import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { customRoles, userRoleAssignments, auditLogs } from '../../../db/schema/index.js';
import { eq, count as dbCount, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import Logger from '../../../utils/logger.js';
import ErrorResponses from '../../../utils/error-responses.js';
import { amazonMQPublisher } from '../../messaging/utils/amazon-mq-publisher.js';

type ReqWithUser = FastifyRequest & { userContext?: Record<string, unknown> };

export default async function adminRoleRoutes(fastify: FastifyInstance): Promise<void> {
  // Get all custom roles
  fastify.get('/roles', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('roles-list');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔍 [${requestId}] Getting roles for tenant: ${tenantId}`);

      const page = Math.max(1, parseInt(query.page || '1', 10));
      const pageLimit = Math.min(Math.max(1, parseInt(query.limit || '20', 10)), 100);
      const pageOffset = (page - 1) * pageLimit;

      const roles = await db
        .select()
        .from(customRoles)
        .where(eq(customRoles.tenantId, tenantId))
        .limit(pageLimit + 1)
        .offset(pageOffset);

      const hasMore = roles.length > pageLimit;
      const items = hasMore ? roles.slice(0, pageLimit) : roles;

      console.log(`✅ [${requestId}] Found ${items.length} roles`);

      return {
        success: true,
        data: items,
        count: items.length,
        meta: { page, limit: pageLimit, hasMore },
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get roles:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get roles',
        message: error.message,
        requestId
      });
    }
  });

  // Create custom role
  fastify.post('/roles', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_CREATE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('role-create');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;
    const roleName = body.roleName as string; const description = body.description as string; const permissions = body.permissions;

    try {
      console.log(`➕ [${requestId}] Creating role:`, { roleName, description, tenantId });

      const roleId = uuidv4();

      const result = await (db.insert(customRoles) as any)
        .values({
          roleId,
          tenantId,
          roleName,
          description,
          permissions: JSON.stringify(permissions as any),
          isSystemRole: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      console.log(`✅ [${requestId}] Role created successfully: ${roleId}`);

      return {
        success: true,
        message: 'Role created successfully',
        data: result[0],
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to create role:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create role',
        message: error.message,
        requestId
      });
    }
  });

  // Update custom role
  fastify.put('/roles/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('role-update');
    const roleId = params.roleId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;
    const updateData = body as Record<string, unknown>;

    try {
      console.log(`✏️ [${requestId}] Updating role:`, { roleId, tenantId, updateData });

      const result = await (db.update(customRoles) as any)
        .set({
          ...(updateData as Record<string, unknown>),
          permissions: (updateData as any).permissions ? JSON.stringify((updateData as any).permissions) : undefined,
          updatedAt: new Date()
        })
        .where(and(
          eq(customRoles.roleId, roleId),
          eq(customRoles.tenantId, tenantId)
        ))
        .returning();

      if (result.length === 0) {
        return ErrorResponses.notFound(reply, 'Role', 'Role not found', {
          requestId
        });
      }

      console.log(`✅ [${requestId}] Role updated successfully`);

      // Publish role update event to AWS MQ
      try {
        const updatedRole = result[0];
        await amazonMQPublisher.publishRoleEventToSuite('role_updated', tenantId, updatedRole.roleId, {
          roleId: updatedRole.roleId,
          roleName: updatedRole.roleName,
          description: updatedRole.description,
          permissions: typeof updatedRole.permissions === 'string'
            ? JSON.parse(updatedRole.permissions)
            : updatedRole.permissions,
          restrictions: typeof updatedRole.restrictions === 'string'
            ? JSON.parse(updatedRole.restrictions)
            : updatedRole.restrictions,
          updatedBy: ((request as ReqWithUser).userContext?.internalUserId ?? '') as string,
          updatedAt: updatedRole.updatedAt || new Date().toISOString()
        });
        console.log(`📡 [${requestId}] Published role_updated event to Redis streams`);
      } catch (publishErr: unknown) {
        const publishError = publishErr as Error;
        console.warn(`⚠️ [${requestId}] Failed to publish role_updated event:`, publishError.message);
        // Don't fail the request if event publishing fails
      }

      return {
        success: true,
        message: 'Role updated successfully',
        data: result[0],
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to update role:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update role',
        message: error.message,
        requestId
      });
    }
  });

  // Delete custom role
  fastify.delete('/roles/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_DELETE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('role-delete');
    const roleId = params.roleId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🗑️ [${requestId}] Deleting role:`, { roleId, tenantId });

      const result = await db
        .delete(customRoles)
        .where(and(
          eq(customRoles.roleId, roleId),
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.isSystemRole, false) // Only allow deletion of custom roles
        ))
        .returning();

      if (result.length === 0) {
        return ErrorResponses.notFound(reply, 'Role', 'Role not found or cannot be deleted', {
          requestId
        });
      }

      console.log(`✅ [${requestId}] Role deleted successfully`);

      return {
        success: true,
        message: 'Role deleted successfully',
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to delete role:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete role',
        message: error.message,
        requestId
      });
    }
  });

  // Get audit logs
  fastify.get('/audit-logs', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.AUDIT_LOG_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('audit-logs');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;
    const action = query.action as string | undefined; const userId = query.userId as string | undefined;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const pageLimit = Math.min(Math.max(1, parseInt(query.limit || '20', 10)), 100);
    const pageOffset = (page - 1) * pageLimit;

    try {
      console.log(`🔍 [${requestId}] Getting audit logs:`, { tenantId, page, limit: pageLimit, action, userId });

      const whereClause = action && userId
        ? and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.action, action), eq(auditLogs.userId, userId))
        : action
          ? and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.action, action))
          : userId
            ? and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.userId, userId))
            : eq(auditLogs.tenantId, tenantId);
      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(auditLogs.createdAt)
        .limit(pageLimit + 1)
        .offset(pageOffset);

      const hasMore = logs.length > pageLimit;
      const items = hasMore ? logs.slice(0, pageLimit) : logs;

      console.log(`✅ [${requestId}] Found ${items.length} audit logs`);

      return {
        success: true,
        data: items,
        meta: { page, limit: pageLimit, hasMore },
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get audit logs:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get audit logs',
        message: error.message,
        requestId
      });
    }
  });

  // Get all roles for tenant (no pagination limit)
  fastify.get('/roles/all', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('all-roles');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const pageLimit = Math.min(Math.max(1, parseInt(query.limit || '20', 10)), 100);
      const pageOffset = (page - 1) * pageLimit;

      console.log(`🔍 [${requestId}] Getting all roles for tenant: ${tenantId}`);

      if (!tenantId) {
        console.error(`❌ [${requestId}] Missing tenantId in userContext:`, {
          userContext: request.userContext,
          isAuthenticated: request.userContext?.isAuthenticated,
          userId: request.userContext?.userId
        });
        return reply.code(400).send({
          success: false,
          error: 'Missing tenant ID',
          message: 'Tenant ID is required. Please ensure you are properly authenticated.',
          requestId
        });
      }

      const allRoles = await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          description: customRoles.description,
          color: customRoles.color,
          permissions: customRoles.permissions,
          restrictions: customRoles.restrictions,
          isSystemRole: customRoles.isSystemRole,
          isDefault: customRoles.isDefault,
          priority: customRoles.priority,
          createdAt: customRoles.createdAt,
          updatedAt: customRoles.updatedAt,
          userCount: dbCount(userRoleAssignments.id)
        })
        .from(customRoles)
        .leftJoin(userRoleAssignments, eq(customRoles.roleId, userRoleAssignments.roleId))
        .where(eq(customRoles.tenantId, tenantId))
        .groupBy(customRoles.roleId);

      // Ensure allRoles is an array
      if (!Array.isArray(allRoles)) {
        console.error(`❌ [${requestId}] Database query did not return an array:`, typeof allRoles);
        return reply.code(500).send({
          success: false,
          error: 'Database error',
          message: 'Failed to retrieve roles from database',
          requestId
        });
      }

      // Sort roles: system roles first, then by priority (nulls last), then by name
      const sortedRoles = allRoles.sort((a, b) => {
        // System roles first
        if (a.isSystemRole !== b.isSystemRole) {
          return a.isSystemRole ? -1 : 1;
        }
        // Then by priority (nulls treated as 999)
        const aPriority = a.priority ?? 999;
        const bPriority = b.priority ?? 999;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        // Finally by name - ensure both are strings
        const aName = (a.roleName || '').toString();
        const bName = (b.roleName || '').toString();
        return aName.localeCompare(bName);
      });

      console.log(`✅ [${requestId}] Found ${sortedRoles.length} roles`);

        // Transform roles to ensure all fields are properly formatted
      const transformedRoles = sortedRoles.map(role => {
        // Ensure role is an object
        if (!role || typeof role !== 'object') {
          console.warn(`⚠️ [${requestId}] Invalid role object found:`, role);
          return null;
        }

        let permissions = {};
        let restrictions = {};

        try {
          if (typeof role.permissions === 'string' && role.permissions) {
            permissions = JSON.parse(role.permissions);
          } else if (role.permissions && typeof role.permissions === 'object') {
            permissions = role.permissions;
          }
          // Ensure permissions is always an object
          if (!permissions || typeof permissions !== 'object') {
            permissions = {};
          }
        } catch (parseErr: unknown) {
          const parseError = parseErr as Error;
          console.warn(`⚠️ [${requestId}] Failed to parse permissions for role ${role.roleId}:`, parseError.message);
          permissions = {};
        }

        try {
          if (typeof role.restrictions === 'string' && role.restrictions) {
            restrictions = JSON.parse(role.restrictions);
          } else if (role.restrictions && typeof role.restrictions === 'object') {
            restrictions = role.restrictions;
          }
          // Ensure restrictions is always an object
          if (!restrictions || typeof restrictions !== 'object') {
            restrictions = {};
          }
        } catch (parseErr: unknown) {
          const parseError = parseErr as Error;
          console.warn(`⚠️ [${requestId}] Failed to parse restrictions for role ${role.roleId}:`, parseError.message);
          restrictions = {};
        }

        return {
          roleId: role.roleId || '',
          roleName: role.roleName || '',
          description: role.description || '',
          color: role.color || '#6b7280',
          icon: (role as Record<string, unknown>).icon as string || '👤',
          permissions,
          restrictions,
          isSystemRole: role.isSystemRole || false,
          isDefault: role.isDefault || false,
          priority: role.priority ?? 999,
          createdAt: role.createdAt || null,
          updatedAt: role.updatedAt || null,
          userCount: typeof role.userCount === 'number' ? role.userCount : Number(role.userCount) || 0
        };
      }).filter(role => role !== null); // Remove any null entries

      const sliced = transformedRoles.slice(pageOffset, pageOffset + pageLimit + 1);
      const hasMore = sliced.length > pageLimit;
      const paginatedRoles = hasMore ? sliced.slice(0, pageLimit) : sliced;

      return {
        success: true,
        data: paginatedRoles,
        count: paginatedRoles.length,
        meta: { page, limit: pageLimit, hasMore },
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get all roles:`, error);
      console.error(`❌ [${requestId}] Error stack:`, error.stack);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get all roles',
        message: error.message,
        requestId
      });
    }
  });
}
