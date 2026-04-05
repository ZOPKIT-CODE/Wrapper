/**
 * Organization Service - Handles Parent and Sub-Organization Management
 * Follows SOLID principles with single responsibility for organization operations
 */

import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/core/tenants.js';
import { entities } from '../../../db/schema/organizations/unified-entities.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  dataIsolationService,
  applicationDataIsolationService,
  type DataIsolationUserContext,
  type ApplicationIsolationUserContext,
} from './entity-access.js';
import HierarchyManager from '../../../utils/hierarchy-manager.js';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';
import accountingEntityProvisioningService from '../../messaging/services/accounting-entity-provisioning-service.js';

export class OrganizationService {

  /**
   * Create a new parent organization (at most 1 per tenant)
   */
  async createParentOrganization(data: Record<string, unknown> & { name: string; description?: string; gstin?: string; parentTenantId: string }, createdBy: string) {
    const { name, description, gstin: _gstin, parentTenantId } = data;

    // Validate input
    this.validateOrganizationData(data);

    // Check if parent tenant exists
    const parentTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.tenantId, parentTenantId))
      .limit(1);

    if (parentTenant.length === 0) {
      throw new Error('Parent tenant not found');
    }

    // Check if a parent organization already exists for this tenant
    const existingParentOrg = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.tenantId, parentTenantId),
        eq(entities.entityType, 'organization'),
        eq(entities.isActive, true)
      ))
      .limit(1);

    if (existingParentOrg.length > 0) {
      throw new Error('A parent organization already exists for this tenant. Only one parent organization is allowed per tenant.');
    }

    const organizationId = uuidv4();

    // Create organization entity
    const organization = await db.insert(entities).values({
      entityId: organizationId,
      tenantId: parentTenantId,
      entityType: 'organization',
      entityName: name,

      description,
      entityLevel: 1,
      hierarchyPath: name, // Will be updated by trigger
      responsiblePersonId: createdBy,
      isActive: true,
      createdBy,
      createdAt: new Date()
    }).returning();

    // Publish organization creation event to AWS MQ
    try {
      await snsSqsPublisher.publishOrgEventToSuite('entity.created', parentTenantId, organization[0].entityId, {
        entityId: organization[0].entityId,
        entityCode: organization[0].entityId,
        entityName: organization[0].entityName,
        entityType: 'organization',
        subType: 'business_unit',
        organizationType: 'business_unit',
        description: organization[0].description,
        parentId: null,
        entityLevel: organization[0].entityLevel,
        isActive: organization[0].isActive,
        createdBy: organization[0].createdBy,
        createdAt: organization[0].createdAt
      });
    } catch (streamError: unknown) {
      const e = streamError as Error;
      console.warn('⚠️ Failed to publish organization creation event:', e.message);
    }

    try {
      await accountingEntityProvisioningService.publishProvisionRequest({
        tenantId: parentTenantId,
        entityId: organization[0].entityId,
        entityType: 'organization',
        subType: 'business_unit',
        entityCode: organization[0].entityId,
        entityName: organization[0].entityName,
        parentId: null,
        description: organization[0].description ?? null,
        createdBy,
        createdAt: organization[0].createdAt ?? new Date(),
      });
    } catch (provisionError: unknown) {
      const e = provisionError as Error;
      console.warn('⚠️ Failed to publish accounting provisioning request:', e.message);
    }

    return {
      success: true,
      organization: organization[0],
      message: 'Parent organization created successfully'
    };
  }

  /**
   * Get the parent organization for a tenant
   */
  async getParentOrganization(tenantId: string) {
    const parentOrg = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'organization'),
        eq(entities.isActive, true)
      ))
      .limit(1);

    return parentOrg.length > 0 ? parentOrg[0] : null;
  }

  /**
   * Check if tenant has a parent organization
   */
  async hasParentOrganization(tenantId: string) {
    const parentOrg = await this.getParentOrganization(tenantId);
    return parentOrg !== null;
  }

  /**
   * Create a sub-organization under a parent organization
   */
  async createSubOrganization(data: Record<string, unknown> & { name: string; description?: string; gstin?: string; parentOrganizationId?: string; organizationType?: string; tenantId?: string; entityCode?: string; legalName?: string; status?: string; country?: string; currency?: string; fiscalYearEnd?: string; taxId?: string; registrationNumber?: string; email?: string; phone?: string; website?: string; notes?: string }, createdBy: string) {
    const { name, description, parentOrganizationId, organizationType, tenantId, entityCode, legalName, status, country, currency, fiscalYearEnd, taxId, registrationNumber, email, phone, website, notes } = data;

    console.log('🏗️ OrganizationService.createSubOrganization called with:', {
      name,
      description,
      parentOrganizationId,
      organizationType,
      tenantId,
      createdBy
    });

    // Validate input
    console.log('🔍 Validating organization data...');
    this.validateOrganizationData(data);
    console.log('✅ Organization data validation passed');

    const organizationId = uuidv4();
    let tenantIdToUse, parentEntityId;

    if (parentOrganizationId) {
      // Get parent organization details for sub-organization
      const parentOrg = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, parentOrganizationId),
          eq(entities.entityType, 'organization')
        ))
        .limit(1);

      if (parentOrg.length === 0) {
        throw new Error('Parent organization not found');
      }

      tenantIdToUse = parentOrg[0].tenantId;
      parentEntityId = parentOrganizationId;
    } else {
      // Create top-level organization - need tenantId from somewhere else
      console.log('🏢 Creating top-level organization, checking tenantId...');
      if (!tenantId) {
        console.log('❌ No tenantId provided for top-level organization');
        throw new Error('Tenant ID is required for top-level organization creation');
      }

      console.log('✅ Using tenantId for top-level organization:', tenantId);
      tenantIdToUse = tenantId;
      parentEntityId = null;
    }

    // Create organization
    console.log('💾 Inserting organization into database...');
    const organization = await db.insert(entities).values({
      entityId: organizationId,
      tenantId: tenantIdToUse,
      entityType: 'organization',
      parentEntityId: parentEntityId,
      entityName: name,

      description,
      responsiblePersonId: createdBy,
      isActive: true,
      createdBy,
      createdAt: new Date()
    }).returning();

    console.log('✅ Organization inserted successfully:', organization[0]);
    // Note: Hierarchy paths are automatically maintained by database triggers

    // Publish organization creation event to AWS MQ
    try {
      await snsSqsPublisher.publishOrgEventToSuite('entity.created', tenantIdToUse, organization[0].entityId, {
        entityId: organization[0].entityId,
        entityCode: entityCode ?? organization[0].entityId,
        entityName: organization[0].entityName,
        entityType: organization[0].entityType,
        subType: organizationType ?? null,
        organizationType: organizationType ?? null,
        description: organization[0].description,
        parentId: organization[0].parentEntityId,
        entityLevel: organization[0].entityLevel,
        isActive: organization[0].isActive,
        createdBy: organization[0].createdBy,
        createdAt: organization[0].createdAt,
        legalName: legalName ?? name,
        status: status ?? 'active',
        country: country ?? undefined,
        currency: currency ?? 'USD',
        fiscalYearEnd: fiscalYearEnd ?? '12-31',
        taxId: taxId ?? undefined,
        registrationNumber: registrationNumber ?? undefined,
        email: email ?? undefined,
        phone: phone ?? undefined,
        website: website ?? undefined,
        notes: notes ?? undefined,
      });
    } catch (streamError: unknown) {
      const e = streamError as Error;
      console.warn('⚠️ Failed to publish organization creation event:', e.message);
    }

    try {
      await accountingEntityProvisioningService.publishProvisionRequest({
        tenantId: tenantIdToUse,
        entityId: organization[0].entityId,
        entityType: organization[0].entityType,
        subType: organizationType ?? null,
        entityCode: entityCode ?? organization[0].entityId,
        entityName: organization[0].entityName,
        parentId: organization[0].parentEntityId ?? null,
        description: organization[0].description ?? null,
        createdBy: organization[0].createdBy ?? createdBy,
        createdAt: organization[0].createdAt ?? new Date(),
      });
    } catch (provisionError: unknown) {
      const e = provisionError as Error;
      console.warn('⚠️ Failed to publish accounting provisioning request:', e.message);
    }

    return {
      success: true,
      organization: organization[0],
      message: 'Organization created successfully'
    };
  }

  /**
   * Get organization details with hierarchy
   */
  async getOrganizationDetails(organizationId: string) {
    try {
      console.log('🔍 Getting organization details for:', organizationId);

      // First, check if organization exists with a simple query
      const orgCheck = await db
        .select({
          organizationId: entities.entityId,
          organizationName: entities.entityName
        })
        .from(entities)
        .where(and(
          eq(entities.entityId, organizationId),
          eq(entities.entityType, 'organization')
        ))
        .limit(1);

      if (!orgCheck || orgCheck.length === 0) {
        throw new Error('Organization not found');
      }

      console.log('✅ Organization exists:', orgCheck[0]);

      // Now get full details
      const organization = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, organizationId),
          eq(entities.entityType, 'organization')
        ))
        .limit(1);

      console.log('📊 Full organization query result:', organization);

      if (!organization || organization.length === 0) {
        throw new Error('Organization not found');
      }

      const orgData = organization[0];
      console.log('🏢 Organization data:', orgData);

      // Get parent organization details if exists
      let parentOrganization = null;
      if (orgData.parentEntityId) {
        console.log('👨‍👩‍👧‍👦 Getting parent organization:', orgData.parentEntityId);
        try {
          const parent = await db
            .select({
              organizationId: entities.entityId,
              organizationName: entities.entityName
            })
            .from(entities)
            .where(and(
              eq(entities.entityId, orgData.parentEntityId),
              eq(entities.entityType, 'organization')
            ))
            .limit(1);

          if (parent && parent.length > 0) {
            parentOrganization = parent[0];
            console.log('👨‍👩‍👧‍👦 Parent organization found:', parentOrganization);
          }
        } catch (parentError: unknown) {
          const e = parentError as Error;
          console.log('⚠️ Could not get parent organization:', e.message);
          // Continue without parent organization
        }
      }

      return {
        success: true,
        organization: orgData,
        parentOrganization,
        message: 'Organization details retrieved successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error in getOrganizationDetails:', error);
      throw new Error(`Failed to get organization details: ${error.message}`);
    }
  }

  /**
   * Get all sub-organizations for a parent organization
   */
  async getSubOrganizations(parentOrganizationId: string) {
    const subOrgs = await db
      .select({
        organizationId: entities.entityId,
        organizationName: entities.entityName,
        description: entities.description,
        organizationType: entities.entityType,
        organizationLevel: entities.entityLevel,
        isActive: entities.isActive,
        createdAt: entities.createdAt
      })
      .from(entities)
      .where(and(
        eq(entities.parentEntityId, parentOrganizationId),
        eq(entities.entityType, 'organization')
      ))
      .orderBy(entities.createdAt);

    return {
      success: true,
      subOrganizations: subOrgs,
      count: subOrgs.length,
      message: 'Sub-organizations retrieved successfully'
    };
  }

  /**
   * Get organization hierarchy tree
   */
  async getOrganizationHierarchy(tenantId: string, userContext: Record<string, unknown> | null = null, applicationContext: Record<string, unknown> | null = null) {
    try {
      // Get all entities first to filter organizations
      const { db } = await import('../../../db/index.js');
      const { entities } = await import('../../../db/schema/index.js');
      const { eq, and } = await import('drizzle-orm');

      const allEntities = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          entityLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          fullHierarchyPath: entities.fullHierarchyPath,
          parentEntityId: entities.parentEntityId,
          locationType: entities.locationType,
          address: entities.address,
          description: entities.description,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.isActive, true)
        ))
        .orderBy(entities.entityLevel, entities.entityName);

      console.log(`📊 Found ${allEntities.length} total entities, including both organizations and locations...`);

      // Include both organizations and locations in hierarchy
      let hierarchy = allEntities.filter(entity =>
        entity.entityType === 'organization' || entity.entityType === 'location'
      );

      console.log(`🏢 Found ${hierarchy.length} entities before access control filtering (${hierarchy.filter(e => e.entityType === 'organization').length} organizations, ${hierarchy.filter(e => e.entityType === 'location').length} locations)`);

      if (userContext) {
        // Check if user is a tenant admin or super admin - they should have access to all organizations
        const uctx = userContext as Record<string, unknown>;
        const isAdmin = uctx.isTenantAdmin || uctx.isSuperAdmin || uctx.isAdmin;
        console.log('🔍 User access check - isAdmin:', isAdmin, 'isTenantAdmin:', uctx.isTenantAdmin, 'isSuperAdmin:', uctx.isSuperAdmin);

        if (isAdmin) {
          console.log('👑 User is admin, granting access to all organizations and locations');
          // Admin users can access all organizations and locations, no filtering needed
        } else {
          let accessibleEntities: string[] = [];

          // If application context is provided, use application-specific filtering
          const appContext = applicationContext as Record<string, unknown> | null;
          if (appContext?.application) {
            const appAccess = await applicationDataIsolationService.getUserApplicationAccess(
              userContext as unknown as ApplicationIsolationUserContext,
              appContext.application as string
            );

            if (!appAccess.hasAccess) {
              return {
                success: true,
                hierarchy: [],
                totalOrganizations: 0,
                message: `User does not have access to ${appContext.application} application`
              };
            }

            accessibleEntities = (appAccess.organizations || []) as string[];
          } else {
            // Use regular organizational access
            accessibleEntities = await dataIsolationService.getUserAccessibleOrganizations(
              userContext as unknown as DataIsolationUserContext
            );
          }

          if (accessibleEntities.length > 0) {
            // Filter hierarchy to only include accessible organizations and locations
            hierarchy = hierarchy.filter((entity: Record<string, unknown>) => accessibleEntities.includes(String(entity.entityId ?? '')));
          } else {
            // User has no access to any organizations or locations
            return { success: true, hierarchy: [], totalOrganizations: 0 };
          }
        }
      }

      console.log(`✅ Final entities after filtering: ${hierarchy.length} (${hierarchy.filter((e: { entityType: string }) => e.entityType === 'organization').length} organizations, ${hierarchy.filter((e: { entityType: string }) => e.entityType === 'location').length} locations)`);

      // Build hierarchy tree from flat list
      const orgMap = new Map<string, Record<string, unknown>>();
      const rootOrgs: Record<string, unknown>[] = [];

      // First pass: create all nodes
      hierarchy.forEach((org: Record<string, unknown>) => {
        const node = {
          organizationId: org.entityId,
          organizationName: org.entityName,
          organizationType: org.organizationType,
          organizationLevel: org.entityLevel,
          hierarchyPath: org.hierarchyPath,
          fullHierarchyPath: org.fullHierarchyPath,
          description: org.description,
          isActive: org.isActive,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          parentOrganizationId: org.parentEntityId,
          children: []
        };
        orgMap.set(String(org.entityId ?? ''), node);
      });

      // Second pass: build tree structure
      hierarchy.forEach((org: Record<string, unknown>) => {
        const node = orgMap.get(String(org.entityId ?? ''));
        const parentId = org.parentEntityId != null ? String(org.parentEntityId) : undefined;

        if (parentId && orgMap.has(parentId)) {
          // Add as child to parent
          const parent = orgMap.get(parentId);
          if (parent && Array.isArray(parent.children)) {
            parent.children.push(node as Record<string, unknown>);
          }
        } else {
          // Add as root organization
          rootOrgs.push(node as Record<string, unknown>);
        }
      });

      return {
        success: true,
        hierarchy: rootOrgs,
        totalOrganizations: hierarchy.length,
        message: 'Entity hierarchy retrieved successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error in getOrganizationHierarchy:', error);

      // Fallback to simple query if hierarchy manager fails
      console.log('Falling back to simple hierarchy query...');
      const allEntities = await db
        .select({
          organizationId: entities.entityId,
          parentOrganizationId: entities.parentEntityId,
          organizationName: entities.entityName,
          organizationType: entities.entityType,
          organizationLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          description: entities.description,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt,
          entityType: entities.entityType
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.isActive, true)
        ))
        .orderBy(entities.entityLevel, entities.createdAt);

      // Filter to include both organizations and locations
      const filteredEntities = allEntities.filter(entity =>
        entity.entityType === 'organization' || entity.entityType === 'location'
      );

      return {
        success: true,
        hierarchy: filteredEntities.map(entity => ({
          ...entity,
          children: [] // Simple fallback doesn't build tree structure
        })),
        totalOrganizations: filteredEntities.length,
        message: 'Entity hierarchy retrieved (fallback mode)'
      };
    }
  }

  /**
   * Move organization to new parent (hierarchy reorganization)
   */
  async moveOrganization(organizationId: string, newParentId: string | null, movedBy: string) {
    // Validate organization exists
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

    // Validate new parent exists (if provided)
    if (newParentId) {
      const parentCheck = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, newParentId),
          eq(entities.entityType, 'organization')
        ))
        .limit(1);

      if (parentCheck.length === 0) {
        throw new Error('New parent organization not found');
      }

      // Validate hierarchy integrity (prevent circular references)
      const validation = await HierarchyManager.validateHierarchyIntegrity(organizationId, newParentId);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
    }

    // Update the organization
    const updatedOrg = await db
      .update(entities)
      .set({
        parentEntityId: newParentId,
        updatedBy: movedBy,
        updatedAt: new Date()
      })
      .where(and(
        eq(entities.entityId, organizationId),
        eq(entities.entityType, 'organization')
      ))
      .returning();

    // Update hierarchy paths for the moved organization and all its descendants
    await HierarchyManager.updateEntityHierarchyPaths(organizationId);

    return {
      success: true,
      organization: updatedOrg[0],
      message: 'Organization moved successfully'
    };
  }


  /**
   * Update organization details
   */
  async updateOrganization(organizationId: string, updateData: Record<string, unknown>, updatedBy: string) {
    const allowedFields = ['entityName', 'organizationName', 'description', 'responsiblePersonId'];

    const updateFields: Record<string, unknown> = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        // Map old field names to new ones
        if (key === 'organizationName') {
          updateFields.entityName = updateData[key];
        } else {
          updateFields[key] = updateData[key];
        }
      }
    });

    if (Object.keys(updateFields).length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.updatedAt = new Date();
    updateFields.updatedBy = updatedBy;

    const updatedOrg = await db
      .update(entities)
      .set(updateFields)
      .where(and(
        eq(entities.entityId, organizationId),
        eq(entities.entityType, 'organization')
      ))
      .returning();

    if (updatedOrg.length === 0) {
      throw new Error('Organization not found or update failed');
    }

    return {
      success: true,
      organization: updatedOrg[0],
      message: 'Organization updated successfully'
    };
  }

  /**
   * Delete organization (soft delete)
   * Cannot delete the primary organization created during onboarding (root org with no parent).
   */
  async deleteOrganization(organizationId: string, deletedBy: string) {
    // Prevent deleting the primary/root organization (created during onboarding)
    const orgRow = await db
      .select({ parentEntityId: entities.parentEntityId, entityType: entities.entityType })
      .from(entities)
      .where(and(
        eq(entities.entityId, organizationId),
        eq(entities.entityType, 'organization')
      ))
      .limit(1);

    if (orgRow.length === 0) {
      throw new Error('Organization not found');
    }
    if (orgRow[0].parentEntityId == null) {
      throw new Error('Cannot delete the primary organization created during onboarding');
    }

    // Check if organization has sub-organizations
    const subOrgs = await db
      .select({ organizationId: entities.entityId })
      .from(entities)
      .where(and(
        eq(entities.parentEntityId, organizationId),
        eq(entities.entityType, 'organization'),
        eq(entities.isActive, true)
      ))
      .limit(1);

    if (subOrgs.length > 0) {
      throw new Error('Cannot delete organization with active sub-organizations');
    }

    const deletedOrg = await db
      .update(entities)
      .set({
        isActive: false,
        updatedAt: new Date(),
        updatedBy: deletedBy
      })
      .where(and(
        eq(entities.entityId, organizationId),
        eq(entities.entityType, 'organization')
      ))
      .returning();

    if (deletedOrg.length === 0) {
      throw new Error('Organization not found');
    }

    return {
      success: true,
      organization: deletedOrg[0],
      message: 'Organization deactivated successfully'
    };
  }

  /**
   * Bulk create organizations
   */
  async bulkCreateOrganizations(organizationData: Record<string, unknown>[], createdBy: string) {
    const results = [];
    const errors = [];

    for (const [index, data] of organizationData.entries()) {
      try {
        // Validate data
        this.validateOrganizationData(data as Record<string, unknown> & { name: string; description?: string; gstin?: string; parentTenantId: string });

        const result = await this.createParentOrganization(data as Record<string, unknown> & { name: string; description?: string; gstin?: string; parentTenantId: string }, createdBy);
        results.push({
          index,
          success: true,
          data: result.organization
        });
      } catch (err: unknown) {
        const error = err as Error;
        errors.push({
          index,
          success: false,
          error: error.message,
          data
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      totalProcessed: organizationData.length,
      successful: results.length,
      failed: errors.length,
      message: `Bulk creation completed: ${results.length} successful, ${errors.length} failed`
    };
  }

  /**
   * Bulk update organizations
   */
  async bulkUpdateOrganizations(updateData: Record<string, unknown>[], updatedBy: string) {
    const results = [];
    const errors = [];

    for (const [index, item] of updateData.entries()) {
      try {
        const { organizationId, ...updateFields } = item as Record<string, unknown> & { organizationId?: string };

        if (!organizationId || typeof organizationId !== 'string') {
          throw new Error('Organization ID is required');
        }

        const result = await this.updateOrganization(organizationId, updateFields as Record<string, unknown>, updatedBy);
        results.push({
          index,
          organizationId,
          success: true,
          data: result.organization
        });
      } catch (err: unknown) {
        const error = err as Error;
        errors.push({
          index,
          organizationId: (item as Record<string, unknown>).organizationId,
          success: false,
          error: error.message,
          data: item
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      totalProcessed: updateData.length,
      successful: results.length,
      failed: errors.length,
      message: `Bulk update completed: ${results.length} successful, ${errors.length} failed`
    };
  }

  /**
   * Bulk delete organizations
   */
  async bulkDeleteOrganizations(organizationIds: string[], deletedBy: string) {
    const results = [];
    const errors = [];

    for (const [index, organizationId] of organizationIds.entries()) {
      try {
        const result = await this.deleteOrganization(organizationId, deletedBy);
        results.push({
          index,
          organizationId,
          success: true,
          data: result.organization
        });
      } catch (err: unknown) {
        const error = err as Error;
        errors.push({
          index,
          organizationId,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      totalProcessed: organizationIds.length,
      successful: results.length,
      failed: errors.length,
      message: `Bulk deletion completed: ${results.length} successful, ${errors.length} failed`
    };
  }

  /**
   * Validate organization data
   */
  validateOrganizationData(data: Record<string, unknown> & { name?: string; gstin?: string }) {
    const { name, gstin } = data;

    if (!name || name.trim().length < 2) {
      throw new Error('Organization name must be at least 2 characters');
    }

    if (gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        throw new Error('Invalid GSTIN format');
      }
    }
  }
}

export default new OrganizationService();
