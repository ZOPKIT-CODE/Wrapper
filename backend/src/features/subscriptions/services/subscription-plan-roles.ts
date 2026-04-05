import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { customRoles, tenantUsers } from '../../../db/schema/index.js';

/**
 * Update Administrator roles when plan changes - Enhanced version
 */
export async function updateAdministratorRolesForPlan(tenantId: string, newPlanId: string): Promise<void> {
  try {
    console.log(`🔐 Updating Administrator roles for tenant ${tenantId} to ${newPlanId} plan`);

    const { createSuperAdminRoleConfig } = await import('../../../utils/super-admin-permissions.js');
    const { PLAN_ACCESS_MATRIX } = await import('../../../data/permission-matrix.js');

    const planAccess = (PLAN_ACCESS_MATRIX as Record<string, unknown>)[newPlanId];
    if (!planAccess) {
      throw new Error(`Plan ${newPlanId} not found in access matrix`);
    }

    const adminRoles = await db
      .select()
      .from(customRoles)
      .where(and(
        eq(customRoles.tenantId, tenantId),
        or(
          and(
            eq(customRoles.roleName, 'Super Administrator'),
            eq(customRoles.isSystemRole, true)
          ),
          and(
            eq(customRoles.isSystemRole, false),
            sql`${customRoles.permissions}::text ILIKE '%"system"%'`
          ),
          or(
            sql`${customRoles.roleName} ILIKE '%administrator%'`,
            sql`${customRoles.roleName} ILIKE '%admin%'`
          )
        )
      ));

    console.log(`📋 Found ${adminRoles.length} administrator role(s) to update`);

    await db.transaction(async (tx) => {
      for (const role of adminRoles) {
        try {
          let updatedPermissions: Record<string, unknown>, updatedRestrictions: Record<string, unknown>, updatedDescription: string;

          if (role.roleName === 'Super Administrator' && role.isSystemRole) {
            const newRoleConfig = createSuperAdminRoleConfig(newPlanId, tenantId, role.createdBy);
            updatedPermissions = newRoleConfig.permissions as Record<string, unknown>;
            updatedRestrictions = newRoleConfig.restrictions as Record<string, unknown>;
            updatedDescription = newRoleConfig.description as string;

            console.log(`   🎯 Updating Super Administrator with full ${newPlanId} plan access`);
          } else {
            updatedPermissions = await enhanceAdminPermissionsForPlan(role.permissions as Record<string, unknown>, newPlanId, planAccess as Record<string, unknown>);
            updatedRestrictions = await updateAdminRestrictionsForPlan(role.restrictions as Record<string, unknown>, newPlanId, planAccess as Record<string, unknown>);
            updatedDescription = `${role.description} (Updated for ${newPlanId.charAt(0).toUpperCase() + newPlanId.slice(1)} Plan)`;

            console.log(`   🔧 Enhancing custom admin role: ${role.roleName}`);
          }

          await tx
            .update(customRoles)
            .set({
              description: updatedDescription,
              permissions: updatedPermissions as any,
              restrictions: updatedRestrictions as any,
              updatedAt: new Date()
            })
            .where(eq(customRoles.roleId, role.roleId));

          console.log(`   ✅ Updated role: ${role.roleName}`);

        } catch (errRole: unknown) {
          const roleError = errRole as Error;
          console.error(`   ❌ Failed to update role ${role.roleName}:`, roleError.message);
          throw roleError;
        }
      }
    });

    await updateTenantAdminUsersForPlan(tenantId, newPlanId);

    console.log(`✅ Completed administrator role updates for tenant ${tenantId} with ${newPlanId} plan`);

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`❌ Failed to update administrator roles for tenant ${tenantId}:`, error);
  }
}

/**
 * Helper to enhance existing admin permissions with new plan features
 */
export async function enhanceAdminPermissionsForPlan(
  existingPermissions: Record<string, unknown>,
  newPlanId: string,
  planAccess: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const { generateSuperAdminPermissions } = await import('../../../utils/super-admin-permissions.js');

    const newPlanPermissions = generateSuperAdminPermissions(newPlanId) as Record<string, unknown>;

    const enhancedPermissions: Record<string, unknown> = { ...existingPermissions };

    const applications = (planAccess.applications as string[]) || [];
    const modules = (planAccess.modules as Record<string, unknown>) || {};
    applications.forEach((appCode: string) => {
      if (!enhancedPermissions[appCode]) {
        enhancedPermissions[appCode] = {};
      }

      const appModules = modules[appCode];
      if (appModules === '*') {
        enhancedPermissions[appCode] = (newPlanPermissions[appCode] as Record<string, unknown>) || {};
      } else if (Array.isArray(appModules)) {
        const appPerms = enhancedPermissions[appCode] as Record<string, unknown>;
        const newAppPerms = newPlanPermissions[appCode] as Record<string, unknown> | undefined;
        (appModules as string[]).forEach((moduleCode: string) => {
          if (!appPerms[moduleCode] && newAppPerms?.[moduleCode]) {
            appPerms[moduleCode] = newAppPerms[moduleCode];
          }
        });
      }
    });

    if (newPlanPermissions.system) {
      const existingSystem = enhancedPermissions.system as Record<string, unknown> | undefined;
      const newSystem = newPlanPermissions.system as Record<string, unknown>;
      enhancedPermissions.system = {
        ...(typeof existingSystem === 'object' && existingSystem !== null ? existingSystem : {}),
        ...(typeof newSystem === 'object' && newSystem !== null ? newSystem : {})
      };
    }

    return enhancedPermissions;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to enhance admin permissions:', error);
    return existingPermissions;
  }
}

/**
 * Helper to update admin restrictions for new plan
 */
export async function updateAdminRestrictionsForPlan(
  existingRestrictions: Record<string, unknown>,
  newPlanId: string,
  planAccess: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const { getSuperAdminRestrictions } = await import('../../../utils/super-admin-permissions.js');

    const newPlanRestrictions = getSuperAdminRestrictions(newPlanId) as Record<string, unknown>;

    const updatedRestrictions: Record<string, unknown> = {
      ...existingRestrictions,
      ...newPlanRestrictions,
      planType: newPlanId,
      lastUpgraded: new Date().toISOString()
    };

    const limitations = planAccess.limitations as Record<string, number> | undefined;
    if (limitations) {
      if (limitations.users === -1) {
        delete updatedRestrictions.maxUsers;
      }
      if (limitations.roles === -1) {
        delete updatedRestrictions.maxRoles;
      }
    }

    return updatedRestrictions;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to update admin restrictions:', error);
    return existingRestrictions;
  }
}

/**
 * Helper to update tenant admin users for new plan
 */
export async function updateTenantAdminUsersForPlan(tenantId: string, _newPlanId: string): Promise<void> {
  try {
    console.log(`👥 Checking tenant admin users for plan update...`);

    const tenantAdminUsers = await db
      .select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.isTenantAdmin, true)
      ));

    if (tenantAdminUsers.length > 0) {
      console.log(`   📝 Found ${tenantAdminUsers.length} tenant admin user(s) - permissions will be refreshed on next login`);

      await db
        .update(tenantUsers)
        .set({
          updatedAt: new Date()
        })
        .where(and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.isTenantAdmin, true)
        ));
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to update tenant admin users:', error);
  }
}

/**
 * Backward compatibility: delegates to updateAdministratorRolesForPlan
 */
export async function updateSuperAdminRoleForPlan(tenantId: string, newPlanId: string): Promise<void> {
  return await updateAdministratorRolesForPlan(tenantId, newPlanId);
}
