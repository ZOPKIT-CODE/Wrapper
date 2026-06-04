import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import Logger from '../../../utils/logger.js';
import permissionService from '../services/permission-service.js';
import { db } from '../../../db/index.js';
import {
  applications,
  applicationModules,
  organizationApplications,
} from '../../../db/schema/core/suite-schema.js';
import { tenantUsers } from '../../../db/schema/core/users.js';
import { customRoles, userRoleAssignments } from '../../../db/schema/index.js';
import { organizationMemberships } from '../../../db/schema/organizations/organization_memberships.js';
import { eq, and, not, sql } from 'drizzle-orm';
import ActivityLogger, { ACTIVITY_TYPES } from '../../../services/activityLogger.js';

export default async function permissionRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  const getTenantId = (request: FastifyRequest) => {
    const tenantId = request.userContext?.tenantId || request.user?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant context required - User must be associated with a tenant');
    }
    return tenantId;
  };

  // Get available permissions with categories and operations
  fastify.get('/available', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'role', 'get-available-permissions', 'Fetching permission structure');

      const permissionData = await permissionService.getAvailablePermissions();

      Logger.log('info', 'role', 'get-available-permissions', 'Permission data summary', { applications: permissionData.summary.applicationCount, modules: permissionData.summary.moduleCount, operations: permissionData.summary.operationCount });

      return {
        success: true,
        data: permissionData,
        message: 'Permission structure retrieved successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'role', 'get-available-permissions', 'Error fetching permissions', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch permission structure',
        error: error.message
      });
    }
  });

  // Get applications with modules and permissions
  fastify.get('/applications', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      
      // Get organization's enabled applications
      const orgApps = await db
        .select({
          appId: applications.appId,
          appCode: applications.appCode,
          appName: applications.appName,
          description: applications.description,
          icon: applications.icon,
          isEnabled: organizationApplications.isEnabled,
          enabledModules: organizationApplications.enabledModules,
          subscriptionTier: organizationApplications.subscriptionTier
        })
        .from(applications)
        .innerJoin(
          organizationApplications,
          and(
            eq(organizationApplications.appId, applications.appId),
            eq(organizationApplications.tenantId, tenantId)
          )
        )
        .where(eq(applications.status, 'active'));

      // Get modules for each application
      const appsWithModules = await Promise.all(
        orgApps.map(async (app) => {
          const modules = await db
            .select()
            .from(applicationModules)
            .where(eq(applicationModules.appId, app.appId));

          return {
            ...app,
            modules: modules.map(module => ({
              moduleId: module.moduleId,
              moduleCode: module.moduleCode,
              moduleName: module.moduleName,
              description: module.description,
              isCore: module.isCore,
              permissions: module.permissions || []
            }))
          };
        })
      );

      return {
        success: true,
        data: appsWithModules
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching applications:');
      return reply.code(500).send({ error: 'Failed to fetch applications' });
    }
  });

  // Get tenant users for permission management
  fastify.get('/users', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_DATA_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      
      const users = await db
        .select({
          userId: tenantUsers.userId,
          name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
          email: tenantUsers.email,
          isActive: tenantUsers.isActive,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          createdAt: tenantUsers.createdAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));

      return {
        success: true,
        data: users
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching users:');
      return reply.code(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Get permission templates
  fastify.get('/templates', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const templates = await getPermissionTemplates();
      
      return {
        success: true,
        data: templates
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching templates:');
      return reply.code(500).send({ error: 'Failed to fetch templates' });
    }
  });

  // Get tenant roles
  fastify.get('/roles', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      const page = query.page != null ? Number(query.page) : undefined;
      const limit = query.limit != null ? Number(query.limit) : undefined;
      const search = query.search;
      const type = query.type;
      
      // Get tenant ID from user context
      const tenantId = getTenantId(request);
      
      Logger.log('info', 'role', 'get-roles', 'GET roles request', { tenantId, page, limit, search, type });

      const roles = await permissionService.getTenantRoles(tenantId, {
        page,
        limit,
        search,
        type
      });

      Logger.log('info', 'role', 'get-roles', 'Roles fetched from service', { count: roles.data?.length || 0, total: roles.total });
      
      return {
        success: true,
        data: roles
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching tenant roles:');
      return reply.code(500).send({ error: 'Failed to fetch roles' });
    }
  });

  // Create custom role - REMOVED (use /custom-roles/create-from-builder instead)

  // Update role
  fastify.put('/roles/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_UPDATE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const roleId = params.roleId;
      const body = request.body as Record<string, unknown>;
      const updatedBy = request.userContext?.idpSub ?? request.user?.id;
      const updateData = {
        ...body,
        updatedBy: updatedBy ?? undefined
      };
      
      const role = await permissionService.updateRole(
        getTenantId(request),
        roleId,
        updateData as any
      );
      
      return {
        success: true,
        data: role,
        message: 'Role updated successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error updating role:');
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to update role' });
    }
  });

  // Delete role
  fastify.delete('/roles/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_DELETE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const roleId = params.roleId;
      const query = request.query as Record<string, string | undefined>;
      const force = query.force as boolean | undefined;
      const transferUsersTo = query.transferUsersTo as string | undefined;
      const tenantId = getTenantId(request);

      Logger.log('info', 'role', 'delete-role', 'Attempting to delete role', { roleId, tenantId });

      // Get role data before deletion for event publishing
      const [roleToDelete] = await db
        .select()
        .from(customRoles)
        .where(
          and(
            eq(customRoles.tenantId, tenantId),
            eq(customRoles.roleId, roleId)
          )
        )
        .limit(1);

      Logger.log('info', 'role', 'delete-role', 'Role to delete found', { found: !!roleToDelete, roleId: roleToDelete ? roleToDelete.roleId : null });

      if (!roleToDelete) {
        return reply.code(404).send({ error: 'Role not found' });
      }

      // Check how many users are affected
      const userAssignments = await db
        .select({
          userId: userRoleAssignments.userId,
          userEmail: tenantUsers.email
        })
        .from(userRoleAssignments)
        .innerJoin(tenantUsers, eq(userRoleAssignments.userId, tenantUsers.userId))
        .where(eq(userRoleAssignments.roleId, roleId));

      const organizationAssignments = await db
        .select({
          membershipId: organizationMemberships.membershipId,
          userId: organizationMemberships.userId,
          userEmail: tenantUsers.email,
          entityId: organizationMemberships.entityId,
          entityType: organizationMemberships.entityType
        })
        .from(organizationMemberships)
        .innerJoin(tenantUsers, eq(organizationMemberships.userId, tenantUsers.userId))
        .where(eq(organizationMemberships.roleId, roleId));

      const affectedUsers = [
        ...userAssignments.map(ua => ({ userId: ua.userId, email: ua.userEmail, type: 'direct' })),
        ...organizationAssignments.map(oa => ({ userId: oa.userId, email: oa.userEmail, type: 'organization' }))
      ];

      // Remove duplicates
      const uniqueAffectedUsers = affectedUsers.filter((user, index, self) =>
        index === self.findIndex(u => u.userId === user.userId)
      );

      Logger.log('info', 'role', 'delete-role', 'Affected users count', { count: uniqueAffectedUsers.length });

      // If force is not specified and there are affected users, return confirmation needed
      if (!force && uniqueAffectedUsers.length > 0) {
        return reply.code(200).send({
          success: false,
          requiresConfirmation: true,
          message: `Role "${roleToDelete.roleName}" is assigned to ${uniqueAffectedUsers.length} user(s)`,
          affectedUsers: uniqueAffectedUsers,
          role: {
            roleId: roleToDelete.roleId,
            roleName: roleToDelete.roleName,
            description: roleToDelete.description
          },
          instructions: 'To delete this role, set force=true in the query parameters. This will remove all user assignments.'
        });
      }

      Logger.log('info', 'role', 'delete-role', 'Calling permissionService.deleteRole');
      const result = await permissionService.deleteRole(
        tenantId,
        roleId,
        {
          force: force || false,
          transferUsersTo,
          deletedBy: request.userContext.internalUserId ?? undefined
        }
      );
      Logger.log('info', 'role', 'delete-role', 'permissionService.deleteRole completed', { usersAffected: result.usersAffected });

      Logger.log('info', 'general', 'delete-role', 'About to publish role deletion event', { roleToDeleteExists: !!roleToDelete });

      // Log role deletion activity
      await ActivityLogger.logActivity(
        (request.userContext.internalUserId ?? '') as string,
        tenantId,
        null,
        ACTIVITY_TYPES.ROLE_DELETED,
        {
          roleId: roleId,
          force: force,
          transferUsersTo: transferUsersTo,
          tenantId: tenantId,
          userEmail: request.userContext.email
        },
        ActivityLogger.createRequestContext(request as unknown as Record<string, unknown>)
      );

      // Publish role deletion event to relevant applications (only apps with permissions)
      if (roleToDelete) {
        Logger.log('info', 'general', 'delete-role', 'Publishing role deletion event for role', { roleId });
        Logger.log('info', 'general', 'delete-role', 'Role data for event', {
          roleId: roleToDelete.roleId,
          roleName: roleToDelete.roleName,
          permissionsType: typeof roleToDelete.permissions,
          permissionsValue: roleToDelete.permissions ? (typeof roleToDelete.permissions === 'string' ? 'JSON string' : 'object') : 'null/undefined',
          hasPermissions: !!roleToDelete.permissions
        });
        try {
          // Import the event publishing function
          Logger.log('info', 'general', 'delete-role', 'Importing roles.js');
          const { publishRoleEventToApplications } = await import('./roles.js');
          Logger.log('info', 'general', 'delete-role', 'Successfully imported publishRoleEventToApplications');

          await publishRoleEventToApplications(
            'role.deleted',
            tenantId,
            roleId,
            {
              roleName: roleToDelete.roleName || (roleToDelete as { name?: string }).name,
              description: roleToDelete.description,
              permissions: roleToDelete.permissions,
              restrictions: roleToDelete.restrictions,
              metadata: (roleToDelete as Record<string, unknown>).metadata,
              deletedBy: (request.userContext.internalUserId ?? '') as string,
              deletedAt: new Date().toISOString(),
              transferredToRoleId: transferUsersTo,
              affectedUsersCount: result.usersAffected || 0
            }
          );
          Logger.log('info', 'general', 'delete-role', 'Role deletion event published successfully');
        } catch (publishError: unknown) {
          const err = publishError as Error;
          Logger.log('warning', 'general', 'delete-role', 'Failed to publish role deletion event', { error: err.message });
          Logger.log('error', 'general', 'delete-role', 'Full publish error', { error: (publishError as Error).message });
          // Don't fail the deletion if event publishing fails
        }
      } else {
        Logger.log('warning', 'general', 'delete-role', 'No role data found for event publishing');
      }

      return {
        success: true,
        data: result,
        message: 'Role deleted successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'delete-role', 'Error deleting role', { error: error.message });
      fastify.log.error(error, 'Error deleting role:');
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      if (error.message.includes('in use') || error.message.includes('assigned to')) {
        return reply.code(409).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to delete role' });
    }
  });

  // Role templates - REMOVED (use /custom-roles/create-from-builder instead)

  // Get user role assignments
  fastify.get('/assignments', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      const userId = query.userId;
      const roleId = query.roleId;
      const page = query.page;
      const limit = query.limit;
      
      // Get tenant ID from user context
      const tenantId = getTenantId(request);
      
      const assignments = await permissionService.getRoleAssignments(
        { tenantId, userId, roleId, page, limit }
      );
      
      return {
        success: true,
        data: assignments
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching role assignments:');
      return reply.code(500).send({ error: 'Failed to fetch role assignments' });
    }
  });

  // Assign role to user
  fastify.post('/assignments', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const userId = body.userId as string;
      const roleId = body.roleId as string;
      const expiresAt = body.expiresAt as string | undefined;
      const conditions = body.conditions as unknown;
      const assignedBy = (request.userContext?.idpSub ?? request.user?.id) ?? '';
      
      // Get tenant ID from user context
      const tenantId = getTenantId(request);
      
      const assignment = await permissionService.assignRole({
        tenantId,
        userId,
        roleId,
        expiresAt,
        assignedBy,
        ...(conditions !== undefined && { conditions })
      } as any);

      // Log role assignment activity
      await ActivityLogger.logActivity(
        (request.userContext?.internalUserId ?? request.user?.id) ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.PERMISSION_GRANTED,
        {
          targetUserId: userId,
          roleId: roleId,
          expiresAt: expiresAt,
          hasConditions: !!conditions,
          tenantId: tenantId,
          userEmail: request.userContext?.email || request.user?.email
        },
        ActivityLogger.createRequestContext(request as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        data: assignment,
        message: 'Role assigned successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error assigning role:');
      if (error.message.includes('already assigned')) {
        return reply.code(409).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to assign role' });
    }
  });

  // Remove role assignment by assignmentId
  fastify.delete('/assignments/:assignmentId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const assignmentId = params.assignmentId;
      const tenantId = getTenantId(request);
      const removedBy = (request.userContext?.idpSub ?? request.user?.id) ?? '';
      
      await permissionService.removeRoleAssignmentById(
        tenantId,
        assignmentId,
        removedBy
      );

      // Log role removal activity
      await ActivityLogger.logActivity(
        (request.userContext?.internalUserId ?? request.user?.id) ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.PERMISSION_REVOKED,
        {
          assignmentId: assignmentId,
          tenantId: tenantId,
          userEmail: (request.userContext as unknown as Record<string, unknown>)?.email || (request.user as unknown as Record<string, unknown>)?.email
        },
        ActivityLogger.createRequestContext(request as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        message: 'Role assignment removed successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error removing role assignment:');
      if (error.message === 'Role assignment not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to remove role assignment' });
    }
  });

  // Remove role assignment by userId and roleId (deassign)
  fastify.delete('/assignments/user/:userId/role/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const userId = params.userId;
      const roleId = params.roleId;
      const tenantId = getTenantId(request);
      const removedBy = (request.userContext?.idpSub ?? request.user?.id) ?? '';
      
      await permissionService.removeRoleAssignment(
        tenantId,
        userId,
        roleId,
        removedBy
      );

      // Log role removal activity
      await ActivityLogger.logActivity(
        (request.userContext?.internalUserId ?? request.user?.id) ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.PERMISSION_REVOKED,
        {
          userId: userId,
          roleId: roleId,
          tenantId: tenantId,
          userEmail: (request.userContext as unknown as Record<string, unknown>)?.email || (request.user as unknown as Record<string, unknown>)?.email
        },
        ActivityLogger.createRequestContext(request as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        message: 'Role assignment removed successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error removing role assignment:');
      if (error.message === 'Role assignment not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to remove role assignment' });
    }
  });

  // Get permission audit log
  fastify.get('/audit', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.AUDIT_LOG_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, unknown>;
      const tenantId = getTenantId(request);
      const auditLog = await permissionService.getAuditLog(
        { ...query, tenantId }
      );
      
      return {
        success: true,
        data: auditLog
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching audit log:');
      return reply.code(500).send({ error: 'Failed to fetch audit log' });
    }
  });

  // Check user permissions
  fastify.post('/check', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const permissions = body.permissions;
      const userId = body.userId as string | undefined;
      const resource = body.resource;
      const context = body.context;
      const targetUserId = userId || (request.userContext as unknown as Record<string, unknown>)?.idpSub || (request.user as unknown as Record<string, unknown>)?.id;
      
      const results = await (permissionService as unknown as { checkPermissions: (tid: string, uid: string, perms: unknown, opts: unknown) => Promise<unknown> }).checkPermissions(
        getTenantId(request),
        String(targetUserId ?? ''),
        permissions,
        { resource, context }
      );
      
      return {
        success: true,
        data: results
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error checking permissions:');
      return reply.code(500).send({ error: 'Failed to check permissions' });
    }
  });

  // Get user effective permissions
  fastify.get('/user/:userId/effective', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const userId = params.userId;
      
      const permissions = await (permissionService as unknown as { getUserEffectivePermissions: (tid: string, uid: string) => Promise<unknown> }).getUserEffectivePermissions(
        getTenantId(request),
        userId
      );
      
      return {
        success: true,
        data: permissions
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching user permissions:');
      return reply.code(500).send({ error: 'Failed to fetch user permissions' });
    }
  });

  // Bulk role assignment
  fastify.post('/assignments/bulk', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const assignments = body.assignments;
      
      const results = await (permissionService as unknown as { bulkAssignRoles: (tid: string, assignments: unknown, by?: string) => Promise<unknown> }).bulkAssignRoles(
        getTenantId(request),
        assignments,
        (request.userContext?.idpSub ?? request.user?.id) ?? undefined
      );
      
      return {
        success: true,
        data: results,
        message: 'Bulk role assignment completed'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error in bulk role assignment:');
      return reply.code(500).send({ error: 'Failed to complete bulk assignment' });
    }
  });

  // Migrate role permissions to hierarchical format
  fastify.post('/migrate-role-permissions', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_UPDATE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);

      Logger.log('info', 'general', 'migrate-role-permissions', 'Starting role permissions migration', { tenantId });

      // Get all custom roles for this tenant
      const roles = await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          permissions: customRoles.permissions,
          isSystemRole: customRoles.isSystemRole
        })
        .from(customRoles)
        .where(and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.isSystemRole, false),
          not(eq(customRoles.permissions, null))
        ));

      Logger.log('info', 'general', 'migrate-role-permissions', 'Found custom roles to check', { count: roles.length });

      let updatedCount = 0;
      let skippedCount = 0;
      const results = [];

      for (const role of roles) {
        try {
          let permissionsData;

          // Parse permissions if it's a string
          if (typeof role.permissions === 'string') {
            try {
              permissionsData = JSON.parse(role.permissions);
            } catch (parseErr: unknown) {
              const parseError = parseErr as Error;
              Logger.log('warning', 'general', 'migrate-role-permissions', `Failed to parse permissions for role ${role.roleName}`, { error: parseError.message });
              skippedCount++;
              continue;
            }
          } else {
            permissionsData = role.permissions;
          }

          // Check if already in hierarchical format
          if (permissionsData && typeof permissionsData === 'object' && !Array.isArray(permissionsData)) {
            Logger.log('info', 'general', 'migrate-role-permissions', `Skipping role - already in hierarchical format`, { roleName: role.roleName });
            skippedCount++;
            results.push({
              roleId: role.roleId,
              roleName: role.roleName,
              status: 'skipped',
              reason: 'Already in hierarchical format'
            });
            continue;
          }

          // Check if it's in flat array format
          if (Array.isArray(permissionsData) && permissionsData.length > 0 && typeof permissionsData[0] === 'string') {
            Logger.log('info', 'general', 'migrate-role-permissions', `Converting role from flat array to hierarchical format`, { roleName: role.roleName });

            // Convert to hierarchical format
            const hierarchicalPermissions: Record<string, Record<string, string[]>> = {};
            permissionsData.forEach((permission: string) => {
              const parts = permission.split('.');
              if (parts.length >= 3) {
                const [app, module, operation] = parts;

                if (!hierarchicalPermissions[app]) {
                  hierarchicalPermissions[app] = {};
                }
                if (!hierarchicalPermissions[app][module]) {
                  hierarchicalPermissions[app][module] = [];
                }
                if (!hierarchicalPermissions[app][module].includes(operation)) {
                  hierarchicalPermissions[app][module].push(operation);
                }
              }
            });

            // Update the role
            await db
              .update(customRoles)
              .set({
                permissions: JSON.stringify(hierarchicalPermissions),
                updatedAt: new Date()
              })
              .where(eq(customRoles.roleId, role.roleId));

            Logger.log('info', 'general', 'migrate-role-permissions', `Updated role with hierarchical permissions`, { roleName: role.roleName });
            updatedCount++;
            results.push({
              roleId: role.roleId,
              roleName: role.roleName,
              status: 'updated',
              oldFormat: 'flat_array',
              newFormat: 'hierarchical'
            });
          } else {
            Logger.log('warning', 'general', 'migrate-role-permissions', `Unknown permissions format for role`, { roleName: role.roleName, permissionsType: typeof permissionsData });
            skippedCount++;
            results.push({
              roleId: role.roleId,
              roleName: role.roleName,
              status: 'skipped',
              reason: 'Unknown permissions format'
            });
          }

        } catch (err: unknown) {
          const error = err as Error;
          Logger.log('error', 'general', 'migrate-role-permissions', `Error processing role`, { roleName: role.roleName, error: error.message });
          skippedCount++;
          results.push({
            roleId: role.roleId,
            roleName: role.roleName,
            status: 'error',
            error: error.message
          });
        }
      }

      Logger.log('info', 'general', 'migrate-role-permissions', 'Migration completed', { updated: updatedCount, skipped: skippedCount, total: roles.length });

      return {
        success: true,
        message: `Migration completed. Updated ${updatedCount} roles, skipped ${skippedCount} roles.`,
        data: {
          totalProcessed: roles.length,
          updated: updatedCount,
          skipped: skippedCount,
          results: results
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'migrate-role-permissions', 'Migration failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to migrate role permissions',
        error: error.message
      });
    }
  });

  // Get permission summary
  fastify.get('/summary', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const permissionData = await permissionService.getAvailablePermissions();

      return {
        success: true,
        data: {
          totalApplications: permissionData.summary.applicationCount,
          totalModules: permissionData.summary.moduleCount,
          totalOperations: permissionData.summary.operationCount,
          byApplication: permissionData.applications.map((app: any) => ({
            name: app.name,
            key: app.key,
            moduleCount: app.moduleCount,
            operationCount: app.operationCount
          }))
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching permission summary:');
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch permission summary',
        error: error.message
      });
    }
  });
}

// Helper functions
async function getPermissionTemplates() {
  return [
    {
      id: 'admin',
      name: 'Admin',
      description: 'Full access to all CRM applications and modules',
      color: 'bg-red-100 text-red-800 border-red-200',
      isBuiltIn: true,
      permissions: [
        { appCode: 'crm', moduleCode: 'leads', permissions: ['create', 'read', 'read_all', 'update', 'delete', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'accounts', permissions: ['create', 'read', 'read_all', 'update', 'delete', 'view_contacts', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'contacts', permissions: ['create', 'read', 'read_all', 'update', 'delete', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'opportunities', permissions: ['create', 'read', 'read_all', 'update', 'delete', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'quotations', permissions: ['create', 'read', 'read_all', 'update', 'delete', 'generate_pdf', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'tickets', permissions: ['create', 'read', 'read_all', 'update', 'delete'] },
        { appCode: 'crm', moduleCode: 'communications', permissions: ['create', 'read', 'read_all', 'update', 'delete'] },
        { appCode: 'crm', moduleCode: 'invoices', permissions: ['create', 'read', 'read_all', 'update', 'delete'] },
        { appCode: 'crm', moduleCode: 'sales_orders', permissions: ['create', 'read', 'read_all', 'update', 'delete'] },
        { appCode: 'crm', moduleCode: 'documents', permissions: ['upload', 'read', 'read_all', 'download', 'delete'] },
        { appCode: 'crm', moduleCode: 'bulk_operations', permissions: ['import', 'export', 'template'] },
        { appCode: 'crm', moduleCode: 'pdf', permissions: ['generate', 'download'] },
        { appCode: 'crm', moduleCode: 'dashboard', permissions: ['view', 'stats'] },
        { appCode: 'crm', moduleCode: 'users', permissions: ['create', 'read', 'read_all', 'update', 'delete', 'change_status', 'change_role', 'change_password', 'bulk_upload'] },
        { appCode: 'crm', moduleCode: 'roles', permissions: ['create', 'read', 'update', 'delete'] },
        { appCode: 'crm', moduleCode: 'audit', permissions: ['view_own', 'view_all', 'export', 'stats', 'search'] },
        { appCode: 'crm', moduleCode: 'special', permissions: ['admin_access', 'super_admin', 'view_all_data', 'export_all', 'import_all'] }
      ]
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Management access with approval and export/import permissions',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      isBuiltIn: true,
      permissions: [
        { appCode: 'crm', moduleCode: 'leads', permissions: ['create', 'read', 'read_all', 'update', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'accounts', permissions: ['create', 'read', 'read_all', 'update', 'view_contacts', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'contacts', permissions: ['create', 'read', 'read_all', 'update', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'opportunities', permissions: ['create', 'read', 'read_all', 'update', 'export', 'import'] },
        { appCode: 'crm', moduleCode: 'quotations', permissions: ['create', 'read', 'read_all', 'update', 'generate_pdf', 'export'] },
        { appCode: 'crm', moduleCode: 'tickets', permissions: ['create', 'read', 'read_all', 'update'] },
        { appCode: 'crm', moduleCode: 'communications', permissions: ['create', 'read', 'read_all', 'update'] },
        { appCode: 'crm', moduleCode: 'invoices', permissions: ['read', 'read_all'] },
        { appCode: 'crm', moduleCode: 'sales_orders', permissions: ['read', 'read_all'] },
        { appCode: 'crm', moduleCode: 'documents', permissions: ['upload', 'read', 'read_all', 'download'] },
        { appCode: 'crm', moduleCode: 'bulk_operations', permissions: ['export', 'template'] },
        { appCode: 'crm', moduleCode: 'pdf', permissions: ['generate', 'download'] },
        { appCode: 'crm', moduleCode: 'dashboard', permissions: ['view', 'stats'] },
        { appCode: 'crm', moduleCode: 'audit', permissions: ['view_own', 'view_all', 'export'] }
      ]
    },
    {
      id: 'sales_rep',
      name: 'Sales Representative',
      description: 'CRM access for sales activities with export capabilities',
      color: 'bg-green-100 text-green-800 border-green-200',
      isBuiltIn: true,
      permissions: [
        { appCode: 'crm', moduleCode: 'leads', permissions: ['create', 'read', 'update', 'export'] },
        { appCode: 'crm', moduleCode: 'accounts', permissions: ['read', 'view_contacts'] },
        { appCode: 'crm', moduleCode: 'contacts', permissions: ['create', 'read', 'update', 'export'] },
        { appCode: 'crm', moduleCode: 'opportunities', permissions: ['create', 'read', 'update', 'export'] },
        { appCode: 'crm', moduleCode: 'quotations', permissions: ['create', 'read', 'update'] },
        { appCode: 'crm', moduleCode: 'communications', permissions: ['create', 'read', 'update'] },
        { appCode: 'crm', moduleCode: 'documents', permissions: ['upload', 'read', 'download'] },
        { appCode: 'crm', moduleCode: 'dashboard', permissions: ['view'] }
      ]
    },
    {
      id: 'hr_specialist',
      name: 'HR Specialist',
      description: 'HR module access with employee management',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      isBuiltIn: true,
      permissions: [
        { appCode: 'hr', moduleCode: 'employees', permissions: ['view', 'create', 'edit'] },
        { appCode: 'hr', moduleCode: 'payroll', permissions: ['view', 'export'] },
        { appCode: 'hr', moduleCode: 'leave', permissions: ['view', 'approve', 'reject'] }
      ]
    },
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to CRM information',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      isBuiltIn: true,
      permissions: [
        { appCode: 'crm', moduleCode: 'leads', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'accounts', permissions: ['read', 'view_contacts'] },
        { appCode: 'crm', moduleCode: 'contacts', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'opportunities', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'quotations', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'tickets', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'communications', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'invoices', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'sales_orders', permissions: ['read'] },
        { appCode: 'crm', moduleCode: 'documents', permissions: ['read', 'download'] },
        { appCode: 'crm', moduleCode: 'dashboard', permissions: ['view'] }
      ]
    }
  ];
}

async function getTemplatePermissions(templateId: string): Promise<Array<{ appId: string; moduleId: string; permissions: string[] }> | null> {
  const templates = await getPermissionTemplates();
  const template = templates.find((t: { id: string }) => t.id === templateId);
  
  if (!template) {
    return null;
  }

  const convertedPermissions: Array<{ appId: string; moduleId: string; permissions: string[] }> = [];
  
  for (const permission of template.permissions as Array<{ appCode: string; moduleCode: string; permissions: string[] }>) {
    // Get app and module IDs from the database
    const [app] = await db
      .select({ appId: applications.appId })
      .from(applications)
      .where(eq(applications.appCode, permission.appCode))
      .limit(1);
      
    if (!app) continue;
    
    const [module] = await db
      .select({ moduleId: applicationModules.moduleId })
      .from(applicationModules)
      .where(and(
        eq(applicationModules.appId, app.appId),
        eq(applicationModules.moduleCode, permission.moduleCode)
      ))
      .limit(1);
      
    if (!module) continue;
    
    convertedPermissions.push({
      appId: app.appId,
      moduleId: module.moduleId,
      permissions: permission.permissions
    });
  }
  
  return convertedPermissions;
}  