import { db } from '../../../db/index.js';
import { eq } from 'drizzle-orm';
import { customRoles } from '../../../db/schema/core/permissions.js';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CRM_ROLES } from '../../../data/default-crm-roles.js';
import Logger from '../../../utils/logger.js';

/**
 * Seed the standard CRM role catalog (CRM Admin, Sales Rep, Support Agent,
 * Viewer) for a newly onboarded tenant. These are delegation templates: the
 * owner assigns them to teammates later, and the apps resolve each user's
 * permission codes locally from their synced role projections.
 *
 * Deliberately NOT done here:
 * - No role.created publishing. Seeding runs before publishAppProvisioningEvents,
 *   so the full catalog rides the tenant.onboarded snapshot. Publishing per-role
 *   here raced that snapshot (role.created landed before the tenant existed and
 *   failed-then-retried 4x on every onboarding — observed live 2026-06-12).
 * - No owner assignment. The onboarding flow assigns the owner the
 *   "Organization Admin" system role (backstopped by ensureTenantAdminRole),
 *   whose enumerated permission set strictly contains CRM Admin's (verified:
 *   512 codes spanning crm+accounting vs 211 crm codes, zero unique). A second
 *   assignment added rows and events but no access.
 *
 * Idempotent: skips roles that already exist.
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

      Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Created role', { roleName: roleDef.roleName, roleId });
    }

    Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Seeded default CRM roles', { count: toInsert.length, tenantId });
  }
}
