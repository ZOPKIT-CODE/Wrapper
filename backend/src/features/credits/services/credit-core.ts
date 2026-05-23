import { db } from '../../../db/index.js';
import { credits, applications as applicationsTable, applicationModules } from '../../../db/schema/index.js';
import { eq, and, isNull, desc } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

/**
 * Initialize credit record for an entity if it doesn't exist
 */
export async function ensureCreditRecord(tenantId: string, entityType = 'organization', entityId: string | null = null, initialCredits = 0): Promise<boolean> {
  try {
    const searchEntityId = entityId || tenantId;
    const { entities } = await import('../../../db/schema/index.js');
    const [existingEntity] = await db
      .select({ entityId: entities.entityId })
      .from(entities)
      .where(and(
        eq(entities.entityId, searchEntityId),
        eq(entities.tenantId, tenantId),
        eq(entities.isActive, true)
      ))
      .limit(1);

    if (!existingEntity) {
      Logger.log('warning', 'billing', 'ensure-credit-record', 'Cannot create credit record: entity does not exist', { entityId: searchEntityId });
      return false;
    }

    const [existingRecord] = await db
      .select()
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenantId),
        eq(credits.entityId, searchEntityId)
      ))
      .limit(1);

    if (!existingRecord) {
      await db
        .insert(credits)
        .values({
          tenantId,
          entityId: searchEntityId,
          availableCredits: initialCredits.toString(),
          isActive: true,
          lastUpdatedAt: new Date()
        });
      return true;
    }
    return false;
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'ensure-credit-record', 'Error ensuring credit record', { error: error.message });
    throw error;
  }
}

/**
 * Find the primary/root organization for a tenant
 */
export async function findRootOrganization(tenantId: string): Promise<string | null> {
  try {
    const { entities } = await import('../../../db/schema/index.js');
    const { organizationMemberships } = await import('../../../db/schema/organizations/organization_memberships.js');

    const primaryOrgMembership = await db
      .select({ entityId: organizationMemberships.entityId })
      .from(organizationMemberships)
      .where(and(
        eq(organizationMemberships.tenantId, tenantId),
        eq(organizationMemberships.entityType, 'organization'),
        eq(organizationMemberships.membershipStatus, 'active'),
        eq(organizationMemberships.isPrimary, true)
      ))
      .limit(1);

    if (primaryOrgMembership.length > 0) {
      const primaryEntityId = primaryOrgMembership[0].entityId;
      const [primaryOrg] = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(and(
          eq(entities.entityId, primaryEntityId),
          eq(entities.isActive, true)
        ))
        .limit(1);
      if (primaryOrg) return primaryOrg.entityId;
    }

    const [defaultOrg] = await db
      .select({ entityId: entities.entityId })
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'organization'),
        isNull(entities.parentEntityId),
        eq(entities.isActive, true)
      ))
      .limit(1);
    if (defaultOrg) return defaultOrg.entityId;

    const [rootOrg] = await db
      .select({ entityId: entities.entityId })
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'organization'),
        isNull(entities.parentEntityId),
        eq(entities.isActive, true)
      ))
      .orderBy(desc(entities.createdAt))
      .limit(1);
    return rootOrg?.entityId ?? null;
  } catch (err: unknown) {
    Logger.log('warning', 'billing', 'find-root-organization', 'No root organization found for tenant', { tenantId, error: (err as Error).message });
    return null;
  }
}

/**
 * Get permissions for a specific module
 */
export async function getModulePermissions(moduleCode: string): Promise<string[]> {
  try {
    const [module] = await db
      .select({
        permissions: applicationModules.permissions,
        appCode: applicationsTable.appCode
      })
      .from(applicationModules)
      .leftJoin(applicationsTable, eq(applicationModules.appId, applicationsTable.appId))
      .where(and(
        eq(applicationModules.moduleCode, moduleCode),
        eq(applicationsTable.status, 'active')
      ))
      .limit(1);

    if (!module || !module.permissions) {
      // Fallback to standard permissions if not found in database
      const appCode = module?.appCode || 'system';
      return [
        `${appCode}.${moduleCode}.view`,
        `${appCode}.${moduleCode}.create`,
        `${appCode}.${moduleCode}.edit`,
        `${appCode}.${moduleCode}.delete`,
        `${appCode}.${moduleCode}.export`,
        `${appCode}.${moduleCode}.import`
      ];
    }

    // Return permissions from database, formatted with app and module prefix
    const appCode = module.appCode;
    if (Array.isArray(module.permissions)) {
      if (module.permissions.length > 0 && typeof module.permissions[0] === 'object') {
        // Permissions are objects with code property
        return module.permissions.map(permission => `${appCode}.${moduleCode}.${(permission as { code?: string }).code || permission}`);
      } else {
        // Permissions are simple strings
        return module.permissions.map(permission => `${appCode}.${moduleCode}.${permission}`);
      }
    }
    return [];
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'get-module-permissions', 'Error fetching module permissions', { error: error.message });
    return [
      `system.${moduleCode}.view`,
      `system.${moduleCode}.create`,
      `system.${moduleCode}.edit`,
      `system.${moduleCode}.delete`,
      `system.${moduleCode}.export`,
      `system.${moduleCode}.import`
    ];
  }
}
