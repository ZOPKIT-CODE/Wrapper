import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import CustomRoleService from '../services/custom-role-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
type ReqWithUser = FastifyRequest & { userContext?: { tenantId?: string; internalUserId?: string }; body?: Record<string, unknown>; params?: Record<string, string> };

/**
 * 🎯 **CUSTOM ROLES API ROUTES**
 * Demonstrates complete workflow for creating roles from applications/modules
 */
export default async function customRolesRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  
  /**
   * 1️⃣ **GET ROLE BUILDER OPTIONS**
   * Shows what apps/modules are available for role creation
   * Uses organization_applications to filter by tenant access
   */
  fastify.get('/builder-options', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = (request as any).userContext?.tenantId ?? '';
      
      const options = await CustomRoleService.getRoleCreationOptions(tenantId) as any[];
      
      return {
        success: true,
        message: 'Retrieved role builder options',
        data: {
          applications: options,
          totalApps: options.length,
          totalModules: options.reduce((sum: number, app: any) => sum + (app.modules?.length ?? 0), 0),
          totalPermissions: options.reduce((sum: number, app: any) => 
            sum + (app.modules as any[] || []).reduce((moduleSum: number, mod: any) => 
              moduleSum + (mod.permissions?.length || 0), 0
            ), 0
          )
        }
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting builder options:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get role builder options'
      });
    }
  });
  
  /**
   * 2️⃣ **CREATE ROLE FROM BUILDER**
   * Creates custom role using selected apps, modules, and permissions
   */
  fastify.post('/create-from-builder', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_CREATE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = (request as any).userContext?.tenantId ?? '';
      const roleName = (body as any).roleName;
      const description = (body as any).description;
      const selectedApps = (body as any).selectedApps;
      const selectedModules = (body as any).selectedModules;
      const selectedPermissions = (body as any).selectedPermissions;
      const restrictions = (body as any).restrictions ?? {};
      const metadata = (body as any).metadata ?? {};
      
      if (!roleName || !selectedApps || !selectedModules || !selectedPermissions) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields: roleName, selectedApps, selectedModules, selectedPermissions'
        });
      }
      
      const role = await CustomRoleService.createRoleFromAppsAndModules({
        tenantId,
        roleName,
        description,
        selectedApps,
        selectedModules,
        selectedPermissions,
        restrictions,
        metadata
      } as any);
      
      return reply.code(201).send({
        success: true,
        message: `Created custom role "${roleName}"`,
        data: role
      });
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error creating role:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create custom role'
      });
    }
  });
  
  /**
   * 2.5️⃣ **UPDATE ROLE FROM BUILDER**
   * Updates existing custom role using builder format data
   */
  fastify.put('/update-from-builder/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_MANAGEMENT_EDIT)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = (request as any).userContext?.tenantId ?? '';
      const roleId = (params as any).roleId ?? '';
      const roleName = (body as any).roleName;
      const description = (body as any).description;
      const selectedApps = (body as any).selectedApps;
      const selectedModules = (body as any).selectedModules;
      const selectedPermissions = (body as any).selectedPermissions;
      const restrictions = (body as any).restrictions ?? {};
      const metadata = (body as any).metadata ?? {};
      
      if (!roleName || !selectedApps || !selectedModules || !selectedPermissions) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields: roleName, selectedApps, selectedModules, selectedPermissions'
        });
      }
      
      console.log('🔄 Updating role from builder:', { 
        roleId, 
        roleName,
        restrictionsType: typeof restrictions,
        restrictionsValue: restrictions
      });
      
      const updatedRole = await CustomRoleService.updateRoleFromAppsAndModules({
        tenantId,
        roleId,
        roleName,
        description,
        selectedApps,
        selectedModules,
        selectedPermissions,
        restrictions,
        metadata,
        updatedBy: (request as any).userContext?.internalUserId ?? ''
      } as any);
      
      try {
        const { amazonMQPublisher } = await import('../../messaging/utils/amazon-mq-publisher.js');
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
          updatedBy: (request as any).userContext?.internalUserId ?? '',
          updatedAt: updatedRole.updatedAt || new Date().toISOString()
        });
        console.log('📡 Published role_updated event to Redis streams');
      } catch (publishErr: unknown) {
        const publishError = publishErr as Error;
        console.warn('⚠️ Failed to publish role_updated event:', publishError.message);
      }
      
      return {
        success: true,
        message: `Updated custom role "${roleName}"`,
        data: updatedRole
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error updating role:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to update custom role'
      });
    }
  });
  
  /**
   * 3️⃣ **ASSIGN USER-SPECIFIC PERMISSIONS**
   * Shows why user_application_permissions table is needed
   */
  fastify.post('/assign-user-permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = (request as any).userContext?.tenantId ?? '';
      const userId = (body as any).userId;
      const appCode = (body as any).appCode;
      const moduleCode = (body as any).moduleCode;
      const permissions = (body as any).permissions;
      const reason = (body as any).reason ?? 'Custom access granted';
      const expiresAt = (body as any).expiresAt ?? null;
      
      const userPerm = await CustomRoleService.assignUserSpecificPermissions({
        userId,
        tenantId,
        appCode,
        moduleCode,
        permissions,
        reason,
        expiresAt
      } as any);
      
      return {
        success: true,
        message: `Assigned ${(permissions?.length ?? 0)} specific permissions to user`,
        data: userPerm
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error assigning user permissions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to assign user permissions'
      });
    }
  });
  
  /**
   * 4️⃣ **GET USER'S COMPLETE PERMISSIONS**
   * Shows how all tables work together for permission resolution
   */
  fastify.get('/user-permissions/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = (request as any).userContext?.tenantId ?? '';
      const userId = (params as any).userId ?? '';
      
      const result = await CustomRoleService.resolveUserPermissions({
        userId,
        tenantId
      } as any);
      
      return {
        success: true,
        message: 'Retrieved user permissions',
        data: result
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting user permissions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get user permissions'
      });
    }
  });
  
  /**
   * 5️⃣ **DEMONSTRATE TABLE USAGE**
   * Educational endpoint showing why each table is needed
   */
  fastify.get('/demonstrate-usage', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      await CustomRoleService.demonstrateTableUsage();
      
      return {
        success: true,
        message: 'Check console for demonstration of table usage',
        data: {
          explanation: {
            applications_table: 'Defines what apps exist in the system',
            application_modules_table: 'Defines modules and permissions within each app',
            organization_applications_table: 'Controls which apps/modules each tenant can access',
            user_application_permissions_table: 'Individual user-level permission overrides',
            custom_roles_table: 'Role definitions created from apps/modules'
          },
          workflow: [
            '1. Applications & Modules define what exists',
            '2. Organization Apps control tenant access',
            '3. Custom Roles grant access to selected features',
            '4. User Permissions provide individual overrides',
            '5. All layers combine for final permission resolution'
          ]
        }
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error demonstrating usage:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to demonstrate usage'
      });
    }
  });
  
  /**
   * 6️⃣ **EXAMPLE ROLE CREATION PAYLOAD**
   * Shows the exact structure needed to create roles
   */
  fastify.get('/example-payload', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      success: true,
      data: {
        example_role_creation: {
          roleName: 'Senior Sales Manager',
          description: 'Sales manager with advanced permissions',
          selectedApps: ['crm', 'hr'],
          selectedModules: {
            crm: ['leads', 'contacts', 'accounts', 'opportunities'],
            hr: ['employees']
          },
          selectedPermissions: {
            'crm.leads': ['read', 'create', 'update', 'delete'],
            'crm.contacts': ['read', 'create', 'update'],
            'crm.accounts': ['read', 'create'],
            'crm.opportunities': ['read', 'create', 'update'],
            'hr.employees': ['read']
          },
          restrictions: {
            'crm.leads.bulk_delete': false // Explicitly deny bulk delete
          },
          metadata: {
            department: 'Sales',
            level: 'Senior',
            notes: 'Created for Q4 2024 sales push'
          }
        },
        example_user_override: {
          userId: 'user-123',
          appCode: 'crm',
          moduleCode: 'leads',
          permissions: ['bulk_import', 'advanced_search'],
          reason: 'Temporary access for data migration project',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      }
    };
  });
} 