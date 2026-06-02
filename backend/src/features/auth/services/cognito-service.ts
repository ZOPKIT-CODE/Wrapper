import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

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
