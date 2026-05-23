import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { getUserAccessibleEntities } from '../../../middleware/security/entity-scope.js';
import { db } from '../../../db/index.js';
import { entities, responsiblePersons, tenantUsers } from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import ErrorResponses from '../../../utils/error-responses.js';
import Logger from '../../../utils/logger.js';

export default async function entityScopeRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  // Get current user's entity scope
  fastify.get('/entity-scope', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = request.userContext as { internalUserId: string | null; tenantId: string };
      const internalUserId = ctx.internalUserId ?? '';
      const tenantId = ctx.tenantId;
      if (!internalUserId || !tenantId) {
        return reply.code(401).send({ success: false, error: 'Unauthorized' });
      }
      const entityScope = await getUserAccessibleEntities(internalUserId, tenantId);
      
      return reply.send({
        success: true,
        scope: entityScope
      });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-entity-scope', 'Failed to get entity scope', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get entity scope',
        message: error.message
      });
    }
  });

  // Update responsible person for an entity
  fastify.patch('/entities/:entityId/responsible-person', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const entityId = params.entityId;
      const body = request.body as Record<string, unknown>;
      const userId = body.userId as string | undefined;
      const ctx = request.userContext as { tenantId: string; internalUserId: string | null };
      const tenantId = ctx.tenantId;
      const internalUserId = ctx.internalUserId ?? '';
      
      Logger.log('info', 'general', 'update-responsible-person', 'Updating responsible person', { entityId, userId, tenantId });

      // Verify entity exists and belongs to tenant
      const [entity] = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          currentResponsiblePersonId: entities.responsiblePersonId
        } as const)
        .from(entities)
        .where(and(
          eq(entities.entityId, entityId),
          eq(entities.tenantId, tenantId)
        ))
        .limit(1);

      if (!entity) {
        return ErrorResponses.notFound(reply, 'Entity', 'Entity not found');
      }

      // If userId is provided, verify user exists
      if (userId && userId !== 'none') {
        const [user] = await db
          .select({ userId: tenantUsers.userId } as const)
          .from(tenantUsers)
          .where(and(
            eq(tenantUsers.userId, userId),
            eq(tenantUsers.tenantId, tenantId)
          ))
          .limit(1);

        if (!user) {
          return ErrorResponses.notFound(reply, 'User', 'User not found');
        }
      }

      // Update entity's responsible person
      const responsiblePersonId = (userId === 'none' || !userId) ? null : userId;
      
      await db
        .update(entities)
        .set({ 
          responsiblePersonId,
          updatedAt: new Date()
        })
        .where(and(
          eq(entities.entityId, entityId),
          eq(entities.tenantId, tenantId)
        ));

      // Deactivate old responsible person entry if exists
      if (entity.currentResponsiblePersonId) {
        await db
          .update(responsiblePersons)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(responsiblePersons.entityId, entityId),
            eq(responsiblePersons.userId, entity.currentResponsiblePersonId),
            eq(responsiblePersons.isActive, true)
          ));
      }

      // Create new responsible person entry if userId is provided
      if (responsiblePersonId) {
        await db
          .insert(responsiblePersons)
          .values({
            assignmentId: randomUUID(),
            tenantId,
            entityType: entity.entityType,
            entityId,
            userId: responsiblePersonId,
            responsibilityLevel: 'primary',
            scope: {
              creditManagement: true,
              userManagement: true,
              auditAccess: true,
              configurationManagement: true,
              reportingAccess: true
            } as Record<string, boolean>,
            assignedBy: internalUserId,
            isActive: true,
            isConfirmed: false
          });
      }

      Logger.log('info', 'general', 'update-responsible-person', 'Responsible person updated successfully');

      return {
        success: true,
        message: 'Responsible person updated successfully',
        data: {
          entityId,
          entityName: entity.entityName,
          responsiblePersonId
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'update-responsible-person', 'Failed to update responsible person', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to update responsible person',
        message: error.message
      });
    }
  });

  // Get responsible person details for an entity
  fastify.get('/entities/:entityId/responsible-person', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const entityId = params.entityId;
      const tenantId = (request.userContext as { tenantId: string }).tenantId;

      const [entity] = await db
        .select({
          responsiblePersonId: entities.responsiblePersonId
        } as const)
        .from(entities)
        .where(and(
          eq(entities.entityId, entityId),
          eq(entities.tenantId, tenantId)
        ))
        .limit(1);

      if (!entity) {
        return ErrorResponses.notFound(reply, 'Entity', 'Entity not found');
      }

      if (!entity.responsiblePersonId) {
        return reply.send({
          success: true,
          data: null,
          message: 'No responsible person assigned'
        });
      }

      // Get responsible person details
      const rpId = entity.responsiblePersonId;
      const [user] = await db
        .select({
          userId: tenantUsers.userId,
          name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
          email: tenantUsers.email,
        } as const)
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, rpId))
        .limit(1);

      return {
        success: true,
        data: user || null
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-responsible-person', 'Failed to get responsible person', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get responsible person',
        message: error.message
      });
    }
  });
}

