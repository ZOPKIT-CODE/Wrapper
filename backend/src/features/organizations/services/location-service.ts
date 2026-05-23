/**
 * Location Service - Handles Location Management for Organizations
 * Follows SOLID principles with single responsibility for location operations
 * Updated to work without locationAssignments and organizationLocations tables
 */

import { db } from '../../../db/index.js';
import { entities } from '../../../db/schema/organizations/unified-entities.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import HierarchyManager from '../../../utils/hierarchy-manager.js';
import Logger from '../../../utils/logger.js';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';

export class LocationService {

  /**
   * Create a new location for an organization (using unified entities)
   */
  async createLocation(data: Record<string, unknown> & { name: string; address?: string; city?: string; state?: string; zipCode?: string; country?: string; organizationId: string; responsiblePersonId?: string }, createdBy: string) {
    const { name, address, city, state, zipCode, country, organizationId, responsiblePersonId } = data;

    Logger.log('info', 'general', 'create-location', 'Received location data', { name, address, city, state, zipCode, country, organizationId });

    // Validate input
    this.validateLocationData(data);

    // Check if parent organization exists in entities table
    const parentEntity = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.entityId, organizationId),
        eq(entities.entityType, 'organization'),
        eq(entities.isActive, true)
      ))
      .limit(1);

    if (parentEntity.length === 0) {
      throw new Error('Parent organization not found or inactive');
    }

    const entityId = uuidv4();
    const addressData = {
      street: address || '',
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
      country: country || '',
      additionalDetails: ''
    };

    // Insert location as entity
    const location = await db.insert(entities).values({
      entityId,
      tenantId: parentEntity[0].tenantId,
      entityType: 'location',
      parentEntityId: organizationId, // Link to parent organization
      entityName: name,
      locationType: 'office', // Default location type
      address: addressData,
      responsiblePersonId: responsiblePersonId || null,
      isActive: true,
      createdBy: createdBy,
      createdAt: new Date()
    }).returning();

    Logger.log('info', 'general', 'create-location', 'Location entity inserted', { entityId: location[0].entityId });
    // Note: Hierarchy paths are automatically maintained by database triggers

    // Get updated location data with hierarchy paths
    const updatedLocation = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entityId))
      .limit(1);

    const responseData = {
      success: true,
      location: {
        entityId: updatedLocation[0].entityId,
        entityName: updatedLocation[0].entityName,
        entityType: updatedLocation[0].entityType,
        address: addressData,
        city: city,
        country: country,
        hierarchyPath: updatedLocation[0].hierarchyPath, // Include hierarchy path
        entityLevel: updatedLocation[0].entityLevel, // Include entity level
        fullHierarchyPath: updatedLocation[0].fullHierarchyPath
      }
    };

    Logger.log('info', 'general', 'create-location', 'Location created successfully', { entityId: responseData.location.entityId });

    snsSqsPublisher.publishOrgEventToSuite('entity.created', parentEntity[0].tenantId, entityId, {
      entityId,
      entityName: name,
      entityType: 'location',
      parentId: organizationId,
      address: addressData,
      isActive: true,
      createdBy,
      createdAt: new Date().toISOString(),
    }).catch((err: Error) => {
      Logger.log('warning', 'general', 'create-location', 'Failed to publish entity.created event', { entityId, error: err.message });
    });

    return responseData;
  }

  /**
   * Get locations for an organization (using unified entities)
   */
  async getLocationsByOrganization(organizationId: string) {
    // Get organization first to verify it exists
    const organization = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.entityId, organizationId),
        eq(entities.entityType, 'organization')
      ))
      .limit(1);

    if (organization.length === 0) {
      throw new Error('Organization not found');
    }

    // Get all location entities that have this organization as parent
    const locationsList = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.parentEntityId, organizationId),
        eq(entities.entityType, 'location')
      ));

    return {
      success: true,
      locations: locationsList
    };
  }

  /**
   * Get location by ID
   */
  async getLocationById(locationId: string) {
    const location = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.entityId, locationId),
        eq(entities.entityType, 'location')
      ))
      .limit(1);

    if (location.length === 0) {
      throw new Error('Location not found');
    }

    return {
      success: true,
      location: location[0]
    };
  }

  /**
   * Update location
   */
  async updateLocation(locationId: string, data: Record<string, unknown>, updatedBy: string) {
    const { name, address, city, state, zipCode, country, responsiblePersonId } = data;

    // Validate input
    this.validateLocationData(data);

    const addressData = {
      street: address || '',
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
      country: country || '',
      additionalDetails: ''
    };

    const updatedLocation = await db
      .update(entities)
      .set({
        entityName: String(name ?? ''),
        address: addressData,
        responsiblePersonId: responsiblePersonId != null ? String(responsiblePersonId) : null,
        updatedBy: updatedBy,
        updatedAt: new Date()
      })
      .where(and(
        eq(entities.entityId, locationId),
        eq(entities.entityType, 'location')
      ))
      .returning();

    if (updatedLocation.length === 0) {
      throw new Error('Location not found');
    }

    const loc = updatedLocation[0];
    snsSqsPublisher.publishOrgEventToSuite('entity.updated', loc.tenantId, locationId, {
      entityId: locationId,
      entityName: loc.entityName,
      entityType: 'location',
      address: addressData,
      updatedBy,
      updatedAt: loc.updatedAt,
    }).catch((err: Error) => {
      Logger.log('warning', 'general', 'update-location', 'Failed to publish entity.updated event', { locationId, error: err.message });
    });

    return {
      success: true,
      location: loc
    };
  }

  /**
   * Delete location
   */
  async deleteLocation(locationId: string, deletedBy = 'system') {
    // Fetch before delete to capture tenantId for event publishing.
    const [locationData] = await db
      .select({ tenantId: entities.tenantId, entityName: entities.entityName })
      .from(entities)
      .where(and(eq(entities.entityId, locationId), eq(entities.entityType, 'location')))
      .limit(1);

    const deletedLocation = await db
      .delete(entities)
      .where(and(
        eq(entities.entityId, locationId),
        eq(entities.entityType, 'location')
      ))
      .returning();

    if (deletedLocation.length === 0) {
      throw new Error('Location not found');
    }

    if (locationData) {
      snsSqsPublisher.publishOrgEventToSuite('entity.deactivated', locationData.tenantId, locationId, {
        entityId: locationId,
        entityName: locationData.entityName,
        entityType: 'location',
        isActive: false,
        deletedBy,
        deletedAt: new Date().toISOString(),
      }).catch((err: Error) => {
        Logger.log('warning', 'general', 'delete-location', 'Failed to publish entity.deactivated event', { locationId, error: err.message });
      });
    }

    return {
      success: true,
      message: 'Location deleted successfully'
    };
  }

  /**
   * Get all locations for a tenant
   */
  async getLocationsByTenant(tenantId: string) {
    const locationsList = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'location')
      ));

    return {
      success: true,
      locations: locationsList
    };
  }

  /**
   * Alias for getLocationsByTenant - used by routes
   */
  async getTenantLocations(tenantId: string) {
    return this.getLocationsByTenant(tenantId);
  }

  /**
   * Get complete entity hierarchy including locations
   */
  async getEntityHierarchyWithLocations(tenantId: string) {
    try {
      // Use HierarchyManager to get the complete entity hierarchy
      const hierarchyResult = await HierarchyManager.getEntityHierarchyTree(tenantId);

      if (!hierarchyResult.success) {
        throw new Error(hierarchyResult.message);
      }

      return {
        success: true,
        hierarchy: hierarchyResult.hierarchy,
        totalEntities: hierarchyResult.totalEntities,
        message: 'Complete entity hierarchy retrieved successfully'
      };
    } catch (error) {
      Logger.log('error', 'general', 'get-entity-hierarchy-with-locations', 'Error in getEntityHierarchyWithLocations, falling back to simple query', { error: (error as Error).message });

      // Fallback to simple query
      const allEntities = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.isActive, true)
        ))
        .orderBy(entities.entityLevel, entities.createdAt);

      return {
        success: true,
        hierarchy: allEntities,
        totalEntities: allEntities.length,
        message: 'Complete entity hierarchy retrieved (fallback mode)'
      };
    }
  }

  /**
   * Validate location data
   */
  validateLocationData(data: Record<string, unknown> & { name?: string; organizationId?: string }) {
    const { name, organizationId } = data;

    if (!name || name.trim() === '') {
      throw new Error('Location name is required');
    }

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Additional validation can be added here
    if (name.length > 255) {
      throw new Error('Location name is too long');
    }
  }
}

export default new LocationService();