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
//   1. Super admins  (isSuperAdmin === true on their userContext)
//   2. Platform staff with the specific required permission AND valid,
//      non-expired, active record in platform_staff table
//
// Every call by a platform staff member is logged to platform_audit_logs.
// Super admin calls are NOT logged here (they have their own audit path).
// ─────────────────────────────────────────────────────────────────────────────

// Short-lived in-process cache to avoid a DB hit on every request.
// Key = kindeUserId, value = the staff row + expiry.
const STAFF_CACHE_TTL_MS = 60 * 1000; // 1 minute — short so revocations propagate quickly
interface StaffCacheEntry {
  staff: typeof platformStaff.$inferSelect | null;
  cachedAt: number;
}
const staffCache = new Map<string, StaffCacheEntry>();

function invalidateStaffCache(kindeUserId: string): void {
  staffCache.delete(kindeUserId);
}
export { invalidateStaffCache };

async function getActivePlatformStaff(
  kindeUserId: string
): Promise<typeof platformStaff.$inferSelect | null> {
  const cached = staffCache.get(kindeUserId);
  if (cached && Date.now() - cached.cachedAt < STAFF_CACHE_TTL_MS) {
    return cached.staff;
  }

  const [staff] = await db
    .select()
    .from(platformStaff)
    .where(
      and(
        eq(platformStaff.kindeUserId, kindeUserId),
        eq(platformStaff.isActive, true),
        gt(platformStaff.expiresAt, new Date())
      )
    )
    .limit(1);

  const result = staff ?? null;
  staffCache.set(kindeUserId, { staff: result, cachedAt: Date.now() });
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
      kindeUserId:      staff.kindeUserId,
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
    // Never let audit log failure block the actual request — but always surface it.
    Logger.log('error', 'auth', 'log-platform-action', '❌ Failed to write platform audit log', { error: err });
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
 * Use this as the preHandler on any cross-tenant admin route.
 *
 * Allows:
 *   - Super admins (isSuperAdmin === true) — pass through, no audit log
 *   - Platform staff with the required permission and a valid, non-expired record
 *
 * Blocks:
 *   - Regular tenant admins (they can only access their own tenant)
 *   - Platform staff with wrong/expired/revoked permission
 *   - Unauthenticated requests
 *
 * Usage:
 *   fastify.put('/:tenantId/operation/:operationCode', {
 *     preHandler: requirePlatformPermission('credit_config:write')
 *   }, handler)
 */
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

    // Super admins pass through unconditionally.
    if (userContext.isSuperAdmin) {
      return;
    }

    // Resolve Kinde user id for optional platform staff lookup.
    const kindeUserId = userContext.kindeUserId ?? userContext.userId;
    if (kindeUserId) {
      const staff = await getActivePlatformStaff(kindeUserId);

      if (staff) {
        // Check expiry explicitly (belt-and-suspenders — the DB query already filters).
        if (new Date() > staff.expiresAt) {
          invalidateStaffCache(kindeUserId);
          reply.code(403).send({
            error: 'Forbidden',
            message: `Your platform access expired at ${staff.expiresAt.toISOString()}. Request a renewal.`,
          });
          return;
        }

        const hasPermission = (staff.grantedPermissions as string[]).includes(permission);
        if (!hasPermission) {
          reply.code(403).send({
            error: 'Forbidden',
            message: `Your platform access does not include '${permission}'.`,
            yourPermissions: staff.grantedPermissions,
          });
          return;
        }

        // Attach staff record and audit helper to the request for use in route handlers.
        request.platformStaff = staff;
        request.logPlatformAction = (
          action,
          targetTenantId,
          targetResource,
          targetResourceId?,
          changesBefore?,
          changesAfter?
        ) =>
          logPlatformAction(
            staff,
            request,
            action,
            targetTenantId,
            targetResource,
            targetResourceId,
            changesBefore,
            changesAfter
          );
        return;
      }
    }

    // Tenant admins without platform-staff grant pass through and remain
    // scoped to their own tenant via inline tenantId checks in handlers.
    if (userContext.isTenantAdmin) {
      return;
    }

    reply.code(403).send({
      error: 'Forbidden',
      message: 'You do not have platform staff access. Contact a super admin to grant access.',
    });
    return;
  };
}
