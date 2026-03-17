/**
 * Unified Entities Routes - RESTful API endpoints for unified entity management
 * Handles organizations, locations, departments, and teams in a unified way
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import OrganizationService from '../services/organization-service.js';
import LocationService from '../services/location-service.js';
import EntityService from '../services/entity-service.js';
import { EntityAdminService } from '../../../features/admin/index.js';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import {
  validateOrganizationUpdate,
  sanitizeInputMiddleware
} from '../../../middleware/validation/validation.js';
import {
  enforceOrganizationAccess,
  addUserAccessContext
} from '../../../middleware/security/data-isolation.js';
import {
  enforceApplicationAccess,
  addApplicationDataFiltering,
  validateApplicationExists
} from '../../../middleware/security/application-isolation.js';

console.log('🚀 Loading entities.js routes file...');

/**
 * Maps raw entity from DB to FA-relevant response format.
 * Excludes internal/credit/branding fields not needed for Financial Accounting.
 */
function toEntityResponse(entity: Record<string, unknown>): Record<string, unknown> {
  return {
    entityId: entity.entityId,
    tenantId: entity.tenantId,
    entityType: entity.entityType,
    parentEntityId: entity.parentEntityId,
    entityName: entity.entityName,
    entityCode: entity.entityCode,
    description: entity.description,
    organizationType: entity.organizationType,
    locationType: entity.locationType,
    address: entity.address,
    timezone: entity.timezone,
    currency: entity.currency,
    legalName: entity.legalName,
    country: entity.country,
    fiscalYearEnd: entity.fiscalYearEnd,
    taxId: entity.taxId,
    registrationNumber: entity.registrationNumber,
    contactEmail: entity.contactEmail,
    contactPhone: entity.contactPhone,
    contactWebsite: entity.contactWebsite,
    responsiblePersonId: entity.responsiblePersonId,
    isActive: entity.isActive,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export default async function entityRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Simple logging to verify routes are loaded
  console.log('🔄 Entities routes are being registered...');

  // Apply authentication and data isolation to all entity routes
  fastify.addHook('preHandler', async (request, reply) => {
    // First authenticate the user
    await authenticateToken(request, reply);

    // Add user context for data isolation
    await addUserAccessContext()(request, reply);

    // Validate application access
    await validateApplicationExists()(request, reply);
    await enforceApplicationAccess()(request, reply);
  });

  // Resolve tenant by Kinde org ID (bootstrap helper endpoint)
  fastify.get('/by-kinde-id/:kindeOrgId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const kindeOrgId = params.kindeOrgId ?? '';
      if (!kindeOrgId) {
        return reply.code(400).send({
          success: false,
          message: 'kindeOrgId is required',
        });
      }

      const { db } = await import('../../../db/index.js');
      const { tenants } = await import('../../../db/schema/index.js');
      const { eq } = await import('drizzle-orm');

      const [tenant] = await db
        .select({
          id: tenants.tenantId,
          name: tenants.companyName,
          kindeOrgId: tenants.kindeOrgId,
          code: tenants.subdomain,
        })
        .from(tenants)
        .where(eq(tenants.kindeOrgId, kindeOrgId))
        .limit(1);

      if (!tenant) {
        return reply.code(404).send({
          success: false,
          message: 'Tenant not found',
        });
      }

      return reply.send({
        success: true,
        tenant,
      });
    } catch (error) {
      console.error('❌ Get tenant by kinde org id failed:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to resolve tenant by kinde org id',
      });
    }
  });

  // Get entity hierarchy - FULL DATABASE VERSION (including locations)
  fastify.get('/hierarchy/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';

      console.log('🔍 Getting complete entity hierarchy for tenant:', tenantId);

      // Use the location service to get complete hierarchy with locations
      const result = await LocationService.getEntityHierarchyWithLocations(tenantId);

      if (result.success) {
        // Remove duplicates by using entityId as key
        const entityMap = new Map();
        
        const processEntity = (entity: any) => {
          if (!entityMap.has(entity.entityId)) {
            const processedEntity = {
              entityId: entity.entityId,
              tenantId: entity.tenantId,
              entityName: entity.entityName,
              entityType: entity.entityType,
              entityCode: entity.entityCode,
              entityLevel: entity.entityLevel,
              hierarchyPath: entity.hierarchyPath,
              fullHierarchyPath: entity.fullHierarchyPath,
              description: entity.description,
              isActive: entity.isActive,
              createdAt: entity.createdAt,
              updatedAt: entity.updatedAt,
              parentEntityId: entity.parentEntityId,
              responsiblePersonId: entity.responsiblePersonId,
              organizationType: entity.organizationType,
              locationType: entity.locationType,
              address: entity.address,
              // Include credit information (default to 0 if null)
              availableCredits: (entity as any).availableCredits ?? 0,
              reservedCredits: (entity as any).reservedCredits ?? 0,
              totalCredits: ((entity as any).availableCredits ?? 0) + ((entity as any).reservedCredits ?? 0),
              children: []
            };
            
            entityMap.set(entity.entityId, processedEntity);
            
            // Process children recursively
            if (entity.children && Array.isArray(entity.children)) {
              processedEntity.children = entity.children.map(processEntity);
            }
          }
          
          return entityMap.get(entity.entityId);
        };

        // Process all entities and remove duplicates
        const transformedHierarchy = result.hierarchy.map(processEntity).filter(Boolean);

        // Count total entities including children
        const countTotalEntities = (entities: any[]) => {
          let count = entities.length;
          entities.forEach((entity: any) => {
            if (entity.children && Array.isArray(entity.children)) {
              count += countTotalEntities(entity.children);
            }
          });
          return count;
        };

        const totalEntities = countTotalEntities(transformedHierarchy);

        return reply.send({
          success: true,
          data: {
            tenantId,
            hierarchy: transformedHierarchy,
            totalEntities: totalEntities
          },
          message: 'Complete entity hierarchy retrieved successfully'
        });
      } else {
        // FALLBACK: Try to get basic entity list if hierarchy fails
        console.log('⚠️ Hierarchy retrieval failed, attempting fallback...');
        const fallbackResult = await LocationService.getTenantLocations(tenantId);

        if (fallbackResult.success && fallbackResult.locations.length > 0) {
          console.log('✅ Fallback successful - returning flat entity list');
          
          // Remove duplicates in fallback mode too
          const entityMap = new Map();
          fallbackResult.locations.forEach((entity: any) => {
            if (!entityMap.has(entity.entityId)) {
              entityMap.set(entity.entityId, {
                entityId: entity.entityId,
                tenantId: entity.tenantId,
                entityName: entity.entityName,
                entityType: entity.entityType,
                entityCode: entity.entityCode,
                entityLevel: entity.entityLevel || 1,
                hierarchyPath: entity.hierarchyPath || entity.entityId,
                fullHierarchyPath: entity.fullHierarchyPath || entity.entityName,
                description: entity.description,
                isActive: entity.isActive,
                createdAt: entity.createdAt,
                updatedAt: entity.updatedAt,
                parentEntityId: entity.parentEntityId,
                responsiblePersonId: entity.responsiblePersonId,
                organizationType: entity.organizationType,
                locationType: entity.locationType,
                address: entity.address,
                // Include credit information (fallback to 0 if not available)
                availableCredits: entity.availableCredits || "0.0000",
                children: [] // No hierarchy in fallback
              });
            }
          });

          const transformedEntities = Array.from(entityMap.values());

          return reply.send({
            success: true,
            hierarchy: transformedEntities,
            totalEntities: transformedEntities.length,
            message: 'Entity hierarchy retrieved (fallback mode - no tree structure)',
            fallbackMode: true
          });
        }

        return reply.code(404).send(result);
      }
    } catch (error) {
      console.error('❌ Get entity hierarchy failed:', error);
      return reply.code(500).send({
        success: false,
        error: 'Retrieval failed',
        message: 'Failed to get entity hierarchy'
      });
    }
  });

  // Get parent entity hierarchy - includes parent and all children
  fastify.get('/parent/:parentEntityId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const parentEntityId = params.parentEntityId ?? '';

      console.log('🏠 Getting hierarchy starting from parent entity:', parentEntityId);

      // Get the parent entity details first
      const { db } = await import('../../../db/index.js');
      const { entities } = await import('../../../db/schema/index.js');
      const { eq, and } = await import('drizzle-orm');

      const [parentEntity] = await db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          entityCode: entities.entityCode,
          entityLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          fullHierarchyPath: entities.fullHierarchyPath,
          parentEntityId: entities.parentEntityId,
          organizationType: entities.organizationType,
          locationType: entities.locationType,
          address: entities.address,
          description: entities.description,
          responsiblePersonId: entities.responsiblePersonId,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt
        })
        .from(entities)
        .where(and(
          eq(entities.entityId, parentEntityId),
          eq(entities.isActive, true)
        ));

      if (!parentEntity) {
        return reply.code(404).send({
          success: false,
          error: 'Parent entity not found',
          message: 'The specified parent entity does not exist or is inactive'
        });
      }

      // Get all descendant entities (children, grandchildren, etc.)
      const descendantEntities = await db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          entityCode: entities.entityCode,
          entityLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          fullHierarchyPath: entities.fullHierarchyPath,
          parentEntityId: entities.parentEntityId,
          organizationType: entities.organizationType,
          locationType: entities.locationType,
          address: entities.address,
          description: entities.description,
          responsiblePersonId: entities.responsiblePersonId,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, parentEntity.tenantId),
          eq(entities.isActive, true)
        ));

      // Build hierarchy starting from parent
      const buildHierarchy = (parentId: string): any[] => {
        const children = descendantEntities.filter(entity => entity.parentEntityId === parentId);
        return children.map((child: any) => ({
          ...child,
          children: buildHierarchy(child.entityId)
        }));
      };

      // Transform parent entity to match the expected format
      const transformedParent = {
        entityId: parentEntity.entityId,
        entityName: parentEntity.entityName,
        entityType: parentEntity.entityType,
        entityCode: parentEntity.entityCode,
        entityLevel: parentEntity.entityLevel,
        hierarchyPath: parentEntity.hierarchyPath,
        fullHierarchyPath: parentEntity.fullHierarchyPath,
        organizationType: parentEntity.organizationType,
        locationType: parentEntity.locationType,
        address: parentEntity.address,
        description: parentEntity.description,
        isActive: parentEntity.isActive,
        createdAt: parentEntity.createdAt,
        updatedAt: parentEntity.updatedAt,
        parentEntityId: parentEntity.parentEntityId,
        responsiblePersonId: parentEntity.responsiblePersonId,
        children: buildHierarchy(parentEntity.entityId)
      };

      return reply.send({
        success: true,
        parentEntity: transformedParent,
        message: 'Parent entity hierarchy retrieved successfully'
      });

    } catch (error) {
      console.error('❌ Get parent entity hierarchy failed:', error);
      return reply.code(500).send({
        success: false,
        error: 'Retrieval failed',
        message: 'Failed to get parent entity hierarchy'
      });
    }
  });

  // Get tenant entities - FULL DATABASE VERSION
  fastify.get('/tenant/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';
      const entityType = query?.entityType;

      console.log('🏢 Getting tenant entities:', {
        tenantId,
        entityType,
        queryString: request.query,
        url: request.url,
        tenantIdType: typeof tenantId,
        tenantIdLength: tenantId?.length
      });

      // DEBUG: Validate tenantId format
      if (!tenantId || typeof tenantId !== 'string' || tenantId.length !== 36) {
        console.error('🚨 Invalid tenantId format:', {
          tenantId,
          type: typeof tenantId,
          length: tenantId?.length
        });
        return reply.code(400).send({
          success: false,
          error: 'Invalid tenant ID',
          message: 'Tenant ID must be a valid UUID string'
        });
      }

      // DEBUG: Check if tenant exists in database
      const { db } = await import('../../../db/index.js');
      const { tenants, tenantUsers } = await import('../../../db/schema/index.js');
      const { eq, and } = await import('drizzle-orm');

      const [tenantRecord] = await db
        .select({ tenantId: tenants.tenantId, companyName: tenants.companyName })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenantRecord) {
        console.error('🚨 Tenant does not exist in database:', tenantId);

        // Try to find the correct tenant for this user as fallback
        if (request.userContext?.userId) {
          console.log('🔍 Attempting to find correct tenant for user:', request.userContext.userId);

          const userTenants = await db
            .select({
              tenantId: tenants.tenantId,
              companyName: tenants.companyName,
              subdomain: tenants.subdomain
            })
            .from(tenants)
            .innerJoin(tenantUsers, eq(tenants.tenantId, tenantUsers.tenantId))
            .where(and(
              eq(tenantUsers.kindeUserId, request.userContext.userId),
              eq(tenants.isActive, true)
            ))
            .orderBy(tenants.createdAt)
            .limit(1);

          if (userTenants.length > 0) {
            const correctTenant = userTenants[0];
            console.log('✅ Found correct tenant for user:', correctTenant);

            // Use the correct tenant instead
            const result = await EntityAdminService.getTenantEntities(correctTenant.tenantId, entityType);

            if (result.success) {
              console.log('✅ Returned entities for correct tenant:', correctTenant.tenantId);
              return reply.send({
                ...result,
                correctedTenantId: correctTenant.tenantId,
                originalTenantId: tenantId,
                message: `Tenant corrected from ${tenantId} to ${correctTenant.tenantId}`
              });
            }
          }
        }

        return reply.code(404).send({
          success: false,
          error: 'Tenant not found',
          message: `Tenant with ID ${tenantId} does not exist`,
          suggestion: 'Try refreshing the page to get the correct tenant information'
        });
      }

      console.log('✅ Tenant exists:', {
        tenantId: tenantRecord.tenantId,
        companyName: tenantRecord.companyName
      });

      const result = await EntityAdminService.getTenantEntities(tenantId, entityType);

      if (result.success) {
        console.log('✅ Tenant entities retrieved successfully:', {
          tenantId,
          entityType,
          totalEntities: result.total,
          entityTypesReturned: [...new Set((result.entities as any[]).map((e: any) => e.entityType))],
          sampleEntities: (result.entities as any[]).slice(0, 3).map((e: any) => ({
            id: e.entityId,
            name: e.entityName,
            type: e.entityType,
            tenantId: e.tenantId
          }))
        });

        return reply.send(result);
      } else {
        return reply.code(404).send(result);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Get tenant entities failed:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        errorMessage: error.message,
        errorName: error.name
      });
      return reply.code(500).send({
        success: false,
        error: 'Retrieval failed',
        message: error.message || 'Failed to get tenant entities',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Unified create entity endpoint
  fastify.post('/', {
    preHandler: [
      authenticateToken,
      addUserAccessContext(),
      sanitizeInputMiddleware()
    ]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const entityData = body as any;
      const entityType = entityData.entityType as 'organization' | 'location' | 'department' | 'team';

      if (!entityData.entityName || entityData.entityName.trim().length < 2) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          message: 'Entity name is required and must be at least 2 characters long'
        });
      }

      if (!['organization', 'location', 'department', 'team'].includes(entityType)) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          message: 'entityType must be one of: organization, location, department, team',
        });
      }

      // organization and location require the same accounting fields
      if (entityType === 'organization' || entityType === 'location') {
        if (!entityData.legalName || !entityData.country || !entityData.currency) {
          return reply.code(400).send({
            success: false,
            error: 'Validation failed',
            message: `${entityType} requires legalName, country, and currency`,
          });
        }
      }
      // department/team: only name required (already validated above)

      const result = await EntityService.createEntity(
        {
          entityName: entityData.entityName.trim(),
          entityType,
          subType: (entityData.subType as string) || (entityData.organizationType as string) || (entityData.locationType as string),
          parentEntityId: (entityData.parentEntityId as string) || null,
          parentTenantId: (entityData.parentTenantId as string) ?? (request as any).user?.tenantId ?? '',
          responsiblePersonId: (entityData.responsiblePersonId as string) || null,
          entityCode: (entityData.entityCode as string) || undefined,
          description: (entityData.description as string) || '',
          legalName: (entityData.legalName as string) || undefined,
          status: (entityData.status as string) || 'active',
          country: (entityData.country as string) || undefined,
          currency: (entityData.currency as string) || undefined,
          fiscalYearEnd: (entityData.fiscalYearEnd as string) || '12-31',
          taxId: (entityData.taxId as string) || undefined,
          registrationNumber: (entityData.registrationNumber as string) || undefined,
          email: (entityData.email as string) || undefined,
          phone: (entityData.phone as string) || undefined,
          website: (entityData.website as string) || undefined,
          notes: (entityData.notes as string) || undefined,
          address: entityData.address || undefined,
        },
        (request as any).user?.internalUserId ?? undefined,
      );

      if (result.success) {
        return reply.send({
          success: true,
          entity: toEntityResponse(result.entity as Record<string, unknown>),
          message: 'Entity created successfully'
        });
      }
      return reply.code(400).send(result);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Create entity failed:', error);
      return reply.code(500).send({
        success: false,
        error: 'Creation failed',
        message: error.message || 'Failed to create entity'
      });
    }
  });

  // Update entity - FULL DATABASE VERSION
  fastify.put('/:entityId', {
    preHandler: [
      authenticateToken,
      validateOrganizationUpdate,
      addUserAccessContext(),
      enforceApplicationAccess(),
      sanitizeInputMiddleware()
    ]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const entityId = params.entityId ?? '';
      const updateData = request.body as Record<string, unknown>;

      console.log('🔄 Update entity endpoint called for:', entityId, 'with data:', updateData);

      // Transform entity data to organization format for service compatibility
      const orgUpdateData = {
        organizationName: updateData.entityName,
        description: updateData.description,
        isActive: updateData.isActive,
        responsiblePersonId: updateData.responsiblePersonId,
        organizationType: updateData.organizationType
      };

      const result = await (OrganizationService as any).updateOrganization(entityId, orgUpdateData);

      if (result.success) {
        // Transform back to entity format
        const transformedEntity = {
          entityId: (result.organization as any).organizationId ?? (result.organization as any).entityId,
          entityName: (result.organization as any).organizationName ?? (result.organization as any).entityName,
          entityType: 'organization',
          organizationType: result.organization.organizationType,
          entityLevel: (result.organization as any).organizationLevel ?? (result.organization as any).entityLevel,
          hierarchyPath: result.organization.hierarchyPath,
          description: result.organization.description,
          isActive: result.organization.isActive,
          updatedAt: result.organization.updatedAt,
          parentEntityId: (result.organization as any).parentOrganizationId ?? (result.organization as any).parentEntityId,
          responsiblePersonId: result.organization.responsiblePersonId
        };

        return reply.send({
          success: true,
          entity: transformedEntity,
          message: 'Entity updated successfully'
        });
      } else {
        return reply.code(404).send(result);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Update entity failed:', error);
      return reply.code(500).send({
        success: false,
        error: 'Update failed',
        message: 'Failed to update entity'
      });
    }
  });

  // Delete entity - FULL DATABASE VERSION
  fastify.delete('/:entityId', {
    preHandler: [
      authenticateToken,
      addUserAccessContext(),
      enforceApplicationAccess(),
      sanitizeInputMiddleware()
    ]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const entityId = params.entityId ?? '';

      console.log('🗑️ Delete entity endpoint called for:', entityId);

      const result = await (OrganizationService as any).deleteOrganization(entityId);

      if (result.success) {
        return reply.send({
          success: true,
          message: 'Entity deleted successfully'
        });
      } else {
        return reply.code(404).send(result);
      }
    } catch (error) {
      console.error('❌ Delete entity failed:', error);
      return reply.code(500).send({
        success: false,
        error: 'Deletion failed',
        message: 'Failed to delete entity'
      });
    }
  });


}
