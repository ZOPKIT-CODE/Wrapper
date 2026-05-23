import { db } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { userRoleAssignments, customRoles } from '../../db/schema/index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserPermissions } from '../../types/common.js';
import Logger from '../../utils/logger.js';

export function requirePermissions(requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    request.log.debug({
      requiredPermissions,
      userId: request.userContext?.internalUserId,
      tenantId: request.userContext?.tenantId,
      isAuthenticated: request.userContext?.isAuthenticated,
      isAdmin: request.userContext?.isAdmin,
      isTenantAdmin: request.userContext?.isTenantAdmin
    }, 'Permission check initiated');

    if (!request.userContext?.isAuthenticated) {
      request.log.debug('User not authenticated');
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    if (request.userContext.isAdmin || request.userContext.isTenantAdmin) {
      request.log.debug('Admin user detected, granting access');
      return;
    }

    try {
      request.log.debug('Fetching user permissions...');
      const userPermissions = await getUserPermissions(
        request.userContext.internalUserId!,
        request.userContext.tenantId!
      );

      request.log.debug({
        moduleCount: typeof userPermissions.modules === 'string' ? 'all' : Object.keys(userPermissions.modules).length,
        roleCount: userPermissions.roles.length,
        modules: typeof userPermissions.modules === 'string' ? '*' : Object.keys(userPermissions.modules),
        roles: userPermissions.roles.map(r => r.roleName)
      }, 'User permissions fetched');

      const hasPermission = checkPermissions(userPermissions, requiredPermissions);
      
      request.log.debug({
        hasPermission,
        required: requiredPermissions,
        userModules: typeof userPermissions.modules === 'string' ? '*' : Object.keys(userPermissions.modules)
      }, 'Permission check result');

      if (!hasPermission) {
        request.log.debug({
          required: requiredPermissions,
          userPermissions: userPermissions.modules
        }, 'Permission denied');
        reply.code(403).send({ 
          error: 'Insufficient permissions',
          required: requiredPermissions
        });
        return;
      }

      request.log.debug('Permission granted');
      request.userContext.permissions = userPermissions;
    } catch (error) {
      request.log.error({ err: error }, 'Permission check failed');
      reply.code(500).send({ error: 'Permission check failed' });
    }
  };
}

export async function getUserPermissions(userId: string, tenantId: string): Promise<UserPermissions> {
  try {
    const userRoles = await db
      .select({
        role: customRoles,
      })
      .from(userRoleAssignments)
      .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
      .where(and(
        eq(userRoleAssignments.userId, userId),
        eq(customRoles.tenantId, tenantId)
      ));

    const aggregatedPermissions: Record<string, Record<string, string[]>> = {};
    
    for (const { role } of userRoles) {
      if (role.permissions === '*' || (role.isSystemRole === true) || (role.priority ?? 0) >= 1000) {
        return {
          modules: '*',
          roles: userRoles.map(({ role }) => ({
            roleId: role.roleId,
            roleName: role.roleName,
            priority: role.priority || 100,
            isSuperAdmin: true
          })),
          isSuperAdmin: true
        };
      }
      
      let rolePermissions: Record<string, unknown>;
      try {
        rolePermissions = typeof role.permissions === 'string' 
          ? JSON.parse(role.permissions as string) 
          : (role.permissions || {}) as Record<string, unknown>;
      } catch (_parseError) {
        Logger.log('error', 'auth', 'get-user-permissions', `❌ [PermissionMiddleware] Failed to parse permissions for role ${role.roleName}`, { error: _parseError });
        rolePermissions = {};
      }

      Object.keys(rolePermissions).forEach(module => {
        if (module === 'metadata' || module === 'inheritance' || module === 'restrictions') {
          return;
        }

        if (!aggregatedPermissions[module]) {
          aggregatedPermissions[module] = {};
        }
        
        const modulePermissions = rolePermissions[module];
        
        if (Array.isArray(modulePermissions)) {
          modulePermissions.forEach((permission: unknown) => {
            if (typeof permission === 'string') {
              if (!aggregatedPermissions[module][permission]) {
                aggregatedPermissions[module][permission] = [];
              }
              
              const basicActions = ['view', 'read'];
              basicActions.forEach(action => {
                if (!aggregatedPermissions[module][permission as string].includes(action)) {
                  aggregatedPermissions[module][permission as string].push(action);
                }
              });
            }
          });
        } else if (typeof modulePermissions === 'object' && modulePermissions !== null) {
          const modPerms = modulePermissions as Record<string, string[]>;
          Object.keys(modPerms).forEach(section => {
            if (!aggregatedPermissions[module][section]) {
              aggregatedPermissions[module][section] = [];
            }
            
            const existingPerms = aggregatedPermissions[module][section];
            const newPerms = modPerms[section] || [];
            aggregatedPermissions[module][section] = [
              ...new Set([...existingPerms, ...newPerms])
            ];
          });
        }
      });
    }

    const result: UserPermissions = {
      modules: aggregatedPermissions,
      roles: userRoles.map(({ role }) => ({
        roleId: role.roleId,
        roleName: role.roleName,
        priority: role.priority || 100
      }))
    };

    return result;
  } catch (error) {
    Logger.log('error', 'auth', 'get-user-permissions', '❌ [PermissionMiddleware] Error fetching user permissions', { error: (error as Error).message, stack: (error as Error).stack });
    return { modules: {}, roles: [] };
  }
}

export function checkPermissions(userPermissions: UserPermissions, requiredPermissions: string[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (userPermissions.isSuperAdmin || userPermissions.modules === '*') {
    return true;
  }

  const modules = userPermissions.modules as Record<string, Record<string, string[]>>;
  return requiredPermissions.some(permission => {
    const [module, section, action] = permission.split('.');
    return modules[module]?.[section]?.includes(action) || false;
  });
}

export function canAccessModule(userPermissions: UserPermissions, module: string): boolean {
  if (userPermissions.modules === '*') return true;
  const modules = userPermissions.modules as Record<string, Record<string, string[]>>;
  return Object.keys(modules[module] || {}).length > 0;
}

export function getAvailablePermissions(): Record<string, Record<string, string[]>> {
  return {
    crm: {
      leads: ['create', 'read', 'read_all', 'update', 'delete', 'export', 'import'],
      accounts: ['create', 'read', 'read_all', 'update', 'delete', 'view_contacts', 'export', 'import'],
      contacts: ['create', 'read', 'read_all', 'update', 'delete', 'export', 'import'],
      opportunities: ['create', 'read', 'read_all', 'update', 'delete', 'export', 'import'],
      quotations: ['create', 'read', 'read_all', 'update', 'delete', 'generate_pdf', 'export', 'import'],
      tickets: ['create', 'read', 'read_all', 'update', 'delete'],
      communications: ['create', 'read', 'read_all', 'update', 'delete'],
      invoices: ['create', 'read', 'read_all', 'update', 'delete'],
      sales_orders: ['create', 'read', 'read_all', 'update', 'delete'],
      documents: ['upload', 'read', 'read_all', 'download', 'delete'],
      bulk_operations: ['import', 'export', 'template'],
      pdf: ['generate', 'download'],
      dashboard: ['view', 'stats'],
      users: ['create', 'read', 'read_all', 'update', 'delete', 'change_status', 'change_role', 'change_password', 'bulk_upload'],
      roles: ['create', 'read', 'update', 'delete'],
      audit: ['view_own', 'view_all', 'export', 'stats', 'search'],
      special: ['admin_access', 'super_admin', 'view_all_data', 'export_all', 'import_all']
    }
  };
}
