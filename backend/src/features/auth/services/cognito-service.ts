import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import crypto from 'node:crypto';
import { SharedCache } from '../../../utils/shared-cache.js';

/**
 * AWS Cognito token verification for the shared `zopkit-platform` user pool.
 *
 * Part of the Kinde -> Cognito migration. During the cutover the Wrapper accepts
 * Cognito RS256 tokens ALONGSIDE Kinde (dual-IdP). The Wrapper is the platform's
 * token-validation authority for the whole ecosystem, so a token may be issued by
 * ANY app client in the shared pool (finance-accounting-web, wrapper-web, ...). We
 * therefore verify ISSUER + SIGNATURE only (proves the token came from our pool) and
 * do NOT restrict to a single client_id — exactly how the Kinde JWKS path worked.
 *
 * Cognito issues no `org_code` claim, so the /validate-token route resolves the tenant
 * by email (the existing no-org code path) — the same "membership by email/sub" model
 * finance-accounting uses.
 */

interface CognitoConfig {
  issuer: string;
  jwksUri: string;
}

function cognitoConfig(): CognitoConfig | null {
  const region = (process.env.COGNITO_REGION || '').trim();
  const poolId = (process.env.COGNITO_USER_POOL_ID || '').trim();
  if (!region || !poolId) return null;
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  return { issuer, jwksUri: `${issuer}/.well-known/jwks.json` };
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUri: string | null = null;
function cognitoJwks(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
  if (!cachedJwks || cachedJwksUri !== jwksUri) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUri));
    cachedJwksUri = jwksUri;
  }
  return cachedJwks;
}

/** True if the token's `iss` is our Cognito pool — used to route dual-IdP verification. */
export function isCognitoIssuer(iss: string | undefined | null): boolean {
  const cfg = cognitoConfig();
  return !!iss && !!cfg && iss === cfg.issuer;
}

/** True when Cognito is configured at all (COGNITO_REGION + COGNITO_USER_POOL_ID set). */
export function isCognitoConfigured(): boolean {
  return cognitoConfig() !== null;
}

/**
 * `getUserInfo`-compatible shape (mirrors what kindeService.getUserInfo returns) so the
 * /validate-token route can consume Cognito and Kinde results through one code path.
 * `id`/`sub` carry the Cognito subject; there is intentionally no `org_code`.
 */
export interface CognitoUserInfo {
  id: string;
  sub: string;
  email?: string;
  preferred_email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  token_use?: string;
}

/**
 * Verify a Cognito RS256 token (ID or access) by issuer + signature against the pool JWKS.
 * Returns a userInfo-shaped object, or null if Cognito isn't configured / no subject.
 * Throws (caught by the caller -> 401) on signature/issuer/expiry failure.
 */
export async function verifyCognitoToken(token: string): Promise<CognitoUserInfo | null> {
  const cfg = cognitoConfig();
  if (!cfg) return null;
  const { payload } = await jwtVerify(token, cognitoJwks(cfg.jwksUri), { issuer: cfg.issuer });
  const p = payload as JWTPayload & {
    email?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    token_use?: string;
    'cognito:username'?: string;
  };
  const sub = typeof p.sub === 'string' ? p.sub : '';
  if (!sub) return null;
  const email = typeof p.email === 'string' ? p.email : undefined;
  return {
    id: sub,
    sub,
    email,
    preferred_email: email,
    given_name: p.given_name,
    family_name: p.family_name,
    name: p.name ?? ([p.given_name, p.family_name].filter(Boolean).join(' ') || undefined),
    token_use: p.token_use,
  };
}

// ─── Cognito Hosted-UI OAuth (backend-mediated, PKCE — public client, no secret) ───────
//
// The Wrapper keeps its secure backend-mediated flow (code exchange + httpOnly cookies). The
// shared `wrapper-web` Cognito client is PUBLIC, so the authorization_code grant uses PKCE:
// /oauth/login generates a verifier (stored in a short-lived httpOnly cookie), redirects to
// Cognito's /oauth2/authorize with the challenge; /callback exchanges code + verifier at
// /oauth2/token. Mirrors the FA SPA PKCE client, server-side.

function cognitoOAuthConfig(): { domain: string; clientId: string } | null {
  const domain = (process.env.COGNITO_DOMAIN || '').trim().replace(/\/+$/, '');
  const clientId = (process.env.COGNITO_CLIENT_ID || '').trim();
  if (!domain || !clientId) return null;
  return { domain, clientId };
}

export function isCognitoOAuthConfigured(): boolean {
  return cognitoOAuthConfig() !== null;
}

/** Generate a PKCE (verifier, S256 challenge) pair. */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// PKCE verifier store, keyed by an opaque nonce embedded in the OAuth `state`. The state
// round-trips through Cognito (set at /oauth/login, returned at /callback), so the verifier
// survives regardless of host — unlike a cookie, which breaks across localhost<->127.0.0.1 or
// when /oauth/login (via the frontend) and /callback (the backend redirect_uri) differ in host.
// SharedCache is Redis-ready (shared across instances) and falls back to in-process.
const pkceCache = new SharedCache<string>('auth:pkce');
const PKCE_TTL_MS = 10 * 60 * 1000;

/**
 * Build an OAuth `state` carrying flow info + a PKCE nonce, and stash the verifier server-side.
 * Returns the `state` to send to Cognito and the `codeChallenge` for the authorize URL.
 */
export async function newPkceState(flowInfo?: Record<string, unknown>): Promise<{ state: string; codeChallenge: string }> {
  const { verifier, challenge } = generatePkce();
  const key = crypto.randomBytes(16).toString('base64url');
  await pkceCache.set(key, verifier, PKCE_TTL_MS);
  const state = JSON.stringify({ ...(flowInfo || {}), pk: key });
  return { state, codeChallenge: challenge };
}

/** Look up + consume (one-time) the PKCE verifier for a returned `state`. */
export async function takePkceVerifier(state: string | undefined | null): Promise<string | null> {
  if (!state) return null;
  let key: string | undefined;
  try {
    const parsed = JSON.parse(state) as { pk?: string };
    key = parsed?.pk;
  } catch {
    return null;
  }
  if (!key) return null;
  const verifier = await pkceCache.get(key);
  if (verifier !== undefined && verifier !== null) {
    await pkceCache.delete(key);
    return verifier;
  }
  return null;
}

/** Cognito provider name for a social-login slug (only Google is wired in the pool today). */
export function cognitoIdentityProviderFor(slug?: string): string | undefined {
  if (!slug) return undefined;
  const map: Record<string, string> = { google: 'Google' };
  return map[slug.toLowerCase()];
}

export function buildCognitoAuthorizeUrl(opts: {
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  identityProvider?: string;
  prompt?: string;
  loginHint?: string;
}): string {
  const cfg = cognitoOAuthConfig();
  if (!cfg) throw new Error('Cognito OAuth not configured (COGNITO_DOMAIN / COGNITO_CLIENT_ID)');
  const u = new URL(`${cfg.domain}/oauth2/authorize`);
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('code_challenge', opts.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  if (opts.state) u.searchParams.set('state', opts.state);
  if (opts.identityProvider) u.searchParams.set('identity_provider', opts.identityProvider);
  if (opts.loginHint) u.searchParams.set('login_hint', opts.loginHint);
  if (opts.prompt === 'login' || opts.prompt === 'none') u.searchParams.set('prompt', opts.prompt);
  return u.toString();
}

export interface CognitoTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export async function exchangeCognitoCode(opts: { code: string; redirectUri: string; codeVerifier: string }): Promise<CognitoTokens> {
  const cfg = cognitoOAuthConfig();
  if (!cfg) throw new Error('Cognito OAuth not configured');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(`${cfg.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Cognito token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as CognitoTokens;
}

export async function refreshCognitoTokens(refreshToken: string): Promise<CognitoTokens> {
  const cfg = cognitoOAuthConfig();
  if (!cfg) throw new Error('Cognito OAuth not configured');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: cfg.clientId,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${cfg.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Cognito refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as CognitoTokens;
}

/** Cognito Hosted-UI logout URL (clears the Cognito session, then redirects back). */
export function getCognitoLogoutUrl(logoutRedirectUri: string): string {
  const cfg = cognitoOAuthConfig();
  if (!cfg) return logoutRedirectUri;
  const u = new URL(`${cfg.domain}/logout`);
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('logout_uri', logoutRedirectUri);
  return u.toString();
}
