/**
 * Entity / org visibility for hierarchy and app-scoped flows (no HTTP middleware).
 */

import type { UserContext } from '../../../types/common.js';
import { db } from '../../../db/index.js';
import { entities } from '../../../db/schema/organizations/unified-entities.js';
import { organizationMemberships } from '../../../db/schema/organizations/organization_memberships.js';
import { eq, and, inArray } from 'drizzle-orm';

export interface DataIsolationUserContext {
  userId: string;
  internalUserId?: string | null;
  tenantId: string | null;
  roles?: string[];
  isTenantAdmin?: boolean;
}

export type ApplicationIsolationUserContext = {
  userId: string;
  internalUserId?: string | null;
  tenantId: string | null;
  roles?: string[];
  isTenantAdmin?: boolean;
};

interface MembershipRow {
  organizationId: string;
  membershipType: string | null;
  membershipStatus: string | null;
}

function resolveRolesAndTenantAdmin(
  userContext: UserContext | DataIsolationUserContext
): { roles: string[]; isTenantAdmin: boolean } {
  const u = userContext as UserContext & DataIsolationUserContext;
  const roles = u.roles ?? [];
  const isTenantAdmin =
    roles.includes('TENANT_ADMIN') || Boolean(u.isTenantAdmin);
  return { roles, isTenantAdmin };
}

export class DataIsolationService {
  async getUserAccessibleOrganizations(
    userContext: UserContext | DataIsolationUserContext
  ): Promise<string[]> {
    const { userId, internalUserId, tenantId } = userContext;
    const { roles, isTenantAdmin } = resolveRolesAndTenantAdmin(userContext);
    console.log(
      '🔍 getUserAccessibleOrganizations - userId:',
      userId,
      'internalUserId:',
      internalUserId,
      'tenantId:',
      tenantId,
      'roles:',
      roles
    );

    let userMemberships: MembershipRow[] = [];
    try {
      const result = await db
        .select({
          organizationId: organizationMemberships.entityId,
          membershipType: organizationMemberships.membershipType,
          membershipStatus: organizationMemberships.membershipStatus,
        })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.userId, internalUserId || userId),
            eq(organizationMemberships.entityType, 'organization'),
            eq(organizationMemberships.membershipStatus, 'active'),
            ...(tenantId ? [eq(organizationMemberships.tenantId, tenantId)] : [])
          )
        );
      userMemberships = result as unknown as MembershipRow[];
      console.log(
        '✅ User organization memberships query successful:',
        userMemberships.length,
        'records'
      );
    } catch (err: unknown) {
      const queryError = err as Error;
      console.error('❌ User organization memberships query failed:', queryError);
      console.error('❌ Query error details:', queryError.message);
      console.error('❌ Using userId:', internalUserId || userId);
      userMemberships = [];
    }

    const directOrgIds = userMemberships
      .map((m) => m.organizationId)
      .filter((id): id is string => id != null);
    console.log('📋 Direct entity IDs:', directOrgIds);

    if (!tenantId) return [];
    if (isTenantAdmin) {
      console.log('👑 User is tenant admin, granting access to all organizations');
      const allOrgs = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(
          and(eq(entities.tenantId, tenantId), eq(entities.entityType, 'organization'))
        );

      return allOrgs.map((org) => org.entityId);
    }

    const accessibleOrgs = new Set(directOrgIds);

    if (directOrgIds.length === 0) {
      console.log('ℹ️ User has no direct organization memberships, returning empty array');
      return [];
    }

    for (const entityId of directOrgIds) {
      const entity = await db
        .select({ parentEntityId: entities.parentEntityId })
        .from(entities)
        .where(eq(entities.entityId, entityId))
        .limit(1);

      if (entity[0]?.parentEntityId) {
        accessibleOrgs.add(entity[0].parentEntityId);
      }
    }

    for (const entityId of directOrgIds) {
      const children = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(
          and(eq(entities.parentEntityId, entityId), eq(entities.entityType, 'organization'))
        );

      children.forEach((child) => accessibleOrgs.add(child.entityId));
    }

    return Array.from(accessibleOrgs);
  }

  async getUserAccessibleLocations(
    userContext: UserContext | DataIsolationUserContext,
    _accessibleOrgs: string[]
  ): Promise<string[]> {
    if (!_accessibleOrgs || _accessibleOrgs.length === 0 || !userContext.tenantId) {
      return [];
    }
    const tenantId = userContext.tenantId;
    const locationResults = await db
      .select({ entityId: entities.entityId })
      .from(entities)
      .where(
        and(eq(entities.tenantId, tenantId), eq(entities.entityType, 'location'))
      );

    return locationResults.map((result) => result.entityId);
  }

  async filterOrganizationsByAccess(
    organizations: Array<{ entityId: string }>,
    userContext: UserContext | DataIsolationUserContext
  ): Promise<Array<{ entityId: string }>> {
    const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
    return organizations.filter((org) => accessibleOrgs.includes(org.entityId));
  }

  async filterLocationsByAccess(
    locations: Array<{ entityId: string }>,
    userContext: UserContext | DataIsolationUserContext
  ): Promise<Array<{ entityId: string }>> {
    const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
    const accessibleLocations = await this.getUserAccessibleLocations(
      userContext,
      accessibleOrgs
    );

    return locations.filter((loc) => accessibleLocations.includes(loc.entityId));
  }

  async canAccessEntity(
    userContext: UserContext | DataIsolationUserContext,
    entityId: string
  ): Promise<boolean> {
    const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
    const accessibleLocations = await this.getUserAccessibleLocations(
      userContext,
      accessibleOrgs
    );

    return accessibleOrgs.includes(entityId) || accessibleLocations.includes(entityId);
  }

  async getUserAccessScope(
    userContext: UserContext | DataIsolationUserContext
  ): Promise<{
    organizations: Array<Record<string, unknown>>;
    locations: Array<Record<string, unknown>>;
    scope: { orgCount: number; locationCount: number };
  }> {
    try {
      console.log('🔍 getUserAccessScope - Starting with userContext:', {
        userId: userContext.userId,
        tenantId: userContext.tenantId,
        roles: 'roles' in userContext ? userContext.roles : undefined,
      });

      const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
      console.log('📋 Accessible organizations:', accessibleOrgs);

      const accessibleLocations = await this.getUserAccessibleLocations(
        userContext,
        accessibleOrgs
      );
      console.log('📍 Accessible locations:', accessibleLocations);

      const cleanOrgIds = (accessibleOrgs || []).filter((id) => id != null);
      const cleanLocationIds = (accessibleLocations || []).filter((id) => id != null);

      console.log('🧹 Clean org IDs:', cleanOrgIds);
      console.log('🧹 Clean location IDs:', cleanLocationIds);

      let orgDetails: Array<Record<string, unknown>> = [];
      let locationDetails: Array<Record<string, unknown>> = [];

      if (cleanOrgIds.length > 0 || cleanLocationIds.length > 0) {
        console.log('🔍 Querying entity details...');
        try {
          const allEntityIds = [...cleanOrgIds, ...cleanLocationIds];
          const entityDetails = await db
            .select({
              entityId: entities.entityId,
              entityName: entities.entityName,
              entityType: entities.entityType,
              organizationType: entities.organizationType,
            })
            .from(entities)
            .where(inArray(entities.entityId, allEntityIds));

          orgDetails = entityDetails
            .filter((e) => e.entityType === 'organization')
            .map((e) => ({
              organizationId: e.entityId,
              organizationName: e.entityName,
              organizationType: e.organizationType,
            }));

          locationDetails = entityDetails
            .filter((e) => e.entityType === 'location')
            .map((e) => ({
              locationId: e.entityId,
              locationName: e.entityName,
            }));

          console.log(
            '✅ Entity details retrieved:',
            entityDetails.length,
            '(orgs:',
            orgDetails.length,
            ', locs:',
            locationDetails.length,
            ')'
          );
        } catch (entityError: unknown) {
          console.error('❌ Entity query failed:', entityError);
          orgDetails = [];
          locationDetails = [];
        }
      } else {
        console.log('ℹ️ No accessible entities, skipping query');
      }

      const result = {
        organizations: orgDetails || [],
        locations: locationDetails || [],
        scope: {
          orgCount: cleanOrgIds.length,
          locationCount: cleanLocationIds.length,
        },
      };

      console.log('✅ getUserAccessScope - Success:', result.scope);
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error in getUserAccessScope:', error);
      console.error('❌ Error stack:', error.stack);
      return {
        organizations: [],
        locations: [],
        scope: {
          orgCount: 0,
          locationCount: 0,
        },
      };
    }
  }
}

export const dataIsolationService = new DataIsolationService();

type AppAccessResult = {
  hasAccess: boolean;
  entities: string[];
  permissions: number;
  application?: string;
  scope?: { entityCount: number; orgCount: number; locationCount: number };
  organizations?: string[];
  locations?: string[];
};

export class ApplicationDataIsolationService {
  static APPLICATIONS = {
    CRM: 'crm',
    HR: 'hr',
    FINANCE: 'finance',
    SALES: 'sales',
    MARKETING: 'marketing',
    INVENTORY: 'inventory',
    PROJECTS: 'projects',
    ANALYTICS: 'analytics',
  };

  static PERMISSION_LEVELS = {
    NONE: 0,
    VIEWER: 1,
    EDITOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4,
  };

  async getUserApplicationAccess(
    userContext: ApplicationIsolationUserContext,
    application: string
  ): Promise<Record<string, unknown>> {
    const { tenantId } = userContext;
    if (!tenantId) {
      return {
        hasAccess: false,
        entities: [],
        permissions: ApplicationDataIsolationService.PERMISSION_LEVELS.NONE,
        application,
        organizations: [],
        locations: [],
        scope: { entityCount: 0, orgCount: 0, locationCount: 0 },
      };
    }

    const accessibleOrgs = await dataIsolationService.getUserAccessibleOrganizations(
      userContext
    );
    const accessibleLocations = await dataIsolationService.getUserAccessibleLocations(
      userContext,
      accessibleOrgs
    );

    const hasAccess =
      accessibleOrgs.length > 0 || accessibleLocations.length > 0;
    if (!hasAccess) {
      return {
        hasAccess: false,
        entities: [],
        permissions: ApplicationDataIsolationService.PERMISSION_LEVELS.NONE,
        application,
        organizations: [],
        locations: [],
        scope: { entityCount: 0, orgCount: 0, locationCount: 0 },
      };
    }

    return {
      hasAccess: true,
      entities: [...accessibleOrgs, ...accessibleLocations],
      organizations: accessibleOrgs,
      locations: accessibleLocations,
      permissions: ApplicationDataIsolationService.PERMISSION_LEVELS.ADMIN,
      application,
      scope: {
        entityCount: accessibleOrgs.length + accessibleLocations.length,
        orgCount: accessibleOrgs.length,
        locationCount: accessibleLocations.length,
      },
    };
  }

  async canAccessDataInApplication(
    userContext: ApplicationIsolationUserContext,
    application: string,
    dataType: string,
    dataId: string
  ): Promise<boolean> {
    try {
      const appAccess = (await this.getUserApplicationAccess(
        userContext,
        application
      )) as AppAccessResult;
      if (!appAccess.hasAccess) return false;
      switch (dataType) {
        case 'organization':
        case 'location':
          return (appAccess.entities ?? []).includes(dataId);
        case 'user':
          return true;
        default:
          return false;
      }
    } catch (err: unknown) {
      console.error('❌ Error in canAccessDataInApplication:', err);
      return false;
    }
  }

  async filterDataByApplication(
    data: Record<string, unknown> | Record<string, unknown>[],
    userContext: ApplicationIsolationUserContext,
    application: string,
    _dataType = 'organization'
  ): Promise<Record<string, unknown>[] | Record<string, unknown> | null> {
    try {
      const appAccess = (await this.getUserApplicationAccess(
        userContext,
        application
      )) as AppAccessResult;
      if (!appAccess.hasAccess) return Array.isArray(data) ? [] : null;
      if (Array.isArray(data)) {
        return data.filter((item) => {
          const itemId =
            (item as Record<string, unknown>).organizationId ??
            (item as Record<string, unknown>).locationId ??
            (item as Record<string, unknown>).userId;
          return (
            typeof itemId === 'string' &&
            (appAccess.entities ?? []).includes(itemId)
          );
        });
      }
      const itemId =
        (data as Record<string, unknown>).organizationId ??
        (data as Record<string, unknown>).locationId ??
        (data as Record<string, unknown>).userId;
      const canAccess =
        typeof itemId === 'string' &&
        (appAccess.entities ?? []).includes(itemId);

      return canAccess ? data : null;
    } catch (err: unknown) {
      console.error('❌ Error in filterDataByApplication:', err);
      return Array.isArray(data) ? [] : null;
    }
  }

  async getUserCompleteAccessProfile(
    userContext: ApplicationIsolationUserContext
  ): Promise<Record<string, unknown>> {
    const profile: Record<string, unknown> = {
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      applications: {} as Record<string, unknown>,
    };

    for (const [appName, appCode] of Object.entries(
      ApplicationDataIsolationService.APPLICATIONS
    )) {
      try {
        const appAccess = (await this.getUserApplicationAccess(
          userContext,
          appCode
        )) as AppAccessResult & { permissions?: number };
        (profile.applications as Record<string, unknown>)[appCode] = {
          name: appName,
          hasAccess: appAccess.hasAccess,
          permissionLevel: appAccess.permissions,
          organizationCount: appAccess.scope?.orgCount || 0,
          locationCount: appAccess.scope?.locationCount || 0,
        };
      } catch (err: unknown) {
        const error = err as Error;
        (profile.applications as Record<string, unknown>)[appCode] = {
          name: appName,
          hasAccess: false,
          error: error.message,
        };
      }
    }
    return profile;
  }

  async canShareDataBetweenApplications(
    userContext: ApplicationIsolationUserContext,
    sourceApp: string,
    targetApp: string,
    dataType: string,
    dataId: string
  ): Promise<boolean> {
    const sourceAccess = await this.canAccessDataInApplication(
      userContext,
      sourceApp,
      dataType,
      dataId
    );
    if (!sourceAccess) {
      return false;
    }

    const targetAccess = (await this.getUserApplicationAccess(
      userContext,
      targetApp
    )) as AppAccessResult;
    if (!targetAccess.hasAccess) return false;

    const sharingRules: Record<string, string[]> = {
      'hr-finance': ['user', 'organization'],
      'hr-crm': ['user'],
      'finance-sales': ['organization'],
      'crm-sales': ['user', 'organization'],
    };
    const ruleKey = `${sourceApp}-${targetApp}`;
    const allowedDataTypes = sharingRules[ruleKey] ?? [];

    return allowedDataTypes.includes(dataType);
  }
}

export const applicationDataIsolationService = new ApplicationDataIsolationService();
