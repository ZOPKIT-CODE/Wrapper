import { db } from '../../../db/index.js';
import { customRoles, userRoleAssignments } from '../../../db/schema/core/permissions.js';
import { tenantUsers, auditLogs } from '../../../db/schema/core/users.js';
import { eq, and, count, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../../../utils/logger.js';
const SYSTEM_ACTOR_UUID = '00000000-0000-0000-0000-000000000000';

class PermissionMatrixService {
  // Get user permission context
  async getUserPermissionContext(userId: string, tenantId: string) {
    try {
      Logger.log('info', 'general', 'getUserPermissionContext', 'Getting user permission context', { userId, tenantId });

      // Get user roles
      const userRoles = await db
        .select({
          roleId: userRoleAssignments.roleId,
          isActive: userRoleAssignments.isActive,
          permissions: customRoles.permissions,
          restrictions: customRoles.restrictions,
          roleName: customRoles.roleName
        })
        .from(userRoleAssignments)
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(
          and(
            eq(userRoleAssignments.userId, userId),
            eq(customRoles.tenantId, tenantId),
            eq(userRoleAssignments.isActive, true)
          )
        );

      Logger.log('info', 'general', 'getUserPermissionContext', 'Found active roles for user', { count: userRoles.length });

      // Aggregate permissions from all roles
      const aggregatedPermissions: Record<string, unknown> = {};
      const allRestrictions: unknown[] = [];

      userRoles.forEach(role => {
        try {
          // postgres-js returns JSONB columns as already-parsed JS values (objects/arrays).
          // Guard against the legacy String() + JSON.parse() path that breaks on objects.
          const rawPerms = role.permissions ?? {};
          const rolePermissions = (
            typeof rawPerms === 'string'
              ? JSON.parse(rawPerms)
              : rawPerms
          ) as Record<string, unknown>;

          const rawRestr = role.restrictions ?? null;
          const roleRestrictions = (
            typeof rawRestr === 'string'
              ? JSON.parse(rawRestr)
              : rawRestr
          ) as unknown;

          // Merge permissions (higher priority roles override lower ones)
          Object.keys(rolePermissions).forEach(resource => {
            if (resource !== 'metadata') {
              aggregatedPermissions[resource] = rolePermissions[resource];
            }
          });

          if (roleRestrictions) {
            allRestrictions.push(roleRestrictions);
          }
        } catch (parseError: unknown) {
          const err = parseError as Error;
          Logger.log('error', 'general', 'getUserPermissionContext', 'Error parsing permissions for role', { roleId: role.roleId, error: err.message });
        }
      });

      // Combine restrictions (most restrictive wins)
      const combinedRestrictions = this.combineRestrictions(allRestrictions);

      const context = {
        userId,
        tenantId,
        roles: userRoles.map(r => ({ id: r.roleId, name: r.roleName })),
        permissions: aggregatedPermissions,
        restrictions: combinedRestrictions,
        hasRoles: userRoles.length > 0,
        roleCount: userRoles.length
      };

      Logger.log('info', 'general', 'getUserPermissionContext', 'Permission context built', { userId, tenantId, roleCount: context.roleCount, permissionCount: Object.keys(aggregatedPermissions).length });

      return context;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getUserPermissionContext', 'Error in getUserPermissionContext', { error: error.message });
      throw error;
    }
  }

  // Flatten nested permissions
  flattenNestedPermissions(permissions: Record<string, { operations?: string[] }>): string[] {
    const flat: string[] = [];

    Object.entries(permissions).forEach(([resource, config]) => {
      if (resource === 'metadata') return;

      if (config && config.operations && Array.isArray(config.operations)) {
        config.operations.forEach(operation => {
          flat.push(`${resource}.${operation}`);
        });
      }
    });

    return flat;
  }

  // Check if user has a specific permission
  async hasPermission(userId: string, tenantId: string, permission: string) {
    try {
      const context = await this.getUserPermissionContext(userId, tenantId);
      const flatPermissions = this.flattenNestedPermissions(context.permissions as Record<string, { operations?: string[] }>);

      const hasPermission = flatPermissions.includes(permission);

      Logger.log('info', 'general', 'hasPermission', 'Permission check', { userId, tenantId, permission, hasPermission, totalPermissions: flatPermissions.length });

      return hasPermission;
    } catch (err: unknown) {
      Logger.log('error', 'general', 'hasPermission', 'Error checking permission', { error: (err as Error).message });
      return false;
    }
  }

  // Check if user has all permissions
  async hasAllPermissions(userId: string, tenantId: string, permissions: string[]) {
    try {
      const context = await this.getUserPermissionContext(userId, tenantId);
      const flatPermissions = this.flattenNestedPermissions(context.permissions as Record<string, { operations?: string[] }>);

      const hasAll = permissions.every(permission => flatPermissions.includes(permission));

      Logger.log('info', 'general', 'hasAllPermissions', 'Has all permissions check', { userId, tenantId, required: permissions, hasAll, userPermissions: flatPermissions.length });

      return hasAll;
    } catch (err: unknown) {
      Logger.log('error', 'general', 'hasAllPermissions', 'Error checking all permissions', { error: (err as Error).message });
      return false;
    }
  }

  // Check if user has any of the permissions
  async hasAnyPermission(userId: string, tenantId: string, permissions: string[]) {
    try {
      const context = await this.getUserPermissionContext(userId, tenantId);
      const flatPermissions = this.flattenNestedPermissions(context.permissions as Record<string, { operations?: string[] }>);

      const hasAny = permissions.some(permission => flatPermissions.includes(permission));

      Logger.log('info', 'general', 'hasAnyPermission', 'Has any permission check', { userId, tenantId, required: permissions, hasAny, userPermissions: flatPermissions.length });

      return hasAny;
    } catch (err: unknown) {
      Logger.log('error', 'general', 'hasAnyPermission', 'Error checking any permission', { error: (err as Error).message });
      return false;
    }
  }

  // Get applications user can access
  async getUserAccessibleApplications(userId: string, tenantId: string) {
    try {
      const context = await this.getUserPermissionContext(userId, tenantId);
      const applications = new Set<string>();

      // Extract applications from permissions
      Object.keys(context.permissions).forEach(resource => {
        if (resource.includes('.')) {
          const app = resource.split('.')[0];
          applications.add(app);
        }
      });

      const result = Array.from(applications);

      Logger.log('info', 'general', 'getUserAccessibleApplications', 'User accessible applications', { userId, tenantId, applications: result });

      return result;
    } catch (err: unknown) {
      Logger.log('error', 'general', 'getUserAccessibleApplications', 'Error getting accessible applications', { error: (err as Error).message });
      return [];
    }
  }

  // Get available role templates
  getAvailableRoleTemplates() {
    // Static templates for now - can be moved to database later
    const templates = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full access to all system features',
        category: 'system',
        permissions: {
          'crm.*': { level: 'admin', operations: ['*'], scope: 'all' },
          'admin.*': { level: 'admin', operations: ['*'], scope: 'all' }
        },
        color: '#ef4444',
        isActive: true,
        sortOrder: 1
      },
      {
        id: 'manager',
        name: 'Manager',
        description: 'Management access with reporting capabilities',
        category: 'management',
        permissions: {
          'crm.leads': { level: 'write', operations: ['read', 'create', 'update'], scope: 'team' },
          'crm.accounts': { level: 'write', operations: ['read', 'create', 'update'], scope: 'team' },
          'crm.reports': { level: 'read', operations: ['read', 'export'], scope: 'team' }
        },
        color: '#f59e0b',
        isActive: true,
        sortOrder: 2
      },
      {
        id: 'user',
        name: 'Standard User',
        description: 'Basic access for regular operations',
        category: 'user',
        permissions: {
          'crm.leads': { level: 'write', operations: ['read', 'create', 'update'], scope: 'own' },
          'crm.accounts': { level: 'read', operations: ['read'], scope: 'own' }
        },
        color: '#10b981',
        isActive: true,
        sortOrder: 3
      },
      {
        id: 'viewer',
        name: 'Read-Only User',
        description: 'View-only access to data',
        category: 'user',
        permissions: {
          'crm.*': { level: 'read', operations: ['read'], scope: 'own' }
        },
        color: '#6b7280',
        isActive: true,
        sortOrder: 4
      }
    ];

    Logger.log('info', 'general', 'getAvailableRoleTemplates', 'Available role templates', { count: templates.length });
    return templates;
  }

  // Assign role template to user
  async assignRoleTemplate(userId: string, tenantId: string, templateId: string, customizations: Record<string, unknown> = {}) {
    try {
      Logger.log('info', 'general', 'assignRoleTemplate', 'Assigning role template', { userId, tenantId, templateId });

      const templates = this.getAvailableRoleTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        throw new Error(`Template '${templateId}' not found`);
      }

      // Apply customizations
      let permissions: Record<string, unknown> = { ...template.permissions };
      if (customizations.addPermissions && typeof customizations.addPermissions === 'object') {
        permissions = { ...permissions, ...(customizations.addPermissions as Record<string, unknown>) };
      }

      if (Array.isArray(customizations.removePermissions)) {
        (customizations.removePermissions as string[]).forEach(perm => {
          delete permissions[perm];
        });
      }

      // Create role from template
      const roleId = uuidv4();
      const roleName = (customizations.name as string) || `${template.name} (${userId.slice(-8)})`;

      await db.insert(customRoles).values({
        roleId,
        tenantId,
        roleName,
        description: template.description,
        color: template.color,
        permissions: JSON.stringify(permissions),
        restrictions: JSON.stringify({}),
        isSystemRole: false,
        isDefault: false,
        priority: 0,
        createdBy: 'system',
        createdAt: new Date()
      } as any);

      // Assign role to user (schema uses id, not assignmentId)
      await db.insert(userRoleAssignments).values({
        id: uuidv4(),
        userId,
        roleId,
        isActive: true,
        isTemporary: false,
        assignedBy: 'system',
        assignedAt: new Date()
      } as any);

      Logger.log('info', 'general', 'assignRoleTemplate', 'Role template assigned successfully');
      return { roleId, templateId, userId };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'assignRoleTemplate', 'Error assigning role template', { error: error.message });
      throw error;
    }
  }

  // Get permission analytics
  async getPermissionAnalytics(tenantId: string) {
    try {
      Logger.log('info', 'general', 'getPermissionAnalytics', 'Getting permission analytics', { tenantId });

      // Get role counts
      const roleStats = await db
        .select({
          isSystemRole: customRoles.isSystemRole,
          userCount: count(userRoleAssignments.id)
        })
        .from(customRoles)
        .leftJoin(userRoleAssignments, eq(customRoles.roleId, userRoleAssignments.roleId))
        .where(eq(customRoles.tenantId, tenantId))
        .groupBy(customRoles.isSystemRole);

      // Get user counts
      const userStats = await db
        .select({
          totalUsers: count(tenantUsers.userId),
          activeUsers: sql<number>`count(case when ${tenantUsers.isActive} = true then 1 end)`
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));

      const analytics = {
        tenantId,
        roles: {
          system: roleStats.find(r => r.isSystemRole)?.userCount || 0,
          custom: roleStats.find(r => !r.isSystemRole)?.userCount || 0,
          total: (roleStats.find(r => r.isSystemRole)?.userCount || 0) + (roleStats.find(r => !r.isSystemRole)?.userCount || 0)
        },
        users: userStats[0] || { totalUsers: 0, activeUsers: 0 },
        generatedAt: new Date().toISOString()
      };

      Logger.log('info', 'general', 'getPermissionAnalytics', 'Permission analytics computed', { analytics });
      return analytics;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getPermissionAnalytics', 'Error getting permission analytics', { error: error.message });
      throw error;
    }
  }

  // Revoke all user permissions
  async revokeAllUserPermissions(userId: string, tenantId: string) {
    try {
      Logger.log('info', 'general', 'revokeAllUserPermissions', 'Revoking all permissions for user', { userId, tenantId });

      // Get all active role assignments for user
      const assignments = await db
        .select({ assignmentId: userRoleAssignments.id })
        .from(userRoleAssignments)
        .where(
          and(
            eq(userRoleAssignments.userId, userId),
            eq(userRoleAssignments.isActive, true)
          )
        );

      // Deactivate all assignments (userRoleAssignments has no updatedAt column)
      if (assignments.length > 0) {
        await db
          .update(userRoleAssignments)
          .set({
            isActive: false
          })
          .where(eq(userRoleAssignments.userId, userId));
      }

      // Log audit event
      await db.insert(auditLogs).values({
        logId: uuidv4(),
        tenantId,
        userId: SYSTEM_ACTOR_UUID,
        action: 'permissions_revoked',
        resourceType: 'user',
        resourceId: userId,
        details: JSON.stringify({ assignmentsRevoked: assignments.length }),
        createdAt: new Date()
      });

      Logger.log('info', 'general', 'revokeAllUserPermissions', 'All permissions revoked for user', { userId, assignmentsRevoked: assignments.length });
      return { userId, assignmentsRevoked: assignments.length };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'revokeAllUserPermissions', 'Error revoking user permissions', { error: error.message });
      throw error;
    }
  }

  // Helper method to combine restrictions
  combineRestrictions(restrictionsArray: unknown[]) {
    if (!restrictionsArray || restrictionsArray.length === 0) {
      return {};
    }

    // For now, return the most restrictive set
    // In a real implementation, you'd merge restrictions intelligently
    return restrictionsArray[0];
  }
}

export default new PermissionMatrixService();
