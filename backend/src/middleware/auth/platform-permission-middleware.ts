import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { platformStaff, platformAuditLogs, type PlatformPermission } from '../../db/schema/platform/platform-staff.js';
import { eq, and, gt } from 'drizzle-orm';
import Logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// Platform permission middleware
//
// Protects cross-tenant admin routes (credit config, org assignments) so only
// two types of callers can reach them:
//
//   1. Platform admins (isPlatformAdmin === true — Cognito platform-admin group).
//      NOT tenant super admins: isSuperAdmin is tenant-scoped and every tenant
//      founder has it, so it must never grant cross-tenant access.
//   2. Platform staff with the specific required permission AND a valid,
//      non-expired, active record in the platform_staff table.
//
// Every call by a platform staff member is logged to platform_audit_logs.
// Platform admin calls are NOT logged here (they have their own audit path).
// ─────────────────────────────────────────────────────────────────────────────

// Short-lived in-process cache to avoid a DB hit on every request.
// Key = idpSub, value = the staff row + expiry.
const STAFF_CACHE_TTL_MS = 60 * 1000; // 1 minute — short so revocations propagate quickly
interface StaffCacheEntry {
  staff: typeof platformStaff.$inferSelect | null;
  cachedAt: number;
}
const staffCache = new Map<string, StaffCacheEntry>();

function invalidateStaffCache(idpSub: string): void {
  staffCache.delete(idpSub);
}
export { invalidateStaffCache };

async function getActivePlatformStaff(
  idpSub: string
): Promise<typeof platformStaff.$inferSelect | null> {
  const cached = staffCache.get(idpSub);
  if (cached && Date.now() - cached.cachedAt < STAFF_CACHE_TTL_MS) {
    return cached.staff;
  }

  const [staff] = await db
    .select()
    .from(platformStaff)
    .where(
      and(
        eq(platformStaff.idpSub, idpSub),
        eq(platformStaff.isActive, true),
        gt(platformStaff.expiresAt, new Date())
      )
    )
    .limit(1);

  const result = staff ?? null;
  staffCache.set(idpSub, { staff: result, cachedAt: Date.now() });
  return result;
}

async function logPlatformAction(
  staff: typeof platformStaff.$inferSelect,
  request: FastifyRequest,
  action: string,
  targetTenantId: string,
  targetResource: string,
  targetResourceId?: string,
  changesBefore?: unknown,
  changesAfter?: unknown
): Promise<void> {
  try {
    await db.insert(platformAuditLogs).values({
      staffId:          staff.staffId,
      idpSub:           staff.idpSub,
      staffEmail:       staff.email,
      action,
      targetTenantId,
      targetResource,
      targetResourceId: targetResourceId ?? null,
      requestPath:      request.url,
      requestMethod:    request.method,
      changesBefore:    changesBefore ? JSON.stringify(changesBefore) : null,
      changesAfter:     changesAfter  ? JSON.stringify(changesAfter)  : null,
      ipAddress:        request.ip ?? null,
      userAgent:        request.headers['user-agent'] ?? null,
    });
  } catch (err) {
    // AUDIT-OR-BLOCK: a platform staff action that cannot be audited must not be
    // reported as success. Route handlers `await request.logPlatformAction(...)`,
    // so re-throwing surfaces as a 500 rather than a silent, unaudited change.
    // (The mutation has already run; the 500 is a loud signal to investigate —
    // true atomicity would require writing this row in the mutation's transaction.)
    Logger.log('error', 'auth', 'log-platform-action', '❌ Failed to write platform audit log — blocking', { error: err });
    throw new Error('Platform action could not be audited; aborting to preserve the audit trail.');
  }
}

// Attach the audit log helper to the request so route handlers can call it
// after the DB write succeeds (so they can include the before/after state).
declare module 'fastify' {
  interface FastifyRequest {
    platformStaff?: typeof platformStaff.$inferSelect;
    logPlatformAction?: (
      action: string,
      targetTenantId: string,
      targetResource: string,
      targetResourceId?: string,
      changesBefore?: unknown,
      changesAfter?: unknown
    ) => Promise<void>;
  }
}

/**
 * requirePlatformPermission(permission)
 *
 * Use this as the preHandler on any PLATFORM-ONLY (cross-tenant) admin route.
 *
 * Allows:
 *   - Platform admins (isPlatformAdmin === true) — pass through, no audit log
 *   - Platform staff with the required permission and a valid, non-expired record
 *
 * Blocks:
 *   - Tenant admins / tenant super admins (no cross-tenant plane)
 *   - Platform staff with wrong/expired/revoked permission
 *   - Unauthenticated requests
 *
 * Usage:
 *   fastify.put('/:tenantId/operation/:operationCode', {
 *     preHandler: requirePlatformPermission('credit_config:write')
 *   }, handler)
 */
// Outcome of attempting to authorize the caller as platform staff.
type StaffOutcome = 'allowed' | 'denied' | 'not-staff';

/**
 * Attempt to authorize the caller as platform staff for `permission`. On success
 * attaches `request.platformStaff` + `request.logPlatformAction` and returns
 * 'allowed'. If the caller IS staff but expired / lacks the permission, sends a
 * 403 and returns 'denied'. If the caller is not staff at all, returns 'not-staff'
 * (no reply sent) so the caller can fall through to other planes.
 */
async function tryAuthorizePlatformStaff(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PlatformPermission
): Promise<StaffOutcome> {
  const userContext = (request as any).userContext;
  const idpSub = userContext.idpSub ?? userContext.userId;
  if (!idpSub) return 'not-staff';

  const staff = await getActivePlatformStaff(idpSub);
  if (!staff) return 'not-staff';

  // Check expiry explicitly (belt-and-suspenders — the DB query already filters).
  if (new Date() > staff.expiresAt) {
    invalidateStaffCache(idpSub);
    reply.code(403).send({
      error: 'Forbidden',
      message: `Your platform access expired at ${staff.expiresAt.toISOString()}. Request a renewal.`,
    });
    return 'denied';
  }

  if (!(staff.grantedPermissions as string[]).includes(permission)) {
    reply.code(403).send({
      error: 'Forbidden',
      message: `Your platform access does not include '${permission}'.`,
      yourPermissions: staff.grantedPermissions,
    });
    return 'denied';
  }

  // Attach staff record and audit helper to the request for use in route handlers.
  request.platformStaff = staff;
  request.logPlatformAction = (action, targetTenantId, targetResource, targetResourceId?, changesBefore?, changesAfter?) =>
    logPlatformAction(staff, request, action, targetTenantId, targetResource, targetResourceId, changesBefore, changesAfter);
  return 'allowed';
}

export function requirePlatformPermission(permission: PlatformPermission) {
  return async function platformPermissionGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const userContext = (request as any).userContext;

    if (!userContext?.isAuthenticated) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // Platform admins pass through unconditionally.
    if (userContext.isPlatformAdmin) {
      return;
    }

    const outcome = await tryAuthorizePlatformStaff(request, reply, permission);
    if (outcome === 'allowed' || outcome === 'denied') return;

    // Tenant admins do NOT pass a platform guard. Cross-tenant routes are the
    // platform plane only. Routes that legitimately serve a tenant's own admin
    // (read/write their own tenant) must use requirePlatformOrOwnTenant instead.
    reply.code(403).send({
      error: 'Forbidden',
      message: 'You do not have platform staff access. Contact a platform admin to grant access.',
    });
    return;
  };
}

/**
 * requirePlatformOrOwnTenant(permission, paramName='tenantId')
 *
 * For DUAL-PURPOSE routes (e.g. credit config, app assignments) that serve both:
 *   - the platform plane operating cross-tenant, AND
 *   - a tenant's own admin operating strictly on their own tenant.
 *
 * Encodes the tenant-scoping in ONE place so handlers no longer repeat (and risk
 * forgetting) the inline `tenantId !== userContext.tenantId` check.
 *
 * Allows:
 *   - Platform admins → any tenant
 *   - Platform staff with `permission` → any tenant (attached + audited)
 *   - Tenant admins / tenant super admins → ONLY when the path tenant matches
 *     their own `userContext.tenantId`
 *
 * Blocks everyone else, and any tenant admin targeting a different tenant.
 */
export function requirePlatformOrOwnTenant(permission: PlatformPermission, paramName = 'tenantId') {
  return async function platformOrOwnTenantGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const userContext = (request as any).userContext;

    if (!userContext?.isAuthenticated) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // Platform plane → any tenant.
    if (userContext.isPlatformAdmin) return;

    const outcome = await tryAuthorizePlatformStaff(request, reply, permission);
    if (outcome === 'allowed' || outcome === 'denied') return;

    // Tenant plane → own tenant only. Tenant (super) admins manage their own tenant.
    const paramTenantId = (request.params as Record<string, string> | undefined)?.[paramName];
    if (
      paramTenantId &&
      userContext.tenantId === paramTenantId &&
      (userContext.isTenantAdmin || userContext.isSuperAdmin)
    ) {
      return;
    }

    reply.code(403).send({
      error: 'Forbidden',
      message: 'You can only access your own tenant here. Cross-tenant access requires platform staff.',
    });
    return;
  };
}
