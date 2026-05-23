import jwt from 'jsonwebtoken';
import { kindeService } from '../../features/auth/index.js';
import { db, dbManager } from '../../db/index.js';
import { reserveTenantConnection } from '../../db/request-connection.js';
import { enterRequestDbScope } from '../../db/request-context.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments } from '../../db/schema/index.js';
import * as schema from '../../db/schema/index.js';
import { drizzle as drizzleWrap } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { RequestAnalyzer } from './request-analyzer.js';
import { shouldLogVerbose } from '../../utils/verbose-log.js';
import { getUserPermissions, checkPermissions } from './permission-middleware.js';
import { SharedCache } from '../../utils/shared-cache.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { OnboardingStatus } from '../../types/common.js';
import Logger from '../../utils/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

// Public routes that do NOT require authentication.
// SECURITY: Keep this list minimal. Use exact paths; avoid broad prefixes.
const PUBLIC_ROUTES: string[] = [
  '/health',
  '/.well-known/jwks.json',
  '/api/auth/callback',
  '/api/auth/oauth/',
  '/api/auth/providers',
  '/api/auth/logout',
  '/api/auth/validate-token',
  '/api/auth/login/',
  '/api/version',
  '/api/plans',
  '/api/webhooks',
  '/api/subscriptions/webhook',
  '/api/payments/webhook',
  '/api/credits/webhook',
  '/api/invitations/details',
  '/api/invitations/accept',
  '/api/invitations/details-by-token',
  '/api/credits/packages',
  '/api/onboarding/verify-pan',
  '/api/onboarding/verify-gstin',
  '/api/onboarding/check-subdomain',
  '/api/onboarding/onboard-frontend',
  '/api/onboarding/status',
  'POST /api/onboarding/get-data',
  '/api/contact',
  '/api/demo',
  '/api/email-preview',
  '/docs',
];

interface UserRecord {
  userId: string;
  tenantId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  onboardingCompleted: boolean | null;
  isActive: boolean | null;
  isTenantAdmin: boolean | null;
  preferences?: Record<string, unknown>;
  invitedBy?: string | null;
  invitedAt?: string | null;
  kindeUserId?: string;
}

interface KindeUser {
  userId: string;
  email?: string;
  name?: string;
  organization?: { id: string; name?: string } | null;
}

async function findUserInDatabase(kindeUserId: string, tenantId?: string): Promise<UserRecord | null> {
  // Cache key includes tenantId so multi-tenant users get correct records per tenant.
  const cacheKey = tenantId ? `${kindeUserId}:${tenantId}` : kindeUserId;

  // Check shared cache first — eliminates a DB round-trip on every request
  // for the same user within the 5-minute TTL window.
  const cached = await userRecordCache.get(cacheKey);
  if (cached !== undefined) {
    if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-user-in-database', '🔍 User cache HIT', { cacheKey });
    // Verify tenant still exists — uses tenantExistsCache (30-min TTL) to avoid
    // a live DB round-trip on every request. Accepts ≤30min stale window for deletions.
    if (cached.v?.tenantId && !(await isTenantValid(cached.v.tenantId))) {
      await userRecordCache.delete(cacheKey);
      await userRecordCache.set(cacheKey, { v: null }, USER_RECORD_CACHE_TTL_MS);
      if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-user-in-database', '🔍 User cache invalidated: tenant no longer exists');
      return null;
    }
    return cached.v;
  }

  try {
    if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-user-in-database', '🔍 Looking up user', { cacheKey });

    const whereClause = tenantId
      ? and(eq(tenantUsers.kindeUserId, kindeUserId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true))
      : and(eq(tenantUsers.kindeUserId, kindeUserId), eq(tenantUsers.isActive, true));

    const userRecords = await db
      .select({
        userId: tenantUsers.userId,
        tenantId: tenantUsers.tenantId,
        email: tenantUsers.email,
        firstName: tenantUsers.firstName,
        lastName: tenantUsers.lastName,
        onboardingCompleted: tenantUsers.onboardingCompleted,
        isActive: tenantUsers.isActive,
        isTenantAdmin: tenantUsers.isTenantAdmin
      })
      .from(tenantUsers)
      .where(whereClause) as UserRecord[];

    if (!Array.isArray(userRecords) || userRecords.length === 0) {
      if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-user-in-database', '⚠️ No user records found (expected during onboarding)');
      await userRecordCache.set(cacheKey, { v: null }, USER_RECORD_CACHE_TTL_MS);
      return null;
    }

    const selectedUser = userRecords.find(u => u.onboardingCompleted) || userRecords[0];
    if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-user-in-database', 'Auth: user found', { userId: selectedUser.userId });
    await userRecordCache.set(cacheKey, { v: selectedUser }, USER_RECORD_CACHE_TTL_MS);
    return selectedUser;

  } catch (error: unknown) {
    const err = error as Error;
    Logger.log('error', 'auth', 'find-user-in-database', '❌ Database query error', { error: err.message });
    return null;
  }
}

// ── User record cache ─────────────────────────────────────────────────────
// findUserInDatabase() runs on every authenticated request and is the single
// most expensive repeated DB call. Cache by kindeUserId with a 5-minute TTL.
// Invalidate via invalidateUserCache() whenever onboarding/isActive changes.
// Backed by SharedCache (async, Redis-ready); falls back to in-process Map.
const USER_RECORD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Value is wrapped in an object so that null (user-not-found sentinel) can be
// distinguished from undefined (cache miss).
const userRecordCache = new SharedCache<{ v: UserRecord | null }>('auth:user');

export async function invalidateUserCache(kindeUserId: string, tenantId?: string): Promise<void> {
  await userRecordCache.delete(kindeUserId); // bare key (legacy)
  if (tenantId) {
    await userRecordCache.delete(`${kindeUserId}:${tenantId}`);
  } else {
    // Delete all tenant-specific keys for this user (in-process key scan).
    const toDelete: string[] = [];
    for (const key of userRecordCache.keys()) {
      if (key.startsWith(`${kindeUserId}:`)) toDelete.push(key);
    }
    await Promise.all(toDelete.map(k => userRecordCache.delete(k)));
  }
}
// ─────────────────────────────────────────────────────────────────────────

// ── Super-admin role cache ────────────────────────────────────────────────
// The role JOIN query runs on every authenticated request for non-null users.
// Cache by internalUserId with a 5-minute TTL.
// Invalidate via invalidateRoleCache() whenever roles are reassigned.
// Backed by SharedCache (async, Redis-ready); falls back to in-process Map.
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const roleCacheByUserId = new SharedCache<{ isSuperAdmin: boolean }>('auth:role');

export async function invalidateRoleCache(internalUserId: string): Promise<void> {
  await roleCacheByUserId.delete(internalUserId);
}

/**
 * Bust the tenant-lookup cache for a given Kinde org code.
 * Call this immediately after onboarding creates a new tenant so the next
 * auth middleware run hits the DB and finds the new tenant, rather than
 * returning the cached null from before onboarding completed.
 */
export async function invalidateTenantLookupCache(orgCode: string): Promise<void> {
  await tenantLookupCache.delete(orgCode);
}
// ─────────────────────────────────────────────────────────────────────────

// ── Tenant-exists cache ───────────────────────────────────────────────────
// Verifying tenant existence is done on every cache HIT in findUserInDatabase
// and findTenantByOrgCode. Since tenantIds are immutable once created, we cache
// existence checks for 30 minutes to avoid a DB round-trip on every request.
// Worst case: a deleted tenant's cache entry persists for up to 30 minutes.
// Backed by SharedCache (async, Redis-ready); falls back to in-process Map.
const TENANT_EXISTS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const tenantExistsCache = new SharedCache<true>('auth:tenant-exists');

async function isTenantValid(tenantId: string): Promise<boolean> {
  const hit = await tenantExistsCache.get(tenantId);
  if (hit !== undefined) return true; // cache hit — no DB round-trip
  try {
    const [row] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);
    if (row) {
      await tenantExistsCache.set(tenantId, true, TENANT_EXISTS_CACHE_TTL_MS);
      return true;
    }
    return false;
  } catch {
    return true; // fail open — don't invalidate on transient DB errors
  }
}
// ─────────────────────────────────────────────────────────────────────────

// Short-lived cache for org-code → tenantId lookups.
// Caches both hits (tenantId string) and misses (null sentinel) to prevent
// a DB round-trip on every authenticated request for the same org code.
// TTL is intentionally short (2 min) so new tenants propagate quickly.
// Backed by SharedCache (async, Redis-ready); falls back to in-process Map.
const TENANT_LOOKUP_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
// Value is wrapped so null (miss sentinel) is distinguishable from undefined (not cached).
const tenantLookupCache = new SharedCache<{ v: string | null }>('auth:tenant-lookup');

async function findTenantByOrgCode(orgCode: string): Promise<string | null> {
  if (!orgCode) return null;

  // Check shared cache (hits AND misses).
  const cached = await tenantLookupCache.get(orgCode);
  if (cached !== undefined) {
    // Verify tenant still exists — uses tenantExistsCache (30-min TTL).
    if (cached.v && !(await isTenantValid(cached.v))) {
      await tenantLookupCache.delete(orgCode);
      await tenantLookupCache.set(orgCode, { v: null }, TENANT_LOOKUP_CACHE_TTL_MS);
      if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-tenant-by-org-code', '🔍 Tenant lookup cache invalidated: tenant no longer exists');
      return null;
    }
    return cached.v; // null means "not found" — also cached to avoid repeated DB hits
  }

  try {
    if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-tenant-by-org-code', '🔍 Looking up tenant', { orgCode });

    const [tenant] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.kindeOrgId, orgCode))
      .limit(1);

    const result = tenant?.tenantId ?? null;
    // Cache the result (hit or miss).
    await tenantLookupCache.set(orgCode, { v: result }, TENANT_LOOKUP_CACHE_TTL_MS);

    if (result) {
      if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-tenant-by-org-code', '✅ Found tenant', { result });
    } else {
      // Expected during onboarding (no tenant record yet) — verbose-only to avoid noise.
      if (shouldLogVerbose()) Logger.log('info', 'auth', 'find-tenant-by-org-code', `⚠️ No tenant found for org code: ${orgCode}`);
    }
    return result;
  } catch (error: unknown) {
    const err = error as Error;
    Logger.log('error', 'auth', 'find-tenant-by-org-code', '❌ Tenant lookup error', { error: err.message });
    return null;
  }
}

function determineOnboardingStatus(userRecord: UserRecord | null, tenantId: string | null): OnboardingStatus {
  if (!tenantId || !userRecord) {
    return { needsOnboarding: true, reason: 'no_tenant_or_user_record' };
  }

  const isTenantAdmin = userRecord.isTenantAdmin === true;
  const onboardingCompleted = userRecord.onboardingCompleted === true;
  
  const isInvitedUser = onboardingCompleted === true && (
    (userRecord.preferences as any)?.userType === 'INVITED_USER' ||
    (userRecord.preferences as any)?.isInvitedUser === true ||
    userRecord.invitedBy !== null ||
    userRecord.invitedAt !== null
  );

  if (isInvitedUser) {
    return { needsOnboarding: false, reason: 'invited_user_skips_onboarding' };
  }

  if (isTenantAdmin && !onboardingCompleted) {
    return { needsOnboarding: true, reason: 'tenant_admin_incomplete_onboarding' };
  }

  if (!onboardingCompleted) {
    return { needsOnboarding: true, reason: 'non_admin_incomplete_onboarding' };
  }

  return { needsOnboarding: false, reason: 'fully_onboarded' };
}

export async function setupDatabaseConnection(request: FastifyRequest, tenantId: string | null = null, userId: string | null = null): Promise<void> {
  const analysis = RequestAnalyzer.analyzeRequest(request);
  request.requestAnalysis = analysis;

  // Bypass requests (system/admin/onboarding) and unauthenticated requests use
  // the shared pool directly. RLS does not apply here, so there's nothing to
  // bind to a specific connection and we avoid the cost of a reservation.
  if (analysis.requiresBypass || !tenantId) {
    try {
      request.db = analysis.requiresBypass
        ? dbManager.getSystemConnection()
        : dbManager.getAppConnection();
    } catch (dbError: unknown) {
      const err = dbError as Error;
      Logger.log('error', 'auth', 'setup-database-connection', '❌ Failed to establish database connection', { error: err.message });
      request.db = null;
    }
    return;
  }

  // Tenant-scoped path: reserve a connection from the app pool, set the GUCs
  // on it, and stash both the reserved Sql and its release callback on the
  // request. Fastify onResponse + onError hooks (registered in
  // app-routes.ts) MUST invoke `_dbRelease` to return the connection to the
  // pool. Missing either hook causes a slow connection leak.
  //
  // GUC ↔ query binding guarantee:
  //   `reserveTenantConnection` calls `appPool.reserve()` which pins one
  //   physical connection until release(). The set_config call runs on that
  //   pinned connection, and any subsequent query made on `request.db`
  //   (the same reserved handle) is therefore guaranteed to execute against
  //   the connection whose GUCs were just set. This closes the hole where
  //   the previous shared-pool implementation would land set_config and the
  //   query on different connections.
  try {
    const pool = dbManager.getAppConnection();
    const { sql: reserved, release } = await reserveTenantConnection(pool, tenantId, userId);
    request.db = reserved;
    request._dbRelease = release;

    // Publish the reserved Drizzle in AsyncLocalStorage so the default `db`
    // import (a Proxy in db/index.ts) routes queries onto the pinned
    // connection. enterWith binds for the remainder of this async context,
    // which Fastify's hook chain inherits — preHandler, handler, and
    // onResponse all observe the same store.
    const reservedDrizzle = drizzleWrap(reserved, { schema });
    enterRequestDbScope(reservedDrizzle);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Failed to reserve tenant DB connection:', err.message);
    // Fall back to the shared pool so the request can still proceed. Without
    // a reservation the GUCs cannot be reliably bound to subsequent queries,
    // but this is strictly better than 500'ing every request if the pool is
    // momentarily exhausted. RLS won't enforce for this request — same as
    // the pre-fix behaviour.
    try {
      request.db = dbManager.getAppConnection();
    } catch {
      request.db = null;
    }
  }
}

/**
 * Release any per-request DB reservation taken by setupDatabaseConnection.
 * Idempotent — safe to call from both onResponse and onError hooks (Fastify
 * may invoke them in sequence on a failed request).
 */
export async function releaseRequestDbConnection(request: FastifyRequest): Promise<void> {
  const release = request._dbRelease;
  if (!release) return;
  // Clear first so a second invocation is a no-op even if release() throws.
  request._dbRelease = undefined;
  try {
    await release();
  } catch (err: unknown) {
    // Releasing should not fail in practice; if it does, log and move on
    // rather than propagating into Fastify's error path.
    console.error('❌ Failed to release request DB connection:', (err as Error).message);
  }
}

async function handleTokenRefresh(request: FastifyRequest, reply: FastifyReply, refreshToken: string): Promise<boolean> {
  try {
    const tokens = await kindeService.refreshToken(refreshToken);

    const accessToken = tokens.access_token as string;
    const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 3600;
    reply.setCookie('kinde_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/'
    });

    const refreshTokenVal = tokens.refresh_token as string | undefined;
    if (refreshTokenVal) {
      reply.setCookie('kinde_refresh_token', refreshTokenVal, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/'
      });
    }

    const kindeUser = await kindeService.validateToken(accessToken) as unknown as KindeUser | null;
    if (!kindeUser?.userId) {
      throw new Error('Invalid refreshed token');
    }

    await processAuthenticatedUser(request, reply, kindeUser);
    return true;

  } catch (refreshError: unknown) {
    const err = refreshError as Error;
    if (err.message.includes('invalid_grant')) {
      reply.code(401).send({
        error: 'Token Expired',
        message: 'Your session has expired. Please sign in again.',
        requiresReauth: true
      });
      return false;
    }

    reply.clearCookie('kinde_token', { path: '/' })
         .clearCookie('kinde_refresh_token', { path: '/' });
    return false;
  }
}

async function processAuthenticatedUser(request: FastifyRequest, reply: FastifyReply, kindeUser: KindeUser): Promise<void> {
  // Resolve tenantId first so findUserInDatabase can use it as part of the cache key.
  // This ensures multi-tenant users always get the correct record for their active org.
  let tenantId: string | null = null;
  if (kindeUser.organization?.id) {
    tenantId = await findTenantByOrgCode(kindeUser.organization.id);
  }

  // Look up the user scoped to the resolved tenant (cache key: kindeUserId:tenantId).
  const userRecord = await findUserInDatabase(kindeUser.userId, tenantId ?? undefined);

  // Fallback: if tenantId couldn't be resolved from the org, derive it from the DB record.
  if (!tenantId && userRecord?.tenantId) {
    tenantId = userRecord.tenantId;
  }

  // effectiveUserRecord is the correct tenant-scoped record (findUserInDatabase already
  // filters by tenantId when provided, so no mismatch check needed).
  const effectiveUserRecord = userRecord;

  const { needsOnboarding } = determineOnboardingStatus(effectiveUserRecord, tenantId);

  let isSuperAdmin = false;
  if (effectiveUserRecord?.userId && tenantId) {
    // Check role cache first — eliminates a DB round-trip on every request
    // for the same user within the 5-minute TTL window.
    const cachedRole = await roleCacheByUserId.get(effectiveUserRecord.userId);
    if (cachedRole !== undefined) {
      isSuperAdmin = cachedRole.isSuperAdmin;
    } else {
      try {
        const userRoles = await db
          .select({
            roleName: customRoles.roleName,
            isSystemRole: customRoles.isSystemRole,
            organizationId: userRoleAssignments.organizationId
          })
          .from(userRoleAssignments)
          .innerJoin(customRoles, and(eq(userRoleAssignments.roleId, customRoles.roleId), eq(customRoles.tenantId, tenantId)))
          .where(eq(userRoleAssignments.userId, effectiveUserRecord.userId));

        isSuperAdmin = userRoles.some(role => role.roleName === 'Super Administrator' && role.isSystemRole);
        await roleCacheByUserId.set(effectiveUserRecord.userId, { isSuperAdmin }, ROLE_CACHE_TTL_MS);
      } catch (error) {
        Logger.log('warning', 'auth', 'process-authenticated-user', '⚠️ Failed to check super admin status', { error });
      }
    }
  }

  const isTenantAdmin = effectiveUserRecord?.isTenantAdmin || false;
  request.userContext = {
    userId: kindeUser.userId,
    kindeUserId: kindeUser.userId,
    internalUserId: effectiveUserRecord?.userId || null,
    tenantId,
    kindeOrgId: kindeUser.organization?.id,
    email: effectiveUserRecord?.email || kindeUser.email || '',
    name: [effectiveUserRecord?.firstName, effectiveUserRecord?.lastName].filter(Boolean).join(' ') || kindeUser.name || '',
    isAuthenticated: true,
    needsOnboarding,
    onboardingCompleted: effectiveUserRecord?.onboardingCompleted || false,
    isActive: effectiveUserRecord?.isActive || false,
    isAdmin: isTenantAdmin,
    isTenantAdmin,
    isSuperAdmin
  };

  request.user = {
    id: kindeUser.userId,
    userId: kindeUser.userId,
    internalUserId: userRecord?.userId || null,
    tenantId,
    email: request.userContext.email,
    name: request.userContext.name,
    isAuthenticated: true,
    isAdmin: isTenantAdmin,
    isTenantAdmin
  };

  await setupDatabaseConnection(request, tenantId, request.userContext.internalUserId);

  if (shouldLogVerbose()) {
    Logger.log('info', 'auth', 'process-authenticated-user', '✅ User authenticated', {
      userId: kindeUser.userId,
      tenantId,
      needsOnboarding
    });
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip if already authenticated by an earlier preHandler in the same request lifecycle.
  // Routes that have both a global hook preHandler AND a per-route preHandler would otherwise
  // run full Kinde token validation + DB queries twice (400-800ms duplicate cost).
  if (request.userContext?.tenantId) return;

  // CORS preflight has no auth headers; never 401 here or the browser blocks the real request.
  if (request.method.toUpperCase() === 'OPTIONS') {
    return;
  }

  if (isPublicRoute(request.url)) {
    await setupDatabaseConnection(request);
    return;
  }

  const token = extractToken(request);
  if (!token) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication token required'
    });
    return;
  }

  try {
    if (shouldLogVerbose()) Logger.log('info', 'auth', 'auth-middleware', '🔐 Authenticating user...');

    const sharedSecret = process.env.OPERATIONS_JWT_SECRET || process.env.SHARED_APP_JWT_SECRET;
    if (sharedSecret) {
      try {
        const decoded = jwt.verify(token, sharedSecret) as Record<string, any>;
        if (decoded?.currentTenantId && decoded?.email) {
          let [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, decoded.currentTenantId)).limit(1);
          if (!tenant) {
            [tenant] = await db.select().from(tenants).where(eq(tenants.kindeOrgId, decoded.currentTenantId)).limit(1);
          }
          if (tenant) {
            const [u] = await db.select().from(tenantUsers).where(and(eq(tenantUsers.tenantId, tenant.tenantId), eq(tenantUsers.email, decoded.email))).limit(1);
            if (u) {
              const uName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '';
              request.userContext = {
                userId: u.kindeUserId || u.userId,
                kindeUserId: u.kindeUserId || u.userId,
                internalUserId: u.userId,
                tenantId: tenant.tenantId,
                kindeOrgId: tenant.kindeOrgId,
                email: u.email,
                name: uName,
                isAuthenticated: true,
                needsOnboarding: !u.onboardingCompleted,
                onboardingCompleted: u.onboardingCompleted || false,
                isActive: u.isActive ?? true,
                isAdmin: u.isTenantAdmin || false,
                isTenantAdmin: u.isTenantAdmin || false,
                isSuperAdmin: false,
              };
              request.user = {
                id: request.userContext.userId,
                userId: request.userContext.userId,
                internalUserId: u.userId,
                tenantId: tenant.tenantId,
                email: u.email,
                name: uName,
                isAuthenticated: true,
                isAdmin: request.userContext.isAdmin,
                isTenantAdmin: request.userContext.isTenantAdmin,
              };
              await setupDatabaseConnection(request, tenant.tenantId, u.userId);
              if (shouldLogVerbose()) Logger.log('info', 'auth', 'auth-middleware', '✅ Authentication successful (Operations JWT)');
              return;
            }
          }
        }
      } catch (opsErr: unknown) {
        if (shouldLogVerbose()) Logger.log('info', 'auth', 'auth-middleware', '⚠️ Operations JWT verification failed, falling through to Kinde', { error: (opsErr as Error).message });
      }
    }

    const authPromise = kindeService.validateToken(token);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Authentication timeout')), 10000)
    );

    const kindeUser = await Promise.race([authPromise, timeoutPromise]) as unknown as KindeUser | null;
    
    if (!kindeUser?.userId) {
      throw new Error('Invalid token response');
    }

    await processAuthenticatedUser(request, reply, kindeUser);
    if (shouldLogVerbose()) Logger.log('info', 'auth', 'auth-middleware', '✅ Authentication successful');

  } catch (error: unknown) {
    const err = error as Error;
    Logger.log('error', 'auth', 'auth-middleware', '❌ Authentication failed', { error: err.message });

    if (err.message === 'Authentication timeout') {
      reply.code(408).send({
        error: 'Request Timeout',
        message: 'Authentication request timed out. Please try again.',
        retryable: true
      });
      return;
    }

    const refreshToken = (request as any).cookies?.kinde_refresh_token;
    if (refreshToken) {
      try {
        const refreshSuccess = await handleTokenRefresh(request, reply, refreshToken);
        if (refreshSuccess) return;
      } catch (refreshError: unknown) {
        const refErr = refreshError as Error;
        Logger.log('error', 'auth', 'auth-middleware', '❌ Token refresh failed', { error: refErr.message });
      }
    }

    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token',
      retryable: true
    });
  }
}

export const authenticateToken = authMiddleware;

/**
 * CSRF Origin verification middleware.
 * For state-changing requests (POST/PUT/DELETE/PATCH), verifies that the
 * Origin or Referer header matches an allowed origin. This prevents cross-site
 * form submissions and other CSRF vectors.
 * Webhook endpoints are excluded since they come from external services.
 */
export async function csrfProtection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const method = request.method.toUpperCase();

  // Only check state-changing methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  // Skip for webhook endpoints (external services)
  const url = request.url;
  if (url.includes('/webhook')) return;

  // Skip if request has Authorization header with Bearer token (SPA API call pattern acts as CSRF protection)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return;

  // For cookie-only authenticated requests, verify origin
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  const checkValue = origin || (referer ? new URL(referer).origin : null);

  if (!checkValue) {
    // No origin info — block in production for cookie-authenticated state-changing requests
    if (isProduction) {
      reply.code(403).send({ error: 'Forbidden', message: 'Origin header required for this request' });
      return;
    }
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || '';
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  const isAllowed = allowedOrigins.some(allowed => checkValue === allowed) ||
    /^https?:\/\/[a-z0-9-]+\.zopkit\.com$/i.test(checkValue) ||
    /^https?:\/\/zopkit\.com$/i.test(checkValue);

  if (!isAllowed) {
    reply.code(403).send({ error: 'Forbidden', message: 'Cross-origin request blocked' });
    return;
  }
}

export function requirePermission(permission: string | string[]) {
  return async function(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.userContext?.isAuthenticated) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    if (request.userContext.isAdmin || request.userContext.isTenantAdmin) {
      return;
    }

    if (!request.userContext.internalUserId || !request.userContext.tenantId) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'User context incomplete for permission check'
      });
      return;
    }

    try {
      if (!request.userContext.permissions) {
        request.userContext.permissions = await getUserPermissions(
          request.userContext.internalUserId,
          request.userContext.tenantId
        );
      }

      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      const hasPermission = checkPermissions(request.userContext.permissions, requiredPermissions);

      if (!hasPermission) {
        reply.code(403).send({
          error: 'Insufficient permissions',
          message: `Required permission: ${requiredPermissions.join(', ')}`,
          required: requiredPermissions
        });
        return;
      }
    } catch (error) {
      request.log.error(error as Error, 'Permission check failed:');
      reply.code(500).send({ error: 'Permission check failed' });
    }
  };
}

function isPublicRoute(url: string): boolean {
  // Paths ending with /current typically need auth context
  if (url.endsWith('/current')) {
    return false;
  }

  // Strip query string for matching
  const pathOnly = url.split('?')[0];

  return PUBLIC_ROUTES.some(route => {
    // Method-specific route: "POST /api/foo"
    if (route.includes(' ')) {
      const routePath = route.split(' ')[1];
      return pathOnly === routePath || pathOnly.startsWith(routePath + '/');
    }

    // Routes ending with '/' are explicit prefix matches (e.g. '/api/auth/oauth/')
    if (route.endsWith('/')) {
      return pathOnly.startsWith(route) || pathOnly === route.slice(0, -1);
    }

    // Exact match or direct sub-path
    return pathOnly === route || pathOnly.startsWith(route + '/');
  });
}

function extractToken(request: FastifyRequest): string | null {
  const cookieToken = (request as any).cookies?.kinde_token;
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return (request as any).cookies?.token || null;
}
