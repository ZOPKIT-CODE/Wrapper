import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getIdentityProvider } from '../adapters/kinde-adapter.js';
import {
  isCognitoIssuer, verifyCognitoToken,
  newPkceState, takePkceVerifier, buildCognitoAuthorizeUrl, cognitoIdentityProviderFor,
  exchangeCognitoCode, refreshCognitoTokens, getCognitoLogoutUrl,
} from '../services/cognito-service.js';
import jwt from 'jsonwebtoken';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, applications, organizationApplications } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { shouldLogVerbose } from '../../../utils/verbose-log.js';
import Logger from '../../../utils/logger.js';

// ─── validate-token response cache ────────────────────────────────────────
// The FA backend (and other downstream apps) call POST /validate-token on
// every request. Without a cache, a page load that fires 4 parallel requests
// triggers 4 independent JWKS verifications + 2 DB queries each (≈16 DB
// round-trips for a single page). With a 2-minute TTL cache those collapse
// to 1 round-trip for the same token.
//
// Cache key   = SHA-256(token) truncated to 64 chars — avoids storing raw JWTs.
// Eviction    = TTL expiry (checked on read) + LRU on overflow.
// Capacity    = VALIDATE_TOKEN_CACHE_MAX (default 1000 entries).
import { createHash } from 'crypto';

const VALIDATE_TOKEN_CACHE_TTL_MS  = Number(process.env.VALIDATE_TOKEN_CACHE_TTL_MS  || 15 * 60 * 1000); // 15 min
const VALIDATE_TOKEN_CACHE_MAX     = Number(process.env.VALIDATE_TOKEN_CACHE_MAX      || 1000);

interface ValidateTokenCacheEntry {
  response: Record<string, unknown>;
  expiresAt: number;
  lastAccessedAt: number;
}

const validateTokenCache = new Map<string, ValidateTokenCacheEntry>();

function tokenCacheKey(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex').slice(0, 64);
}

function getValidateTokenCache(rawToken: string): Record<string, unknown> | null {
  const key = tokenCacheKey(rawToken);
  const entry = validateTokenCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    validateTokenCache.delete(key);
    return null;
  }
  entry.lastAccessedAt = Date.now(); // LRU promotion
  return entry.response;
}

function setValidateTokenCache(rawToken: string, response: Record<string, unknown>): void {
  if (validateTokenCache.size >= VALIDATE_TOKEN_CACHE_MAX) {
    // Evict the least-recently-accessed entry
    let lruKey: string | undefined;
    let lruTime = Infinity;
    for (const [k, v] of validateTokenCache) {
      if (v.lastAccessedAt < lruTime) { lruTime = v.lastAccessedAt; lruKey = k; }
    }
    if (lruKey) validateTokenCache.delete(lruKey);
  }
  const now = Date.now();
  validateTokenCache.set(tokenCacheKey(rawToken), {
    response,
    expiresAt: now + VALIDATE_TOKEN_CACHE_TTL_MS,
    lastAccessedAt: now,
  });
}

/** Invalidate a token's cached validate-token response (e.g. after plan change). */
export function invalidateValidateTokenCache(rawToken: string): void {
  validateTokenCache.delete(tokenCacheKey(rawToken));
}
// ──────────────────────────────────────────────────────────────────────────

// ─── Enabled-apps helper ──────────────────────────────────────────────────
// Returns which apps a tenant has active access to, including module+tier info.
// Called inside validate-token so downstream apps can gate on entitlement
// without a separate API call.
async function fetchEnabledApps(tenantId: string): Promise<Array<{
  appCode: string;
  appName: string;
  subscriptionTier: string | null;
  enabledModules: string[];
  expiresAt: string | null;
}>> {
  try {
    const rows = await db
      .select({
        appCode:          applications.appCode,
        appName:          applications.appName,
        subscriptionTier: organizationApplications.subscriptionTier,
        enabledModules:   organizationApplications.enabledModules,
        expiresAt:        organizationApplications.expiresAt,
      })
      .from(organizationApplications)
      .innerJoin(applications, eq(applications.appId, organizationApplications.appId))
      .where(and(
        eq(organizationApplications.tenantId, tenantId),
        eq(organizationApplications.isEnabled, true),
        eq(applications.status, 'active'),
      ));

    return rows
      .filter(r => {
        // Exclude expired entitlements
        if (r.expiresAt && new Date(r.expiresAt) < new Date()) return false;
        return true;
      })
      .map(r => ({
        appCode:          r.appCode,
        appName:          r.appName,
        subscriptionTier: r.subscriptionTier ?? null,
        enabledModules:   Array.isArray(r.enabledModules) ? (r.enabledModules as string[]) : [],
        expiresAt:        r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      }));
  } catch (err: unknown) {
    // Non-fatal: if organization_applications doesn't exist yet (older tenants)
    // return empty array — downstream apps handle entitlement gracefully.
    if (shouldLogVerbose()) Logger.log('warning', 'kinde', 'fetch-enabled-apps', 'fetchEnabledApps failed (non-fatal)', { error: (err as Error).message });
    return [];
  }
}

const SUPPORTED_PROVIDERS = ['google', 'github', 'microsoft', 'apple', 'linkedin'] as const;

function parseStateSafe(state: string | undefined): Record<string, unknown> {
  if (!state) return {};
  try {
    return JSON.parse(state) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildAuthErrorRedirect(
  parsedState: Record<string, unknown>,
  errorCode: string,
  errorDescription: string
): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  if (parsedState.app_code && parsedState.redirect_url) {
    const url = new URL(`${frontendUrl}/auth/callback`);
    url.searchParams.set('state', JSON.stringify({
      app_code: parsedState.app_code,
      redirect_url: parsedState.redirect_url,
      error: errorCode,
      error_description: errorDescription
    }));
    return url.toString();
  }
  const url = new URL(`${frontendUrl}/onboarding`);
  url.searchParams.set('error', errorCode);
  url.searchParams.set('error_description', errorDescription);
  return url.toString();
}

function getAuthCookieOptions() {
  // Apply a cross-subdomain cookie domain ONLY in production. In dev the host is
  // localhost/127.0.0.1, where a `.zopkit.com` Domain makes the browser REJECT the session
  // cookie entirely (host mismatch) — so dev cookies are host-only. The old Kinde dev flow
  // masked this by carrying a client-side Bearer from the SDK; the Cognito flow is cookie-only.
  const isProd = process.env.NODE_ENV === 'production';
  return {
    domain: isProd ? (process.env.COOKIE_DOMAIN || '.zopkit.com') : undefined,
    secure: process.env.COOKIE_SECURE === 'true' || isProd,
    path: '/',
  };
}

// Cognito Hosted-UI redirects back to the BACKEND callback, which does the PKCE code
// exchange + sets the session cookies (backend-mediated flow). The PKCE verifier is stored
// server-side keyed by the OAuth `state` (see cognito-service newPkceState/takePkceVerifier) —
// NOT a cookie, which breaks across localhost<->127.0.0.1 / host boundaries.
function cognitoCallbackUri(): string {
  return `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/callback`;
}

export default async function authRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  const identityProvider = getIdentityProvider();

  /**
   * GET /oauth/login
   * Generic Cognito Hosted-UI OAuth2 entry point for onboarding (no org context).
   * Optional ?provider=google routes straight to that federated IdP (skips the selector).
   * Always redirects Cognito back to the BACKEND callback; any post-login destination is
   * carried in `state` and resolved in /callback.
   */
  fastify.get('/oauth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const { state, provider, prompt, login_hint } = query;

    if (shouldLogVerbose()) Logger.log('info', 'cognito', 'oauth-login', 'OAuth login request', { state, provider });

    try {
      let stateObj: Record<string, unknown> = { flow: 'onboarding' };
      if (state) { try { stateObj = JSON.parse(state); } catch { stateObj = { flow: state }; } }
      const { state: cognitoState, codeChallenge } = await newPkceState(stateObj);
      const authUrl = buildCognitoAuthorizeUrl({
        redirectUri: cognitoCallbackUri(),
        codeChallenge,
        state: cognitoState,
        identityProvider: cognitoIdentityProviderFor(provider),
        prompt,
        loginHint: login_hint,
      });
      return reply.redirect(authUrl);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'cognito', 'oauth-login', 'OAuth login error', { error: error.message });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate OAuth login URL',
      });
    }
  });

  /**
   * GET /oauth/:provider
   * Per-provider convenience routes (google, github, microsoft, apple, linkedin).
   * All route to the same Kinde /oauth2/auth endpoint — the social connection
   * the user sees is controlled by the Kinde dashboard config, not by a
   * query parameter.  A connection_id env var (KINDE_CONNECTION_<PROVIDER>)
   * is forwarded when present so custom sign-in pages can skip the selector.
   */
  fastify.get('/oauth/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as Record<string, string>;
    const { state, redirect_uri, prompt } = query;

    if (!SUPPORTED_PROVIDERS.includes(provider as typeof SUPPORTED_PROVIDERS[number])) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Unsupported provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
      });
    }

    try {
      let stateObj: Record<string, unknown> = { flow: 'onboarding' };
      if (state) { try { stateObj = JSON.parse(state); } catch { stateObj = { flow: state }; } }
      const { state: cognitoState, codeChallenge } = await newPkceState(stateObj);
      const authUrl = buildCognitoAuthorizeUrl({
        redirectUri: cognitoCallbackUri(),
        codeChallenge,
        state: cognitoState,
        identityProvider: cognitoIdentityProviderFor(provider),
        prompt,
      });
      return reply.redirect(authUrl);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'cognito', 'oauth-provider', `${provider} OAuth error`, { provider, error: error.message });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: `Failed to generate ${provider} OAuth URL`,
      });
    }
  });

  /**
   * GET /login/:subdomain
   * Organization-specific login. Uses Kinde's org_code parameter so the
   * user is scoped to the correct organisation during authentication.
   */
  fastify.get('/login/:subdomain', async (request: FastifyRequest, reply: FastifyReply) => {
    const { subdomain } = request.params as { subdomain: string };
    const { prompt } = request.query as Record<string, string>;

    if (!subdomain) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Subdomain parameter is required',
      });
    }

    try {
      // Cognito has no org_code; the subdomain rides in `state` and the tenant is resolved
      // post-login by email (validate-token's no-org path).
      const { state, codeChallenge } = await newPkceState({ subdomain, flow: 'login' });
      const authUrl = buildCognitoAuthorizeUrl({
        redirectUri: cognitoCallbackUri(),
        codeChallenge,
        state,
        prompt,
      });
      return reply.redirect(authUrl);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'cognito', 'org-login', 'Organization login error', { error: error.message });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate organization login URL',
      });
    }
  });

  /**
   * GET /callback
   * OAuth2 callback — handles both onboarding and app (CRM) authentication.
   * Kinde redirects here with ?code=...&state=... after the user authenticates.
   */
  fastify.get('/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const { code, state, error: authError } = query;

    if (shouldLogVerbose()) Logger.log('info', 'kinde', 'oauth-callback', 'OAuth callback received', { hasCode: !!code, state, authError });

    if (authError) {
      Logger.log('error', 'kinde', 'oauth-callback', 'OAuth error in callback', { authError });
      return reply.redirect(buildAuthErrorRedirect(parseStateSafe(state), 'auth_failed', 'Authentication failed'));
    }

    if (!code) {
      Logger.log('error', 'kinde', 'oauth-callback', 'No authorization code received');
      return reply.redirect(buildAuthErrorRedirect(parseStateSafe(state), 'no_code', 'No authorization code provided'));
    }

    try {
      let parsedState: Record<string, unknown> = { flow: 'onboarding' };
      if (state) {
        try {
          parsedState = (typeof state === 'string' ? JSON.parse(state) : state) as Record<string, unknown>;
        } catch {
          if (state === 'onboarding') parsedState = { flow: 'onboarding' };
        }
      }

      const codeVerifier = await takePkceVerifier(state);
      if (!codeVerifier) {
        Logger.log('error', 'cognito', 'oauth-callback', 'PKCE verifier missing/expired for state (login session expired)');
        return reply.redirect(buildAuthErrorRedirect(parseStateSafe(state), 'pkce_missing', 'Login session expired — please try again'));
      }
      const tokens = await exchangeCognitoCode({ code, redirectUri: cognitoCallbackUri(), codeVerifier });

      // Identity comes from the verified Cognito ID token (carries email/sub).
      const userInfo = tokens.id_token ? await verifyCognitoToken(tokens.id_token) : null;
      if (shouldLogVerbose()) Logger.log('info', 'cognito', 'oauth-callback', 'Authenticated user', { id: userInfo?.id, email: userInfo?.email });

      const base = getAuthCookieOptions();
      const cookieOptions = {
        httpOnly: true,
        secure: base.secure,
        sameSite: 'lax' as const,
        domain: base.domain,
        path: base.path,
        maxAge: (Number(tokens.expires_in) || 3600) * 1000,
      };

      // The session cookie holds the Cognito ID TOKEN (the identity assertion the auth
      // middleware + /validate-token verify). Cognito does not rotate refresh tokens on
      // refresh, so the refresh token is stored once here and reused by /refresh.
      reply
        .setCookie('idp_token', (tokens.id_token || tokens.access_token) as string, cookieOptions)
        .setCookie('idp_refresh_token', (tokens.refresh_token as string) || '', {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

      // App authentication flow (CRM redirect)
      if (parsedState.app_code && parsedState.redirect_url) {
        if (shouldLogVerbose()) Logger.log('info', 'kinde', 'oauth-callback', 'App auth flow', { appCode: parsedState.app_code });
        const frontendCallbackUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
        frontendCallbackUrl.searchParams.set('state', JSON.stringify({
          app_code: parsedState.app_code,
          redirect_url: parsedState.redirect_url,
        }));
        return reply.redirect(frontendCallbackUrl.toString());
      }

      // Organization login flow
      if (parsedState.flow === 'login' && parsedState.subdomain) {
        const orgDashboardUrl = `https://${parsedState.subdomain}.${process.env.FRONTEND_DOMAIN || 'localhost:3001'}/dashboard`;
        return reply.redirect(orgDashboardUrl);
      }

      // Default: onboarding flow
      const onboardingUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/onboarding`);
      onboardingUrl.searchParams.set('email', (userInfo?.email as string) ?? '');
      onboardingUrl.searchParams.set('name', `${userInfo?.given_name ?? ''} ${userInfo?.family_name ?? ''}`.trim());
      onboardingUrl.searchParams.set('step', '2');
      return reply.redirect(onboardingUrl.toString());

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'kinde', 'oauth-callback', 'OAuth callback error', { error: error.message });
      return reply.redirect(buildAuthErrorRedirect(parseStateSafe(state), 'callback_failed', error.message || 'Failed to process authentication'));
    }
  });

  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.userContext || !request.userContext.isAuthenticated) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userContext = request.userContext as unknown as Record<string, unknown>;
      return reply.send({
        success: true,
        data: {
          user: userContext,
          organization: userContext.organization,
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'kinde', 'auth-me', 'Error getting user info', { error: error.message });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user information',
      });
    }
  });

  /**
   * POST /logout
   * Clears httpOnly auth cookies and returns the Kinde logout URL.
   * Kinde docs: https://<subdomain>.kinde.com/logout?redirect=<url>
   */
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as Record<string, unknown>) || {};
    const { redirect_uri } = body;

    try {
      const clearOpts = { path: '/', domain: getAuthCookieOptions().domain };
      reply.clearCookie('idp_token', clearOpts).clearCookie('idp_refresh_token', clearOpts);

      const redirectTarget = (redirect_uri as string) || `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`;
      const logoutUrl = getCognitoLogoutUrl(redirectTarget);

      return reply.send({ success: true, data: { logoutUrl, message: 'Logged out successfully' } });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'kinde', 'auth-logout', 'Logout error', { error: error.message });
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to logout' });
    }
  });

  /**
   * POST /refresh
   * Exchange the httpOnly idp_refresh_token cookie for a new access token.
   * Kinde automatically rotates refresh tokens on each exchange.
   */
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const refreshToken = (request.cookies as Record<string, string | undefined>).idp_refresh_token;
      if (!refreshToken) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Refresh token not found' });
      }

      const tokens = await refreshCognitoTokens(refreshToken);

      const base = getAuthCookieOptions();
      const opts = {
        httpOnly: true,
        secure: base.secure,
        sameSite: 'lax' as const,
        domain: base.domain,
        path: base.path,
        maxAge: (Number(tokens.expires_in) || 3600) * 1000,
      };

      reply.setCookie('idp_token', (tokens.id_token || tokens.access_token) as string, opts);
      if (tokens.refresh_token) {
        reply.setCookie('idp_refresh_token', tokens.refresh_token as string, {
          ...opts,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }

      return reply.send({ success: true, data: { message: 'Token refreshed successfully' } });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'kinde', 'auth-refresh', 'Token refresh error', { error: error.message });
      const clearOpts = { path: '/', domain: getAuthCookieOptions().domain };
      reply.clearCookie('idp_token', clearOpts).clearCookie('idp_refresh_token', clearOpts);
      return reply.code(401).send({ error: 'Unauthorized', message: 'Failed to refresh token' });
    }
  });

  /**
   * POST /validate-token
   * Validate a Kinde RS256 JWT (or Operations-issued HS256 JWT) and return
   * user + tenant context. Used by external apps (e.g. Operations backend).
   */
  fastify.post('/validate-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const rawToken = (body?.token as string) || (request.headers.authorization as string | undefined);
      const token = rawToken?.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return reply.code(400).send({
          success: false,
          code: 'TOKEN_MISSING',
          error: 'Missing token',
          message: 'Provide token in body { "token": "..." } or Authorization: Bearer <token>',
        });
      }

      // Normalize and reject obviously invalid JWTs before hitting Kinde APIs.
      // This avoids noisy fallback logs like "Invalid Compact JWS".
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return reply.code(400).send({
          success: false,
          code: 'TOKEN_MALFORMED',
          error: 'Malformed token',
          message: 'Token must be a valid JWT (header.payload.signature)',
        });
      }

      const decoded = jwt.decode(token);
      if (!decoded || typeof decoded !== 'object') {
        return reply.code(400).send({
          success: false,
          code: 'TOKEN_MALFORMED',
          error: 'Malformed token',
          message: 'Unable to decode JWT payload',
        });
      }

      const exp = (decoded as jwt.JwtPayload).exp;
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (typeof exp === 'number' && exp < nowSeconds) {
        return reply.code(401).send({
          success: false,
          code: 'TOKEN_EXPIRED',
          error: 'Token expired',
          message: 'Access token is expired. Re-authenticate to get a new token.',
        });
      }

      // ── Cache check ──────────────────────────────────────────────────────
      // Return cached result immediately — skips JWKS verification + DB queries.
      // This is the primary fix for the "getUserInfo JWKS verified" log appearing
      // 3-4 times per page load (parallel requests from the same client).
      const cachedResponse = getValidateTokenCache(token);
      if (cachedResponse) {
        if (shouldLogVerbose()) request.log.debug('[validate-token] cache HIT');
        return reply.send(cachedResponse);
      }
      if (shouldLogVerbose()) request.log.debug('[validate-token] cache MISS — validating with Kinde');
      // ─────────────────────────────────────────────────────────────────────

      // Try Operations-issued JWT first when shared secret is configured
      const sharedSecret = process.env.OPERATIONS_JWT_SECRET || process.env.SHARED_APP_JWT_SECRET;
      if (sharedSecret) {
        try {
          const decoded = jwt.verify(token, sharedSecret) as { currentTenantId?: string; email?: string };
          if (decoded?.currentTenantId && decoded?.email) {
            let [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, decoded.currentTenantId)).limit(1);
            if (!tenant) {
              [tenant] = await db.select().from(tenants).where(eq(tenants.kindeOrgId, decoded.currentTenantId)).limit(1);
            }
            if (tenant) {
              const [u] = await db.select().from(tenantUsers)
                .where(and(eq(tenantUsers.tenantId, tenant.tenantId), eq(tenantUsers.email, decoded.email)))
                .limit(1);
              if (u) {
                const enabledApps = await fetchEnabledApps(tenant.tenantId);
                const res = {
                  success: true,
                  user: { id: u.userId, email: u.email, firstName: u.firstName ?? undefined, lastName: u.lastName ?? undefined, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '', kindeId: u.kindeUserId },
                  tenant: { id: tenant.tenantId, name: tenant.companyName, kindeOrgId: tenant.kindeOrgId },
                  enabledApps,
                };
                setValidateTokenCache(token, res);
                return reply.send(res);
              }
            }
          }
        } catch (opsErr: unknown) {
          if (shouldLogVerbose()) Logger.log('warning', 'kinde', 'validate-token', 'Operations JWT verification failed, trying Kinde', { error: (opsErr as Error).message });
        }
      }

      // Validate the bearer token. Dual-IdP during the Kinde->Cognito migration: a token
      // from the shared Cognito pool is verified via Cognito JWKS (issuer + signature);
      // otherwise fall back to the Kinde path (JWKS -> API -> introspect). Cognito tokens
      // carry no org_code, so they resolve the tenant by email below (the no-org path).
      let userInfo: Record<string, unknown> | undefined;
      if (isCognitoIssuer((decoded as jwt.JwtPayload).iss)) {
        try {
          const ci = await verifyCognitoToken(token);
          userInfo = ci ? (ci as unknown as Record<string, unknown>) : undefined;
        } catch (cognitoErr: unknown) {
          if (shouldLogVerbose()) Logger.log('warning', 'kinde', 'validate-token', 'Cognito token verification failed', { error: (cognitoErr as Error).message });
          userInfo = undefined;
        }
      } else {
        userInfo = (await identityProvider.getUserInfo(token)) as Record<string, unknown> | undefined;
      }
      const kindeId = (userInfo?.id as string) || (userInfo?.sub as string);
      const orgCode = (userInfo?.org_code as string) || (Array.isArray(userInfo?.org_codes) ? (userInfo?.org_codes as string[])[0] : undefined);

      if (!kindeId) {
        return reply.code(401).send({ success: false, error: 'Invalid token', message: 'Token did not contain a user identifier' });
      }

      const email = (userInfo?.email as string) || (userInfo?.preferred_email as string);

      if (!orgCode) {
        if (!email) {
          return reply.code(403).send({ success: false, error: 'No organization', message: 'Token has no organization context and no email to resolve tenant' });
        }
        const byEmail = await db
          .select({
            tenantId: tenants.tenantId, companyName: tenants.companyName, kindeOrgId: tenants.kindeOrgId,
            userId: tenantUsers.userId, userEmail: tenantUsers.email, firstName: tenantUsers.firstName,
            lastName: tenantUsers.lastName, kindeUserId: tenantUsers.kindeUserId,
          })
          .from(tenantUsers)
          .innerJoin(tenants, eq(tenants.tenantId, tenantUsers.tenantId))
          .where(eq(tenantUsers.email, email))
          .limit(2);

        if (byEmail.length === 0) {
          return reply.code(404).send({ success: false, error: 'User not found', message: `No tenant found for email: ${email}` });
        }
        if (byEmail.length > 1) {
          return reply.code(403).send({ success: false, error: 'No organization', message: 'Token has no organization context; user has multiple tenants' });
        }
        const row = byEmail[0];
        const enabledApps = await fetchEnabledApps(row.tenantId);
        const res = {
          success: true,
          user: { id: row.userId, email: row.userEmail, firstName: row.firstName ?? undefined, lastName: row.lastName ?? undefined, name: [row.firstName, row.lastName].filter(Boolean).join(' '), kindeId: row.kindeUserId },
          tenant: { id: row.tenantId, name: row.companyName, kindeOrgId: row.kindeOrgId },
          enabledApps,
        };
        setValidateTokenCache(token, res);
        return reply.send(res);
      }

      let [tenant] = await db.select().from(tenants).where(eq(tenants.kindeOrgId, orgCode)).limit(1);
      if (!tenant) {
        // Fallback for stale/mismatched org context in token:
        // resolve tenant by kinde user membership when exactly one tenant match exists.
        const byKindeMembership = await db
          .select({
            tenantId: tenants.tenantId,
            companyName: tenants.companyName,
            kindeOrgId: tenants.kindeOrgId,
            userId: tenantUsers.userId,
            userEmail: tenantUsers.email,
            firstName: tenantUsers.firstName,
            lastName: tenantUsers.lastName,
            kindeUserId: tenantUsers.kindeUserId,
          })
          .from(tenantUsers)
          .innerJoin(tenants, eq(tenants.tenantId, tenantUsers.tenantId))
          .where(eq(tenantUsers.kindeUserId, kindeId))
          .limit(2);

        if (byKindeMembership.length === 1) {
          const row = byKindeMembership[0];
          const enabledApps = await fetchEnabledApps(row.tenantId);
          const res = {
            success: true,
            user: {
              id: row.userId,
              email: row.userEmail,
              firstName: row.firstName ?? undefined,
              lastName: row.lastName ?? undefined,
              name: [row.firstName, row.lastName].filter(Boolean).join(' '),
              kindeId: row.kindeUserId,
            },
            tenant: {
              id: row.tenantId,
              name: row.companyName,
              kindeOrgId: row.kindeOrgId,
            },
            enabledApps,
          };
          setValidateTokenCache(token, res);
          return reply.send(res);
        }

        return reply.code(404).send({ success: false, error: 'Tenant not found', message: `No tenant for org_code: ${orgCode}` });
      }

      const [u] = await db.select().from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenant.tenantId), eq(tenantUsers.kindeUserId, kindeId)))
        .limit(1);
      if (!u) {
        return reply.code(404).send({ success: false, error: 'User not found', message: 'User not found in tenant' });
      }

      const enabledApps = await fetchEnabledApps(tenant.tenantId);
      const res = {
        success: true,
        user: { id: u.userId, email: u.email, firstName: u.firstName ?? undefined, lastName: u.lastName ?? undefined, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '', kindeId: u.kindeUserId },
        tenant: { id: tenant.tenantId, name: tenant.companyName, kindeOrgId: tenant.kindeOrgId },
        enabledApps,
      };
      setValidateTokenCache(token, res);
      return reply.send(res);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'kinde', 'validate-token', 'validate-token error', { error: error.message });
      const lowerMessage = (error.message || '').toLowerCase();
      if (lowerMessage.includes('invalid compact jws') || lowerMessage.includes('jwt malformed')) {
        return reply.code(400).send({
          success: false,
          code: 'TOKEN_MALFORMED',
          error: 'Malformed token',
          message: error.message,
        });
      }
      if (lowerMessage.includes('expired')) {
        return reply.code(401).send({
          success: false,
          code: 'TOKEN_EXPIRED',
          error: 'Token expired',
          message: error.message,
        });
      }
      return reply.code(401).send({
        success: false,
        code: 'TOKEN_VALIDATION_FAILED',
        error: 'Validation failed',
        message: error.message,
      });
    }
  });

  /**
   * GET /providers
   * Returns the list of social providers enabled for sign-in.
   * The URLs point to the parameterized /oauth/:provider route.
   */
  fastify.get('/providers', async (_request: FastifyRequest, reply: FastifyReply) => {
    const providers = SUPPORTED_PROVIDERS.map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      icon: id,
      url: `/api/auth/oauth/${id}`,
      description: `Sign in with ${id.charAt(0).toUpperCase() + id.slice(1)}`,
      ...(id === 'google' && { primary: true }),
    }));
    return reply.send({ success: true, data: { providers } });
  });
}
