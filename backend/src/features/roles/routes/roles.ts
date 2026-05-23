import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import permissionService from '../services/permission-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { checkRoleLimit } from '../../../middleware/restrictions/planRestrictions.js';
import { db } from '../../../db/index.js';
import { userRoleAssignments, tenantUsers, customRoles } from '../../../db/schema/index.js';
import { applications as applicationsSchema, organizationApplications } from '../../../db/schema/core/suite-schema.js';
import { eq, and } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';
import ActivityLogger, { ACTIVITY_TYPES } from '../../../services/activityLogger.js';
// crmSyncStreams removed - migrated to RabbitMQ (AmazonMQPublisher)
import { PermissionMatrixUtils } from '../../../data/permission-matrix.js';
import { PERMISSIONS } from '../../../constants/permissions.js';

/**
 * Publish role events to relevant applications based on permissions
 * Publishes to application-specific streams: crm:sync:role:{eventType}
 * Only publishes to applications that have permissions in the role
 */
export async function publishRoleEventToApplications(
  eventType: string,
  tenantId: string,
  roleId: string,
  roleData: Record<string, unknown>
): Promise<void> {
  try {
    // NOTE: kindeOrgId translation now happens inside snsSqsPublisher.publishInterAppEvent
    // (Bug 1/3 chokepoint fix) — callers may pass either wrapper UUID or kindeOrgId.

    // Parse permissions if they're stored as JSON string
    let permissions = roleData.permissions as unknown;
    Logger.log('info', 'role', 'publish-role-event', 'Processing permissions for role', { roleId, type: typeof permissions, isNull: permissions === null, isString: typeof permissions === 'string' });

    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
        Logger.log('info', 'role', 'publish-role-event', 'Parsed permissions JSON string for role', { roleId });
      } catch (err: unknown) {
        const e = err as Error;
        Logger.log('warning', 'role', 'publish-role-event', 'Failed to parse permissions JSON for role', { roleId, error: e.message });
        permissions = {};
      }
    }

    // Ensure permissions is an object (could be null/undefined from database)
    if (!permissions || typeof permissions !== 'object') {
      Logger.log('warning', 'role', 'publish-role-event', 'Invalid permissions format for role, using empty object', { roleId, type: typeof permissions });
      permissions = {};
    }

    // Extract which applications are present in this role's permissions
    let applications = PermissionMatrixUtils.extractApplicationsFromPermissions(permissions as Record<string, unknown> | null | undefined);
    Logger.log('info', 'role', 'publish-role-event', 'Extracted applications for role', { roleId, applications });

    // For deletion events, if we can't extract applications from permissions,
    // try to get all enabled applications for the tenant as a fallback
    if (applications.length === 0 && eventType === 'role.deleted') {
      Logger.log('warning', 'role', 'publish-role-event', 'No applications found in role permissions for deletion event, attempting fallback', { roleId, permissionsType: typeof permissions });
      
      try {
        // Try to get enabled applications for the tenant as fallback
        const enabledApps = await db
          .select({
            appCode: applicationsSchema.appCode
          })
          .from(organizationApplications)
          .innerJoin(applicationsSchema, eq(organizationApplications.appId, applicationsSchema.appId))
          .where(and(
            eq(organizationApplications.tenantId, tenantId),
            eq(organizationApplications.isEnabled, true)
          ));
        
        applications = enabledApps.map(app => app.appCode);
        Logger.log('info', 'role', 'publish-role-event', 'Fallback: Found enabled applications for tenant', { tenantId, count: applications.length, applications });
        
        if (applications.length === 0) {
          Logger.log('warning', 'role', 'publish-role-event', 'No enabled applications found for tenant, skipping event publishing', { tenantId });
          return;
        }
      } catch (err: unknown) {
        const fallbackError = err as Error;
        Logger.log('error', 'role', 'publish-role-event', 'Failed to get enabled applications as fallback, skipping event publishing', { roleId, error: fallbackError.message });
        return;
      }
    } else if (applications.length === 0) {
      Logger.log('warning', 'role', 'publish-role-event', 'No applications found in role permissions, skipping event publishing', { roleId, permissionsType: typeof permissions });
      return;
    }

    Logger.log('info', 'role', 'publish-role-event', `Publishing ${eventType} event for role`, { roleId, applications });

    // Publish event to each relevant application using their specific stream
    const publishPromises = applications.map(async (appCode) => {
      // Filter permissions for this specific application
      const appPermissions = PermissionMatrixUtils.filterPermissionsByApplication(permissions as Record<string, unknown>, appCode);

      // Prepare event data with only relevant permissions
      const eventData = {
        roleId: roleId,
        roleName: roleData.roleName || roleData.name,
        description: roleData.description,
        permissions: appPermissions, // Only permissions for this app
        restrictions: roleData.restrictions,
        metadata: roleData.metadata,
        ...(eventType === 'role.created' && {
          createdBy: roleData.createdBy,
          createdAt: roleData.createdAt
        }),
        ...(eventType === 'role.updated' && {
          updatedBy: roleData.updatedBy,
          updatedAt: roleData.updatedAt
        }),
        ...(eventType === 'role.deleted' && {
          deletedBy: roleData.deletedBy,
          deletedAt: roleData.deletedAt,
          transferredToRoleId: roleData.transferredToRoleId,
          affectedUsersCount: roleData.affectedUsersCount
        })
      };

      try {
        // Use SNS/SQS publisher to publish role event
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        
        await snsSqsPublisher.publishRoleEvent(
          appCode, // Target application (crm, hr, etc.)
          eventType, // Already in format: role.created, role.updated, role.deleted
          tenantId,
          roleId,
          eventData,
          (roleData.createdBy || roleData.updatedBy || roleData.deletedBy || 'system') as string
        );

        Logger.log('info', 'role', 'publish-role-event', `Published ${eventType} event to application`, { appCode, roleId });
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'role', 'publish-role-event', `Failed to publish ${eventType} event to application`, { appCode, error: error.message });
        // Don't throw - continue with other applications
      }
    });

    await Promise.allSettled(publishPromises);
    Logger.log('info', 'role', 'publish-role-event', `Completed publishing ${eventType} events for role`, { roleId });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'role', 'publish-role-event', 'Error publishing role events', { error: error.message });
    // Don't throw - event publishing failure shouldn't break the API response
  }
}

export default async function roleRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  type ReqWithUser = FastifyRequest & { userContext?: { tenantId?: string; internalUserId?: string; email?: string }; body?: Record<string, unknown>; params?: Record<string, string>; query?: Record<string, string> };
  // Get all role templates with categories
  fastify.get('/templates', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    try {
      const category = query?.category;
      const includeInactive = query?.includeInactive === 'true' || query?.includeInactive === '1';
      const templates = await permissionService.getRoleTemplates({
        category,
        includeInactive
      });
      
      return {
        success: true,
        data: templates
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching role templates:');
      return reply.code(500).send({ error: 'Failed to fetch role templates' });
    }
  });

  // Get available permissions with categories and operations
  fastify.get('/permissions/available', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const permissionsResponse = await permissionService.getAvailablePermissions();
      const flatPerms = (permissionsResponse as any).applications ?? (permissionsResponse as any).structure ?? [];
      const permissionsList = Array.isArray(flatPerms) ? flatPerms : Object.values(flatPerms as Record<string, unknown>).flat();
      
      // Group permissions by tool, resource, and operation
      const grouped = (permissionsList as any[]).reduce((acc: any, perm: any) => {
        const { tool, resource, action, category } = perm;
        
        if (!acc[tool]) acc[tool] = { name: tool, resources: {}, category };
        if (!acc[tool].resources[resource]) {
          acc[tool].resources[resource] = { 
            name: resource, 
            operations: [], 
            category: category 
          };
        }
        
        acc[tool].resources[resource].operations.push({
          action,
          id: perm.id,
          name: perm.name,
          description: perm.description,
          level: perm.level || 'standard' // basic, standard, advanced
        });
        
        return acc;
      }, {});

      return {
        success: true,
        data: {
          grouped,
          flat: permissionsList,
          metadata: {
            totalPermissions: (permissionsList as any[]).length,
            tools: Object.keys(grouped).length,
            categories: [...new Set((permissionsList as any[]).map((p: any) => p.category))]
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching available permissions:');
      return reply.code(500).send({ error: 'Failed to fetch permissions' });
    }
  });

  // Create role from template with customizations
  fastify.post('/from-template', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_CREATE), checkRoleLimit],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const userCtx = (request as any).userContext;
      const roleData = {
        ...body,
        tenantId: userCtx?.tenantId,
        createdBy: userCtx?.internalUserId
      };
      
      const role = await permissionService.createRoleFromTemplate(roleData as any);
      
      return {
        success: true,
        data: role,
        message: 'Role created from template successfully'
      };
    } catch (error) {
      request.log.error(error, 'Error creating role from template:');
      return reply.code(500).send({ error: 'Failed to create role from template' });
    }
  });

  // Get tenant roles with advanced filtering
  fastify.get('/', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)],
    schema: {}
  }, async (request, reply) => {
    try {
      Logger.log('info', 'role', 'get-roles', 'GET roles request', { tenantId: (request as any).userContext?.tenantId });

      const roles = await permissionService.getTenantRoles(
        request.userContext?.tenantId ?? '',
        request.query as any
      );
      
      // Parse JSON fields for frontend consumption with error handling
      const parsedRoles = (roles.data as any[] | undefined)?.map((role: any) => {
        let permissions = {};
        let restrictions = {};
        let metadata = {};
        
        try {
          // Handle both object and string data types
          if (typeof role.permissions === 'object' && role.permissions !== null) {
            permissions = role.permissions;
          } else if (typeof role.permissions === 'string' && role.permissions) {
            permissions = JSON.parse(role.permissions);
          } else {
            permissions = {};
          }
        } catch (err: unknown) {
          const error = err as Error;
          Logger.log('error', 'role', 'get-roles', 'Failed to parse permissions for role', { roleId: (role as any).roleId, error: error.message });
          permissions = {};
        }
        
        try {
          // Handle both object and string data types
          if (typeof role.restrictions === 'object' && role.restrictions !== null) {
            restrictions = role.restrictions;
          } else if (typeof role.restrictions === 'string' && role.restrictions) {
            restrictions = JSON.parse(role.restrictions);
          } else {
            restrictions = {};
          }
        } catch (err: unknown) {
          const error = err as Error;
          Logger.log('error', 'role', 'get-roles', 'Failed to parse restrictions for role', { roleId: (role as any).roleId, error: error.message });
          restrictions = {};
        }

        try {
          metadata = (role as any).metadata ? JSON.parse((role as any).metadata) : {};
        } catch (err: unknown) {
          const error = err as Error;
          Logger.log('error', 'role', 'get-roles', 'Failed to parse metadata for role', { roleId: (role as any).roleId, error: error.message });
          metadata = {};
        }
        
        // Calculate permission counts for better frontend display
        let permissionCount = 0;
        let moduleCount = 0;
        let applicationCount = 0;
        
        if (Array.isArray(permissions)) {
          // Handle flat array permissions (from CustomRoleService)
          permissionCount = permissions.length;
          
          // Count unique applications and modules
          const apps = new Set();
          const modules = new Set();
          
          permissions.forEach(permission => {
            if (typeof permission === 'string') {
              const parts = permission.split('.');
              if (parts.length >= 3) {
                const [app, module] = parts;
                apps.add(app);
                modules.add(`${app}.${module}`);
              }
            }
          });
          
          applicationCount = apps.size;
          moduleCount = modules.size;
          
        } else if (typeof permissions === 'object' && permissions !== null) {
          // Handle hierarchical permissions (from PermissionService)
          const keys = Object.keys(permissions);
          
          // Skip metadata and other non-permission keys
          const permissionKeys = keys.filter(key => 
            key !== 'metadata' && key !== 'inheritance' && key !== 'restrictions'
          );
          
          applicationCount = permissionKeys.length;
          permissionKeys.forEach(appKey => {
            const appPerms = (permissions as Record<string, unknown>)[appKey];
            if (typeof appPerms === 'object' && appPerms !== null) {
              const modules = Object.keys(appPerms);
              moduleCount += modules.length;
              modules.forEach(moduleKey => {
                const modulePerms = (appPerms as Record<string, unknown>)[moduleKey];
                if (Array.isArray(modulePerms)) {
                  permissionCount += modulePerms.length;
                }
              });
            }
          });
        }
        
        // Convert flat array permissions to structured format for consistent frontend display
        let displayPermissions = permissions;
        
        if (Array.isArray(permissions)) {
          // Convert flat array to hierarchical structure for frontend
          displayPermissions = {};
          const groupedPermissions = {};
          
          permissions.forEach(permission => {
            if (typeof permission === 'string') {
              const parts = permission.split('.');
              if (parts.length >= 3) {
                const [app, module, ...actionParts] = parts;
                const action = actionParts.join('.');
                const appKey = app;
                const moduleKey = module;
                
                const gp = groupedPermissions as Record<string, Record<string, string[]>>;
                if (!gp[appKey]) {
                  gp[appKey] = {};
                }
                if (!gp[appKey][moduleKey]) {
                  gp[appKey][moduleKey] = [];
                }
                gp[appKey][moduleKey].push(action);
              }
            }
          });
          
          displayPermissions = groupedPermissions;
        }

        return {
          ...(role as Record<string, unknown>),
          permissions: displayPermissions,
          restrictions,
          metadata,
          // Add computed fields for frontend display
          permissionCount,
          moduleCount,
          applicationCount
        };
      }) || [];
      
      Logger.log('info', 'role', 'get-roles', 'Roles fetched successfully', { count: parsedRoles.length, total: roles.total || 0 });
      
      return {
        success: true,
        data: {
          roles: parsedRoles,
          total: roles.total || 0,
          pagination: {
            currentPage: roles.page || 1,
            totalPages: roles.totalPages || 1,
            limit: roles.limit || 20
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'role', 'get-roles', 'Error fetching tenant roles', { error: error.message, tenantId: request.userContext?.tenantId });
      
      // Provide more specific error response
      return reply.code(500).send({ 
        success: false,
        error: 'Failed to fetch roles',
        message: 'An error occurred while fetching roles. Please try again.',
        code: 'FETCH_ROLES_ERROR',
        data: {
          roles: [],
          total: 0,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
          }
        }
      });
    }
  });

  // Create custom role with advanced features
  fastify.post('/', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_CREATE), checkRoleLimit],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const startTime = Date.now();
    const requestId = Logger.generateRequestId('role-create');
    
    try {
      const userCtx = (request as any).userContext;
      Logger.role.create.start(requestId, {
        tenantId: userCtx?.tenantId,
        userId: userCtx?.internalUserId,
        roleName: body?.name,
        hasDescription: !!(body as any)?.description,
        permissionsCount: Object.keys(((body as any)?.permissions as object) || {}).length,
        hasRestrictions: !!(body as any)?.restrictions,
        hasInheritance: !!(body as any)?.inheritance,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Check if user has completed onboarding and has internal user record
      Logger.role.create.step(requestId, 'Validation', 'Checking user authorization', {
        hasInternalUserId: !!request.userContext.internalUserId,
        tenantId: request.userContext.tenantId
      });
      
      if (!request.userContext.internalUserId) {
        Logger.role.create.step(requestId, 'Error', 'User attempting to create role without internal user record');
        return reply.code(401).send({
          success: false,
          error: 'Access denied',
          message: 'You must complete onboarding before creating roles. Please complete your organization setup.',
          code: 'ONBOARDING_REQUIRED'
        });
      }

      const roleData = {
        ...(body || {}),
        tenantId: request.userContext.tenantId,
        createdBy: request.userContext.internalUserId
      };
      
      Logger.role.create.step(requestId, 'Processing', 'Creating role with permission service', {
        roleData: {
          name: (roleData as any).name,
          tenantId: (roleData as any).tenantId,
          createdBy: (roleData as any).createdBy,
          permissionsCount: Object.keys((roleData as any).permissions || {}).length
        }
      });
      
      const role = await permissionService.createAdvancedRole(roleData);

      Logger.role.create.step(requestId, 'Success', 'Role created successfully', {
        roleId: role.roleId,
        roleName: role.roleName,
        tenantId: role.tenantId
      });

      // Log role creation activity
      await ActivityLogger.logActivity(
        (request as any).userContext?.internalUserId ?? '',
        (request as any).userContext?.tenantId ?? '',
        null,
        ACTIVITY_TYPES.ROLE_CREATED,
        {
          roleId: role.roleId,
          roleName: role.roleName,
          permissionsCount: Object.keys((body as any)?.permissions || {}).length,
          tenantId: (request as any).userContext?.tenantId,
          userEmail: (request as any).userContext?.email
        },
        ActivityLogger.createRequestContext(request as any)
      );

      // Publish role creation event to relevant applications (only apps with permissions)
      await publishRoleEventToApplications(
        'role.created',
        (request as any).userContext?.tenantId ?? '',
        role.roleId ?? '',
        {
          roleName: role.roleName,
          description: role.description,
          permissions: role.permissions,
          restrictions: role.restrictions,
          metadata: (role as any).metadata,
          createdBy: role.createdBy,
          createdAt: role.createdAt
        }
      );
      
      // Parse JSON fields for frontend consumption with error handling
      let permissions = {};
      let restrictions = {};
      
      try {
        permissions = (role as any).permissions ? JSON.parse((role as any).permissions) : {};
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'role', 'create-role', 'Failed to parse permissions for created role', { roleId: (role as any).roleId, error: error.message });
        permissions = {};
      }
      
      try {
        restrictions = (role as any).restrictions ? JSON.parse((role as any).restrictions) : {};
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'role', 'create-role', 'Failed to parse restrictions for created role', { roleId: (role as any).roleId, error: error.message });
        restrictions = {};
      }
      
      const parsedRole = {
        ...(role as Record<string, unknown>),
        permissions,
        restrictions
      };
      
      Logger.role.create.success(requestId, startTime, {
        roleId: (parsedRole as any).roleId,
        roleName: (parsedRole as any).roleName,
        tenantId: (parsedRole as any).tenantId,
        permissionsCount: Object.keys(permissions).length,
        hasRestrictions: Object.keys(restrictions).length > 0
      });
      
      return {
        success: true,
        data: parsedRole,
        message: 'Role created successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'role', 'create-role', 'Error creating role', { error: error.message, tenantId: request.userContext.tenantId });
      
      // Provide more specific error responses
      if ((error as Error).message.includes('already exists')) {
        return reply.code(409).send({ 
          success: false,
          error: 'Duplicate role name',
          message: error.message,
          code: 'DUPLICATE_ROLE_NAME'
        });
      }
      
      if ((error as Error).message.includes('Permission validation failed') || 
          error.message.includes('Restriction validation failed')) {
        return reply.code(400).send({ 
          success: false,
          error: 'Validation failed',
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
      
      if ((error as Error).message.includes('One or more parent roles not found')) {
        return reply.code(400).send({ 
          success: false,
          error: 'Invalid parent roles',
          message: 'One or more specified parent roles do not exist.',
          code: 'INVALID_PARENT_ROLES'
        });
      }
      
      // Generic server error
      return reply.code(500).send({ 
        success: false,
        error: 'Failed to create role',
        message: 'An internal server error occurred while creating the role. Please try again.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  // Update role with advanced permissions
  fastify.put('/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_EDIT)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const roleId = params.roleId ?? '';
      const updateData = body;
      const tenantId = (request as any).userContext?.tenantId ?? '';

      Logger.log('info', 'role', 'update-role', 'Updating role', { roleId, tenantId, restrictionsType: typeof updateData.restrictions });

      const updatedRole = await permissionService.updateAdvancedRole((request as any).userContext?.tenantId ?? '', roleId, updateData as any);

      Logger.log('info', 'role', 'update-role', 'Role updated successfully', { roleId: (updatedRole as any).roleId });

      // Log role update activity
      await ActivityLogger.logActivity(
        (request as any).userContext?.internalUserId ?? '',
        (request as any).userContext?.tenantId ?? '',
        null,
        ACTIVITY_TYPES.ROLE_UPDATED,
        {
          roleId: roleId,
          updatedFields: Object.keys(updateData),
          tenantId: (request as any).userContext?.tenantId,
          userEmail: (request as any).userContext?.email
        },
        ActivityLogger.createRequestContext(request as any)
      );

      // Publish role update event to relevant applications (only apps with permissions)
      await publishRoleEventToApplications(
        'role.updated',
        tenantId,
        roleId,
        {
          roleName: updatedRole.roleName || (updatedRole as any).name,
          description: updatedRole.description,
          permissions: updatedRole.permissions,
          restrictions: updatedRole.restrictions,
          metadata: (updatedRole as any).metadata,
          updatedBy: (request as any).userContext?.internalUserId,
          updatedAt: updatedRole.updatedAt || new Date()
        }
      );

      // When permissions explicitly changed, also emit a fine-grained event
      if (updateData.permissions !== undefined) {
        await publishRoleEventToApplications(
          'role.permissions_updated',
          tenantId,
          roleId,
          {
            roleName: updatedRole.roleName || (updatedRole as any).name,
            permissions: updatedRole.permissions,
            updatedBy: (request as any).userContext?.internalUserId,
            updatedAt: updatedRole.updatedAt || new Date()
          }
        );
      }

      // Get users affected by this role change — scoped to this tenant
      const affectedUsers = await db
        .select({
          userId: userRoleAssignments.userId,
          email: tenantUsers.email
        })
        .from(userRoleAssignments)
        .leftJoin(tenantUsers, and(
          eq(userRoleAssignments.userId, tenantUsers.userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .where(and(
          eq(userRoleAssignments.roleId, roleId),
          eq(userRoleAssignments.isActive, true)
        ));

      Logger.log('info', 'role', 'update-role', 'Role change affects users', { count: affectedUsers.length });

      // Trigger permission refresh notification for affected users
      if (affectedUsers.length > 0) {
        Logger.log('info', 'role', 'update-role', 'Triggering permission refresh notifications for affected users', { emails: affectedUsers.map(u => u.email) });
        
        // In a real implementation, you would implement WebSocket broadcasting here
        // For now, we'll include this information in the response so the frontend can handle it
      }

      return {
        success: true,
        data: updatedRole,
        affectedUsers: {
          count: affectedUsers.length,
          emails: affectedUsers.map(u => u.email),
          userIds: affectedUsers.map(u => u.userId)
        },
        message: `Role updated successfully. ${affectedUsers.length} users affected.`,
        // Include a flag that frontend can use to trigger refresh notifications
        shouldNotifyUsers: affectedUsers.length > 0
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'role', 'update-role', 'Error updating role', { error: error.message, roleId: params.roleId, tenantId: (request as any).userContext?.tenantId });

      return reply.code(500).send({
        error: 'Failed to update role',
        message: (error as Error).message
      });
    }
  });

  // Clone role with modifications
  fastify.post('/:roleId/clone', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_CREATE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const roleId = params.roleId ?? '';
      const cloneData = {
        ...(request.body as Record<string, unknown>),
        tenantId: (request as any).userContext?.tenantId,
        createdBy: (request as any).userContext?.internalUserId
      };
      
      const clonedRole = await permissionService.cloneRole(roleId, cloneData as any);
      
      return {
        success: true,
        data: clonedRole,
        message: 'Role cloned successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error cloning role:');
      return reply.code(500).send({ error: 'Failed to clone role' });
    }
  });

  // Validate role permissions
  fastify.post('/:roleId/validate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const roleId = params.roleId ?? '';
      const context = (body as any)?.context;
      
      const validation = await permissionService.validateRoleAccess(
        (request as any).userContext?.tenantId ?? '',
        roleId,
        context
      );
      
      return {
        success: true,
        data: validation
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error validating role:');
      return reply.code(500).send({ error: 'Failed to validate role' });
    }
  });

  // Bulk operations on roles
  fastify.post('/bulk', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const { operation, roleIds, options } = body as any;
      
      const result = await permissionService.bulkRoleOperation(
        (request as any).userContext?.tenantId ?? '',
        operation,
        roleIds,
        options,
        (request as any).userContext?.internalUserId ?? ''
      );
      
      return {
        success: true,
        data: result,
        message: `Bulk ${operation} completed successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error in bulk role operation:');
      return reply.code(500).send({ error: 'Failed to complete bulk operation' });
    }
  });

  // Delete role with safety checks
  fastify.delete('/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_DELETE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const roleId = params.roleId ?? '';
      const force = (query as any)?.force;
      const transferUsersTo = (query as any)?.transferUsersTo;
      const tenantId = request.userContext.tenantId;
      
      // Get role data before deletion for event publishing
      const [roleToDelete] = await db
        .select()
        .from(customRoles)
        .where(
          and(
            eq(customRoles.tenantId, tenantId ?? ''),
            eq(customRoles.roleId, roleId)
          )
        )
        .limit(1);
      
      const result = await permissionService.deleteRole(
        tenantId ?? '',
        roleId,
        {
          force,
          transferUsersTo,
          deletedBy: (request as any).userContext?.internalUserId
        }
      );

      // Log role deletion activity
      await ActivityLogger.logActivity(
        (request as any).userContext?.internalUserId ?? '',
        tenantId ?? '',
        null,
        ACTIVITY_TYPES.ROLE_DELETED,
        {
          roleId: roleId,
          force: force,
          transferUsersTo: transferUsersTo,
          tenantId: tenantId,
          userEmail: (request as any).userContext?.email
        },
        ActivityLogger.createRequestContext(request as any)
      );

      // Publish role deletion event to relevant applications (only apps with permissions)
      if (roleToDelete) {
        try {
          await publishRoleEventToApplications(
            'role.deleted',
            tenantId ?? '',
            roleId,
            {
              roleName: (roleToDelete as any).roleName || (roleToDelete as any).name,
              description: roleToDelete.description,
              permissions: roleToDelete.permissions,
              restrictions: roleToDelete.restrictions,
              metadata: (roleToDelete as any).metadata,
              deletedBy: (request as any).userContext?.internalUserId,
              deletedAt: new Date().toISOString(),
              transferredToRoleId: transferUsersTo,
              affectedUsersCount: result.usersAffected || 0
            }
          );
        } catch (publishErr: unknown) {
          const publishError = publishErr as Error;
          Logger.log('warning', 'role', 'delete-role', 'Failed to publish role deletion event', { error: publishError.message });
          // Don't fail the deletion if event publishing fails
        }
      }

      return {
        success: true,
        data: result,
        message: 'Role deleted successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error deleting role:');
      return reply.code(500).send({ error: 'Failed to delete role' });
    }
  });

  // Specific bulk delete endpoint (for frontend compatibility)
  fastify.post('/bulk/delete', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_DELETE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const { roleIds, force, transferUsersTo } = body as any;
      
      const result = await permissionService.bulkRoleOperation(
        (request as any).userContext?.tenantId ?? '',
        'delete',
        roleIds ?? [],
        { force, transferUsersTo },
        (request as any).userContext?.internalUserId ?? ''
      );
      
      return {
        success: true,
        data: result,
        message: `Bulk delete completed successfully. ${result.summary.success} roles deleted, ${result.summary.failure} failed.`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error in bulk delete operation:');
      return reply.code(500).send({ error: 'Failed to complete bulk delete' });
    }
  });

  // Specific bulk deactivate endpoint (for frontend compatibility)
  fastify.post('/bulk/deactivate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const roleIds = (body as any)?.roleIds ?? [];
      
      const result = await permissionService.bulkRoleOperation(
        (request as any).userContext?.tenantId ?? '',
        'deactivate',
        roleIds,
        {},
        (request as any).userContext?.internalUserId ?? ''
      );
      
      return {
        success: true,
        data: result,
        message: `Bulk deactivate completed successfully. ${result.summary.success} roles deactivated, ${result.summary.failure} failed.`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error in bulk deactivate operation:');
      return reply.code(500).send({ error: 'Failed to complete bulk deactivate' });
    }
  });

  // Specific bulk export endpoint (for frontend compatibility)
  fastify.post('/bulk/export', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const roleIds = (body as any)?.roleIds ?? [];
      
      const result = await permissionService.bulkRoleOperation(
        (request as any).userContext?.tenantId ?? '',
        'export',
        roleIds,
        {},
        (request as any).userContext?.internalUserId ?? ''
      );
      
      return {
        success: true,
        data: result,
        message: `Bulk export completed successfully. ${result.summary.success} roles exported, ${result.summary.failure} failed.`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error in bulk export operation:');
      return reply.code(500).send({ error: 'Failed to complete bulk export' });
    }
  });
} 