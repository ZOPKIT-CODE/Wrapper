/**
 * Admin Entity Management Routes - Independent entity administration
 * Provides comprehensive entity operations without modifying existing routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { entities, tenants, credits } from '../../../db/schema/index.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';

export default async function adminEntityManagementRoutes(fastify: FastifyInstance, _options?: object): Promise<void> {

  fastify.get('/all', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_VIEW)],
    schema: {
      description: 'Get all entities across tenants with filtering'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const queryParams = request.query as Record<string, string>;
    try {
      const page = Number(queryParams.page) || 1;
      const limit = Number(queryParams.limit) || 20;
      const tenantId = queryParams.tenantId;
      const entityType = queryParams.entityType;
      const search = queryParams.search;
      const isActive = queryParams.isActive;
      const sortBy = queryParams.sortBy ?? 'createdAt';
      const sortOrder = queryParams.sortOrder ?? 'desc';

      const conditions = [];
      if (tenantId) conditions.push(eq(entities.tenantId, tenantId));
      if (entityType) conditions.push(eq(entities.entityType, entityType));
      if (search) conditions.push(sql`${entities.entityName} ilike ${`%${search}%`}`);
      if (isActive !== undefined) conditions.push(eq(entities.isActive, isActive === 'true'));

      let entitiesQuery = db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
          entityType: entities.entityType,
          entityName: entities.entityName,
          parentEntityId: entities.parentEntityId,
          entityLevel: entities.entityLevel,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          companyName: tenants.companyName,
          availableCredits: sql`
            coalesce((
              select sum(${credits.availableCredits})
              from ${credits}
              where ${credits.entityId} = ${entities.entityId}
              and ${credits.isActive} = true
            ), 0)
          `,
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId));

      if (conditions.length > 0) {
        entitiesQuery = entitiesQuery.where(and(...conditions)) as typeof entitiesQuery;
      }

      // Apply sorting
      const sortColumn = sortBy === 'entityName' ? entities.entityName :
                        sortBy === 'entityType' ? entities.entityType :
                        sortBy === 'createdAt' ? entities.createdAt :
                        sortBy === 'companyName' ? tenants.companyName :
                        sortBy === 'availableCredits' ? sql`
                          coalesce((
                            select sum(${credits.availableCredits})
                            from ${credits}
                            where ${credits.entityId} = ${entities.entityId}
                            and ${credits.isActive} = true
                          ), 0)
                        ` :
                        entities.createdAt;

      entitiesQuery = (sortOrder === 'desc' ? entitiesQuery.orderBy(desc(sortColumn)) : entitiesQuery.orderBy(sortColumn)) as typeof entitiesQuery;

      // Get total count
      const totalCount = await db
        .select({ count: count() })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .then((result: any) => Number(result[0]?.count ?? 0));

      // Apply pagination
      const offset = (page - 1) * limit;
      const entitiesList = await entitiesQuery.limit(limit).offset(offset);

      return {
        success: true,
        data: {
          entities: entitiesList,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-fetch-entities', 'Error fetching entities', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch entities' });
    }
  });

  fastify.get('/:entityId/details', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_VIEW)],
    schema: {
      description: 'Get detailed entity information with hierarchy'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const entityId = params.entityId ?? '';
    try {

      // Get entity with tenant info
      const entityData = await db
        .select({
          entity: entities,
          tenant: tenants,
          credit: credits
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .leftJoin(credits, eq(entities.entityId, credits.entityId))
        .where(eq(entities.entityId, entityId))
        .limit(1);

      if (!entityData.length) {
        return reply.code(404).send({ error: 'Entity not found' });
      }

      const { entity, tenant, credit } = entityData[0];

      // Get parent hierarchy
      const hierarchy = await buildEntityHierarchy(entityId);

      // Get child entities with credit information using subquery
      const childEntities = await db
        .select({
          entityId: entities.entityId,
          entityType: entities.entityType,
          entityName: entities.entityName,
          isActive: entities.isActive,
          availableCredits: sql`
            coalesce((
              select sum(${credits.availableCredits})
              from ${credits}
              where ${credits.entityId} = ${entities.entityId}
              and ${credits.isActive} = true
            ), 0)
          `,
        })
        .from(entities)
        .where(eq(entities.parentEntityId, entityId))
        .orderBy(entities.entityType, entities.entityName);

      return {
        success: true,
        data: {
          entity,
          tenant: {
            tenantId: tenant.tenantId,
            companyName: tenant.companyName,
            subdomain: tenant.subdomain
          },
          credit: credit || { availableCredits: 0, reservedCredits: 0 },
          hierarchy,
          children: childEntities
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-fetch-entity-details', 'Error fetching entity details', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch entity details' });
    }
  });

  fastify.patch('/:entityId/status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_MANAGE)],
    schema: {
      description: 'Update entity status'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const entityId = params.entityId ?? '';
      const isActive = body.isActive;
      const reason = body.reason;

      const [entityMeta] = await db
        .select({ tenantId: entities.tenantId, entityName: entities.entityName, entityType: entities.entityType })
        .from(entities)
        .where(eq(entities.entityId, entityId))
        .limit(1);

      await db
        .update(entities)
        .set({
          isActive: isActive as boolean,
          updatedAt: new Date()
        })
        .where(eq(entities.entityId, entityId));

      Logger.log('info', 'general', 'admin-update-entity-status', 'Admin updated entity status', { userId: (request as any).userContext?.userId ?? '', isActive, entityId, reason });

      if (entityMeta) {
        const entityEventType = isActive ? 'entity.created' : 'entity.deactivated';
        snsSqsPublisher.publishOrgEventToSuite(entityEventType, entityMeta.tenantId, entityId, {
          entityId,
          entityName: entityMeta.entityName,
          entityType: entityMeta.entityType,
          isActive,
          reason: reason ?? null,
          updatedBy: (request as any).userContext?.userId ?? 'admin',
          updatedAt: new Date().toISOString(),
        }).catch((err: Error) => {
          Logger.log('warning', 'general', 'admin-update-entity-status', `Failed to publish ${entityEventType} event`, { entityId, error: err.message });
        });
      }

      return {
        success: true,
        message: `Entity ${isActive ? 'activated' : 'deactivated'} successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-update-entity-status', 'Error updating entity status', { error: error.message });
      return reply.code(500).send({ error: 'Failed to update entity status' });
    }
  });

  fastify.post('/bulk/status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_MANAGE)],
    schema: {
      description: 'Bulk update entity status'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const entityIds = body.entityIds as string[];
      const isActive = body.isActive;
      const reason = body.reason;

      const affectedEntities = await db
        .select({ entityId: entities.entityId, tenantId: entities.tenantId, entityName: entities.entityName, entityType: entities.entityType })
        .from(entities)
        .where(sql`${entities.entityId} = any(${entityIds})`);

      await db
        .update(entities)
        .set({
          isActive: isActive as boolean,
          updatedAt: new Date()
        })
        .where(sql`${entities.entityId} = any(${entityIds})`);

      Logger.log('info', 'general', 'admin-bulk-update-entity-status', 'Admin bulk updated entity status', { userId: (request as any).userContext?.userId ?? '', isActive, entityCount: entityIds.length, reason });

      const bulkEntityEventType = isActive ? 'entity.created' : 'entity.deactivated';
      const bulkAdminUserId = (request as any).userContext?.userId ?? 'admin';
      for (const ent of affectedEntities) {
        snsSqsPublisher.publishOrgEventToSuite(bulkEntityEventType, ent.tenantId, ent.entityId, {
          entityId: ent.entityId,
          entityName: ent.entityName,
          entityType: ent.entityType,
          isActive,
          reason: reason ?? null,
          updatedBy: bulkAdminUserId,
          updatedAt: new Date().toISOString(),
        }).catch((err: Error) => {
          Logger.log('warning', 'general', 'admin-bulk-update-entity-status', `Failed to publish ${bulkEntityEventType} event`, { entityId: ent.entityId, error: err.message });
        });
      }

      return {
        success: true,
        message: `${entityIds.length} entities ${isActive ? 'activated' : 'deactivated'} successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-bulk-update-entity-status', 'Error bulk updating entity status', { error: error.message });
      return reply.code(500).send({ error: 'Failed to bulk update entity status' });
    }
  });

  fastify.get('/stats/overview', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_VIEW)],
    schema: {
      description: 'Get entity statistics overview'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const typeDistribution = await db
        .select({
          entityType: entities.entityType,
          count: count(),
          activeCount: sql`count(case when ${entities.isActive} = true then 1 end)`,
          totalCredits: sql`coalesce(sum(${credits.availableCredits}), 0)`
        })
        .from(entities)
        .leftJoin(credits, eq(entities.entityId, credits.entityId))
        .groupBy(entities.entityType);

      // Entity distribution by tenant
      const tenantDistribution = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityCount: count(),
          activeEntityCount: sql`count(case when ${entities.isActive} = true then 1 end)`
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .groupBy(tenants.tenantId, tenants.companyName)
        .orderBy(desc(count()));

      // Hierarchy depth statistics
      const hierarchyStats = await db
        .select({
          maxDepth: sql`max(${entities.entityLevel})`,
          avgDepth: sql`avg(${entities.entityLevel})`,
          totalRootEntities: sql`count(case when ${entities.parentEntityId} is null then 1 end)`
        })
        .from(entities);

      return {
        success: true,
        data: {
          typeDistribution,
          tenantDistribution: tenantDistribution.slice(0, 10), // Top 10 tenants
          hierarchyStats: hierarchyStats[0],
          generatedAt: new Date().toISOString()
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-entity-stats', 'Error fetching entity stats', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch entity statistics' });
    }
  });

  fastify.get('/search', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_VIEW)],
    schema: {
      description: 'Search entities across all tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const queryParams = request.query as Record<string, string>;
    try {
      const q = queryParams.q ?? '';
      const entityType = queryParams.entityType;
      const tenantId = queryParams.tenantId;
      const limit = Number(queryParams.limit) || 20;

      const searchConditions = [sql`${entities.entityName} ilike ${`%${q}%`}`];
      if (entityType) searchConditions.push(eq(entities.entityType, entityType));
      if (tenantId) searchConditions.push(eq(entities.tenantId, tenantId));

      const results = await db
        .select({
          entityId: entities.entityId,
          entityType: entities.entityType,
          entityName: entities.entityName,
          tenantId: entities.tenantId,
          companyName: tenants.companyName,
          isActive: entities.isActive,
          availableCredits: sql`
            coalesce((
              select sum(${credits.availableCredits})
              from ${credits}
              where ${credits.entityId} = ${entities.entityId}
              and ${credits.isActive} = true
            ), 0)
          `,
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .where(and(...searchConditions))
        .orderBy(desc(sql`case when ${entities.entityName} ilike ${`${q}%`} then 1 else 0 end`))
        .limit(limit);

      return {
        success: true,
        data: {
          query: q,
          results,
          total: results.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-search-entities', 'Error searching entities', { error: error.message });
      return reply.code(500).send({ error: 'Failed to search entities' });
    }
  });

  fastify.get('/hierarchy/:tenantId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_ENTITIES_VIEW)],
    schema: {
      description: 'Get entity hierarchy for a specific tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      let tenantId = params.tenantId ?? '';

      if (tenantId === 'current') {
        if (!(request as any).userContext?.tenantId) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid tenant',
            message: 'Cannot determine current tenant from user context'
          });
        }
        tenantId = (request as any).userContext?.tenantId ?? '';
      }

      // Get entities with their credit information using LEFT JOIN approach
      const entitiesList = await db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
          entityType: entities.entityType,
          entityName: entities.entityName,
          parentEntityId: entities.parentEntityId,
          entityLevel: entities.entityLevel,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          availableCredits: sql`coalesce(${credits.availableCredits}, 0)`
        })
        .from(entities)
        .leftJoin(credits, and(
          eq(credits.entityId, entities.entityId),
          eq(credits.isActive, true)
        ))
        .where(eq(entities.tenantId, tenantId))
        .orderBy(entities.entityLevel, entities.entityName);

      // Debug: Log credit values for each entity
      Logger.log('info', 'general', 'admin-entity-hierarchy', 'Hierarchy entities with credits', { count: entitiesList.length });

      // Build hierarchy tree
      const entityMap = new Map<string, any>();
      const rootEntities: any[] = [];

      // First pass: create entity objects
      entitiesList.forEach(entity => {
        entityMap.set(entity.entityId, {
          ...entity,
          children: []
        });
      });

      // Second pass: build hierarchy
      entitiesList.forEach(entity => {
        const entityObj = entityMap.get(entity.entityId);
        if (entity.parentEntityId) {
          const parent = entityMap.get(entity.parentEntityId);
          if (parent) {
            parent.children.push(entityObj);
          }
        } else {
          rootEntities.push(entityObj);
        }
      });

      return {
        success: true,
        data: {
          tenantId,
          hierarchy: rootEntities,
          totalEntities: entitiesList.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-entity-hierarchy', 'Error fetching entity hierarchy', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch entity hierarchy' });
    }
  });

  fastify.get('/hierarchy/current', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get entity hierarchy for current tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).userContext?.tenantId;

      if (!tenantId) {
        return reply.code(400).send({ error: 'No tenant ID found in user context' });
      }

      Logger.log('info', 'general', 'admin-entity-hierarchy-current', 'Getting entity hierarchy for current tenant', { tenantId });

      // Get all active entities for this tenant
      const allEntities = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          parentEntityId: entities.parentEntityId,
          entityLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          fullHierarchyPath: entities.fullHierarchyPath,
          isActive: entities.isActive
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.isActive, true)
        ))
        .orderBy(entities.entityLevel, entities.entityName);

      Logger.log('info', 'general', 'admin-entity-hierarchy-current', 'Found entities for tenant', { count: allEntities.length, tenantId });

      // Build hierarchy tree
      const entityMap = new Map<string, any>();
      const rootEntities: any[] = [];

      // First pass: create map of all entities
      allEntities.forEach(entity => {
        entityMap.set(entity.entityId, { ...entity, children: [] });
      });

      // Second pass: build hierarchy
      allEntities.forEach(entity => {
        const entityWithChildren = entityMap.get(entity.entityId);

        if (entity.parentEntityId && entityMap.has(entity.parentEntityId)) {
          // Has parent, add to parent's children
          const parent = entityMap.get(entity.parentEntityId);
          if (!parent.children) parent.children = [];
          parent.children.push(entityWithChildren);
        } else {
          // No parent, it's a root entity
          rootEntities.push(entityWithChildren);
        }
      });

      return {
        success: true,
        data: {
          hierarchy: rootEntities
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-entity-hierarchy-current', 'Error fetching current tenant entity hierarchy', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch entity hierarchy' });
    }
  });
}

async function buildEntityHierarchy(entityId: string): Promise<any[]> {
  const hierarchy = [];
  let currentId = entityId;
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops

  while (currentId && depth < maxDepth) {
    const entity = await db
      .select({
        entityId: entities.entityId,
        entityName: entities.entityName,
        entityType: entities.entityType,
        parentEntityId: entities.parentEntityId
      })
      .from(entities)
      .where(eq(entities.entityId, currentId))
      .limit(1);

    if (!entity.length) break;

    hierarchy.unshift({
      entityId: entity[0].entityId,
      entityName: entity[0].entityName,
      entityType: entity[0].entityType
    });

    currentId = entity[0].parentEntityId ?? '';
    depth++;
  }

  return hierarchy;
}
