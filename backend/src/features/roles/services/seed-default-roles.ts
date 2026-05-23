import { db } from '../../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { customRoles } from '../../../db/schema/core/permissions.js';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CRM_ROLES } from '../../../data/default-crm-roles.js';
import { publishRoleEventToApplications } from '../routes/roles.js';
import Logger from '../../../utils/logger.js';

/**
 * Seed the 8 standard CRM roles for a newly onboarded tenant.
 * Roles are created with isSystemRole=true so tenant admins cannot delete them.
 * Idempotent: skips any role whose key already exists for the tenant (checked via roleName).
 * Called before publishAppProvisioningEvents so roles are included in the bootstrap snapshot.
 */
export async function seedDefaultCrmRoles(
  tenantId: string,
  createdByUserId: string,
): Promise<void> {
  // Fetch existing role names for this tenant to skip duplicates
  const existing = await db
    .select({ roleName: customRoles.roleName })
    .from(customRoles)
    .where(eq(customRoles.tenantId, tenantId));

  const existingNames = new Set(existing.map((r) => r.roleName));

  const toInsert = DEFAULT_CRM_ROLES.filter((r) => !existingNames.has(r.roleName));

  if (toInsert.length === 0) {
    Logger.log('info', 'general', 'seedDefaultCrmRoles', 'All default roles already exist for tenant — skipping', { tenantId });
    return;
  }

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
      // Non-fatal — bootstrap snapshot will carry the role anyway
      Logger.log('warning', 'general', 'seedDefaultCrmRoles', 'Failed to publish role.created', { roleName: roleDef.roleName, error: (err as Error).message });
    }

    Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Created role', { roleName: roleDef.roleName, roleId });
  }

  Logger.log('info', 'general', 'seedDefaultCrmRoles', 'Seeded default CRM roles', { count: toInsert.length, tenantId });
}
