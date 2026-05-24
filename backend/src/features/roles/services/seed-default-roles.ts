import { db } from '../../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { customRoles, userRoleAssignments } from '../../../db/schema/core/permissions.js';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CRM_ROLES } from '../../../data/default-crm-roles.js';
import { publishRoleEventToApplications } from '../routes/roles.js';
import Logger from '../../../utils/logger.js';

const CRM_ADMIN_ROLE_KEY = 'crm_admin';

/**
 * Seed the standard CRM roles for a newly onboarded tenant and assign the
 * CRM Admin role to the tenant owner. Module visibility in the CRM sidebar is
 * driven purely by permission codes, so the owner must hold the CRM Admin role
 * (with its full crm.* permission set) rather than relying on a role-based bypass.
 *
 * Idempotent: skips roles that already exist and skips the assignment if it
 * already exists (ON CONFLICT DO NOTHING).
 * Called before publishAppProvisioningEvents so all roles land in the bootstrap snapshot.
 */
export async function seedDefaultCrmRoles(
  tenantId: string,
  createdByUserId: string,
): Promise<void> {
  // Fetch existing role names for this tenant to skip duplicates
  const existing = await db
    .select({ roleName: customRoles.roleName, roleId: customRoles.roleId })
    .from(customRoles)
    .where(eq(customRoles.tenantId, tenantId));

  const existingNames = new Set(existing.map((r) => r.roleName));

  // Track the CRM Admin roleId so we can assign it to the owner below.
  // May already exist from a prior idempotent run.
  let crmAdminRoleId: string | null =
    existing.find((r) => {
      const def = DEFAULT_CRM_ROLES.find((d) => d.roleName === r.roleName && d.key === CRM_ADMIN_ROLE_KEY);
      return !!def;
    })?.roleId ?? null;

  const toInsert = DEFAULT_CRM_ROLES.filter((r) => !existingNames.has(r.roleName));

  if (toInsert.length === 0) {
    Logger.log('info', 'general', 'seedDefaultCrmRoles', 'All default roles already exist for tenant — skipping inserts', { tenantId });
  } else {
    Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Seeding default CRM roles', { count: toInsert.length, tenantId });

    for (const roleDef of toInsert) {
      const roleId = uuidv4();

      const [role] = await db
        .insert(customRoles)
        .values({
          roleId,
          tenantId,
          roleName: roleDef.roleName,
          description: roleDef.description,
          color: roleDef.color,
          priority: roleDef.priority,
          permissions: roleDef.permissions as unknown as Record<string, unknown>,
          isSystemRole: true,
          isDefault: false,
          scope: 'global',
          createdBy: createdByUserId,
          lastModifiedBy: createdByUserId,
        })
        .returning();

      if (!role) {
        Logger.log('warning', 'general', 'seedDefaultCrmRoles', 'Failed to insert role', { roleName: roleDef.roleName });
        continue;
      }

      if (roleDef.key === CRM_ADMIN_ROLE_KEY) {
        crmAdminRoleId = role.roleId;
      }

      // Publish role.created event so CRM (and other apps) receive the role via MQ
      try {
        await publishRoleEventToApplications('role.created', tenantId, role.roleId, {
          roleName: roleDef.roleName,
          description: roleDef.description,
          permissions: JSON.stringify(roleDef.permissions),
          restrictions: '{}',
          createdBy: createdByUserId,
          createdAt: role.createdAt,
        });
      } catch (err: unknown) {
        Logger.log('warning', 'general', 'seedDefaultCrmRoles', 'Failed to publish role.created', { roleName: roleDef.roleName, error: (err as Error).message });
      }

      Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Created role', { roleName: roleDef.roleName, roleId });
    }

    Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Seeded default CRM roles', { count: toInsert.length, tenantId });
  }

  // Assign the CRM Admin role to the tenant owner so their permission codes
  // (crm.leads.read, crm.opportunities.read, …) drive sidebar module visibility
  // without any role-based bypass in the frontend.
  if (crmAdminRoleId) {
    const existing = await db
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, createdByUserId),
          eq(userRoleAssignments.roleId, crmAdminRoleId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(userRoleAssignments).values({
        id: uuidv4(),
        userId: createdByUserId,
        roleId: crmAdminRoleId,
        assignedBy: createdByUserId,
        organizationId: tenantId,
      });
      Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Assigned CRM Admin role to tenant owner', { tenantId, userId: createdByUserId, roleId: crmAdminRoleId });
    } else {
      Logger.log('info', 'general', 'seedDefaultCrmRoles', 'CRM Admin role already assigned to tenant owner — skipping', { tenantId, userId: createdByUserId });
    }
  } else {
    Logger.log('warning', 'general', 'seedDefaultCrmRoles', 'CRM Admin role not found — owner not assigned', { tenantId });
  }
}
