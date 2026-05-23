// 🎯 **PERMISSION MATRIX API ROUTES**
// Provides API access to the permission matrix system

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { permissionMatrixService as PermissionMatrixService } from '../index.js';
import Logger from '../../../utils/logger.js';
import { 
  BUSINESS_SUITE_MATRIX, 
  PLAN_ACCESS_MATRIX, 
  PermissionMatrixUtils 
} from '../../../data/permission-matrix.js';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';

export default async function permissionMatrixRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {

  // 🔧 Helper function to check if user is a tenant admin
  const isUserTenantAdmin = (permissions: unknown, userRoles: unknown): boolean => {
    const perms = Array.isArray(permissions) ? permissions : [];
    const roles = Array.isArray(userRoles) ? userRoles : [];
    const hasAdminPermissions = perms.some((p: unknown) => {
      const s = String(p);
      return s.includes('admin') || s.includes('tenant_admin') || s.includes('super_admin');
    });
    const hasAdminRole = roles.some((role: unknown) => {
      const r = role as Record<string, unknown>;
      const name = (r?.roleName ?? r?.name) as string | undefined;
      const lower = String(name || '').toLowerCase();
      return lower.includes('admin') || lower.includes('administrator') || lower.includes('super');
    });
    return hasAdminPermissions || hasAdminRole;
  };

  // 🔍 **GET COMPLETE PERMISSION MATRIX**
  fastify.get('/matrix', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'get-permission-matrix', 'Fetching complete permission matrix');
      
      return {
        success: true,
        data: {
          applications: PermissionMatrixUtils.getAllApplications(),
          matrix: BUSINESS_SUITE_MATRIX,
          planAccess: PLAN_ACCESS_MATRIX,
          summary: {
            totalApplications: Object.keys(BUSINESS_SUITE_MATRIX).length,
            totalModules: Object.values(BUSINESS_SUITE_MATRIX).reduce((total, app) => 
              total + Object.keys(app.modules).length, 0),
            totalPermissions: Object.values(BUSINESS_SUITE_MATRIX).reduce((total, app) => 
              total + Object.values(app.modules).reduce((moduleTotal, module) => 
                moduleTotal + (module.permissions?.length || 0), 0), 0)
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-permission-matrix', 'Error fetching permission matrix', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch permission matrix',
        error: error.message
      });
    }
  });

  // 🏢 **GET USER'S PERMISSION CONTEXT**
  fastify.get('/user-context', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 🔍 CRITICAL FIX: Read target user ID from CRM header
      const headers = request.headers as Record<string, string | undefined>;
      const targetUserId = headers['x-user-id'];
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const internalUserId = userContext.internalUserId as string;
      const tenantId = userContext.tenantId as string;
      
      // If CRM is requesting permissions for a specific user, use that user ID
      // Otherwise, fall back to authenticated user (for backward compatibility)
      const userIdToCheck = targetUserId || internalUserId;
      
      Logger.log('info', 'general', 'get-user-context', 'CRM Request for user-context', { authenticatedAdmin: internalUserId, targetUserId: targetUserId || 'NOT PROVIDED', finalUserId: userIdToCheck, tenantId });
      
      // 🔒 SECURITY: Validate that admin has permission to view other users' permissions
      if (targetUserId && targetUserId !== internalUserId) {
        // Check if admin has permission to view user permissions
        const adminPermissions = await PermissionMatrixService.getUserPermissionContext(internalUserId, tenantId);
        
        // Allow access if:
        // 1. Admin has specific admin permissions, OR
        // 2. Admin is a tenant admin (can view users in their own tenant)
        const adminPermsArr = (adminPermissions.permissions as unknown) as string[] | undefined;
        const hasSpecificPermissions = Array.isArray(adminPermsArr) && adminPermsArr.some((p: string) =>
          p.includes('admin:users:read') ||
          p.includes('admin:permissions:read') ||
          p.includes('admin:users:sync') ||
          p.includes('admin') ||
          p.includes('users:read') ||
          p.includes('permissions:read') ||
          p.includes('crm.users.read') ||
          p.includes('crm.users.read_all') ||
          p.includes('system.users.read') ||
          p.includes('system.users.read_all')
        );
        
        // Check if admin is a tenant admin (service returns .roles with .name)
        const isTenantAdmin = isUserTenantAdmin(adminPermissions.permissions, adminPermissions.roles);
        
        // Additional check: verify target user belongs to the same tenant
        let targetUserInSameTenant = false;
        try {
          const { tenantUsers } = await import('../../../db/schema/index.js');
          const [targetUser] = await db
            .select({ tenantId: tenantUsers.tenantId })
            .from(tenantUsers)
            .where(eq(tenantUsers.kindeUserId, targetUserId))
            .limit(1);
          
          targetUserInSameTenant = targetUser && targetUser.tenantId === tenantId;
          
          Logger.log('info', 'general', 'get-user-context', 'Target user tenant check', { targetUserId, targetUserTenantId: targetUser?.tenantId, adminTenantId: tenantId, sameTenant: targetUserInSameTenant });
        } catch (err: unknown) {
          const errObj = err as Error;
          Logger.log('warning', 'general', 'get-user-context', 'Could not verify target user tenant', { error: errObj.message });
          // Continue with permission check
        }
        
        const canViewUserPermissions = hasSpecificPermissions || (isTenantAdmin && targetUserInSameTenant);
        
        if (!canViewUserPermissions) {
          Logger.log('warning', 'general', 'get-user-context', 'Admin lacks permission to view user permissions', { adminId: internalUserId, targetUserId, isTenantAdmin, targetUserInSameTenant });
          
          return reply.code(403).send({
            success: false,
            error: 'Insufficient permissions',
            message: 'Admin lacks permission to view other users\' permissions',
            details: {
              adminPermissions: adminPermissions.permissions,
              adminRoles: (adminPermissions.roles as Array<{ roleName?: string; name?: string }>)?.map(r => r.roleName ?? r.name),
              isTenantAdmin,
              targetUserInSameTenant
            }
          });
        }
        
        Logger.log('info', 'general', 'get-user-context', 'Admin authorized to view user permissions', { adminId: internalUserId, targetUserId, hasSpecificPermissions, isTenantAdmin, targetUserInSameTenant });
      }
      
      // Get permissions for the target user (not the admin)
      const context = await PermissionMatrixService.getUserPermissionContext(userIdToCheck, tenantId);
      
      // 🔧 CRITICAL FIX: Ensure permissions are in the format the frontend expects
      // context.permissions is an object (resource -> config); flatten to array of strings
      const rawPermissions = context.permissions || {};
      const flattenedPermissions = typeof rawPermissions === 'object' && !Array.isArray(rawPermissions)
        ? PermissionMatrixService.flattenNestedPermissions(rawPermissions as Record<string, { operations?: string[] }>)
        : Array.isArray(rawPermissions) ? rawPermissions : [];
      
      const contextRoles = context.roles as Array<{ roleName?: string; name?: string }> | undefined;
      Logger.log('info', 'general', 'get-user-context', 'Permission flattening result', {
        originalPermissionsCount: typeof rawPermissions === 'object' && !Array.isArray(rawPermissions) ? Object.keys(rawPermissions).length : (Array.isArray(rawPermissions) ? rawPermissions.length : 0),
        flattenedPermissionsCount: flattenedPermissions.length,
        userRoles: contextRoles?.map(r => r.roleName ?? r.name) || []
      });
      
      return {
        success: true,
        data: {
          ...context,
          // Ensure permissions are in the expected flat format
          permissions: flattenedPermissions,
          // Add metadata about whose permissions were returned
          permissionContext: {
            requestedFor: userIdToCheck,
            requestedBy: internalUserId,
            isAdminRequest: !!targetUserId && targetUserId !== internalUserId,
            source: 'permission-matrix-api',
            permissionFormat: 'flat-array',
            totalPermissions: flattenedPermissions.length
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-user-context', 'Error fetching user permission context', { error: error.message });
      
      // Provide specific error messages for common UUID mapping issues
      let errorMessage = 'Failed to fetch user permission context';
      let errorDetails: Record<string, unknown> = {};
      
      if (error.message.includes('User not found')) {
        errorMessage = 'Target user not found in tenant';
        errorDetails = {
          targetUserId: (request.headers as unknown as Record<string, string | undefined>)['x-user-id'] || 'Not provided',
          tenantId: (request.userContext as unknown as Record<string, unknown>)?.tenantId,
          error: 'User does not exist or is not active in this organization'
        };
      } else if (error.message.includes('invalid input syntax for type uuid')) {
        errorMessage = 'Invalid user ID format';
        errorDetails = {
          targetUserId: (request.headers as unknown as Record<string, string | undefined>)['x-user-id'] || 'Not provided',
          error: 'User ID format is invalid or corrupted'
        };
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        errorMessage = 'Database schema issue';
        errorDetails = {
          error: 'Required database tables are missing',
          suggestion: 'Run database migrations to create missing tables'
        };
      }
      
      return reply.code(500).send({
        success: false,
        message: errorMessage,
        error: error.message,
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 🏢 **CRM PERMISSION SYNC ENDPOINT**
  fastify.post('/crm-sync', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const targetUserId = body.targetUserId as string | undefined;
      const orgCode = body.orgCode as string | undefined;
      const forceRefresh = (body.forceRefresh as boolean) ?? false;
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const internalUserId = userContext.internalUserId as string;
      const tenantId = userContext.tenantId as string;
      
      Logger.log('info', 'general', 'crm-sync', 'CRM Permission Sync Request', { admin: internalUserId, targetUserId, orgCode, forceRefresh });
      
      // 🔒 SECURITY: Validate admin permissions
      const adminPermissions = await PermissionMatrixService.getUserPermissionContext(internalUserId, tenantId);
      
      // Allow access if:
      // 1. Admin has specific admin permissions, OR
      // 2. Admin is a tenant admin (can sync users in their own tenant)
      const adminPermsArrSync = (adminPermissions.permissions as unknown) as string[] | undefined;
      const hasSpecificPermissions = Array.isArray(adminPermsArrSync) && adminPermsArrSync.some((p: string) =>
        p.includes('admin:users:sync') ||
        p.includes('admin:permissions:read') ||
        p.includes('admin:users:read') ||
        p.includes('admin') ||
        p.includes('users:sync') ||
        p.includes('permissions:read') ||
        p.includes('crm.users.read') ||
        p.includes('crm.users.read_all') ||
        p.includes('crm.users.sync') ||
        p.includes('system.users.read') ||
        p.includes('system.users.read_all') ||
        p.includes('system.users.sync')
      );
      
      // Check if admin is a tenant admin
      const isTenantAdmin = isUserTenantAdmin(adminPermissions.permissions, adminPermissions.roles);
      
      const canSyncUserPermissions = hasSpecificPermissions || isTenantAdmin;
      
      if (!canSyncUserPermissions) {
        Logger.log('warning', 'general', 'crm-sync', 'Admin lacks permission to sync user permissions', { adminId: internalUserId, isTenantAdmin });
        
        return reply.code(403).send({
          success: false,
          error: 'Insufficient permissions',
          message: 'Admin lacks permission to sync user permissions',
          details: {
            adminPermissions: adminPermissions.permissions,
            adminRoles: (adminPermissions.roles as Array<{ roleName?: string; name?: string }>)?.map(r => r.roleName ?? r.name),
            isTenantAdmin
          }
        });
      }
      
      if (!targetUserId) {
        return reply.code(400).send({ success: false, error: 'targetUserId is required' });
      }
      
      // Verify target user exists in the same tenant
      const { tenantUsers } = await import('../../../db/schema/index.js');
      const [targetUser] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, targetUserId))
        .limit(1);
      
      if (!targetUser || targetUser.tenantId !== tenantId) {
        Logger.log('warning', 'general', 'crm-sync', 'Target user not found or not in tenant', { targetUserId, tenantId });
        return reply.code(404).send({
          success: false,
          error: 'User not found',
          message: 'Target user not found in this organization'
        });
      }
      
      // Get permissions for the target user
      const targetUserContext = await PermissionMatrixService.getUserPermissionContext(targetUserId, tenantId);
      
      Logger.log('info', 'general', 'crm-sync', 'CRM Permission Sync successful', { targetUserId, hasSpecificPermissions, isTenantAdmin });
      
      return {
        success: true,
        data: {
          ...targetUserContext,
          syncMetadata: {
            syncedAt: new Date().toISOString(),
            syncedBy: internalUserId,
            targetUser: {
              id: targetUser.userId,
              email: targetUser.email,
              name: [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || targetUser.email || '',
              isActive: targetUser.isActive
            },
            organization: {
              id: tenantId,
              orgCode: orgCode
            }
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'crm-sync', 'Error in CRM permission sync', { error: error.message });
      
      let errorMessage = 'Failed to sync user permissions';
      const errorDetails: Record<string, unknown> = {};
      const body = request.body as Record<string, unknown>;
      const uc = request.userContext as unknown as Record<string, unknown>;
      
      if (error.message.includes('User not found')) {
        errorMessage = 'Target user not found in tenant';
        Object.assign(errorDetails, {
          targetUserId: body.targetUserId ?? 'Not provided',
          tenantId: uc.tenantId,
          error: 'User does not exist or is not active in this organization'
        });
      } else if (error.message.includes('invalid input syntax for type uuid')) {
        errorMessage = 'Invalid user ID format';
        Object.assign(errorDetails, { targetUserId: body.targetUserId ?? 'Not provided', error: 'User ID format is invalid or corrupted' });
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        errorMessage = 'Database schema issue';
        Object.assign(errorDetails, { error: 'Required database tables are missing', suggestion: 'Run database migrations to create missing tables' });
      }
      
      return reply.code(500).send({
        success: false,
        message: errorMessage,
        error: error.message,
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 🎯 **CHECK SPECIFIC PERMISSION**
  fastify.post('/check-permission', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const permission = body.permission as string | undefined;
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const internalUserId = userContext.internalUserId as string;
      const tenantId = userContext.tenantId as string;
      const headers = request.headers as Record<string, string | undefined>;
      
      // 🔍 CRITICAL FIX: Support both body userId and X-User-Id header
      const targetUserId = headers['x-user-id'] || (body.userId as string) || internalUserId;
      
      Logger.log('info', 'general', 'check-permission', 'Checking permission', { permission, authenticatedAdmin: internalUserId, targetUserId });
      
      // 🔒 SECURITY: Validate admin permissions if checking other users
      if (targetUserId !== internalUserId) {
        const adminPermissions = await PermissionMatrixService.getUserPermissionContext(internalUserId, tenantId);
        const adminPermsCheck = (adminPermissions.permissions as unknown) as string[] | undefined;
        const canCheckUserPermissions = Array.isArray(adminPermsCheck) && adminPermsCheck.some((p: string) =>
          p.includes('admin:users:read') || p.includes('admin:permissions:read') || p.includes('admin:users:sync')
        );
        
        if (!canCheckUserPermissions) {
          Logger.log('warning', 'general', 'check-permission', 'Admin lacks permission to check user permissions', { adminId: internalUserId, targetUserId });
          return reply.code(403).send({
            success: false,
            error: 'Insufficient permissions',
            message: 'Admin lacks permission to check other users\' permissions'
          });
        }
      }
      
      const permToCheck = permission ?? '';
      const hasPermission = await PermissionMatrixService.hasPermission(targetUserId, tenantId, permToCheck);
      
      return {
        success: true,
        data: {
          permission: permToCheck,
          hasPermission,
          userId: targetUserId,
          checkedBy: internalUserId,
          isAdminRequest: targetUserId !== internalUserId
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'check-permission', 'Error checking permission', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to check permission',
        error: error.message
      });
    }
  });

  // 🎯 **CHECK MULTIPLE PERMISSIONS**
  fastify.post('/check-permissions', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const permissions = body.permissions as string[] | undefined;
      const userId = body.userId as string | undefined;
      const checkType = (body.checkType as string) ?? 'any';
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const internalUserId = userContext.internalUserId as string;
      const tenantId = userContext.tenantId as string;
      
      const targetUserId = userId || internalUserId;
      const permsList = Array.isArray(permissions) ? permissions : [];
      
      Logger.log('info', 'general', 'check-permissions', 'Checking permissions', { checkType, permissions: permsList, targetUserId });
      
      const hasPermission = checkType === 'all'
        ? await PermissionMatrixService.hasAllPermissions(targetUserId, tenantId, permsList)
        : await PermissionMatrixService.hasAnyPermission(targetUserId, tenantId, permsList);
      
      return {
        success: true,
        data: {
          permissions: permsList,
          checkType,
          hasPermission,
          userId: targetUserId
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'check-permissions', 'Error checking multiple permissions', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to check permissions',
        error: error.message
      });
    }
  });

  // 📱 **GET USER'S ACCESSIBLE APPLICATIONS**
  fastify.get('/user-applications', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const internalUserId = userContext.internalUserId as string;
      const tenantId = userContext.tenantId as string;
      
      Logger.log('info', 'general', 'user-applications', 'Getting accessible applications for user', { userId: internalUserId });
      
      const applications = await PermissionMatrixService.getUserAccessibleApplications(internalUserId, tenantId);
      
      return {
        success: true,
        data: {
          applications,
          count: applications.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'user-applications', 'Error fetching user applications', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch user applications',
        error: error.message
      });
    }
  });

  // 👥 **GET AVAILABLE ROLE TEMPLATES**
  fastify.get('/role-templates', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'role-templates', 'Fetching role templates');
      
      const templates = PermissionMatrixService.getAvailableRoleTemplates();
      
      return {
        success: true,
        data: {
          templates,
          count: templates.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'role-templates', 'Error fetching role templates', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch role templates',
        error: error.message
      });
    }
  });

  // 🎯 **ASSIGN ROLE TEMPLATE TO USER**
  fastify.post('/assign-template', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const userId = body.userId as string;
      const templateId = body.templateId as string;
      const customizations = (body.customizations as Record<string, unknown>) ?? {};
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const tenantId = userContext.tenantId as string;
      
      Logger.log('info', 'general', 'assign-template', 'Assigning role template to user', { templateId, userId });
      
      const result = await PermissionMatrixService.assignRoleTemplate(userId, tenantId, templateId, customizations);
      
      return {
        success: true,
        data: result,
        message: `Role template ${templateId} assigned successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'assign-template', 'Error assigning role template', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to assign role template',
        error: error.message
      });
    }
  });

  // 📊 **GET PERMISSION ANALYTICS**
  fastify.get('/analytics', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const tenantId = userContext.tenantId as string;
      
      Logger.log('info', 'general', 'permission-analytics', 'Getting permission analytics', { tenantId });
      
      const analytics = await PermissionMatrixService.getPermissionAnalytics(tenantId);
      
      return {
        success: true,
        data: analytics
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'permission-analytics', 'Error fetching permission analytics', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch permission analytics',
        error: error.message
      });
    }
  });



  // 🔍 **VALIDATE PERMISSION MATRIX** (Admin only)
  fastify.get('/validate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_SYSTEM_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'validate-matrix', 'Validating permission matrix');
      
      const errors = PermissionMatrixUtils.validateMatrix();
      
      return {
        success: true,
        data: {
          valid: errors.length === 0,
          errors,
          summary: {
            totalApplications: Object.keys(BUSINESS_SUITE_MATRIX).length,
            totalModules: Object.values(BUSINESS_SUITE_MATRIX).reduce((total, app) => 
              total + Object.keys(app.modules).length, 0),
            totalPermissions: Object.values(BUSINESS_SUITE_MATRIX).reduce((total, app) => 
              total + Object.values(app.modules).reduce((moduleTotal, module) => 
                moduleTotal + (module.permissions?.length || 0), 0), 0)
          }
        },
        message: errors.length === 0 ? 'Permission matrix is valid' : `Found ${errors.length} validation errors`
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'validate-matrix', 'Error validating permission matrix', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to validate permission matrix',
        error: error.message
      });
    }
  });

  // 📋 **GET PLAN ACCESS INFORMATION**
  fastify.get('/plan-access/:planId', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const planId = params.planId;
      
      Logger.log('info', 'general', 'plan-access', 'Getting plan access', { planId });
      
      const planAccess = (PLAN_ACCESS_MATRIX as Record<string, unknown>)[planId];
      if (!planAccess) {
        return reply.code(404).send({
          success: false,
          message: `Plan ${planId} not found`
        });
      }
      
      const permissions = PermissionMatrixUtils.getPlanPermissions(planId);
      
      return {
        success: true,
        data: {
          planId,
          ...planAccess,
          permissionCount: permissions.length,
          detailedPermissions: permissions
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'plan-access', 'Error fetching plan access', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch plan access',
        error: error.message
      });
    }
  });

  // 🧹 **REVOKE ALL USER PERMISSIONS** (Admin only)
  fastify.post('/revoke-user-permissions', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.PERMISSIONS_ASSIGNMENT_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const userId = body.userId as string;
      const userContext = request.userContext as unknown as Record<string, unknown>;
      const tenantId = userContext.tenantId as string;
      
      Logger.log('info', 'general', 'revoke-user-permissions', 'Revoking all permissions for user', { userId });
      
      await PermissionMatrixService.revokeAllUserPermissions(userId, tenantId);
      
      return {
        success: true,
        message: `All permissions revoked for user ${userId}`
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'revoke-user-permissions', 'Error revoking user permissions', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to revoke user permissions',
        error: error.message
      });
    }
  });
} 