/**
 * Data Isolation Service
 * Implements multi-level data isolation for organizations, sub-orgs, and locations
 */

import { db } from '../db/index.js';
import { entities } from '../db/schema/organizations/unified-entities.js';
import { tenantUsers } from '../db/schema/core/users.js';
import { organizationMemberships } from '../db/schema/organizations/organization_memberships.js';
import { eq, and, inArray } from 'drizzle-orm';

export interface UserContext {
  userId: string;
  internalUserId?: string | null;
  tenantId: string | null;
  roles?: string[];
}

interface MembershipRow { organizationId: string; membershipType: string | null; membershipStatus: string | null }

export class DataIsolationService {

  /**
   * Get user's accessible organizations based on their role and membership
   */
  async getUserAccessibleOrganizations(userContext: UserContext): Promise<string[]> {
    const { userId, internalUserId, tenantId, roles = [] } = userContext;
    console.log('🔍 getUserAccessibleOrganizations - userId:', userId, 'internalUserId:', internalUserId, 'tenantId:', tenantId, 'roles:', roles);

    let userMemberships: MembershipRow[] = [];
    try {
      const result = await db
        .select({
          organizationId: organizationMemberships.entityId,
          membershipType: organizationMemberships.membershipType,
          membershipStatus: organizationMemberships.membershipStatus
        })
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, internalUserId || userId),
          eq(organizationMemberships.entityType, 'organization'),
          eq(organizationMemberships.membershipStatus, 'active'),
          ...(tenantId ? [eq(organizationMemberships.tenantId, tenantId)] : [])
        ));
      userMemberships = result as unknown as MembershipRow[];
      console.log('✅ User organization memberships query successful:', userMemberships.length, 'records');
    } catch (err: unknown) {
      const queryError = err as Error;
      console.error('❌ User organization memberships query failed:', queryError);
      console.error('❌ Query error details:', queryError.message);
      console.error('❌ Using userId:', internalUserId || userId);
      userMemberships = [];
    }

    const directOrgIds = userMemberships.map(m => m.organizationId).filter((id): id is string => id != null);
    console.log('📋 Direct entity IDs:', directOrgIds);

    if (!tenantId) return [];
    if (roles && roles.includes && roles.includes('TENANT_ADMIN')) {
      console.log('👑 User is tenant admin, granting access to all organizations');
      const allOrgs = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.entityType, 'organization')
        ));

      return allOrgs.map(org => org.entityId);
    }

    // For regular users, get their accessible orgs based on hierarchy
    const accessibleOrgs = new Set(directOrgIds);

    // If user has no direct organization memberships, return empty array
    if (directOrgIds.length === 0) {
      console.log('ℹ️ User has no direct organization memberships, returning empty array');
      return [];
    }

    // Add parent entities (users can see their entity's parent)
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

    // Add child entities (users can see their entity's children)
    for (const entityId of directOrgIds) {
      const children = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(and(
          eq(entities.parentEntityId, entityId),
          eq(entities.entityType, 'organization')
        ));

      children.forEach(child => accessibleOrgs.add(child.entityId));
    }

    return Array.from(accessibleOrgs);
  }

  /**
   * Get user's accessible locations based on their organization access
   */
  async getUserAccessibleLocations(userContext: UserContext, _accessibleOrgs: string[]): Promise<string[]> {
    if (!_accessibleOrgs || _accessibleOrgs.length === 0 || !userContext.tenantId) {
      return [];
    }
    const tenantId = userContext.tenantId;
    const locationResults = await db
      .select({ entityId: entities.entityId })
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'location')
      ));

    return locationResults.map(result => result.entityId);
  }

  /**
   * Filter data based on user's access permissions
   */
  async filterOrganizationsByAccess(organizations: Array<{ entityId: string }>, userContext: UserContext): Promise<Array<{ entityId: string }>> {
    const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
    return organizations.filter(org => accessibleOrgs.includes(org.entityId));
  }

  /**
   * Filter locations based on user's access permissions
   */
  async filterLocationsByAccess(locations: Array<{ entityId: string }>, userContext: UserContext): Promise<Array<{ entityId: string }>> {
    const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
    const accessibleLocations = await this.getUserAccessibleLocations(userContext, accessibleOrgs);

    return locations.filter(loc => accessibleLocations.includes(loc.entityId));
  }

  /**
   * Check if user has access to specific entity (organization or location)
   */
  async canAccessEntity(userContext: UserContext, entityId: string): Promise<boolean> {
    const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
    const accessibleLocations = await this.getUserAccessibleLocations(userContext, accessibleOrgs);

    return accessibleOrgs.includes(entityId) || accessibleLocations.includes(entityId);
  }

  /**
   * Get user's data access scope
   */
  async getUserAccessScope(userContext: UserContext): Promise<{ organizations: Array<Record<string, unknown>>; locations: Array<Record<string, unknown>>; scope: { orgCount: number; locationCount: number } }> {
    try {
      console.log('🔍 getUserAccessScope - Starting with userContext:', {
        userId: userContext.userId,
        tenantId: userContext.tenantId,
        roles: userContext.roles
      });

      const accessibleOrgs = await this.getUserAccessibleOrganizations(userContext);
      console.log('📋 Accessible organizations:', accessibleOrgs);

      const accessibleLocations = await this.getUserAccessibleLocations(userContext, accessibleOrgs);
      console.log('📍 Accessible locations:', accessibleLocations);

      // Additional safety: filter out any null/undefined values
      const cleanOrgIds = (accessibleOrgs || []).filter(id => id != null);
      const cleanLocationIds = (accessibleLocations || []).filter(id => id != null);

      console.log('🧹 Clean org IDs:', cleanOrgIds);
      console.log('🧹 Clean location IDs:', cleanLocationIds);

      let orgDetails: Array<Record<string, unknown>> = [];
      let locationDetails: Array<Record<string, unknown>> = [];

      // Get entity details - only query if there are accessible entities
      if (cleanOrgIds.length > 0 || cleanLocationIds.length > 0) {
        console.log('🔍 Querying entity details...');
        try {
          const allEntityIds = [...cleanOrgIds, ...cleanLocationIds];
          const entityDetails = await db
            .select({
              entityId: entities.entityId,
              entityName: entities.entityName,
              entityType: entities.entityType,
              organizationType: entities.organizationType
            })
            .from(entities)
            .where(inArray(entities.entityId, allEntityIds));

          // Split back into organizations and locations
          orgDetails = entityDetails.filter(e => e.entityType === 'organization').map(e => ({
            organizationId: e.entityId,
            organizationName: e.entityName,
            organizationType: e.organizationType
          }));

          locationDetails = entityDetails.filter(e => e.entityType === 'location').map(e => ({
            locationId: e.entityId,
            locationName: e.entityName
          }));

          console.log('✅ Entity details retrieved:', entityDetails.length, '(orgs:', orgDetails.length, ', locs:', locationDetails.length, ')');
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
          locationCount: cleanLocationIds.length
        }
      };

      console.log('✅ getUserAccessScope - Success:', result.scope);
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error in getUserAccessScope:', error);
      console.error('❌ Error stack:', error.stack);
      // Return safe defaults on error
      return {
        organizations: [],
        locations: [],
        scope: {
          orgCount: 0,
          locationCount: 0
        }
      };
    }
  }
}

export default new DataIsolationService();
