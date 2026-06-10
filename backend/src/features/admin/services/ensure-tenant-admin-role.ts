import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { customRoles, userRoleAssignments } from '../../../db/schema/index.js';
import { createSuperAdminRoleConfig } from '../../../data/permission-matrix.js';
import Logger from '../../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// ensureTenantAdminRole
//
// Guarantees that a user flagged as a tenant admin actually HOLDS a role whose
// permissions are enumerated — i.e. a tenant system role (isSystemRole = true).
//
// This is the safeguard that lets us remove the `if (isTenantAdmin) return`
// permission-check fast-path (see [[feedback-no-admin-bypass]]): admin power must
// come from an enumerated role, never from a bare boolean column. Onboarding
// already creates + assigns the "Organization Admin" system role, but a couple of
// "promote" endpoints used to set is_tenant_admin = true WITHOUT a role. Those
// call this so the promoted user gets real, auditable permissions.
//
// Idempotent: reuses the tenant's existing system role if present (preferring
// "Organization Admin"), otherwise creates it; only inserts an assignment if the
// user doesn't already have an active one for that role.
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureTenantAdminRole(params: {
  tenantId: string;
  userId: string;     // internal tenant_users.userId of the user being made admin
  assignedBy: string; // internal tenant_users.userId of the actor performing the promotion
  selectedPlan?: string;
}): Promise<{ roleId: string }> {
  const { tenantId, userId, assignedBy, selectedPlan = 'free' } = params;

  return db.transaction(async (tx) => {
    // Prefer an existing system role for the tenant (Organization Admin first).
    const systemRoles = await tx
      .select({ roleId: customRoles.roleId, roleName: customRoles.roleName })
      .from(customRoles)
      .where(and(eq(customRoles.tenantId, tenantId), eq(customRoles.isSystemRole, true)));

    let roleId =
      systemRoles.find((r) => r.roleName === 'Organization Admin')?.roleId ??
      systemRoles[0]?.roleId;

    if (!roleId) {
      // No system role exists yet — create the canonical Organization Admin role.
      const roleConfig = createSuperAdminRoleConfig(selectedPlan, tenantId, assignedBy);
      const [created] = await tx.insert(customRoles).values(roleConfig as any).returning({ roleId: customRoles.roleId });
      roleId = created.roleId;
      Logger.log('info', 'auth', 'ensure-tenant-admin-role', 'Created Organization Admin system role', { tenantId });
    }

    // Assign the role if the user doesn't already hold it actively.
    const [existing] = await tx
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.roleId, roleId),
        eq(userRoleAssignments.isActive, true),
      ))
      .limit(1);

    if (!existing) {
      await tx.insert(userRoleAssignments).values({
        userId,
        roleId,
        organizationId: tenantId,
        assignedBy,
      });
      Logger.log('info', 'auth', 'ensure-tenant-admin-role', 'Assigned tenant admin system role', { tenantId, userId });
    }

    return { roleId };
  });
}

/**
 * Deactivates the user's active tenant SYSTEM-role assignments. The complement of
 * ensureTenantAdminRole: now that the permission check no longer fast-paths on the
 * is_tenant_admin column, a system role's '*' permissions persist until its
 * assignment is deactivated — so demoting (is_tenant_admin = false) must call this
 * or the demote is a silent no-op.
 */
export async function revokeTenantAdminRole(params: {
  tenantId: string;
  userId: string;
  deactivatedBy: string;
}): Promise<void> {
  const { tenantId, userId, deactivatedBy } = params;

  const systemRoles = await db
    .select({ roleId: customRoles.roleId })
    .from(customRoles)
    .where(and(eq(customRoles.tenantId, tenantId), eq(customRoles.isSystemRole, true)));

  const roleIds = systemRoles.map((r) => r.roleId);
  if (roleIds.length === 0) return;

  await db
    .update(userRoleAssignments)
    .set({ isActive: false, deactivatedAt: new Date(), deactivatedBy })
    .where(and(
      eq(userRoleAssignments.userId, userId),
      inArray(userRoleAssignments.roleId, roleIds),
      eq(userRoleAssignments.isActive, true),
    ));

  Logger.log('info', 'auth', 'revoke-tenant-admin-role', 'Deactivated tenant admin system role(s)', { tenantId, userId });
}
