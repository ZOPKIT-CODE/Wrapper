import { db } from '../../../db/index.js';
import { eq, and, inArray, isNull, like } from 'drizzle-orm';
import { applications, applicationModules, organizationApplications } from '../../../db/schema/core/suite-schema.js';
import { customRoles } from '../../../db/schema/core/permissions.js';
import { creditConfigurations } from '../../../db/schema/billing/credit_configurations.js';
import { getAccessibleModules } from '../../../config/permission-tiers.js';
import { BUSINESS_SUITE_MATRIX } from '../../../data/permission-matrix.js';
import Logger from '../../../utils/logger.js';

import { v4 as uuidv4 } from 'uuid';

// Import the role event publishing function
import { publishRoleEventToApplications } from '../routes/roles.js';

/**
 * Convert flat permission array to hierarchical object format
 */
function convertPermissionsToHierarchical(permissionsArray: string[] | Record<string, unknown>): Record<string, Record<string, string[]>> | Record<string, unknown> {
  if (!Array.isArray(permissionsArray)) {
    return permissionsArray as Record<string, unknown>;
  }

  const hierarchical: Record<string, Record<string, string[]>> = {};

  permissionsArray.forEach((permission: string) => {
    const parts = permission.split('.');
    if (parts.length >= 3) {
      const [app, module, operation] = parts;

      if (!hierarchical[app]) {
        hierarchical[app] = {};
      }
      if (!hierarchical[app][module]) {
        hierarchical[app][module] = [];
      }
      if (!hierarchical[app][module].includes(operation)) {
        hierarchical[app][module].push(operation);
      }
    }
  });

  return hierarchical;
}

/** Flatten hierarchical permissions object to array of 'app.module.operation' strings */
function flattenPermissions(perms: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, val] of Object.entries(perms)) {
    if (Array.isArray(val)) {
      val.forEach((op: unknown) => out.push(`${prefix}${key}.${String(op)}`));
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out.push(...flattenPermissions(val as Record<string, unknown>, prefix + key + '.'));
    }
  }
  return out;
}

/**
 * 🏗️ **CUSTOM ROLE SERVICE**
 * Demonstrates how to use applications/modules tables to create custom roles
 * and why we need organization_applications and user_application_permissions
 */

/**
 * Format permissions for UI compatibility using permission matrix definitions
 * Includes credit consumption information from tenant-specific or global configs
 */
async function formatPermissionsForUI(permissionCodes: string[] | { code?: string }[], appCode: string, moduleCode: string, tenantId: string): Promise<Record<string, unknown>[]> {
  if (!Array.isArray(permissionCodes)) return [];

  const formattedPermissions: Record<string, unknown>[] = [];

  // Get permission definitions from the business suite matrix
  type MatrixModule = { permissions?: Array<{ code: string; name?: string; description?: string }> };
  const appMatrix = (BUSINESS_SUITE_MATRIX as Record<string, unknown>)[appCode] as { modules?: Record<string, MatrixModule> } | undefined;
  const moduleMatrix = appMatrix?.modules?.[moduleCode];

  // Get credit configurations for this tenant (tenant-specific first, then global fallback)
  // First, get tenant-specific configs
  const tenantConfigs = await db
    .select({
      operationCode: creditConfigurations.operationCode,
      creditCost: creditConfigurations.creditCost,
      unit: creditConfigurations.unit,
      unitMultiplier: creditConfigurations.unitMultiplier,
      isGlobal: creditConfigurations.isGlobal
    })
    .from(creditConfigurations)
    .where(and(
      eq(creditConfigurations.tenantId, tenantId ?? ''), // Tenant-specific configs only
      eq(creditConfigurations.isActive, true),
      like(creditConfigurations.operationCode, `${appCode}.${moduleCode}.%`)
    ));

  // Then, get global configs for operations not covered by tenant-specific configs
  const globalConfigs = await db
    .select({
      operationCode: creditConfigurations.operationCode,
      creditCost: creditConfigurations.creditCost,
      unit: creditConfigurations.unit,
      unitMultiplier: creditConfigurations.unitMultiplier,
      isGlobal: creditConfigurations.isGlobal
    })
    .from(creditConfigurations)
    .where(and(
      isNull(creditConfigurations.tenantId), // Global configs only
      eq(creditConfigurations.isActive, true),
      like(creditConfigurations.operationCode, `${appCode}.${moduleCode}.%`)
    ));

  // Create a map of operation codes to credit costs
  // Tenant-specific configs take priority
  const creditCostMap = new Map<string, { creditCost: number; unit: string | null; unitMultiplier: number; isGlobal: boolean | null }>();

  // First, add tenant-specific configs
  tenantConfigs.forEach((config: { operationCode: string; creditCost: string; unit: string | null; unitMultiplier: string | null; isGlobal: boolean | null }) => {
    const operationCode = config.operationCode;
    creditCostMap.set(operationCode, {
      creditCost: parseFloat(String(config.creditCost)),
      unit: config.unit,
      unitMultiplier: parseFloat(String(config.unitMultiplier ?? 0)),
      isGlobal: config.isGlobal
    });
  });

  // Then, add global configs only for operations not covered by tenant-specific configs
  globalConfigs.forEach((config: { operationCode: string; creditCost: string; unit: string | null; unitMultiplier: string | null; isGlobal: boolean | null }) => {
    const operationCode = config.operationCode;
    if (!creditCostMap.has(operationCode)) {
      creditCostMap.set(operationCode, {
        creditCost: parseFloat(String(config.creditCost)),
        unit: config.unit,
        unitMultiplier: parseFloat(String(config.unitMultiplier ?? 0)),
        isGlobal: config.isGlobal
      });
    }
  });

  if (moduleMatrix?.permissions) {
    // Use matrix definitions for proper names and descriptions
    const matrixPermissions = moduleMatrix.permissions;

    for (const code of permissionCodes) {
      // Handle both string codes and permission objects
      const permissionCode = typeof code === 'string' ? code : String((code as { code?: string }).code ?? (code as unknown));

      // Find the permission in the matrix
      const matrixPerm = matrixPermissions.find((p: { code: string }) => p.code === permissionCode);
      if (matrixPerm) {
        const operationCode = `${appCode}.${moduleCode}.${permissionCode}`;
        const creditConfig = creditCostMap.get(operationCode);

        formattedPermissions.push({
          code: matrixPerm.code,
          name: matrixPerm.name,
          description: matrixPerm.description,
          creditCost: creditConfig ? {
            cost: creditConfig.creditCost,
            unit: creditConfig.unit,
            unitMultiplier: creditConfig.unitMultiplier,
            isGlobal: creditConfig.isGlobal
          } : null
        });
      } else {
        // Fallback for permissions not in matrix
        const operationCode = `${appCode}.${moduleCode}.${permissionCode}`;
        const creditConfig = creditCostMap.get(operationCode);

        formattedPermissions.push({
          code: permissionCode,
          name: typeof permissionCode === 'string' ? permissionCode.charAt(0).toUpperCase() + permissionCode.slice(1).replace(/_/g, ' ') : permissionCode,
          description: typeof permissionCode === 'string' ? `${permissionCode.charAt(0).toUpperCase() + permissionCode.slice(1).replace(/_/g, ' ')} access` : `${permissionCode} access`,
          creditCost: creditConfig ? {
            cost: creditConfig.creditCost,
            unit: creditConfig.unit,
            unitMultiplier: creditConfig.unitMultiplier,
            isGlobal: creditConfig.isGlobal
          } : null
        });
      }
    }
  } else {
    // Fallback if no matrix definitions found
    for (const code of permissionCodes) {
      // Handle both string codes and permission objects
      const permissionCode = typeof code === 'string' ? code : String((code as { code?: string }).code ?? (code as unknown));
      const operationCode = `${appCode}.${moduleCode}.${permissionCode}`;
      const creditConfig = creditCostMap.get(operationCode);

      formattedPermissions.push({
        code: permissionCode,
        name: typeof permissionCode === 'string' ? permissionCode.charAt(0).toUpperCase() + permissionCode.slice(1).replace(/_/g, ' ') : permissionCode,
        description: typeof permissionCode === 'string' ? `${permissionCode.charAt(0).toUpperCase() + permissionCode.slice(1).replace(/_/g, ' ')} access` : `${permissionCode} access`,
        creditCost: creditConfig ? {
          cost: creditConfig.creditCost,
          unit: creditConfig.unit,
          unitMultiplier: creditConfig.unitMultiplier,
          isGlobal: creditConfig.isGlobal
        } : null
      });
    }
  }

  return formattedPermissions;
}
export class CustomRoleService {

  /**
   * 1️⃣ **CREATE ROLE FROM APPLICATIONS & MODULES**
   * Shows how applications and modules tables are used for role creation
   */
  static async createRoleFromAppsAndModules({
    tenantId,
    roleName,
    description,
    selectedApps,
    selectedModules,
    selectedPermissions,
    restrictions = {},
    metadata = {},
    createdBy = null
  }: {
    tenantId: string;
    roleName: string;
    description: string | null;
    selectedApps: string[];
    selectedModules: Record<string, string[]>;
    selectedPermissions: Record<string, string[]>;
    restrictions?: Record<string, unknown> | string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<typeof customRoles.$inferSelect> {

    Logger.log('info', 'role', 'create-custom-role', 'Creating custom role from apps and modules', { roleName, selectedApps, selectedModules });


    // 0. Get a default user for createdBy if not provided
    if (!createdBy) {
      const { tenantUsers } = await import('../../../db/schema/core/users.js');
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .limit(1);

      if (!user) {
        throw new Error(`No users found for tenant ${tenantId}. Cannot create role without a creator.`);
      }
      createdBy = user.userId;
      Logger.log('info', 'role', 'create-custom-role', 'Using default user as role creator', { userEmail: user.email });
    }

    // 1. Get applications from database
    if (!selectedApps || selectedApps.length === 0) {
      throw new Error('No applications selected. Please select at least one application.');
    }

    const apps = await db
      .select()
      .from(applications)
      .where(inArray(applications.appCode, selectedApps));

    Logger.log('info', 'role', 'create-custom-role', 'Found applications', { count: apps.length, appCodes: apps.map(a => a.appCode) });

    // 2. Build permission list by iterating through apps and modules
    const permissions: string[] = [];
    const roleMetadata = {
      ...metadata,
      selectedApps,
      selectedModules,
      selectedPermissions,
      createdFrom: 'applications_modules',
      createdAt: new Date().toISOString()
    };
    void roleMetadata;

    for (const app of apps) {
      const appSelectedModules = selectedModules[app.appCode] || [];

      // Skip this app if no modules are selected
      if (appSelectedModules.length === 0) {
        Logger.log('info', 'role', 'create-custom-role', 'App has no selected modules, skipping', { appCode: app.appCode });
        continue;
      }

      const appModules = await db
        .select()
        .from(applicationModules)
        .where(and(
          eq(applicationModules.appId, app.appId),
          inArray(applicationModules.moduleCode, appSelectedModules)
        ));

      Logger.log('info', 'role', 'create-custom-role', 'App has selected modules', { appCode: app.appCode, moduleCount: appModules.length });

      for (const module of appModules) {
        const moduleKey = `${app.appCode}.${module.moduleCode}`;
        const allowedPermissions = selectedPermissions[moduleKey] || [];

        // Add permissions for this module
        // Handle both string permissions and object permissions
        if (allowedPermissions.length > 0) {
          allowedPermissions.forEach((permCode: string) => {
            const fullCode = `${app.appCode}.${module.moduleCode}.${permCode}`;
            permissions.push(fullCode);
          });
        }
      }
    }

    // 3. Create custom role
    Logger.log('info', 'role', 'create-custom-role', 'Total permissions collected', { count: permissions.length });

    // Convert permissions to hierarchical format (consistent with Super Administrator)
    const hierarchicalPermissions = convertPermissionsToHierarchical(permissions);

    // Handle restrictions properly - avoid double-stringification
    let processedRestrictions;
    if (typeof restrictions === 'string') {
      processedRestrictions = restrictions;
    } else {
      processedRestrictions = JSON.stringify(restrictions);
    }

    const [role] = await db.insert(customRoles).values({
      tenantId,
      roleName,
      description,
      permissions: JSON.stringify(hierarchicalPermissions) as unknown as Record<string, unknown>, // Store in hierarchical format
      restrictions: (processedRestrictions as unknown) as Record<string, unknown>, // Handle restrictions properly
      isSystemRole: false, // This is a custom role
      createdBy: createdBy!,
      lastModifiedBy: createdBy!
    }).returning();

    Logger.log('info', 'role', 'create-custom-role', 'Created role with hierarchical permissions structure', { roleName });

    // Publish role creation event to relevant applications (only apps with permissions)
    try {
      await publishRoleEventToApplications(
        'role.created',
        tenantId,
        role?.roleId ?? '',
        {
          roleName: roleName,
          description: description,
          permissions: JSON.stringify(hierarchicalPermissions), // Pass as JSON string like the database stores it
          restrictions: processedRestrictions,
          metadata: metadata,
          createdBy: createdBy,
          createdAt: role.createdAt
        }
      );
      Logger.log('info', 'role', 'create-custom-role', 'Role creation event published', { roleId: role?.roleId });
    } catch (err: unknown) {
      const publishError = err as Error;
      Logger.log('warning', 'role', 'create-custom-role', 'Failed to publish role creation event', { error: publishError.message });
      // Don't fail the role creation if event publishing fails
    }

    return role!;
  }

  /**
   * 1.5️⃣ **UPDATE ROLE FROM APPLICATIONS & MODULES**
   * Updates existing role using applications and modules selection
   */
  static async updateRoleFromAppsAndModules({
    tenantId,
    roleId,
    roleName,
    description,
    selectedApps,
    selectedModules,
    selectedPermissions,
    restrictions = {},
    metadata = {},
    updatedBy = null
  }: {
    tenantId: string;
    roleId: string;
    roleName: string;
    description: string | null;
    selectedApps: string[];
    selectedModules: Record<string, string[]>;
    selectedPermissions: Record<string, string[]>;
    restrictions?: Record<string, unknown> | string;
    metadata?: Record<string, unknown>;
    updatedBy?: string | null;
  }): Promise<typeof customRoles.$inferSelect> {

    Logger.log('info', 'role', 'update-custom-role', 'Updating custom role from apps and modules');

    // 0. Check if role exists and is not a system role
    const [existingRole] = await db
      .select()
      .from(customRoles)
      .where(and(
        eq(customRoles.roleId, roleId),
        eq(customRoles.tenantId, tenantId)
      ));

    if (!existingRole) {
      throw new Error('Role not found');
    }

    if (existingRole.isSystemRole) {
      throw new Error('Cannot modify system roles');
    }

    // 1. Get a default user for updatedBy if not provided
    if (!updatedBy) {
      const { tenantUsers } = await import('../../../db/schema/core/users.js');
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .limit(1);

      if (!user) {
        throw new Error(`No users found for tenant ${tenantId}. Cannot update role without an updater.`);
      }
      updatedBy = user.userId;
      Logger.log('info', 'role', 'update-custom-role', 'Using default user as role updater', { userEmail: user.email });
    }

    // 2. Get applications from database
    if (!selectedApps || selectedApps.length === 0) {
      throw new Error('No applications selected. Please select at least one application.');
    }

    const apps = await db
      .select()
      .from(applications)
      .where(inArray(applications.appCode, selectedApps));

    Logger.log('info', 'role', 'update-custom-role', 'Found applications', { count: apps.length, appCodes: apps.map(a => a.appCode) });

    // 3. Build permission list by iterating through apps and modules
    const permissions: string[] = [];
    const updateRoleMetadata = {
      ...metadata,
      selectedApps,
      selectedModules,
      selectedPermissions,
      updatedFrom: 'applications_modules',
      updatedAt: new Date().toISOString()
    };
    void updateRoleMetadata;

    for (const app of apps) {
      const appSelectedModules = (selectedModules[app.appCode] || []) as string[];

      // Skip this app if no modules are selected
      if (appSelectedModules.length === 0) {
        Logger.log('info', 'role', 'update-custom-role', 'App has no selected modules, skipping', { appCode: app.appCode });
        continue;
      }

      const appModules = await db
        .select()
        .from(applicationModules)
        .where(and(
          eq(applicationModules.appId, app.appId),
          inArray(applicationModules.moduleCode, appSelectedModules)
        ));

      Logger.log('info', 'role', 'update-custom-role', 'App has selected modules', { appCode: app.appCode, moduleCount: appModules.length });

      for (const module of appModules) {
        const moduleKey = `${app.appCode}.${module.moduleCode}`;
        const allowedPermissions = (selectedPermissions[moduleKey] || []) as string[];
        const modulePerms = (module.permissions || []) as { code: string }[];

        // Add permissions for this module
        modulePerms.forEach((permission: { code: string }) => {
          if (allowedPermissions.includes(permission.code)) {
            const fullCode = `${app.appCode}.${module.moduleCode}.${permission.code}`;
            permissions.push(fullCode);
          }
        });
      }
    }

    // 4. Update custom role
    // Convert permissions to hierarchical format (consistent with Super Administrator)
    const hierarchicalPermissions = convertPermissionsToHierarchical(permissions);

    // Handle restrictions properly - avoid double-stringification
    let processedRestrictions;
    if (typeof restrictions === 'string') {
      processedRestrictions = restrictions;
    } else {
      processedRestrictions = JSON.stringify(restrictions);
    }

    const [updatedRole] = await db
      .update(customRoles)
      .set({
        roleName,
        description,
        permissions: JSON.stringify(hierarchicalPermissions) as unknown as Record<string, unknown>,
        restrictions: (processedRestrictions as unknown) as Record<string, unknown>,
        lastModifiedBy: updatedBy!,
        updatedAt: new Date()
      })
      .where(and(
        eq(customRoles.roleId, roleId),
        eq(customRoles.tenantId, tenantId)
      ))
      .returning();

    Logger.log('info', 'role', 'update-custom-role', 'Updated role with hierarchical permissions structure', { roleName });

    // Publish role change event to Redis streams for real-time sync
    try {
      // Redis removed - using AWS MQ publisher

      // Publish using standard publishRoleEvent method for consistency
      const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
      await snsSqsPublisher.publishRoleEventToSuite('role_updated', tenantId, updatedRole.roleId, {
        roleId: updatedRole.roleId,
        roleName: updatedRole.roleName,
        description: updatedRole.description,
        permissions: typeof updatedRole.permissions === 'string'
          ? JSON.parse(updatedRole.permissions)
          : updatedRole.permissions,
        restrictions: typeof updatedRole.restrictions === 'string'
          ? JSON.parse(updatedRole.restrictions)
          : updatedRole.restrictions,
        updatedBy: updatedBy,
        updatedAt: updatedRole.updatedAt || new Date().toISOString(),
        isSystemRole: updatedRole.isSystemRole || false
      });

      Logger.log('info', 'role', 'update-custom-role', 'Published role_updated event', { roleName });

      // Also publish to custom stream for backward compatibility
      const eventData = {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        eventType: 'role_permissions_changed',
        tenantId: tenantId,
        entityType: 'role',
        entityId: updatedRole.roleId,
        action: 'permissions_updated',
        data: {
          roleId: updatedRole.roleId,
          roleName: updatedRole.roleName,
          permissions: typeof updatedRole.permissions === 'string' ? JSON.parse(updatedRole.permissions) : (updatedRole.permissions ?? {}),
          isActive: (updatedRole as Record<string, unknown>).isActive !== false,
          description: updatedRole.description,
          scope: updatedRole.scope || 'organization'
        },
        metadata: {
          correlationId: `role_permissions_${updatedRole.roleId}_${Date.now()}`,
          version: '1.0',
          sourceTimestamp: new Date().toISOString(),
          sourceApp: 'wrapper'
        }
      };

      // Publish to AWS MQ (reusing snsSqsPublisher from above)
      const result = await snsSqsPublisher.publishInterAppEvent({
        eventType: 'role_permissions_changed',
        sourceApplication: 'wrapper',
        targetApplication: 'crm',
        tenantId: tenantId,
        entityId: updatedRole.roleId,
        eventData: eventData
      });

      Logger.log('info', 'role', 'update-custom-role', 'Published role permissions change event to AWS MQ', { roleName, eventId: result?.eventId });
    } catch (err: unknown) {
      const publishError = err as Error;
      Logger.log('warning', 'role', 'update-custom-role', 'Failed to publish role change event', { error: publishError.message });
      // Don't fail the role update if event publishing fails
    }

    return updatedRole!;
  }

  /**
   * 2️⃣ **GET ROLE CREATION OPTIONS (CREDIT-BASED)**
   * Shows all enabled applications and modules for the tenant
   * Uses organization_applications table for access control
   */
  static async getRoleCreationOptions(tenantId: string): Promise<Record<string, unknown>[]> {
    Logger.log('info', 'role', 'get-role-creation-options', 'Getting role creation options for tenant', { tenantId });

    // Get organization's available applications
    const orgApps = await db
      .select({
        appId: applications.appId,
        appCode: applications.appCode,
        appName: applications.appName,
        description: applications.description,
        subscriptionTier: organizationApplications.subscriptionTier,
        isEnabled: organizationApplications.isEnabled,
        enabledModules: organizationApplications.enabledModules,
        customPermissions: organizationApplications.customPermissions
      })
      .from(applications)
      .innerJoin(organizationApplications, and(
        eq(organizationApplications.appId, applications.appId),
        eq(organizationApplications.tenantId, tenantId),
        eq(organizationApplications.isEnabled, true)
      ));

    global.logToES('info', '[role-builder] apps_loaded', { tenantId, appCount: orgApps.length });

    if (orgApps.length === 0) {
      // Check if tenant has any subscription at all (to distinguish "no plan" from "broken provisioning")
      const { subscriptions } = await import('../../../db/schema/index.js');
      const [sub] = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      if (sub) {
        // Tenant has a plan but no org_apps — provisioning failed
        throw Object.assign(
          new Error('Tenant applications not provisioned. Run reconcile to fix.'),
          {
            statusCode: 409,
            code: 'TENANT_APPS_NOT_PROVISIONED',
            tenantId,
            plan: sub.plan,
          }
        );
      }
      // No subscription at all → return empty array (onboarding not finished)
      return [];
    }

    // Get modules for each app based on credit-based access control
    const appsWithModules = await Promise.all(
      orgApps.map(async (app) => {
        const allModules = await db
          .select()
          .from(applicationModules)
          .where(eq(applicationModules.appId, app.appId));

        // Filter modules based on enabledModules from organization_applications
        let accessibleModules = allModules;

        const enabledMods = app.enabledModules as string[] | undefined;
        if (enabledMods && Array.isArray(enabledMods) && enabledMods.length > 0) {
          // Filter to only enabled modules
          accessibleModules = allModules.filter((module: { moduleCode: string }) =>
            enabledMods.includes(module.moduleCode)
          );
          Logger.log('info', 'role', 'get-role-creation-options', 'App modules enabled via credit system', { appCode: app.appCode, accessible: accessibleModules.length, total: allModules.length });
        } else {
          Logger.log('info', 'role', 'get-role-creation-options', 'App modules all accessible', { appCode: app.appCode, accessible: accessibleModules.length, total: allModules.length });
        }

        // Process modules with permissions formatting
        const processedModules = await Promise.all(
          accessibleModules.map(async (module: { permissions?: unknown; moduleId: string; moduleCode: string; moduleName: string; description: string | null; isCore: boolean | null }) => {
            // Use custom permissions from organization_applications if available
            let modulePermissions: Record<string, unknown>[] = Array.isArray(module.permissions) ? (module.permissions as Record<string, unknown>[]) : [];

            if (app.customPermissions && typeof app.customPermissions === 'object') {
              const customModulePermissions = (app.customPermissions as Record<string, unknown>)[module.moduleCode];
              if (customModulePermissions && Array.isArray(customModulePermissions)) {
                // Check if custom permissions are already formatted objects or just codes
                const customArr = Array.isArray(customModulePermissions) ? customModulePermissions : [];
                if (customArr.length > 0) {
                  const firstValidElement = customArr.find((perm: unknown) => perm != null);
                  if (firstValidElement && typeof firstValidElement === 'string') {
                    modulePermissions = await formatPermissionsForUI(customArr as string[], app.appCode, module.moduleCode, tenantId);
                  } else {
                    modulePermissions = customArr as Record<string, unknown>[];
                  }
                } else {
                  const defaultPerms = (module.permissions || []) as string[] | { code?: string }[];
                  modulePermissions = await formatPermissionsForUI(defaultPerms, app.appCode, module.moduleCode, tenantId);
                }
                Logger.log('info', 'role', 'get-role-creation-options', 'Using custom permissions for module', { moduleCode: module.moduleCode, count: modulePermissions.length });
              } else {
                const defaultPerms = (module.permissions || []) as string[] | { code?: string }[];
                modulePermissions = await formatPermissionsForUI(defaultPerms, app.appCode, module.moduleCode, tenantId);
              }
            } else {
              const defaultPerms = (module.permissions || []) as string[] | { code?: string }[];
              modulePermissions = await formatPermissionsForUI(defaultPerms, app.appCode, module.moduleCode, tenantId);
            }

            return {
              moduleId: module.moduleId,
              moduleCode: module.moduleCode,
              moduleName: module.moduleName,
              description: module.description,
              isCore: module.isCore,
              permissions: modulePermissions
            };
          })
        );

        return {
          appId: app.appId,
          appCode: app.appCode,
          appName: app.appName,
          description: app.description,
          subscriptionTier: app.subscriptionTier,
          modules: processedModules
        };
      })
    );

    return appsWithModules;
  }

  /**
   * 🎯 **DYNAMIC MODULE ACCESS CONTROL**
   * Determines which modules are accessible based on subscription tier
   */
  static async getAccessibleModulesForApp(
    appCode: string,
    subscriptionTier: string,
    allModules: { moduleCode: string }[],
    fallbackEnabledModules: string[] | null = null
  ): Promise<{ moduleCode: string }[]> {
    Logger.log('info', 'role', 'get-accessible-modules', 'Determining accessible modules', { appCode, subscriptionTier });

    // Get tier-based accessible modules
    const tierModules = getAccessibleModules(appCode, subscriptionTier as 'custom' | 'starter' | 'professional' | 'enterprise' | 'free');

    if (tierModules === 'all') {
      // Enterprise tier gets all modules
      Logger.log('info', 'role', 'get-accessible-modules', 'Enterprise tier: all modules accessible', { appCode, count: allModules.length });
      return allModules;
    }

    if (Array.isArray(tierModules) && tierModules.length > 0) {
      // Filter modules based on tier configuration
      const tierModulesArr = tierModules as string[];
      const accessibleModules = allModules.filter((module: { moduleCode: string }) =>
        tierModulesArr.includes(module.moduleCode)
      );
      Logger.log('info', 'role', 'get-accessible-modules', 'Tier-based module access', { appCode, subscriptionTier, count: accessibleModules.length });
      return accessibleModules;
    }

    // Fallback to organization-specific enabled modules
    if (fallbackEnabledModules && Array.isArray(fallbackEnabledModules)) {
      const fallbackModules = allModules.filter((module: { moduleCode: string }) =>
        fallbackEnabledModules.includes(module.moduleCode)
      );
      Logger.log('info', 'role', 'get-accessible-modules', 'Fallback to org-specific module access', { appCode, count: fallbackModules.length });
      return fallbackModules;
    }

    // No access or invalid configuration
    Logger.log('info', 'role', 'get-accessible-modules', 'No access configured for app on tier', { appCode, subscriptionTier });
    return [];
  }

  /**
   * 🚀 **AUTO-UPDATE ORGANIZATION ACCESS**
   * Automatically updates organization_applications based on subscription changes
   */
  static async updateOrganizationAccess(tenantId: string, subscriptionTier: string): Promise<void> {
    Logger.log('info', 'role', 'update-org-access', 'Auto-updating organization access', { tenantId, subscriptionTier });

    // Get all applications
    const allApps = await db.select().from(applications);

    for (const app of allApps) {
      // Get accessible modules for this app and tier
      const accessibleModuleCodes = getAccessibleModules(app.appCode, subscriptionTier as 'custom' | 'starter' | 'professional' | 'enterprise' | 'free');

      if (accessibleModuleCodes === 'all') {
        // Enterprise: Get all actual modules for this app
        const allModules = await db
          .select()
          .from(applicationModules)
          .where(eq(applicationModules.appId, app.appId));

        const allModuleCodes = allModules.map(m => m.moduleCode);

        await this.upsertOrganizationApplication(tenantId, app.appId, {
          subscriptionTier,
          enabledModules: allModuleCodes,
          isEnabled: true
        });

        Logger.log('info', 'role', 'update-org-access', 'All modules enabled for app', { appCode: app.appCode, count: allModuleCodes.length });

      } else if (Array.isArray(accessibleModuleCodes) && accessibleModuleCodes.length > 0) {
        // Specific modules
        await this.upsertOrganizationApplication(tenantId, app.appId, {
          subscriptionTier,
          enabledModules: accessibleModuleCodes,
          isEnabled: true
        });

        Logger.log('info', 'role', 'update-org-access', 'Specific modules enabled for app', { appCode: app.appCode, count: accessibleModuleCodes.length });

      } else {
        // No access - disable the app
        await this.upsertOrganizationApplication(tenantId, app.appId, {
          subscriptionTier,
          enabledModules: [],
          isEnabled: false
        });

        Logger.log('info', 'role', 'update-org-access', 'Access disabled for app', { appCode: app.appCode });
      }
    }

    Logger.log('info', 'role', 'update-org-access', 'Organization access updated successfully', { subscriptionTier });
  }

  /**
   * Helper method to upsert organization application record
   */
  static async upsertOrganizationApplication(
    tenantId: string,
    appId: string,
    config: { subscriptionTier: string; enabledModules: string[]; isEnabled: boolean }
  ): Promise<void> {
    const existing = await db
      .select()
      .from(organizationApplications)
      .where(and(
        eq(organizationApplications.tenantId, tenantId),
        eq(organizationApplications.appId, appId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(organizationApplications)
        .set({
          subscriptionTier: config.subscriptionTier,
          enabledModules: config.enabledModules,
          isEnabled: config.isEnabled,
          updatedAt: new Date()
        })
        .where(and(
          eq(organizationApplications.tenantId, tenantId),
          eq(organizationApplications.appId, appId)
        ));
    } else {
      // Insert new
      await db.insert(organizationApplications).values({
        tenantId,
        appId,
        subscriptionTier: config.subscriptionTier,
        enabledModules: config.enabledModules,
        isEnabled: config.isEnabled
      });
    }
  }

  /**
   * 3️⃣ **ASSIGN USER-SPECIFIC PERMISSIONS**
   * Shows why user_application_permissions table is needed - granular user-level control
   */
  static async assignUserSpecificPermissions({
    userId,
    tenantId: _tenantId,
    appCode: _appCode,
    moduleCode: _moduleCode,
    permissions: _permissions,
    reason = 'Custom access granted',
    expiresAt = null
  }: {
    userId: string;
    tenantId: string;
    appCode: string;
    moduleCode: string;
    permissions: string[] | Record<string, unknown>;
    reason?: string;
    expiresAt?: string | null;
  }): Promise<Record<string, unknown>> {
    Logger.log('info', 'role', 'assign-user-permissions', 'Assigning user-specific permissions — table dropped, no-op', { userId });
    return {};
  }

  /**
   * 4️⃣ **COMPLETE PERMISSION RESOLUTION**
   * Shows how all tables work together to resolve final permissions
   */
  static async resolveUserPermissions({ userId, tenantId }: { userId: string; tenantId: string }): Promise<{
    permissions: string[];
    sources: Array<{ source: string; roleName?: string; permission: string; reason?: string }>;
    summary: { totalPermissions: number; rolePermissions: number; userOverrides: number; organizationApps: number };
  }> {
    Logger.log('info', 'role', 'resolve-user-permissions', 'Resolving complete permissions for user', { userId });

    const allPermissions = new Set<string>();
    type PermSource = { source: string; roleName?: string; permission: string; reason?: string };
    const permissionSources: PermSource[] = [];

    // 1. Get user's roles and their permissions
    const userRoles = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));

    userRoles.forEach((role: { permissions?: unknown; roleName?: string | null }) => {
      const perms = role.permissions;
      if (perms && Array.isArray(perms)) {
        (perms as string[]).forEach((permission: string) => {
          allPermissions.add(permission);
          permissionSources.push({
            source: 'role',
            roleName: (role.roleName ?? '') as string,
            permission
          });
        });
      } else if (perms && typeof perms === 'object' && perms !== null) {
        // Hierarchical format: flatten to full codes
        const flatPerms = flattenPermissions(perms as Record<string, unknown>);
        flatPerms.forEach((permission: string) => {
          allPermissions.add(permission);
          permissionSources.push({ source: 'role', roleName: (role.roleName ?? '') as string, permission });
        });
      }
    });

    // 2. Get organization applications (filter what's available)
    const orgApps = await db
      .select()
      .from(organizationApplications)
      .where(and(
        eq(organizationApplications.tenantId, tenantId),
        eq(organizationApplications.isEnabled, true)
      ));

    Logger.log('info', 'role', 'resolve-user-permissions', 'Resolved permissions', { totalPermissions: allPermissions.size, sources: permissionSources.length });

    return {
      permissions: Array.from(allPermissions),
      sources: permissionSources,
      summary: {
        totalPermissions: allPermissions.size,
        rolePermissions: permissionSources.filter(s => s.source === 'role').length,
        userOverrides: permissionSources.filter(s => s.source === 'user_override').length,
        organizationApps: orgApps.length
      }
    };
  }

  /**
   * 5️⃣ **PRACTICAL EXAMPLES - Why We Need Each Table**
   */
  static async demonstrateTableUsage(): Promise<void> {
    Logger.log('info', 'role', 'demonstrate-table-usage', 'Demonstrating table usage: Applications/Modules define what exists; OrganizationApplications controls tenant access; UserApplicationPermissions handles individual overrides. Together they enable standard plans, custom packages, role-based access, individual overrides, and compliance/security restrictions.');
  }
}

// Export helper functions for API routes
export default CustomRoleService; 