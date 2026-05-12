import jwt from 'jsonwebtoken';
import { kindeService } from '../../features/auth/index.js';
import { db, dbManager } from '../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { RequestAnalyzer } from './request-analyzer.js';
import { shouldLogVerbose } from '../../utils/verbose-log.js';
import { getUserPermissions, checkPermissions } from './permission-middleware.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { OnboardingStatus } from '../../types/common.js';

const isProduction = process.env.NODE_ENV === 'production';

// Public routes that do NOT require authentication.
// SECURITY: Keep this list minimal. Use exact paths; avoid broad prefixes.
const PUBLIC_ROUTES: string[] = [
  '/health',
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
  '/api/invitations/accept-by-token',
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

  // Check in-process cache first — eliminates a DB round-trip on every request
  // for the same user within the 5-minute TTL window.
  const cached = userRecordCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    if (shouldLogVerbose()) console.log('🔍 User cache HIT:', cacheKey);
    // Verify tenant still exists — uses tenantExistsCache (30-min TTL) to avoid
    // a live DB round-trip on every request. Accepts ≤30min stale window for deletions.
    if (cached.value?.tenantId && !(await isTenantValid(cached.value.tenantId))) {
      userRecordCache.delete(cacheKey);
      userRecordCache.set(cacheKey, { value: null, expiresAt: Date.now() + USER_RECORD_CACHE_TTL_MS });
      if (shouldLogVerbose()) console.log('🔍 User cache invalidated: tenant no longer exists');
      return null;
    }
    return cached.value;
  }

  try {
    if (shouldLogVerbose()) console.log('🔍 Looking up user:', cacheKey);

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
      if (shouldLogVerbose()) console.log('⚠️ No user records found (expected during onboarding)');
      userRecordCache.set(cacheKey, { value: null, expiresAt: Date.now() + USER_RECORD_CACHE_TTL_MS });
      return null;
    }

    const selectedUser = userRecords.find(u => u.onboardingCompleted) || userRecords[0];
    if (shouldLogVerbose()) console.log('Auth: user found', selectedUser.userId);
    userRecordCache.set(cacheKey, { value: selectedUser, expiresAt: Date.now() + USER_RECORD_CACHE_TTL_MS });
    return selectedUser;

  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Database query error:', err.message);
    return null;
  }
}

// ── User record cache ─────────────────────────────────────────────────────
// findUserInDatabase() runs on every authenticated request and is the single
// most expensive repeated DB call. Cache by kindeUserId with a 5-minute TTL.
// Invalidate via invalidateUserCache() whenever onboarding/isActive changes.
const USER_RECORD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
interface UserRecordCacheEntry { value: UserRecord | null; expiresAt: number }
const userRecordCache = new Map<string, UserRecordCacheEntry>();

export function invalidateUserCache(kindeUserId: string, tenantId?: string): void {
  userRecordCache.delete(kindeUserId); // bare key (legacy)
  if (tenantId) {
    userRecordCache.delete(`${kindeUserId}:${tenantId}`);
  } else {
    // Delete all tenant-specific keys for this user
    for (const key of userRecordCache.keys()) {
      if (key.startsWith(`${kindeUserId}:`)) userRecordCache.delete(key);
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────

// ── Super-admin role cache ────────────────────────────────────────────────
// The role JOIN query runs on every authenticated request for non-null users.
// Cache by internalUserId with a 5-minute TTL.
// Invalidate via invalidateRoleCache() whenever roles are reassigned.
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
interface RoleCacheEntry { isSuperAdmin: boolean; expiresAt: number }
const roleCacheByUserId = new Map<string, RoleCacheEntry>();

export function invalidateRoleCache(internalUserId: string): void {
  roleCacheByUserId.delete(internalUserId);
}

/**
 * Bust the tenant-lookup cache for a given Kinde org code.
 * Call this immediately after onboarding creates a new tenant so the next
 * auth middleware run hits the DB and finds the new tenant, rather than
 * returning the cached null from before onboarding completed.
 */
export function invalidateTenantLookupCache(orgCode: string): void {
  tenantLookupCache.delete(orgCode);
}
// ─────────────────────────────────────────────────────────────────────────

// ── Tenant-exists cache ───────────────────────────────────────────────────
// Verifying tenant existence is done on every cache HIT in findUserInDatabase
// and findTenantByOrgCode. Since tenantIds are immutable once created, we cache
// existence checks for 30 minutes to avoid a DB round-trip on every request.
// Worst case: a deleted tenant's cache entry persists for up to 30 minutes.
const TENANT_EXISTS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const tenantExistsCache = new Map<string, number>(); // tenantId -> expiresAt timestamp

async function isTenantValid(tenantId: string): Promise<boolean> {
  const expiry = tenantExistsCache.get(tenantId);
  if (expiry && Date.now() < expiry) return true; // cache hit — no DB round-trip
  try {
    const [row] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);
    if (row) {
      tenantExistsCache.set(tenantId, Date.now() + TENANT_EXISTS_CACHE_TTL_MS);
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
const TENANT_LOOKUP_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
interface TenantLookupEntry { value: string | null; expiresAt: number }
const tenantLookupCache = new Map<string, TenantLookupEntry>();

async function findTenantByOrgCode(orgCode: string): Promise<string | null> {
  if (!orgCode) return null;

  // Check in-process cache (hits AND misses).
  const cached = tenantLookupCache.get(orgCode);
  if (cached && Date.now() < cached.expiresAt) {
    // Verify tenant still exists — uses tenantExistsCache (30-min TTL).
    if (cached.value && !(await isTenantValid(cached.value))) {
      tenantLookupCache.delete(orgCode);
      tenantLookupCache.set(orgCode, { value: null, expiresAt: Date.now() + TENANT_LOOKUP_CACHE_TTL_MS });
      if (shouldLogVerbose()) console.log('🔍 Tenant lookup cache invalidated: tenant no longer exists');
      return null;
    }
    return cached.value; // null means "not found" — also cached to avoid repeated DB hits
  }

  try {
    if (shouldLogVerbose()) console.log('🔍 Looking up tenant:', orgCode);

    const [tenant] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.kindeOrgId, orgCode))
      .limit(1);

    const result = tenant?.tenantId ?? null;
    // Cache the result (hit or miss).
    tenantLookupCache.set(orgCode, { value: result, expiresAt: Date.now() + TENANT_LOOKUP_CACHE_TTL_MS });

    if (result) {
      if (shouldLogVerbose()) console.log('✅ Found tenant:', result);
    } else {
      // Expected during onboarding (no tenant record yet) — verbose-only to avoid noise.
      if (shouldLogVerbose()) console.log(`⚠️ No tenant found for org code: ${orgCode}`);
    }
    return result;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Tenant lookup error:', err.message);
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

  try {
    request.db = analysis.requiresBypass ?
      dbManager.getSystemConnection() :
      dbManager.getAppConnection();
  } catch (dbError: unknown) {
    const err = dbError as Error;
    console.error('❌ Failed to establish database connection:', err.message);
    request.db = null;
    return;
  }

  if (!analysis.requiresBypass && tenantId && request.db) {
    try {
      // Single round-trip instead of two separate SQL calls.
      await request.db`
        SELECT
          set_config('app.tenant_id', ${tenantId}, false),
          set_config('app.user_id',   ${userId || ''}, false)
      `;
    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ Failed to set tenant context:', err.message);
    }
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
    const cachedRole = roleCacheByUserId.get(effectiveUserRecord.userId);
    if (cachedRole && Date.now() < cachedRole.expiresAt) {
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
        roleCacheByUserId.set(effectiveUserRecord.userId, { isSuperAdmin, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
      } catch (error) {
        console.warn('⚠️ Failed to check super admin status:', error);
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
    console.log('✅ User authenticated:', {
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
    if (shouldLogVerbose()) console.log('🔐 Authenticating user...');

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
              if (shouldLogVerbose()) console.log('✅ Authentication successful (Operations JWT)');
              return;
            }
          }
        }
      } catch (opsErr: unknown) {
        if (shouldLogVerbose()) console.log('⚠️ Operations JWT verification failed, falling through to Kinde:', (opsErr as Error).message);
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
    if (shouldLogVerbose()) console.log('✅ Authentication successful');

  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Authentication failed:', err.message);

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
        console.error('❌ Token refresh failed:', refErr.message);
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
