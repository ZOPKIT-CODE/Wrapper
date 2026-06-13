import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { platformStaff, platformAuditLogs, PLATFORM_PERMISSIONS } from '../../../db/schema/platform/platform-staff.js';
import { eq, desc, and } from 'drizzle-orm';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { invalidateStaffCache } from '../../../middleware/auth/platform-permission-middleware.js';

const MAX_GRANT_DAYS = 30;

// Only PLATFORM admins can manage platform staff — NOT tenant super admins.
// `isSuperAdmin` means "has a system role within a tenant" and every tenant's
// founding admin has it; gating on it here would let any customer org owner grant
// themselves cross-tenant access. The platform plane is the Cognito platform-admin
// group (userContext.isPlatformAdmin), which no tenant role can confer.
function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const ctx = (request as any).userContext;
  if (!ctx?.isPlatformAdmin) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Only platform admins can manage platform staff access.',
    });
    return false;
  }
  return true;
}

export default async function platformStaffManagementRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook('preHandler', authenticateToken);

  // ── GET /api/internal/platform-staff ─────────────────────────────────────
  // List all platform staff (active and inactive). Super admin only.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requirePlatformAdmin(request, reply)) return;

    const staff = await db
      .select({
        staffId:            platformStaff.staffId,
        email:              platformStaff.email,
        name:               platformStaff.name,
        grantedPermissions: platformStaff.grantedPermissions,
        grantedAt:          platformStaff.grantedAt,
        expiresAt:          platformStaff.expiresAt,
        reason:             platformStaff.reason,
        isActive:           platformStaff.isActive,
        revokedAt:          platformStaff.revokedAt,
        revokedReason:      platformStaff.revokedReason,
      })
      .from(platformStaff)
      .orderBy(desc(platformStaff.grantedAt));

    const now = new Date();
    return reply.send({
      success: true,
      data: staff.map(s => ({
        ...s,
        status: !s.isActive
          ? 'revoked'
          : s.expiresAt < now
          ? 'expired'
          : 'active',
        expiresInHours: s.isActive
          ? Math.max(0, Math.round((s.expiresAt.getTime() - now.getTime()) / 3_600_000))
          : null,
      })),
    });
  });

  // ── GET /api/internal/platform-staff/permissions ──────────────────────────
  // List all available platform permissions. Super admin only.
  fastify.get('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requirePlatformAdmin(request, reply)) return;
    return reply.send({ success: true, data: PLATFORM_PERMISSIONS });
  });

  // ── POST /api/internal/platform-staff/grant ───────────────────────────────
  // Grant platform staff access to a user. Super admin only.
  //
  // Body:
  //   idpSub   – the staff member's Cognito sub / IdP subject
  //   email         – for display and notification
  //   name          – display name
  //   permissions   – array of PlatformPermission values
  //   expiresInDays – 1-30 (required, enforced hard cap)
  //   reason        – why this access is being granted (required for audit)
  fastify.post('/grant', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requirePlatformAdmin(request, reply)) return;

    const grantorContext = (request as any).userContext;
    const body = request.body as {
      idpSub: string;
      email:         string;
      name:          string;
      permissions:   string[];
      expiresInDays: number;
      reason:        string;
    };

    // ── Validate input ────────────────────────────────────────────────────
    if (!body.idpSub?.trim()) {
      return reply.code(400).send({ error: 'idpSub is required' });
    }
    if (!body.email?.trim()) {
      return reply.code(400).send({ error: 'email is required' });
    }
    if (!body.name?.trim()) {
      return reply.code(400).send({ error: 'name is required' });
    }
    if (!body.reason?.trim() || body.reason.trim().length < 10) {
      return reply.code(400).send({
        error: 'reason is required and must be at least 10 characters',
      });
    }
    if (!Array.isArray(body.permissions) || body.permissions.length === 0) {
      return reply.code(400).send({ error: 'At least one permission is required' });
    }

    const invalidPerms = body.permissions.filter(
      p => !(PLATFORM_PERMISSIONS as readonly string[]).includes(p)
    );
    if (invalidPerms.length > 0) {
      return reply.code(400).send({
        error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        valid: PLATFORM_PERMISSIONS,
      });
    }

    const days = Number(body.expiresInDays);
    if (!days || days < 1 || days > MAX_GRANT_DAYS) {
      return reply.code(400).send({
        error: `expiresInDays must be between 1 and ${MAX_GRANT_DAYS}`,
      });
    }

    // Resolve the grantor's staffId from the platform pool (not tenant_users — platform
    // admins are a separate identity). Null is acceptable for the bootstrap grant where
    // the first platform admin has no prior staff record.
    const [grantorStaff] = await db
      .select({ staffId: platformStaff.staffId })
      .from(platformStaff)
      .where(eq(platformStaff.idpSub, grantorContext.idpSub))
      .limit(1);

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // ── Upsert: deactivate any existing active record, then insert new one ─
    const existing = await db
      .select({ staffId: platformStaff.staffId })
      .from(platformStaff)
      .where(
        and(
          eq(platformStaff.idpSub, body.idpSub),
          eq(platformStaff.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(platformStaff)
        .set({ isActive: false, revokedAt: new Date(), revokedReason: 'Superseded by new grant' })
        .where(eq(platformStaff.staffId, existing[0].staffId));
    }

    const [newStaff] = await db
      .insert(platformStaff)
      .values({
        idpSub:             body.idpSub.trim(),
        email:              body.email.trim(),
        name:               body.name.trim(),
        grantedPermissions: body.permissions,
        grantedBy:          grantorStaff?.staffId ?? null,
        expiresAt,
        reason:             body.reason.trim(),
      })
      .returning();

    invalidateStaffCache(body.idpSub);

    return reply.code(201).send({
      success: true,
      message: `Platform access granted to ${body.email} for ${days} day(s).`,
      data: {
        staffId:            newStaff.staffId,
        email:              newStaff.email,
        grantedPermissions: newStaff.grantedPermissions,
        expiresAt:          newStaff.expiresAt,
        reason:             newStaff.reason,
      },
    });
  });

  // ── POST /api/internal/platform-staff/revoke ──────────────────────────────
  // Immediately revoke platform access. Super admin only.
  //
  // Body:
  //   idpSub – whose access to revoke
  //   reason      – why (required)
  fastify.post('/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requirePlatformAdmin(request, reply)) return;

    const revokerContext = (request as any).userContext;
    const body = request.body as { idpSub: string; reason: string };

    if (!body.idpSub?.trim()) {
      return reply.code(400).send({ error: 'idpSub is required' });
    }
    if (!body.reason?.trim() || body.reason.trim().length < 5) {
      return reply.code(400).send({ error: 'reason is required (min 5 characters)' });
    }

    // Same pattern as grant: resolve the revoker from the platform pool.
    const [revokerStaff] = await db
      .select({ staffId: platformStaff.staffId })
      .from(platformStaff)
      .where(eq(platformStaff.idpSub, revokerContext.idpSub))
      .limit(1);

    const updated = await db
      .update(platformStaff)
      .set({
        isActive:      false,
        revokedBy:     revokerStaff?.staffId ?? null,
        revokedAt:     new Date(),
        revokedReason: body.reason.trim(),
        updatedAt:     new Date(),
      })
      .where(
        and(
          eq(platformStaff.idpSub, body.idpSub),
          eq(platformStaff.isActive, true)
        )
      )
      .returning({ staffId: platformStaff.staffId, email: platformStaff.email });

    invalidateStaffCache(body.idpSub);

    if (updated.length === 0) {
      return reply.code(404).send({
        error: 'No active platform staff record found for this user',
      });
    }

    return reply.send({
      success: true,
      message: `Platform access revoked for ${updated[0].email}.`,
    });
  });

  // ── GET /api/internal/platform-staff/audit-log ───────────────────────────
  // View the immutable audit log of all platform staff actions. Super admin only.
  // Supports filtering by staffId, targetTenantId, action.
  fastify.get('/audit-log', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requirePlatformAdmin(request, reply)) return;

    const query = request.query as {
      staffId?:       string;
      targetTenantId?: string;
      action?:        string;
      limit?:         string;
    };

    const limit = Math.min(Number(query.limit) || 100, 500);

    const logs = await db
      .select({
        auditId:          platformAuditLogs.auditId,
        staffEmail:       platformAuditLogs.staffEmail,
        action:           platformAuditLogs.action,
        targetTenantId:   platformAuditLogs.targetTenantId,
        targetResource:   platformAuditLogs.targetResource,
        targetResourceId: platformAuditLogs.targetResourceId,
        requestPath:      platformAuditLogs.requestPath,
        requestMethod:    platformAuditLogs.requestMethod,
        changesBefore:    platformAuditLogs.changesBefore,
        changesAfter:     platformAuditLogs.changesAfter,
        ipAddress:        platformAuditLogs.ipAddress,
        createdAt:        platformAuditLogs.createdAt,
      })
      .from(platformAuditLogs)
      .orderBy(desc(platformAuditLogs.createdAt))
      .limit(limit);

    return reply.send({ success: true, data: logs, count: logs.length });
  });
}
