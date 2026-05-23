import { db } from '../../../db/index.js';
import { customRoles, userRoleAssignments } from '../../../db/schema/core/permissions.js';
import { auditLogs } from '../../../db/schema/core/users.js';
import { organizationMemberships } from '../../../db/schema/organizations/organization_memberships.js';
import { eq, and, like, desc, count, or, ne, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../../../utils/logger.js';
// Static imports — avoids repeated module-resolution overhead on every request.
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';
import { BUSINESS_SUITE_MATRIX } from '../../../data/permission-matrix.js';
import { invalidateRoleCache } from '../../../middleware/auth/auth.js';
// Role templates removed - using application/module based role creation
const SYSTEM_ACTOR_UUID = '00000000-0000-0000-0000-000000000000';

// --- Types ---
type ModuleDisplay = { name: string; description: string; operations: Array<{ id: string; name: string; description: string; level: string }> };
type GetTenantRolesOptions = { page?: number; limit?: number; search?: string; type?: string };
type DeleteRoleOptions = { force?: boolean; transferUsersTo?: string; deletedBy?: string };
type RoleCreateData = { tenantId: string; name: string; description?: string; permissions: unknown; restrictions?: Record<string, unknown> };
type RoleUpdateData = { name?: string; description?: string; permissions?: unknown; restrictions?: unknown; updatedBy?: string };
type AssignmentData = { userId: string; roleId: string; expiresAt?: string; assignedBy: string; tenantId: string };
type AuditEventData = { tenantId: string; userId: string; action: string; resourceType: string; resourceId: string; oldValues?: unknown; newValues?: unknown; details?: unknown };
type RoleTemplateStub = { isActive?: boolean; category?: string; sortOrder: number };
type RestrictionInput = Record<string, unknown>;
type ValidateRoleContext = { userId?: string; ipAddress?: string; timeOfAccess?: string | Date; requestedResource?: string; requestedAction?: string };
type CloneRoleData = { name: string; description?: string; modifications?: Record<string, unknown>; tenantId: string };
type RoleAnalyticsOptions = { period?: string; includeAudit?: boolean };
type BulkRoleOptions = Record<string, unknown>;
type AdvancedRoleUpdateData = { name?: string; description?: string; color?: string; icon?: string; permissions?: unknown; restrictions?: unknown; inheritance?: unknown; metadata?: unknown; updatedBy?: string; allowAdvancedUpdate?: boolean; isActive?: boolean };

class PermissionService {
  // Get all available permissions organized by application → module → operation
  async getAvailablePermissions(): Promise<{ applications: unknown[]; summary: { applicationCount: number; moduleCount: number; operationCount: number }; structure: Record<string, unknown> }> {
    // Build from BUSINESS_SUITE_MATRIX (single source of truth)
    const applicationStructure: Record<string, { name: string; description: string; icon: string; color: string; modules: Record<string, ModuleDisplay> }> = {};

    const matrix = BUSINESS_SUITE_MATRIX as Record<string, { appInfo: { appCode: string; appName: string; description: string; icon: string }; modules: Record<string, { moduleName: string; description?: string; permissions: Array<{ code: string; name: string; description: string }> }> }>;
    for (const [appKey, appDef] of Object.entries(matrix)) {
      const modules: Record<string, ModuleDisplay> = {};
      if (appDef.modules) {
        for (const [modKey, modDef] of Object.entries(appDef.modules)) {
          modules[modKey.toUpperCase()] = {
            name: modDef.moduleName ?? this.getModuleDisplayName(modKey),
            description: modDef.description ?? '',
            operations: (modDef.permissions ?? []).map((p) => ({
              id: p.code,
              name: p.name,
              description: p.description,
              level: this.getPermissionLevel(p.code)
            }))
          };
        }
      }
      applicationStructure[appKey.toUpperCase()] = {
        name: appDef.appInfo?.appName ?? appKey,
        description: appDef.appInfo?.description ?? '',
        icon: appDef.appInfo?.icon ?? '',
        color: '#3B82F6',
        modules,
      };
    }

    // Transform to expected frontend format
    const applications = Object.entries(applicationStructure).map(([key, app]) => ({
      key: key.toLowerCase(),
      appId: key.toLowerCase(),
      appCode: key.toLowerCase(),
      appName: app.name,
      name: app.name,
      description: app.description,
      icon: app.icon,
      color: app.color,
      moduleCount: Object.keys(app.modules).length,
      operationCount: Object.values(app.modules).reduce((total: number, mod: ModuleDisplay) => total + mod.operations.length, 0),
      modules: Object.entries(app.modules).map(([moduleKey, module]: [string, ModuleDisplay]) => ({
        key: moduleKey.toLowerCase(),
        moduleId: moduleKey.toLowerCase(),
        moduleCode: moduleKey.toLowerCase(),
        moduleName: module.name,
        name: module.name,
        description: module.description,
        isCore: true,
        permissions: module.operations.map((op: { id: string }) => (op.id.split('.').pop() ?? '')),
        operations: module.operations
      }))
    }));

    // Calculate summary data
    const summary = {
      applicationCount: applications.length,
      moduleCount: applications.reduce((total, app) => total + app.moduleCount, 0),
      operationCount: applications.reduce((total, app) => total + app.operationCount, 0)
    };

    Logger.log('info', 'role', 'get-permission-structure', 'Permission Structure Summary', { applicationCount: summary.applicationCount, moduleCount: summary.moduleCount, operationCount: summary.operationCount });

    return { 
      applications,
      summary,
      structure: applicationStructure
    };
  }

  // Helper methods for display names
  getModuleDisplayName(moduleKey: string): string {
    const displayNames: Record<string, string> = {
      'leads': 'Lead Management', 'accounts': 'Account Management', 'contacts': 'Contact Management',
      'opportunities': 'Opportunity Management', 'quotations': 'Quotation Management', 'tickets': 'Ticket Management',
      'communications': 'Communication Management', 'invoices': 'Invoice Management', 'sales_orders': 'Sales Order Management',
      'documents': 'Document Management', 'bulk_operations': 'Bulk Operations', 'pdf': 'PDF Generation',
      'dashboard': 'Dashboard', 'users': 'User Management', 'roles': 'Role Management', 'audit': 'Audit & Logging'
    };
    return displayNames[moduleKey] ?? moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  }

  getModuleDescription(moduleKey: string): string {
    const descriptions: Record<string, string> = {
      'leads': 'Manage sales leads and prospects', 'accounts': 'Manage customer accounts and company information',
      'contacts': 'Manage individual contacts and relationships', 'opportunities': 'Manage sales opportunities and deals',
      'quotations': 'Create and manage quotations', 'tickets': 'Manage support tickets and requests',
      'communications': 'Track communications and interactions', 'invoices': 'Create and manage invoices',
      'sales_orders': 'Process and manage sales orders', 'documents': 'Upload and manage documents',
      'bulk_operations': 'Import/export data in bulk', 'pdf': 'Generate and download PDFs',
      'dashboard': 'Access dashboard and analytics', 'users': 'Manage user accounts and profiles',
      'roles': 'Manage roles and permissions', 'audit': 'View audit logs and system activity'
    };
    return descriptions[moduleKey] ?? `Manage ${moduleKey} functionality`;
  }

  getOperationDisplayName(permissionKey: string): string {
    const operation = permissionKey.split('.').pop() ?? '';
    const displayNames: Record<string, string> = {
      'create': 'Create', 'read': 'View', 'read_all': 'View All', 'update': 'Edit', 'delete': 'Delete',
      'export': 'Export', 'import': 'Import', 'generate_pdf': 'Generate PDF', 'view_contacts': 'View Contacts',
      'upload': 'Upload', 'download': 'Download', 'view': 'View', 'stats': 'Statistics',
      'change_status': 'Change Status', 'change_role': 'Change Role', 'change_password': 'Change Password',
      'bulk_upload': 'Bulk Upload', 'view_own': 'View Own', 'view_all': 'View All', 'search': 'Search',
      'template': 'Template', 'generate': 'Generate'
    };
    return displayNames[operation] ?? operation.charAt(0).toUpperCase() + operation.slice(1);
  }

  getPermissionLevel(permissionKey: string): string {
    const operation = permissionKey.split('.').pop() ?? '';
    if (['read', 'view', 'view_own'].includes(operation)) return 'basic';
    if (['create', 'update', 'export', 'generate_pdf', 'upload', 'download', 'template'].includes(operation)) return 'standard';
    if (['delete', 'import', 'read_all', 'view_all', 'change_status', 'change_role', 'change_password', 'bulk_upload'].includes(operation)) return 'advanced';
    return 'standard';
  }

  // Get tenant roles with optional filtering
  async getTenantRoles(tenantId: string, options: GetTenantRolesOptions = {}): Promise<{ data: unknown[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20, search, type } = options;
    
    Logger.log('info', 'role', 'get-tenant-roles', 'getTenantRoles called', { tenantId, options });
    
    let whereClause = eq(customRoles.tenantId, tenantId) as ReturnType<typeof eq>;
    if (search) {
      const searchCond = or(like(customRoles.roleName, `%${search}%`), like(customRoles.description ?? '', `%${search}%`));
      whereClause = and(whereClause, searchCond!) as ReturnType<typeof eq>;
    }
    if (type === 'system') whereClause = and(whereClause, eq(customRoles.isSystemRole, true)) as ReturnType<typeof eq>;
    else if (type === 'custom') whereClause = and(whereClause, eq(customRoles.isSystemRole, false)) as ReturnType<typeof eq>;

    const query = db
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
        userCount: count(userRoleAssignments.id)
      })
      .from(customRoles)
      .leftJoin(userRoleAssignments, eq(customRoles.roleId, userRoleAssignments.roleId))
      .where(whereClause)
      .groupBy(customRoles.roleId);

    Logger.log('info', 'role', 'get-tenant-roles', 'Query built for tenant roles', { tenantId });

    // Get total count
    const countQuery = db
      .select({ count: count() })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));

    Logger.log('info', 'role', 'get-tenant-roles', 'Executing queries');
    
    const [roleResults, countResult] = await Promise.all([
      query
        .orderBy(desc(customRoles.priority), desc(customRoles.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      countQuery
    ]);

    const totalCount = Number(countResult[0]?.count ?? 0);
    Logger.log('info', 'role', 'get-tenant-roles', 'Query results', { roleResultsCount: roleResults.length, totalCount });

    return {
      data: roleResults,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  // Create a new role
  async createRole(roleData: RoleCreateData): Promise<typeof customRoles.$inferSelect> {
    const { tenantId, name, description, permissions, restrictions } = roleData;
    const createdBy = (roleData as RoleCreateData & { createdBy?: string }).createdBy ?? '00000000-0000-0000-0000-000000000000';
    
    // Check if role name already exists
    const existingRole = await db
      .select({ roleId: customRoles.roleId })
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleName, name)
        )
      )
      .limit(1);

    if (existingRole.length > 0) {
      throw new Error(`Role with name "${name}" already exists`);
    }

    const roleId = uuidv4();
    const now = new Date();

    // Convert permissions to tool-specific format if needed
    const formattedPermissions = this.formatPermissionsForStorage(permissions);

    const newRole = await db
      .insert(customRoles)
      .values({
        roleId,
        tenantId,
        roleName: name,
        description,
        permissions: formattedPermissions as unknown as typeof customRoles.$inferInsert.permissions,
        restrictions: restrictions ?? {},
        isSystemRole: false,
        isDefault: false,
        priority: 0,
        createdBy,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    // Log the creation
    await this.logAuditEvent({
      tenantId,
      userId: SYSTEM_ACTOR_UUID, // UUID-safe fallback actor for system-generated events
      action: 'role_created',
      resourceType: 'role',
      resourceId: roleId,
      newValues: { name, permissions: formattedPermissions, restrictions }
    });

    return newRole[0];
  }

  // Update an existing role
  async updateRole(tenantId: string, roleId: string, updateData: RoleUpdateData): Promise<typeof customRoles.$inferSelect> {
    const { name, description, permissions, restrictions, updatedBy } = updateData;
    
    // Get existing role
    const existingRole = await db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .limit(1);

    if (!existingRole.length) {
      throw new Error('Role not found');
    }

    if (existingRole[0].isSystemRole) {
      throw new Error('Cannot modify system roles');
    }

    // Check name uniqueness if name is being changed
    if (name && name !== existingRole[0].roleName) {
      const nameExists = await db
        .select({ roleId: customRoles.roleId })
        .from(customRoles)
        .where(
          and(
            eq(customRoles.tenantId, tenantId),
            eq(customRoles.roleName, name),
            ne(customRoles.roleId, roleId)
          )
        )
        .limit(1);

      if (nameExists.length > 0) {
        throw new Error(`Role with name "${name}" already exists`);
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (name) updates.roleName = name;
    if (description !== undefined) updates.description = description;
    if (permissions) {
      const formattedPermissions = this.formatPermissionsForStorage(permissions);
      updates.permissions = formattedPermissions;
    }
    if (restrictions !== undefined) {
      updates.restrictions = restrictions ?? null;
    }

    const updatedRole = await db
      .update(customRoles)
      .set(updates as Partial<typeof customRoles.$inferInsert>)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .returning();

    // Log the update
    await this.logAuditEvent({
      tenantId,
      userId: updatedBy ?? SYSTEM_ACTOR_UUID,
      action: 'role_updated',
      resourceType: 'role',
      resourceId: roleId,
      oldValues: existingRole[0],
      newValues: updates
    });

    // Publish role change event to AWS MQ for real-time sync
    try {
      const row = updatedRole[0] as typeof customRoles.$inferSelect;
      await snsSqsPublisher.publishRoleEventToSuite('role_updated', tenantId, row.roleId, {
        roleId: row.roleId,
        roleName: row.roleName,
        description: row.description,
        permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
        restrictions: row.restrictions
          ? (typeof row.restrictions === 'string' ? JSON.parse(row.restrictions as string) : row.restrictions)
          : null,
        updatedBy: updatedBy,
        updatedAt: (row.updatedAt ?? new Date()).toISOString()
      });

      Logger.log('info', 'role', 'update-role', 'Published role_updated event');

      // Also publish to custom stream for backward compatibility
      const eventData = {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        eventType: 'role_permissions_changed',
        tenantId: tenantId,
        entityType: 'role',
        entityId: (updatedRole[0] as typeof customRoles.$inferSelect).roleId,
        action: 'permissions_updated',
        data: {
          roleId: (updatedRole[0] as typeof customRoles.$inferSelect).roleId,
          roleName: (updatedRole[0] as typeof customRoles.$inferSelect).roleName,
          permissions: typeof (updatedRole[0] as typeof customRoles.$inferSelect).permissions === 'string' ? JSON.parse((updatedRole[0] as typeof customRoles.$inferSelect).permissions as string) : (updatedRole[0] as typeof customRoles.$inferSelect).permissions,
          isActive: true,
          description: (updatedRole[0] as typeof customRoles.$inferSelect).description,
          scope: ((updatedRole[0] as Record<string, unknown>).scope as string) || 'organization'
        },
        metadata: {
          correlationId: `role_permissions_${(updatedRole[0] as typeof customRoles.$inferSelect).roleId}_${Date.now()}`,
          version: '1.0',
          sourceTimestamp: new Date().toISOString(),
          sourceApp: 'wrapper'
        }
      };

      // Publish to AWS MQ
      const result = await snsSqsPublisher.publishInterAppEvent({
        eventType: 'role_permissions_changed',
        sourceApplication: 'wrapper',
        targetApplication: 'crm',
        tenantId: tenantId,
        entityId: roleId,
        eventData: eventData
      });

      Logger.log('info', 'role', 'update-role', 'Published role permissions change event to AWS MQ', { roleId, eventId: result?.eventId });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'role', 'update-role', 'Failed to publish role change event', { error: error.message });
      // Don't fail the role update if event publishing fails
    }

    return updatedRole[0] as typeof customRoles.$inferSelect;
  }

  // Delete a role with options
  async deleteRole(tenantId: string, roleId: string, options: DeleteRoleOptions = {}): Promise<{ deleted: boolean; usersAffected: number; transferredTo?: string }> {
    const { force = false, transferUsersTo, deletedBy } = options;
    
    const existingRole = await db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .limit(1);

    if (!existingRole.length) {
      throw new Error('Role not found');
    }

    if (existingRole[0].isSystemRole) {
      throw new Error('Cannot delete system roles');
    }

    // Special protection for Super Administrator role
    if (existingRole[0].roleName === 'Super Administrator' || (existingRole[0].priority ?? 0) >= 1000) {
      throw new Error('Cannot delete Super Administrator role - this is the primary admin role for the organization');
    }

    // Capture affected users so auth role cache can be invalidated after reassignment/removal.
    const directAssignmentRows = await db
      .select({ userId: userRoleAssignments.userId })
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.roleId, roleId));
    const affectedUserIds = [...new Set(directAssignmentRows.map(row => row.userId))];

    // Check if role is assigned to users (direct assignments)
    const userAssignments = await db
      .select({ count: count() })
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.roleId, roleId));

    // Check if role is assigned via organization memberships
    const orgAssignments = await db
      .select({ count: count() })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.roleId, roleId));

    const totalAssignments = Number(userAssignments[0]?.count ?? 0) + Number(orgAssignments[0]?.count ?? 0);

    if (totalAssignments > 0) {
      if (!force && !transferUsersTo) {
        throw new Error(`Cannot delete role that is assigned to ${totalAssignments} user(s)`);
      }

      if (transferUsersTo) {
        // Transfer users to another role (only for direct assignments)
        await db
          .update(userRoleAssignments)
          .set({ roleId: transferUsersTo })
          .where(eq(userRoleAssignments.roleId, roleId));
        // Note: Organization memberships cannot be transferred, only removed
      } else if (force) {
        // Force delete - remove all assignments
        await db
          .delete(userRoleAssignments)
          .where(eq(userRoleAssignments.roleId, roleId));

        // Also remove organization memberships that reference this role
        await db
          .delete(organizationMemberships)
          .where(eq(organizationMemberships.roleId, roleId));
      }
    }

    // Delete the role
    await db
      .delete(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      );

    // Log the deletion
    if (deletedBy) {
      await this.logAuditEvent({
        tenantId,
        userId: deletedBy,
        action: 'role_deleted',
        resourceType: 'role',
        resourceId: roleId,
        oldValues: existingRole[0],
        details: {
          force,
          transferUsersTo,
          usersAffected: totalAssignments
        }
      });
    }

    // Role membership changed for these users (transfer or force removal).
    affectedUserIds.forEach(id => { void invalidateRoleCache(id); });

    // Publish role.deleted to every app in the suite so each consumer can
    // expire its local copy of the role + any cached permission grants.
    // Done AFTER the DB delete + audit + cache invalidation; any publish
    // failure is logged but never reverses the deletion.
    try {
      const roleRow = existingRole[0] as Record<string, unknown>;
      const publishResults = await snsSqsPublisher.publishRoleEventToSuite(
        'role.deleted',
        tenantId,
        roleId,
        {
          roleName: roleRow.roleName ?? (roleRow as { name?: string }).name,
          description: roleRow.description,
          permissions: roleRow.permissions,
          restrictions: roleRow.restrictions,
          metadata: roleRow.metadata,
          deletedBy: deletedBy ?? 'system',
          deletedAt: new Date().toISOString(),
          transferredToRoleId: transferUsersTo,
          affectedUsersCount: totalAssignments,
        },
        deletedBy ?? 'system'
      );
      const failed = publishResults.filter((r) => r.success === false);
      if (failed.length > 0) {
        Logger.log('warning', 'role', 'delete-role', 'Some role.deleted publishes failed', { roleId, failed });
      }
    } catch (publishErr: unknown) {
      Logger.log('error', 'role', 'delete-role', 'Failed to publish role.deleted event', { roleId, error: (publishErr as Error).message });
    }

    return {
      deleted: true,
      usersAffected: totalAssignments,
      transferredTo: transferUsersTo
    };
  }

  // Format permissions for storage (convert array to tool-specific object)
  formatPermissionsForStorage(permissions: unknown): Record<string, Record<string, string[]>> | unknown {
    if (Array.isArray(permissions)) {
      const toolPermissions: Record<string, Record<string, string[]>> = {};
      
      permissions.forEach((permissionId: unknown) => {
        const parts = String(permissionId).split('.');
        if (parts.length >= 3) {
          const [tool, resource, action] = parts;
          
          if (!toolPermissions[tool]) {
            toolPermissions[tool] = {};
          }
          if (!toolPermissions[tool][resource]) {
            toolPermissions[tool][resource] = [];
          }
          
          if (!toolPermissions[tool][resource].includes(action)) {
            toolPermissions[tool][resource].push(action);
          }
        }
      });
      
      return toolPermissions;
    }
    
    return permissions;
  }

  // Role assignment methods
  async assignRole(assignmentData: AssignmentData): Promise<typeof userRoleAssignments.$inferSelect> {
    const { userId, roleId, expiresAt, assignedBy, tenantId } = assignmentData;
    
    Logger.log('info', 'role', 'assign-role', 'Role assignment request', { userId, roleId, assignedBy, tenantId, hasExpiration: !!expiresAt });
    
    // Check if assignment already exists
    const existing = await db
      .select()
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      Logger.log('info', 'role', 'assign-role', 'Updating existing role assignment', { existingAssignmentId: existing[0].id, wasActive: existing[0].isActive });
      
      // Update existing assignment
      const updated = await db
        .update(userRoleAssignments)
        .set({
          isActive: true,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          assignedBy,
          assignedAt: new Date()
        })
        .where(eq(userRoleAssignments.id, existing[0].id))
        .returning();

      Logger.log('info', 'role', 'assign-role', 'Role assignment updated successfully');
      void invalidateRoleCache(userId);
      
      // Publish role assignment event (reassignment)
      try {
        await snsSqsPublisher.publishRoleEventToSuite('role_assigned', tenantId, roleId, {
          assignmentId: updated[0].id ?? '',
          userId: userId,
          roleId: roleId,
          assignedAt: new Date().toISOString(),
          assignedBy: assignedBy,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          entityId: (updated[0] as { organizationId?: string }).organizationId
        });
        Logger.log('info', 'role', 'assign-role', 'Published role reassignment event successfully');
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('warning', 'role', 'assign-role', 'Failed to publish role reassignment event', { error: error.message });
      }
      
      return updated[0];
    }

    // Create new assignment - 'id' is auto-generated by schema
    Logger.log('info', 'role', 'assign-role', 'Creating new role assignment');
    
    const assignment = await db
      .insert(userRoleAssignments)
      .values({
        userId,
        roleId,
        isActive: true,
        isTemporary: !!expiresAt,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedBy,
        assignedAt: new Date()
      })
      .returning();

    Logger.log('info', 'role', 'assign-role', 'New role assignment created successfully');
    void invalidateRoleCache(userId);
    
    // Publish role assignment event
    try {
      await snsSqsPublisher.publishRoleEventToSuite('role_assigned', tenantId, roleId, {
        assignmentId: assignment[0].id,
        userId: userId,
        roleId: roleId,
        assignedAt: new Date().toISOString(),
        assignedBy: assignedBy,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        entityId: (assignment[0] as { organizationId?: string }).organizationId
      });
      Logger.log('info', 'role', 'assign-role', 'Published role assignment event successfully');
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'role', 'assign-role', 'Failed to publish role assignment event', { error: error.message });
    }
    
    return assignment[0];
  }

  // Remove role assignment
  async removeRoleAssignment(tenantId: string, userId: string, roleId: string, removedBy: string): Promise<{ success: boolean; assignmentId: string }> {
    Logger.log('info', 'role', 'remove-role-assignment', 'Role removal request', { userId, roleId, removedBy, tenantId });
    
    // Find the assignment
    const existing = await db
      .select()
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Role assignment not found');
    }

    const assignment = existing[0];
    
    // Delete the assignment - use 'id' field from schema, not 'assignmentId'
    await db
      .delete(userRoleAssignments)
      .where(eq(userRoleAssignments.id, assignment.id));

    Logger.log('info', 'role', 'remove-role-assignment', 'Role assignment removed successfully');
    void invalidateRoleCache(userId);

    // Publish role unassignment event
    try {
      await snsSqsPublisher.publishRoleEventToSuite('role_unassigned', tenantId, roleId, {
        assignmentId: assignment.id ?? '',
        userId: userId,
        roleId: roleId,
        unassignedAt: new Date().toISOString(),
        unassignedBy: removedBy,
        reason: 'Manual removal'
      });
      Logger.log('info', 'role', 'remove-role-assignment', 'Published role unassignment event successfully');
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'role', 'remove-role-assignment', 'Failed to publish role unassignment event', { error: error.message });
    }

    return { success: true, assignmentId: assignment.id ?? '' };
  }

  // Remove role assignment by assignmentId
  async removeRoleAssignmentById(tenantId: string, assignmentId: string, removedBy: string): Promise<{ success: boolean; assignmentId: string }> {
    Logger.log('info', 'role', 'remove-role-assignment-by-id', 'Role removal by assignmentId request', { assignmentId, removedBy, tenantId });
    
    // Find the assignment - use 'id' field from schema
    const existing = await db
      .select()
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.id, assignmentId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Role assignment not found');
    }

    const assignment = existing[0];
    
    // Delete the assignment - use 'id' field from schema
    await db
      .delete(userRoleAssignments)
      .where(eq(userRoleAssignments.id, assignmentId));

    Logger.log('info', 'role', 'remove-role-assignment-by-id', 'Role assignment removed successfully');
    void invalidateRoleCache(assignment.userId);

    // Publish role unassignment event
    try {
      await snsSqsPublisher.publishRoleEventToSuite('role_unassigned', tenantId, assignment.roleId, {
        assignmentId: assignment.id, // Use 'id' as assignmentId in event
        userId: assignment.userId,
        roleId: assignment.roleId,
        unassignedAt: new Date().toISOString(),
        unassignedBy: removedBy,
        reason: 'Manual removal'
      });
      Logger.log('info', 'role', 'remove-role-assignment-by-id', 'Published role unassignment event successfully');
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'role', 'remove-role-assignment-by-id', 'Failed to publish role unassignment event', { error: error.message });
    }
    
    return { success: true, assignmentId: assignment.id ?? '' };
  }

  // Log audit events
  async logAuditEvent(eventData: AuditEventData): Promise<void> {
    const { tenantId, userId, action, resourceType, resourceId, oldValues, newValues, details } = eventData;
    
    await db.insert(auditLogs).values({
      logId: uuidv4(),
      tenantId,
      userId,
      action,
      resourceType,
      resourceId: String(resourceId),
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      details: details ? JSON.stringify(details) : null,
      createdAt: new Date()
    });
  }

  // Additional methods for role templates, assignments, etc. (role templates table removed)
  async getRoleTemplates(options: { category?: string; includeInactive?: boolean } = {}): Promise<RoleTemplateStub[]> {
    const { category, includeInactive = false } = options;
    const templateData: RoleTemplateStub[] = [];
    
    let templates = templateData.filter((template: RoleTemplateStub) => includeInactive || template.isActive !== false);
    
    if (category) {
      templates = templates.filter((template: RoleTemplateStub) => template.category === category);
    }
    
    templates.sort((a: RoleTemplateStub, b: RoleTemplateStub) => a.sortOrder - b.sortOrder);
    
    return templates;
  }

  async getRoleAssignments(filters: Record<string, unknown> = {}): Promise<{ data: unknown[]; total: number }> {
    // Implementation for getting role assignments
    return { data: [], total: 0 };
  }

  async getAuditLog(filters: Record<string, unknown> = {}): Promise<{ data: unknown[]; total: number }> {
    // Implementation for getting audit log
    return { data: [], total: 0 };
  }

  // Enhanced role creation with advanced features
  async createAdvancedRole(roleData: Record<string, unknown>): Promise<typeof customRoles.$inferSelect> {
    const tenantId = roleData.tenantId as string;
    const name = roleData.name as string;
    const description = roleData.description as string | undefined;
    const color = (roleData.color as string) ?? '#6b7280';
    const icon = (roleData.icon as string) ?? '👤';
    const category = roleData.category;
    const permissions = roleData.permissions;
    const restrictions = (roleData.restrictions ?? {}) as RestrictionInput;
    const inheritance = (roleData.inheritance ?? {}) as Record<string, unknown>;
    const metadata = (roleData.metadata ?? {}) as Record<string, unknown>;
    
    // Check if role name already exists
    const existingRole = await db
      .select({ roleId: customRoles.roleId })
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleName, name)
        )
      )
      .limit(1);

    if (existingRole.length > 0) {
      throw new Error(`Role with name "${name}" already exists`);
    }

    const roleId = uuidv4();
    const now = new Date();

    let effectivePermissions: unknown = permissions;
    if (Array.isArray(inheritance.parentRoles) && inheritance.parentRoles.length > 0) {
      effectivePermissions = await this.processRoleInheritance(tenantId, permissions as Record<string, unknown> | undefined, inheritance);
    }

    const validatedPermissions = await this.validatePermissionStructure(effectivePermissions) as Record<string, unknown>;
    const validatedRestrictions = await this.validateRestrictions(restrictions) as Record<string, unknown>;

    const createdBy = (roleData as Record<string, unknown>).createdBy as string | undefined;
    const newRole = await db
      .insert(customRoles)
      .values({
        roleId,
        tenantId,
        roleName: name,
        description,
        color,
        permissions: { ...validatedPermissions, metadata: { icon, category, inheritance, ...metadata } },
        restrictions: validatedRestrictions,
        isSystemRole: false,
        isDefault: metadata?.isDefault ?? false,
        priority: (inheritance.priority as number) ?? 0,
        createdBy: createdBy ?? '00000000-0000-0000-0000-000000000000',
        createdAt: now,
        updatedAt: now
      } as typeof customRoles.$inferInsert)
      .returning();

    // Log the creation
    await this.logAuditEvent({
      tenantId,
      userId: SYSTEM_ACTOR_UUID, // UUID-safe fallback actor for system-generated events
      action: 'advanced_role_created',
      resourceType: 'role',
      resourceId: roleId,
      newValues: { 
        name, 
        permissions: validatedPermissions, 
        restrictions: validatedRestrictions,
        inheritance,
        metadata
      }
    });

    return newRole[0] as typeof customRoles.$inferSelect;
  }

  // Process role inheritance
  async processRoleInheritance(tenantId: string, basePermissions: Record<string, unknown> | undefined, inheritance: Record<string, unknown>): Promise<Record<string, unknown>> {
    Logger.log('info', 'role', 'process-role-inheritance', 'processRoleInheritance called', { tenantId, hasBasePermissions: !!basePermissions });

    
    const { parentRoles, inheritanceMode } = inheritance as { parentRoles?: unknown[]; inheritanceMode?: string };
    if (!parentRoles || !Array.isArray(parentRoles) || parentRoles.length === 0) {
      Logger.log('info', 'role', 'process-role-inheritance', 'No parent roles specified, returning base permissions');
      return basePermissions || {};
    }

    Logger.log('info', 'role', 'process-role-inheritance', 'Fetching parent roles', { count: parentRoles.length });

    try {
    // Get parent roles
    const parents = await db
      .select({
        roleId: customRoles.roleId,
          roleName: customRoles.roleName,
        permissions: customRoles.permissions,
        priority: customRoles.priority
      })
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          inArray(customRoles.roleId, parentRoles as string[])
        )
      );

      Logger.log('info', 'role', 'process-role-inheritance', 'Found parent roles', { found: parents.length, requested: parentRoles.length });

      if (parents.length === 0) {
        Logger.log('warning', 'role', 'process-role-inheritance', 'No parent roles found, returning base permissions');
        return basePermissions || {};
      }

    if (parents.length !== parentRoles.length) {
        const foundRoleIds = parents.map(p => p.roleId);
        const missingRoleIds = parentRoles.filter(id => !foundRoleIds.includes(id as string));
        Logger.log('warning', 'role', 'process-role-inheritance', 'Some parent roles not found', { missingRoleIds });
        // Don't throw error, just continue with found roles
    }

    // Sort by priority (higher priority = more important)
    parents.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      Logger.log('info', 'role', 'process-role-inheritance', 'Parent roles sorted by priority', { roles: parents.map(p => ({ name: p.roleName, priority: p.priority })) });

      let effectivePermissions = basePermissions ? { ...basePermissions } : {};
      Logger.log('info', 'role', 'process-role-inheritance', 'Starting inheritance processing', { inheritanceMode });

      parents.forEach((parent, index) => {
        try {
          Logger.log('info', 'role', 'process-role-inheritance', 'Processing parent role', { index: index + 1, total: parents.length, roleName: parent.roleName });

          let parentPermissions: Record<string, unknown> = {};
          if (parent.permissions) {
            try {
              parentPermissions = (typeof parent.permissions === 'string' ? JSON.parse(parent.permissions as string) : parent.permissions) as Record<string, unknown>;
              if (parentPermissions.metadata) {
                delete parentPermissions.metadata;
              }
              Logger.log('info', 'role', 'process-role-inheritance', 'Parsed parent role permissions', { roleName: parent.roleName, keys: Object.keys(parentPermissions) });
            } catch (parseError) {
              Logger.log('error', 'role', 'process-role-inheritance', 'Failed to parse permissions for parent role', { roleName: parent.roleName, error: (parseError as Error).message });
              return; // Skip this parent role
            }
          }

      switch (inheritanceMode) {
        case 'additive':
              Logger.log('info', 'role', 'process-role-inheritance', 'Applying additive inheritance', { roleName: parent.roleName });
          effectivePermissions = this.mergePermissions(effectivePermissions as Record<string, unknown>, parentPermissions);
          break;
        case 'restrictive':
              Logger.log('info', 'role', 'process-role-inheritance', 'Applying restrictive inheritance', { roleName: parent.roleName });
          effectivePermissions = this.intersectPermissions(effectivePermissions as Record<string, unknown>, parentPermissions);
          break;
        case 'override':
              Logger.log('info', 'role', 'process-role-inheritance', 'Applying override inheritance', { roleName: parent.roleName });
          effectivePermissions = { ...parentPermissions, ...(effectivePermissions as Record<string, unknown>) };
          break;
            default:
              Logger.log('warning', 'role', 'process-role-inheritance', 'Unknown inheritance mode, using additive', { inheritanceMode });
          effectivePermissions = this.mergePermissions(effectivePermissions as Record<string, unknown>, parentPermissions);
          }

          Logger.log('info', 'role', 'process-role-inheritance', 'Processed inheritance from parent role', { roleName: parent.roleName, permissionKeys: Object.keys(effectivePermissions) });
        } catch (parentError) {
          Logger.log('error', 'role', 'process-role-inheritance', 'Error processing parent role', { roleName: parent.roleName, error: (parentError as Error).message });
          // Continue with other parent roles
        }
      });

      Logger.log('info', 'role', 'process-role-inheritance', 'Role inheritance processing completed', { finalPermissionKeys: Object.keys(effectivePermissions) });
    return effectivePermissions;
    } catch (error) {
      Logger.log('error', 'role', 'process-role-inheritance', 'Error in processRoleInheritance, falling back to base permissions', { error: (error as Error).message });
      return basePermissions || {};
    }
  }

  // Helper method to merge permissions (additive inheritance)
  mergePermissions(basePermissions: Record<string, unknown> | undefined, parentPermissions: Record<string, unknown> | undefined): Record<string, unknown> {
    Logger.log('info', 'role', 'merge-permissions', 'Merging permissions', { baseKeys: Object.keys(basePermissions || {}), parentKeys: Object.keys(parentPermissions || {}) });

    const merged: Record<string, unknown> = { ...(basePermissions || {}) };

    Object.keys(parentPermissions || {}).forEach((resource: string) => {
      const parentPerm = (parentPermissions as Record<string, unknown>)[resource] as Record<string, unknown>;
      const basePerm = merged[resource] as Record<string, unknown> | undefined;

      if (!basePerm) {
        // Resource doesn't exist in base, add it from parent
        merged[resource] = { ...parentPerm };
        Logger.log('info', 'role', 'merge-permissions', 'Added new resource from parent', { resource });
      } else {
        const baseOps = Array.isArray(basePerm.operations) ? basePerm.operations : [];
        const parentOps = Array.isArray(parentPerm.operations) ? parentPerm.operations : [];
        const mergedOps = new Set([...baseOps, ...parentOps]);
        
        // Use the higher permission level
        const levelHierarchy: Record<string, number> = { 'none': 0, 'read': 1, 'write': 2, 'admin': 3 };
        const baseLevel = levelHierarchy[String(basePerm.level)] ?? 0;
        const parentLevel = levelHierarchy[String(parentPerm.level)] ?? 0;
        const higherLevel = baseLevel >= parentLevel ? (basePerm.level as string) : (parentPerm.level as string);
        
        const scopeHierarchy: Record<string, number> = { 'own': 0, 'team': 1, 'department': 2, 'zone': 3, 'all': 4 };
        const baseScope = scopeHierarchy[String(basePerm.scope)] ?? 0;
        const parentScope = scopeHierarchy[String(parentPerm.scope)] ?? 0;
        const broaderScope = baseScope >= parentScope ? (basePerm.scope as string) : (parentPerm.scope as string);
        
        merged[resource] = {
          level: higherLevel,
          operations: Array.from(mergedOps),
          scope: broaderScope,
          conditions: { ...(parentPerm.conditions || {}), ...(basePerm.conditions || {}) }
        };
        
        Logger.log('info', 'role', 'merge-permissions', 'Merged resource', { resource, level: higherLevel, scope: broaderScope });
      }
    });

    Logger.log('info', 'role', 'merge-permissions', 'Permissions merged successfully', { finalKeys: Object.keys(merged) });
    return merged;
  }

  // Helper method to intersect permissions (restrictive inheritance)
  intersectPermissions(basePermissions: Record<string, unknown> | undefined, parentPermissions: Record<string, unknown> | undefined): Record<string, unknown> {
    Logger.log('info', 'role', 'intersect-permissions', 'Intersecting permissions', { baseKeys: Object.keys(basePermissions || {}), parentKeys: Object.keys(parentPermissions || {}) });
    
    const intersected: Record<string, unknown> = {};
    
    Object.keys(basePermissions || {}).forEach((resource: string) => {
      const basePerm = (basePermissions as Record<string, unknown>)[resource] as Record<string, unknown>;
      const parentPerm = (parentPermissions as Record<string, unknown>)[resource] as Record<string, unknown>;
      
      if (!parentPerm) {
        // Resource doesn't exist in parent, exclude it
        Logger.log('info', 'role', 'intersect-permissions', 'Excluded resource not in parent', { resource });
        return;
      }
      
      const baseOps = new Set(Array.isArray(basePerm.operations) ? basePerm.operations : []);
      const parentOps = new Set(Array.isArray(parentPerm.operations) ? parentPerm.operations : []);
      const commonOps = Array.from(baseOps).filter((op: string) => parentOps.has(op));
      
      const levelHierarchy: Record<string, number> = { 'none': 0, 'read': 1, 'write': 2, 'admin': 3 };
      const baseLevel = levelHierarchy[String(basePerm.level)] ?? 0;
      const parentLevel = levelHierarchy[String(parentPerm.level)] ?? 0;
      const lowerLevel = baseLevel <= parentLevel ? (basePerm.level as string) : (parentPerm.level as string);
      
      const scopeHierarchy: Record<string, number> = { 'own': 0, 'team': 1, 'department': 2, 'zone': 3, 'all': 4 };
      const baseScope = scopeHierarchy[String(basePerm.scope)] ?? 0;
      const parentScope = scopeHierarchy[String(parentPerm.scope)] ?? 0;
      const narrowerScope = baseScope <= parentScope ? (basePerm.scope as string) : (parentPerm.scope as string);
        
        intersected[resource] = {
        level: lowerLevel,
        operations: commonOps,
        scope: narrowerScope,
        conditions: { ...(basePerm.conditions || {}), ...(parentPerm.conditions || {}) }
      };
      
      Logger.log('info', 'role', 'intersect-permissions', 'Intersected resource', { resource, level: lowerLevel, scope: narrowerScope, opCount: commonOps.length });
    });

    Logger.log('info', 'role', 'intersect-permissions', 'Permissions intersected successfully', { finalKeys: Object.keys(intersected) });
    return intersected;
  }

  // Validate permission structure
  async validatePermissionStructure(permissions: unknown): Promise<Record<string, unknown>> {
    Logger.log('info', 'role', 'validate-permission-structure', 'validatePermissionStructure called', { type: typeof permissions, keys: Array.isArray(permissions) ? `${(permissions as unknown[]).length} items` : Object.keys((permissions as Record<string, unknown>) || {}) });

    if (!permissions) {
      Logger.log('warning', 'role', 'validate-permission-structure', 'No permissions provided');
      return {};
    }

    // Handle array format (from role builder/custom role service)
    if (Array.isArray(permissions)) {
      Logger.log('info', 'role', 'validate-permission-structure', 'Converting array permissions to structured format');
      return this.convertArrayPermissionsToStructured(permissions);
    }

    // Handle object format (advanced role structure)
    if (typeof permissions !== 'object') {
      Logger.log('warning', 'role', 'validate-permission-structure', 'Invalid permissions type');
      return {};
    }

    // Check if this is a mis-formatted array (array converted to object with numeric keys)
    const keys = Object.keys(permissions as Record<string, unknown>);
    const isArrayAsObject = keys.length > 0 && keys.every(key => /^\d+$/.test(key)) && keys.every(key => Array.isArray((permissions as Record<string, unknown>)[key]));

    if (isArrayAsObject) {
      Logger.log('info', 'role', 'validate-permission-structure', 'Detected array-as-object format, converting back to array');
      const arrayPermissions: unknown[] = [];
      keys.forEach((key: string) => {
        arrayPermissions.push(...((permissions as Record<string, unknown>)[key] as unknown[]));
      });
      return this.convertArrayPermissionsToStructured(arrayPermissions);
    }

    // Get available permissions for validation
    const availablePermissionIds = await this.getAvailablePermissionIds();
    Logger.log('info', 'role', 'validate-permission-structure', 'Available permission IDs count', { count: availablePermissionIds.size });

    const validatedPermissions: Record<string, unknown> = {};

    Object.keys(permissions as Record<string, unknown>).forEach((resource: string) => {
      const permission = (permissions as Record<string, unknown>)[resource];

      // Skip metadata and other non-permission objects
      if (resource === 'metadata' || resource === 'inheritance' || resource === 'restrictions') {
        Logger.log('info', 'role', 'validate-permission-structure', 'Skipping non-permission object', { resource });
        return;
      }

      Logger.log('info', 'role', 'validate-permission-structure', 'Validating resource', { resource });

      if (!permission || typeof permission !== 'object') {
        Logger.log('warning', 'role', 'validate-permission-structure', 'Skipping invalid permission for resource', { resource });
        return;
      }

      const validLevels = ['none', 'read', 'write', 'admin'];
      const permLevel = (permission as Record<string, unknown>).level as string;
      if (!permLevel || !validLevels.includes(permLevel)) {
        Logger.log('error', 'role', 'validate-permission-structure', 'Invalid permission level', { permLevel, resource });
        throw new Error(`Invalid permission level: ${permLevel} for resource: ${resource}`);
      }

      // Validate operations exist (only if we have available permissions)
      if ((permission as Record<string, unknown>).operations && Array.isArray((permission as Record<string, unknown>).operations) && availablePermissionIds.size > 0) {
        const invalidOps = ((permission as Record<string, unknown>).operations as string[]).filter((op: string) => !availablePermissionIds.has(op));
        if (invalidOps.length > 0) {
          Logger.log('warning', 'role', 'validate-permission-structure', 'Some operations not in available permissions', { resource, invalidOps });
          // Don't throw error, just log warning for now
          // throw new Error(`Invalid operations for ${resource}: ${invalidOps.join(', ')}`);
        }
      }

      const validScopes = ['own', 'team', 'department', 'zone', 'all'];
      const permScope = (permission as Record<string, unknown>).scope as string;
      if (permScope && !validScopes.includes(permScope)) {
        Logger.log('error', 'role', 'validate-permission-structure', 'Invalid permission scope', { permScope, resource });
        throw new Error(`Invalid permission scope: ${permScope} for resource: ${resource}`);
      }

      const perm = permission as Record<string, unknown>;
      validatedPermissions[resource] = {
        level: perm.level,
        operations: Array.isArray(perm.operations) ? perm.operations : [],
        scope: perm.scope || 'own',
        conditions: perm.conditions || {}
      };

      Logger.log('info', 'role', 'validate-permission-structure', 'Validated permission for resource', { resource });
    });

    Logger.log('info', 'role', 'validate-permission-structure', 'All permissions validated successfully', { finalCount: Object.keys(validatedPermissions).length });
    return validatedPermissions;
  }

  // Convert array permissions to structured format
  convertArrayPermissionsToStructured(permissionArray: unknown[]): Record<string, unknown> {
    Logger.log('info', 'role', 'convert-array-permissions', 'Converting permission array to structured format', { count: permissionArray.length });
    
    const structured: Record<string, unknown> = {};
    const groupedPermissions: Record<string, string[]> = {};

    permissionArray.forEach((permission: unknown) => {
      if (typeof permission === 'string') {
        const parts = permission.split('.');
        if (parts.length >= 3) {
          const [app, module, ...actionParts] = parts;
          const resourceKey = `${app}.${module}`;
          
          if (!groupedPermissions[resourceKey]) {
            groupedPermissions[resourceKey] = [];
          }
          groupedPermissions[resourceKey].push(permission);
        }
      }
    });

    Object.keys(groupedPermissions).forEach((resourceKey: string) => {
      const operations = groupedPermissions[resourceKey];
      
      // Determine permission level based on operations
      let level = 'read';
      const hasAdmin = operations.some(op => op.includes('delete') || op.includes('manage') || op.includes('admin'));
      const hasWrite = operations.some(op => op.includes('create') || op.includes('update') || op.includes('edit'));
      
      if (hasAdmin) {
        level = 'admin';
      } else if (hasWrite) {
        level = 'write';
      }

      structured[resourceKey] = {
        level: level,
        operations: operations,
        scope: 'all',
        conditions: {}
      };

      Logger.log('info', 'role', 'convert-array-permissions', 'Converted resource', { resourceKey, opCount: operations.length, level });
    });

    Logger.log('info', 'role', 'convert-array-permissions', 'Array to structured conversion completed', { resourceCount: Object.keys(structured).length });
    return structured;
  }

  // Validate restrictions
  async validateRestrictions(restrictions: RestrictionInput | null | undefined): Promise<Record<string, unknown>> {
    Logger.log('info', 'role', 'validate-restrictions', 'validateRestrictions called');

    if (!restrictions || typeof restrictions !== 'object') {
      Logger.log('warning', 'role', 'validate-restrictions', 'No restrictions provided or invalid type, returning default structure');
      return {
        timeRestrictions: {},
        ipRestrictions: {},
        dataRestrictions: {},
        featureRestrictions: {}
      };
    }

    const validated: Record<string, Record<string, unknown>> = {
      timeRestrictions: {},
      ipRestrictions: {},
      dataRestrictions: {},
      featureRestrictions: {}
    };

    if (restrictions.timeRestrictions && typeof restrictions.timeRestrictions === 'object') {
      Logger.log('info', 'role', 'validate-restrictions', 'Validating time restrictions');
      const tr = restrictions.timeRestrictions as Record<string, unknown>;
      const allowedHours = tr.allowedHours;
      const allowedDays = tr.allowedDays;
      const timezone = tr.timezone;
      const blockWeekends = tr.blockWeekends;
      const blockHolidays = tr.blockHolidays;

      if (allowedHours !== undefined) {
        if (!Array.isArray(allowedHours) || (allowedHours as unknown[]).some((h: unknown) => typeof h !== 'number' || (h as number) < 0 || (h as number) > 23)) {
          Logger.log('error', 'role', 'validate-restrictions', 'Invalid allowed hours');
          throw new Error('Invalid allowed hours. Must be array of integers 0-23');
        }
        validated.timeRestrictions.allowedHours = allowedHours;
        Logger.log('info', 'role', 'validate-restrictions', 'Allowed hours validated', { allowedHours });
      }

      if (allowedDays !== undefined) {
        if (!Array.isArray(allowedDays) || (allowedDays as unknown[]).some((d: unknown) => typeof d !== 'number' || (d as number) < 0 || (d as number) > 6)) {
          Logger.log('error', 'role', 'validate-restrictions', 'Invalid allowed days');
          throw new Error('Invalid allowed days. Must be array of integers 0-6');
        }
        validated.timeRestrictions.allowedDays = allowedDays;
        Logger.log('info', 'role', 'validate-restrictions', 'Allowed days validated', { allowedDays });
      }
      if (typeof timezone === 'string') {
        validated.timeRestrictions.timezone = timezone;
        Logger.log('info', 'role', 'validate-restrictions', 'Timezone validated', { timezone });
      }
      if (typeof blockWeekends === 'boolean') {
        validated.timeRestrictions.blockWeekends = blockWeekends;
        Logger.log('info', 'role', 'validate-restrictions', 'Block weekends validated', { blockWeekends });
      }
      if (typeof blockHolidays === 'boolean') {
        validated.timeRestrictions.blockHolidays = blockHolidays;
        Logger.log('info', 'role', 'validate-restrictions', 'Block holidays validated', { blockHolidays });
      }
    }

    if (restrictions.ipRestrictions && typeof restrictions.ipRestrictions === 'object') {
      Logger.log('info', 'role', 'validate-restrictions', 'Validating IP restrictions');
      const ir = restrictions.ipRestrictions as Record<string, unknown>;
      const allowedIPs = ir.allowedIPs;
      const blockedIPs = ir.blockedIPs;
      const allowVPN = ir.allowVPN;

      if (allowedIPs && Array.isArray(allowedIPs)) {
        // Basic IP validation - could be enhanced with proper IP regex
        const validIPs = allowedIPs.filter(ip => typeof ip === 'string' && ip.length > 0);
        if (validIPs.length === allowedIPs.length) {
        validated.ipRestrictions.allowedIPs = allowedIPs;
          Logger.log('info', 'role', 'validate-restrictions', 'Allowed IPs validated', { count: allowedIPs.length });
        } else {
          Logger.log('warning', 'role', 'validate-restrictions', 'Some invalid IPs in allowedIPs list');
        }
      }
      if (blockedIPs && Array.isArray(blockedIPs)) {
        const validIPs = blockedIPs.filter(ip => typeof ip === 'string' && ip.length > 0);
        if (validIPs.length === blockedIPs.length) {
        validated.ipRestrictions.blockedIPs = blockedIPs;
          Logger.log('info', 'role', 'validate-restrictions', 'Blocked IPs validated', { count: blockedIPs.length });
        } else {
          Logger.log('warning', 'role', 'validate-restrictions', 'Some invalid IPs in blockedIPs list');
        }
      }
      if (typeof allowVPN === 'boolean') {
        validated.ipRestrictions.allowVPN = allowVPN;
        Logger.log('info', 'role', 'validate-restrictions', 'Allow VPN validated', { allowVPN });
      }
    }

    if (restrictions.dataRestrictions && typeof restrictions.dataRestrictions === 'object') {
      Logger.log('info', 'role', 'validate-restrictions', 'Validating data restrictions');
      const dr = restrictions.dataRestrictions as Record<string, unknown>;
      const maxRecordsPerDay = dr.maxRecordsPerDay;
      const maxExportsPerMonth = dr.maxExportsPerMonth;
      const allowedFileTypes = dr.allowedFileTypes;
      const maxFileSize = dr.maxFileSize;
      const dataRetentionDays = dr.dataRetentionDays;
      const customRules = dr.customRules;

      if (typeof maxRecordsPerDay === 'number' && maxRecordsPerDay >= 0) {
        validated.dataRestrictions.maxRecordsPerDay = maxRecordsPerDay;
        Logger.log('info', 'role', 'validate-restrictions', 'Max records per day validated', { maxRecordsPerDay });
      }
      if (typeof maxExportsPerMonth === 'number' && maxExportsPerMonth >= 0) {
        validated.dataRestrictions.maxExportsPerMonth = maxExportsPerMonth;
        Logger.log('info', 'role', 'validate-restrictions', 'Max exports per month validated', { maxExportsPerMonth });
      }
      if (allowedFileTypes && Array.isArray(allowedFileTypes)) {
        validated.dataRestrictions.allowedFileTypes = (allowedFileTypes as unknown[]).filter((t: unknown) => typeof t === 'string');
        Logger.log('info', 'role', 'validate-restrictions', 'Allowed file types validated', { count: (validated.dataRestrictions.allowedFileTypes as unknown[]).length });
      }
      if (typeof maxFileSize === 'number' && maxFileSize >= 0) {
        validated.dataRestrictions.maxFileSize = maxFileSize;
        Logger.log('info', 'role', 'validate-restrictions', 'Max file size validated', { maxFileSize });
      }
      if (typeof dataRetentionDays === 'number' && dataRetentionDays >= 0) {
        validated.dataRestrictions.dataRetentionDays = dataRetentionDays;
        Logger.log('info', 'role', 'validate-restrictions', 'Data retention days validated', { dataRetentionDays });
      }
      if (customRules && typeof customRules === 'object') {
        validated.dataRestrictions.customRules = customRules;
        Logger.log('info', 'role', 'validate-restrictions', 'Custom rules validated');
      }
    }

    if (restrictions.featureRestrictions && typeof restrictions.featureRestrictions === 'object') {
      Logger.log('info', 'role', 'validate-restrictions', 'Validating feature restrictions');
      const fr = restrictions.featureRestrictions as Record<string, unknown>;
      const allowBulkOperations = fr.allowBulkOperations;
      const allowAPIAccess = fr.allowAPIAccess;
      const allowIntegrations = fr.allowIntegrations;
      const maxApiCalls = fr.maxApiCalls;

      if (typeof allowBulkOperations === 'boolean') {
        validated.featureRestrictions.allowBulkOperations = allowBulkOperations;
        Logger.log('info', 'role', 'validate-restrictions', 'Allow bulk operations validated', { allowBulkOperations });
      }
      if (typeof allowAPIAccess === 'boolean') {
        validated.featureRestrictions.allowAPIAccess = allowAPIAccess;
        Logger.log('info', 'role', 'validate-restrictions', 'Allow API access validated', { allowAPIAccess });
      }
      if (typeof allowIntegrations === 'boolean') {
        validated.featureRestrictions.allowIntegrations = allowIntegrations;
        Logger.log('info', 'role', 'validate-restrictions', 'Allow integrations validated', { allowIntegrations });
      }
      if (typeof maxApiCalls === 'number' && maxApiCalls >= 0) {
        validated.featureRestrictions.maxApiCalls = maxApiCalls;
        Logger.log('info', 'role', 'validate-restrictions', 'Max API calls validated', { maxApiCalls });
      }
    }

    Logger.log('info', 'role', 'validate-restrictions', 'All restrictions validated successfully');
    return validated;
  }

  // Create role from template with customizations (role templates table removed - stub)
  async createRoleFromTemplate(_templateData: Record<string, unknown>): Promise<typeof customRoles.$inferSelect> {
    throw new Error('Role templates have been removed. Use application/module based role creation (getAvailablePermissions + createRole/createAdvancedRole).');
  }

  // Validate role access with context
  async validateRoleAccess(tenantId: string, roleId: string, context: ValidateRoleContext = {}): Promise<{ allowed: boolean; reason?: string; roleData?: unknown }> {

    // Get role with permissions and restrictions
    const role = await db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .limit(1);

    if (!role.length) {
      return { allowed: false, reason: 'Role not found' };
    }

    const roleData = role[0];
    const permissions = typeof roleData.permissions === 'string' ? JSON.parse(roleData.permissions) : roleData.permissions;
    const restrictions = typeof roleData.restrictions === 'string' ? JSON.parse(roleData.restrictions) : (roleData.restrictions ?? {});

    const restr = (typeof restrictions === 'object' && restrictions !== null) ? restrictions as Record<string, unknown> : {};
    const { timeOfAccess, ipAddress, requestedResource, requestedAction } = context;
    if (restr.timeRestrictions && timeOfAccess) {
      const timeCheck = this.validateTimeRestrictions(restr.timeRestrictions as Record<string, unknown>, new Date(timeOfAccess as string | Date));
      if (!timeCheck.allowed) {
        return { allowed: false, reason: timeCheck.reason };
      }
    }

    if (restr.ipRestrictions && ipAddress) {
      const ipCheck = this.validateIPRestrictions(restr.ipRestrictions as Record<string, unknown>, ipAddress as string);
      if (!ipCheck.allowed) {
        return { allowed: false, reason: ipCheck.reason };
      }
    }

    // Check permission for requested resource and action
    if (requestedResource && requestedAction) {
      const permissionCheck = this.validateResourcePermission(permissions, requestedResource, requestedAction);
      if (!permissionCheck.allowed) {
        return { allowed: false, reason: permissionCheck.reason };
      }
    }

    return { 
      allowed: true, 
      roleData: {
        name: roleData.roleName,
        permissions,
        restrictions,
        metadata: permissions.metadata || {}
      }
    };
  }

  validateTimeRestrictions(timeRestrictions: Record<string, unknown>, accessTime: Date): { allowed: boolean; reason?: string } {
    const { allowedHours, allowedDays, blockWeekends, blockHolidays } = timeRestrictions;
    
    const hour = accessTime.getHours();
    const day = accessTime.getDay(); // 0 = Sunday, 6 = Saturday

    if (Array.isArray(allowedHours) && !allowedHours.includes(hour)) {
      return { allowed: false, reason: `Access not allowed at hour ${hour}` };
    }

    if (Array.isArray(allowedDays) && !allowedDays.includes(day)) {
      return { allowed: false, reason: `Access not allowed on day ${day}` };
    }

    if (blockWeekends === true && (day === 0 || day === 6)) {
      return { allowed: false, reason: 'Access blocked on weekends' };
    }

    // TODO: Implement holiday checking
    if (blockHolidays) {
      // This would require a holiday calendar service
    }

    return { allowed: true };
  }

  validateIPRestrictions(ipRestrictions: Record<string, unknown>, ipAddress: string): { allowed: boolean; reason?: string } {
    const { allowedIPs, blockedIPs } = ipRestrictions as { allowedIPs?: string[]; blockedIPs?: string[] };

    if (blockedIPs && blockedIPs.includes(ipAddress)) {
      return { allowed: false, reason: 'IP address is blocked' };
    }

    if (allowedIPs && allowedIPs.length > 0 && !allowedIPs.includes(ipAddress)) {
      return { allowed: false, reason: 'IP address not in allowed list' };
    }

    return { allowed: true };
  }

  validateResourcePermission(permissions: Record<string, unknown>, resource: string, action: string): { allowed: boolean; reason?: string; resourcePermission?: unknown } {
    if (!(permissions as Record<string, unknown>)[resource]) {
      return { allowed: false, reason: `No permissions for resource: ${resource}` };
    }

    const resourcePermission = (permissions as Record<string, unknown>)[resource] as Record<string, unknown>;
    
    if (Array.isArray(resourcePermission.operations) && !resourcePermission.operations.includes(action)) {
      return { allowed: false, reason: `Action '${action}' not allowed for resource '${resource}'` };
    }

    const actionRequirements: Record<string, string> = {
      'view': 'read', 'read': 'read', 'create': 'write', 'edit': 'write', 'update': 'write',
      'delete': 'admin', 'manage': 'admin', 'admin': 'admin'
    };
    const requiredLevel = actionRequirements[action] ?? 'read';
    const hierarchy: Record<string, number> = { 'none': 0, 'read': 1, 'write': 2, 'admin': 3 };
    
    if ((hierarchy[String(resourcePermission.level)] ?? 0) < (hierarchy[requiredLevel] ?? 0)) {
      return { allowed: false, reason: `Insufficient permission level for action '${action}'` };
    }

    return { allowed: true, resourcePermission };
  }

  // Clone role with modifications
  async cloneRole(sourceRoleId: string, cloneData: CloneRoleData): Promise<typeof customRoles.$inferSelect> {
    const { name, description, modifications = {}, tenantId } = cloneData;

    const sourceRole = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.roleId, sourceRoleId))
      .limit(1);

    if (!sourceRole.length) {
      throw new Error('Source role not found');
    }

    const source = sourceRole[0];
    let permissions = typeof source.permissions === 'string' ? JSON.parse(source.permissions as string) : source.permissions as Record<string, unknown>;
    let restrictions = typeof source.restrictions === 'string' ? JSON.parse(source.restrictions as string) : (source.restrictions as Record<string, unknown>) ?? {};

    const mods = modifications as Record<string, unknown>;
    if (mods.addPermissions) {
      permissions = this.mergePermissions(permissions as Record<string, unknown>, mods.addPermissions as Record<string, unknown>) as Record<string, unknown>;
    }

    if (Array.isArray((modifications as Record<string, unknown>).removePermissions)) {
      ((modifications as Record<string, unknown>).removePermissions as string[]).forEach((resource: string) => {
        delete permissions[resource];
      });
    }

    if (modifications.updateRestrictions) {
      restrictions = { ...restrictions, ...modifications.updateRestrictions };
    }

    // Create cloned role
    return await this.createAdvancedRole({
      tenantId,
      name,
      description: description || `${source.roleName} (Copy)`,
      color: source.color,
      permissions,
      restrictions,
        metadata: {
          clonedFrom: sourceRoleId,
          clonedFromName: source.roleName,
          category: (permissions as Record<string, unknown>).metadata && typeof (permissions as Record<string, unknown>).metadata === 'object' ? ((permissions as Record<string, unknown>).metadata as Record<string, unknown>).category : undefined
        }
    });
  }

  async getRoleAnalytics(tenantId: string, roleId: string, options: RoleAnalyticsOptions = {}): Promise<{ usage: { totalUsers: number; activeUsers: number }; permissionUsage: unknown[]; period: string; generatedAt: string }> {
    const { period = 'month', includeAudit = false } = options;

    const [totalResult, activeResult] = await Promise.all([
      db.select({ totalUsers: count(userRoleAssignments.id) }).from(userRoleAssignments).where(eq(userRoleAssignments.roleId, roleId)),
      db.select({ activeUsers: count(userRoleAssignments.id) }).from(userRoleAssignments).where(and(eq(userRoleAssignments.roleId, roleId), eq(userRoleAssignments.isActive, true)))
    ]);

    const totalUsers = Number(totalResult[0]?.totalUsers ?? 0);
    const activeUsers = Number(activeResult[0]?.activeUsers ?? 0);
    const permissionUsage: unknown[] = includeAudit ? [] : [];

    return {
      usage: { totalUsers, activeUsers },
      permissionUsage,
      period,
      generatedAt: new Date().toISOString()
    };
  }

  async bulkRoleOperation(tenantId: string, operation: string, roleIds: string[], options: BulkRoleOptions = {}, userId: string): Promise<{ successful: unknown[]; failed: unknown[]; summary: { total: number; success: number; failure: number } }> {
    const results = {
      successful: [] as unknown[],
      failed: [] as unknown[],
      summary: { total: roleIds.length, success: 0, failure: 0 }
    };

    for (const rid of roleIds) {
      try {
        let result: unknown;
        switch (operation) {
          case 'delete':
            result = await this.deleteRole(tenantId, rid, {
              force: options.force as boolean,
              transferUsersTo: options.transferUsersTo as string | undefined,
              deletedBy: userId
            });
            break;
          case 'activate':
          case 'deactivate':
            result = await this.updateAdvancedRole(tenantId, rid, {
              isActive: operation === 'activate',
              updatedBy: userId
            });
            break;
          case 'export':
            result = await this.exportRole(tenantId, rid);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        results.successful.push({ roleId: rid, result });
        results.summary.success++;
      } catch (err: unknown) {
        const error = err as Error;
        results.failed.push({ roleId: rid, error: error.message });
        results.summary.failure++;
      }
    }
    return results;
  }

  async exportRole(tenantId: string, roleId: string): Promise<Record<string, unknown>> {
    const role = await db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .limit(1);

    if (!role.length) {
      throw new Error('Role not found');
    }

    const roleData = role[0];
    
    const perms = typeof roleData.permissions === 'string' ? JSON.parse(roleData.permissions as string) : roleData.permissions;
    const restr = typeof roleData.restrictions === 'string' ? JSON.parse(roleData.restrictions as string) : roleData.restrictions;
    return {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      role: {
        name: roleData.roleName,
        description: roleData.description,
        color: roleData.color,
        permissions: perms,
        restrictions: restr ?? {},
        metadata: { isSystemRole: roleData.isSystemRole, priority: roleData.priority }
      }
    };
  }

  async updateAdvancedRole(tenantId: string, roleId: string, updateData: AdvancedRoleUpdateData): Promise<typeof customRoles.$inferSelect> {
    const { 
      name, 
      description, 
      color, 
      icon,
      permissions, 
      restrictions, 
      inheritance,
      metadata,
      updatedBy,
      allowAdvancedUpdate = false // Flag to explicitly allow advanced updates on custom roles
    } = updateData;
    
    try {
      Logger.log('info', 'role', 'update-advanced-role', 'updateAdvancedRole called', {
        tenantId,
        roleId,
        name,
        description,
        color,
        hasPermissions: !!permissions,
        hasRestrictions: !!restrictions,
        hasInheritance: !!inheritance,
        hasMetadata: !!metadata,
        updatedBy,
        allowAdvancedUpdate
      });
    
    // Get existing role
    const existingRole = await db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .limit(1);

    if (!existingRole.length) {
        Logger.log('error', 'role', 'update-advanced-role', 'Role not found', { roleId });
      throw new Error('Role not found');
    }

      Logger.log('info', 'role', 'update-advanced-role', 'Found existing role', {
        roleId: existingRole[0].roleId,
        name: existingRole[0].roleName,
        isSystemRole: existingRole[0].isSystemRole
      });

    if (existingRole[0].isSystemRole) {
        Logger.log('error', 'role', 'update-advanced-role', 'Attempted to modify system role', { roleId });
      throw new Error('Cannot modify system roles');
    }

    // Check if this role was created by CustomRoleService (array permissions)
    // and prevent accidental corruption unless explicitly allowed
    if (permissions && !allowAdvancedUpdate) {
      try {
        const raw = existingRole[0].permissions;
        const existingPermissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const isArrayBasedRole = Array.isArray(existingPermissions);

        if (isArrayBasedRole) {
          Logger.log('warning', 'role', 'update-advanced-role', 'Detected CustomRoleService role (array permissions) — preventing advanced update to avoid corruption. Use CustomRoleService.updateRoleFromAppsAndModules() or set allowAdvancedUpdate=true');
          throw new Error('This role was created using the application/module builder. Use the custom role update API or set allowAdvancedUpdate=true to override this protection.');
        }
      } catch (_parseError) {
        Logger.log('warning', 'role', 'update-advanced-role', 'Could not parse existing permissions, proceeding with update');
      }
    }

    // Check name uniqueness if name is being changed
    if (name && name !== existingRole[0].roleName) {
        Logger.log('info', 'role', 'update-advanced-role', 'Checking name uniqueness', { name });
      const nameExists = await db
        .select({ roleId: customRoles.roleId })
        .from(customRoles)
        .where(
          and(
            eq(customRoles.tenantId, tenantId),
            eq(customRoles.roleName, name),
            ne(customRoles.roleId, roleId)
          )
        )
        .limit(1);

      if (nameExists.length > 0) {
          Logger.log('error', 'role', 'update-advanced-role', 'Role name already exists', { name });
        throw new Error(`Role with name "${name}" already exists`);
      }
        Logger.log('info', 'role', 'update-advanced-role', 'Role name is unique');
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date()
    };

      if (name) {
        updates.roleName = name;
        Logger.log('info', 'role', 'update-advanced-role', 'Updating role name', { name });
      }
      if (description !== undefined) {
        updates.description = description;
        Logger.log('info', 'role', 'update-advanced-role', 'Updating description');
      }
      if (color) {
        updates.color = color;
        Logger.log('info', 'role', 'update-advanced-role', 'Updating color', { color });
      }

    if (permissions) {
        Logger.log('info', 'role', 'update-advanced-role', 'Processing permissions update');
        try {
      let effectivePermissions: unknown = permissions;
      const inh = inheritance as Record<string, unknown> | undefined;
      if (inh?.parentRoles && Array.isArray(inh.parentRoles) && inh.parentRoles.length > 0) {
            Logger.log('info', 'role', 'update-advanced-role', 'Processing inheritance for parent roles', { parentRoles: inh.parentRoles });
        effectivePermissions = await this.processRoleInheritance(tenantId, permissions as Record<string, unknown>, inh);
            Logger.log('info', 'role', 'update-advanced-role', 'Inheritance processed successfully');
      }

          Logger.log('info', 'role', 'update-advanced-role', 'Validating permission structure');
      const validatedPermissions = await this.validatePermissionStructure(effectivePermissions) as Record<string, unknown>;
          Logger.log('info', 'role', 'update-advanced-role', 'Permissions validated successfully');

          if (!validatedPermissions || Object.keys(validatedPermissions).length === 0) {
            Logger.log('error', 'role', 'update-advanced-role', 'validatePermissionStructure returned empty result');
            throw new Error('Permission validation resulted in empty permissions. This would corrupt the role.');
          }

          const rawPerms = existingRole[0].permissions;
          const existingPermissions = (typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms) as Record<string, unknown>;
          const existingMeta = (existingPermissions.metadata ?? {}) as Record<string, unknown>;

      updates.permissions = {
        ...validatedPermissions,
        metadata: {
          ...existingMeta,
          icon: icon ?? existingMeta.icon,
          inheritance: inheritance ?? existingMeta.inheritance,
          ...(metadata as Record<string, unknown> ?? {})
        }
      };
          Logger.log('info', 'role', 'update-advanced-role', 'Permissions formatted for storage');
        } catch (err: unknown) {
          const permissionError = err as Error;
          Logger.log('error', 'role', 'update-advanced-role', 'Permission processing failed', { error: permissionError.message });
          throw new Error(`Permission validation failed: ${permissionError.message}`);
        }
    }

    if (restrictions !== undefined) {
        Logger.log('info', 'role', 'update-advanced-role', 'Processing restrictions update');
        try {
      const validatedRestrictions = await this.validateRestrictions(restrictions as RestrictionInput);
      updates.restrictions = validatedRestrictions;
          Logger.log('info', 'role', 'update-advanced-role', 'Restrictions validated and formatted');
        } catch (err: unknown) {
          const restrictionError = err as Error;
          Logger.log('error', 'role', 'update-advanced-role', 'Restriction processing failed', { error: restrictionError.message });
          throw new Error(`Restriction validation failed: ${restrictionError.message}`);
        }
    }

      Logger.log('info', 'role', 'update-advanced-role', 'Updating role in database');
    const updatedRole = await db
      .update(customRoles)
      .set(updates as Partial<typeof customRoles.$inferInsert>)
      .where(
        and(
          eq(customRoles.tenantId, tenantId),
          eq(customRoles.roleId, roleId)
        )
      )
      .returning();

      if (!updatedRole.length) {
        Logger.log('error', 'role', 'update-advanced-role', 'No rows updated in database');
        throw new Error('Failed to update role - no rows affected');
      }

      Logger.log('info', 'role', 'update-advanced-role', 'Role updated successfully in database');

    // Log the update
      try {
    await this.logAuditEvent({
      tenantId,
      userId: updatedBy ?? SYSTEM_ACTOR_UUID,
      action: 'advanced_role_updated',
      resourceType: 'role',
      resourceId: String(roleId),
      oldValues: existingRole[0],
      newValues: updates
    });
        Logger.log('info', 'role', 'update-advanced-role', 'Audit event logged');
      } catch (auditError) {
        Logger.log('error', 'role', 'update-advanced-role', 'Failed to log audit event', { error: (auditError as Error).message });
        // Don't fail the entire operation for audit logging
      }

      // Publish role update event to AWS MQ
      try {
        const row = updatedRole[0] as typeof customRoles.$inferSelect;
        await snsSqsPublisher.publishRoleEventToSuite('role_updated', tenantId, row.roleId, {
          roleId: row.roleId,
          roleName: row.roleName,
          description: row.description,
          permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions as string) : row.permissions,
          restrictions: typeof row.restrictions === 'string' ? JSON.parse(row.restrictions as string) : row.restrictions,
          updatedBy: updatedBy ?? 'system',
          updatedAt: (row.updatedAt ?? new Date()).toISOString()
        });
        Logger.log('info', 'role', 'update-advanced-role', 'Published role_updated event to AWS MQ');
      } catch (err: unknown) {
        const publishError = err as Error;
        Logger.log('warning', 'role', 'update-advanced-role', 'Failed to publish role_updated event', { error: publishError.message });
      }

      Logger.log('info', 'role', 'update-advanced-role', 'updateAdvancedRole completed successfully');
    return updatedRole[0] as typeof customRoles.$inferSelect;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'role', 'update-advanced-role', 'updateAdvancedRole failed', {
        error: error.message,
        tenantId,
        roleId,
        hasPermissions: !!permissions,
        hasRestrictions: !!restrictions,
        hasInheritance: !!inheritance
      });
      throw error;
    }
  }

  async getAvailablePermissionIds(): Promise<Set<string>> {
    const availablePermissionIds = new Set<string>();
    try {
      const availablePermissionsResponse = await this.getAvailablePermissions();
      if (availablePermissionsResponse?.applications && Array.isArray(availablePermissionsResponse.applications)) {
        (availablePermissionsResponse.applications as Array<{ modules?: Array<{ operations?: Array<{ id: string }> }> }>).forEach((app) => {
          app.modules?.forEach((mod) => {
            mod.operations?.forEach((op) => availablePermissionIds.add(op.id));
          });
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'role', 'get-available-permission-ids', 'Could not load available permissions for validation', { error: error.message });
    }
    return availablePermissionIds;
  }

  // Additional methods as needed...
}

export default new PermissionService(); 