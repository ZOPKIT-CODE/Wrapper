import { db } from '../../../db/index.js';
import { customRoles, userRoleAssignments } from '../../../db/schema/core/permissions.js';
import { tenantUsers, auditLogs } from '../../../db/schema/core/users.js';
import { organizationMemberships } from '../../../db/schema/organizations/organization_memberships.js';
import { eq, and, like, desc, count, or, ne, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
// Static imports — avoids repeated module-resolution overhead on every request.
import { amazonMQPublisher } from '../../messaging/utils/amazon-mq-publisher.js';
import { CRM_PERMISSION_MATRIX, CRM_SPECIAL_PERMISSIONS } from '../../../data/comprehensive-crm-permissions.js';
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
    // Convert realistic permissions to frontend format
    const crmModules: Record<string, ModuleDisplay> = {};
    
    Object.entries(CRM_PERMISSION_MATRIX).forEach(([moduleKey, modulePermissions]: [string, Record<string, string>]) => {
      const moduleKeyUpper = moduleKey.toUpperCase();
      
      crmModules[moduleKeyUpper] = {
        name: this.getModuleDisplayName(moduleKey),
        description: this.getModuleDescription(moduleKey),
        operations: Object.entries(modulePermissions).map(([permissionKey, description]: [string, string]) => ({
          id: permissionKey,
          name: this.getOperationDisplayName(permissionKey),
          description: description,
          level: this.getPermissionLevel(permissionKey)
        }))
      };
    });
    
    // Add special permissions module
    crmModules.SPECIAL = {
      name: 'Special Permissions',
      description: 'Cross-module administrative permissions',
      operations: Object.entries(CRM_SPECIAL_PERMISSIONS as Record<string, string>).map(([permissionKey, description]: [string, string]) => ({
        id: permissionKey,
        name: this.getOperationDisplayName(permissionKey),
        description: description,
        level: 'advanced'
      }))
    };

    const applicationStructure: Record<string, { name: string; description: string; icon: string; color: string; modules: Record<string, ModuleDisplay> }> = {
      CRM: {
        name: 'Customer Relationship Management',
        description: 'Realistic B2B CRM with 16 modules and 107 permissions',
        icon: '💼',
        color: '#3B82F6',
        modules: crmModules
      }
    };

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

    console.log('📊 Permission Structure Summary:');
    console.log(`🏢 Total Applications: ${summary.applicationCount}`);
    console.log(`📦 Total Modules: ${summary.moduleCount}`);
    console.log(`⚡ Total Operations: ${summary.operationCount}`);
    
    applications.forEach(app => {
      console.log(`  📱 ${app.name}: ${app.moduleCount} modules, ${app.operationCount} operations`);
    });

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
    
    console.log('🔍 getTenantRoles called with:', { tenantId, options });
    
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

    console.log('🔍 Query built, checking for roles with tenantId:', tenantId);

    // Get total count
    const countQuery = db
      .select({ count: count() })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));

    console.log('🔍 Executing queries...');
    
    const [roleResults, countResult] = await Promise.all([
      query
        .orderBy(desc(customRoles.priority), desc(customRoles.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      countQuery
    ]);

    const totalCount = Number(countResult[0]?.count ?? 0);
    console.log('🔍 Query results:', {
      roleResultsCount: roleResults.length,
      countResult: totalCount,
      firstRole: roleResults[0] ?? 'No roles found'
    });

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
      await amazonMQPublisher.publishRoleEventToSuite('role_updated', tenantId, row.roleId, {
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

      console.log('📡 Published role_updated event to Redis streams');

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
      const result = await amazonMQPublisher.publishInterAppEvent({
        eventType: 'role_permissions_changed',
        sourceApplication: 'wrapper',
        targetApplication: 'crm',
        tenantId: tenantId,
        entityId: roleId,
        eventData: eventData
      });

      console.log(`📡 Published role permissions change event for role "${roleId}" to AWS MQ`);
      console.log(`   Event ID: ${result?.eventId}`);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('⚠️ Failed to publish role change event:', error.message);
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
    affectedUserIds.forEach(invalidateRoleCache);

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
    
    console.log('🔒 [PermissionService] Role assignment request:', {
      userId,
      roleId,
      assignedBy,
      tenantId,
      hasExpiration: !!expiresAt
    });
    
    console.log('🔒 [PermissionService] Role assignment request:', {
      userId,
      roleId,
      assignedBy,
      tenantId,
      hasExpiration: !!expiresAt
    });
    
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
      console.log('🔄 [PermissionService] Updating existing role assignment:', {
        existingAssignmentId: existing[0].id,
        wasActive: existing[0].isActive
      });
      
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

      console.log('✅ [PermissionService] Role assignment updated successfully');
      invalidateRoleCache(userId);
      
      // Publish role assignment event (reassignment)
      try {
        await amazonMQPublisher.publishRoleEventToSuite('role_assigned', tenantId, roleId, {
          assignmentId: updated[0].id ?? '',
          userId: userId,
          roleId: roleId,
          assignedAt: new Date().toISOString(),
          assignedBy: assignedBy,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          entityId: (updated[0] as { organizationId?: string }).organizationId
        });
        console.log('📡 Published role reassignment event successfully');
      } catch (err: unknown) {
        const error = err as Error;
        console.warn('⚠️ Failed to publish role reassignment event:', error.message);
      }
      
      return updated[0];
    }

    // Create new assignment - 'id' is auto-generated by schema
    console.log('➕ [PermissionService] Creating new role assignment');
    
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

    console.log('✅ [PermissionService] New role assignment created successfully');
    invalidateRoleCache(userId);
    
    // Publish role assignment event
    try {
      await amazonMQPublisher.publishRoleEventToSuite('role_assigned', tenantId, roleId, {
        assignmentId: assignment[0].id,
        userId: userId,
        roleId: roleId,
        assignedAt: new Date().toISOString(),
        assignedBy: assignedBy,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        entityId: (assignment[0] as { organizationId?: string }).organizationId
      });
      console.log('📡 Published role assignment event successfully');
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('⚠️ Failed to publish role assignment event:', error.message);
    }
    
    return assignment[0];
  }

  // Remove role assignment
  async removeRoleAssignment(tenantId: string, userId: string, roleId: string, removedBy: string): Promise<{ success: boolean; assignmentId: string }> {
    console.log('🔒 [PermissionService] Role removal request:', {
      userId,
      roleId,
      removedBy,
      tenantId
    });
    
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

    console.log('✅ [PermissionService] Role assignment removed successfully');
    invalidateRoleCache(userId);
    
    // Publish role unassignment event
    try {
      await amazonMQPublisher.publishRoleEventToSuite('role_unassigned', tenantId, roleId, {
        assignmentId: assignment.id ?? '',
        userId: userId,
        roleId: roleId,
        unassignedAt: new Date().toISOString(),
        unassignedBy: removedBy,
        reason: 'Manual removal'
      });
      console.log('📡 Published role unassignment event successfully');
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('⚠️ Failed to publish role unassignment event:', error.message);
    }

    return { success: true, assignmentId: assignment.id ?? '' };
  }

  // Remove role assignment by assignmentId
  async removeRoleAssignmentById(tenantId: string, assignmentId: string, removedBy: string): Promise<{ success: boolean; assignmentId: string }> {
    console.log('🔒 [PermissionService] Role removal by assignmentId request:', {
      assignmentId,
      removedBy,
      tenantId
    });
    
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

    console.log('✅ [PermissionService] Role assignment removed successfully');
    invalidateRoleCache(assignment.userId);
    
    // Publish role unassignment event
    try {
      await amazonMQPublisher.publishRoleEventToSuite('role_unassigned', tenantId, assignment.roleId, {
        assignmentId: assignment.id, // Use 'id' as assignmentId in event
        userId: assignment.userId,
        roleId: assignment.roleId,
        unassignedAt: new Date().toISOString(),
        unassignedBy: removedBy,
        reason: 'Manual removal'
      });
      console.log('📡 Published role unassignment event successfully');
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('⚠️ Failed to publish role unassignment event:', error.message);
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
    console.log('🧬 processRoleInheritance called with:', {
      tenantId,
      hasBasePermissions: !!basePermissions,
      inheritance
    });

    const { parentRoles, inheritanceMode = 'additive', priority = 0 } = inheritance;
    
    if (!parentRoles || !Array.isArray(parentRoles) || parentRoles.length === 0) {
      console.log('⚠️ No parent roles specified, returning base permissions');
      return basePermissions || {};
    }

    console.log('🔍 Fetching parent roles:', parentRoles);

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

      console.log(`📋 Found ${parents.length} parent roles out of ${parentRoles.length} requested`);

      if (parents.length === 0) {
        console.log('⚠️ No parent roles found, returning base permissions');
        return basePermissions || {};
      }

    if (parents.length !== parentRoles.length) {
        const foundRoleIds = parents.map(p => p.roleId);
        const missingRoleIds = parentRoles.filter(id => !foundRoleIds.includes(id));
        console.log('⚠️ Some parent roles not found:', missingRoleIds);
        // Don't throw error, just continue with found roles
    }

    // Sort by priority (higher priority = more important)
    parents.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      console.log('📊 Parent roles sorted by priority:', parents.map(p => ({ name: p.roleName, priority: p.priority })));

      let effectivePermissions = basePermissions ? { ...basePermissions } : {};
      console.log('🏁 Starting inheritance processing with mode:', inheritanceMode);

      parents.forEach((parent, index) => {
        try {
          console.log(`🔄 Processing parent role ${index + 1}/${parents.length}: ${parent.roleName}`);
          
          let parentPermissions: Record<string, unknown> = {};
          if (parent.permissions) {
            try {
              parentPermissions = (typeof parent.permissions === 'string' ? JSON.parse(parent.permissions as string) : parent.permissions) as Record<string, unknown>;
              if (parentPermissions.metadata) {
                delete parentPermissions.metadata;
              }
              console.log(`📝 Parsed permissions for ${parent.roleName}:`, Object.keys(parentPermissions));
            } catch (parseError) {
              console.error(`❌ Failed to parse permissions for parent role ${parent.roleName}:`, parseError);
              return; // Skip this parent role
            }
          }
      
      switch (inheritanceMode) {
        case 'additive':
              console.log(`➕ Applying additive inheritance from ${parent.roleName}`);
          effectivePermissions = this.mergePermissions(effectivePermissions as Record<string, unknown>, parentPermissions);
          break;
        case 'restrictive':
              console.log(`🔒 Applying restrictive inheritance from ${parent.roleName}`);
          effectivePermissions = this.intersectPermissions(effectivePermissions as Record<string, unknown>, parentPermissions);
          break;
        case 'override':
              console.log(`🔄 Applying override inheritance from ${parent.roleName}`);
          effectivePermissions = { ...parentPermissions, ...(effectivePermissions as Record<string, unknown>) };
          break;
            default:
              console.log(`⚠️ Unknown inheritance mode: ${inheritanceMode}, using additive`);
          effectivePermissions = this.mergePermissions(effectivePermissions as Record<string, unknown>, parentPermissions);
          }
          
          console.log(`✅ Processed inheritance from ${parent.roleName}, current permissions:`, Object.keys(effectivePermissions));
        } catch (parentError) {
          console.error(`❌ Error processing parent role ${parent.roleName}:`, parentError);
          // Continue with other parent roles
        }
      });

      console.log('🎉 Role inheritance processing completed successfully');
      console.log('📊 Final effective permissions:', Object.keys(effectivePermissions));
    return effectivePermissions;
    } catch (error) {
      console.error('🚨 Error in processRoleInheritance:', error);
      console.log('🔄 Falling back to base permissions');
      return basePermissions || {};
    }
  }

  // Helper method to merge permissions (additive inheritance)
  mergePermissions(basePermissions: Record<string, unknown> | undefined, parentPermissions: Record<string, unknown> | undefined): Record<string, unknown> {
    console.log('🔀 Merging permissions - base keys:', Object.keys(basePermissions || {}));
    console.log('🔀 Merging permissions - parent keys:', Object.keys(parentPermissions || {}));
    
    const merged: Record<string, unknown> = { ...(basePermissions || {}) };
    
    Object.keys(parentPermissions || {}).forEach((resource: string) => {
      const parentPerm = (parentPermissions as Record<string, unknown>)[resource] as Record<string, unknown>;
      const basePerm = merged[resource] as Record<string, unknown> | undefined;
      
      if (!basePerm) {
        // Resource doesn't exist in base, add it from parent
        merged[resource] = { ...parentPerm };
        console.log(`➕ Added new resource from parent: ${resource}`);
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
        
        console.log(`🔀 Merged resource: ${resource}, level: ${higherLevel}, scope: ${broaderScope}`);
      }
    });
    
    console.log('✅ Permissions merged successfully - final keys:', Object.keys(merged));
    return merged;
  }

  // Helper method to intersect permissions (restrictive inheritance)
  intersectPermissions(basePermissions: Record<string, unknown> | undefined, parentPermissions: Record<string, unknown> | undefined): Record<string, unknown> {
    console.log('🔒 Intersecting permissions - base keys:', Object.keys(basePermissions || {}));
    console.log('🔒 Intersecting permissions - parent keys:', Object.keys(parentPermissions || {}));
    
    const intersected: Record<string, unknown> = {};
    
    Object.keys(basePermissions || {}).forEach((resource: string) => {
      const basePerm = (basePermissions as Record<string, unknown>)[resource] as Record<string, unknown>;
      const parentPerm = (parentPermissions as Record<string, unknown>)[resource] as Record<string, unknown>;
      
      if (!parentPerm) {
        // Resource doesn't exist in parent, exclude it
        console.log(`❌ Excluded resource not in parent: ${resource}`);
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
      
      console.log(`🔒 Intersected resource: ${resource}, level: ${lowerLevel}, scope: ${narrowerScope}, ops: ${commonOps.length}`);
    });
    
    console.log('✅ Permissions intersected successfully - final keys:', Object.keys(intersected));
    return intersected;
  }

  // Validate permission structure
  async validatePermissionStructure(permissions: unknown): Promise<Record<string, unknown>> {
    console.log('🔍 validatePermissionStructure called with type:', typeof permissions, 'keys:', Array.isArray(permissions) ? permissions.length + ' items' : Object.keys(permissions || {}));
    
    if (!permissions) {
      console.log('⚠️ No permissions provided');
      return {};
    }

    // Handle array format (from role builder/custom role service)
    if (Array.isArray(permissions)) {
      console.log('🔄 Converting array permissions to structured format');
      return this.convertArrayPermissionsToStructured(permissions);
    }

    // Handle object format (advanced role structure)
    if (typeof permissions !== 'object') {
      console.log('⚠️ Invalid permissions type');
      return {};
    }

    // Check if this is a mis-formatted array (array converted to object with numeric keys)
    const keys = Object.keys(permissions as Record<string, unknown>);
    const isArrayAsObject = keys.length > 0 && keys.every(key => /^\d+$/.test(key)) && keys.every(key => Array.isArray((permissions as Record<string, unknown>)[key]));
    
    if (isArrayAsObject) {
      console.log('🔄 Detected array-as-object format, converting back to array...');
      const arrayPermissions: unknown[] = [];
      keys.forEach((key: string) => {
        arrayPermissions.push(...((permissions as Record<string, unknown>)[key] as unknown[]));
      });
      return this.convertArrayPermissionsToStructured(arrayPermissions);
    }

    // Get available permissions for validation
    const availablePermissionIds = await this.getAvailablePermissionIds();
    console.log('📋 Available permission IDs count:', availablePermissionIds.size);

    const validatedPermissions: Record<string, unknown> = {};

    Object.keys(permissions as Record<string, unknown>).forEach((resource: string) => {
      const permission = (permissions as Record<string, unknown>)[resource];
      
      // Skip metadata and other non-permission objects
      if (resource === 'metadata' || resource === 'inheritance' || resource === 'restrictions') {
        console.log(`⏭️ Skipping non-permission object: ${resource}`);
        return;
      }
      
      console.log(`🔍 Validating resource: ${resource}`, permission);

      if (!permission || typeof permission !== 'object') {
        console.log(`⚠️ Skipping invalid permission for resource: ${resource}`);
        return;
      }
      
      const validLevels = ['none', 'read', 'write', 'admin'];
      const permLevel = (permission as Record<string, unknown>).level as string;
      if (!permLevel || !validLevels.includes(permLevel)) {
        console.log(`❌ Invalid permission level: ${permLevel} for resource: ${resource}`);
        throw new Error(`Invalid permission level: ${permLevel} for resource: ${resource}`);
      }

      // Validate operations exist (only if we have available permissions)
      if ((permission as Record<string, unknown>).operations && Array.isArray((permission as Record<string, unknown>).operations) && availablePermissionIds.size > 0) {
        const invalidOps = ((permission as Record<string, unknown>).operations as string[]).filter((op: string) => !availablePermissionIds.has(op));
        if (invalidOps.length > 0) {
          console.log(`⚠️ Some operations not in available permissions for ${resource}:`, invalidOps);
          // Don't throw error, just log warning for now
          // throw new Error(`Invalid operations for ${resource}: ${invalidOps.join(', ')}`);
        }
      }

      const validScopes = ['own', 'team', 'department', 'zone', 'all'];
      const permScope = (permission as Record<string, unknown>).scope as string;
      if (permScope && !validScopes.includes(permScope)) {
        console.log(`❌ Invalid permission scope: ${permScope} for resource: ${resource}`);
        throw new Error(`Invalid permission scope: ${permScope} for resource: ${resource}`);
      }

      const perm = permission as Record<string, unknown>;
      validatedPermissions[resource] = {
        level: perm.level,
        operations: Array.isArray(perm.operations) ? perm.operations : [],
        scope: perm.scope || 'own',
        conditions: perm.conditions || {}
      };

      console.log(`✅ Validated permission for ${resource}:`, validatedPermissions[resource]);
    });

    console.log('✅ All permissions validated successfully. Final count:', Object.keys(validatedPermissions).length);
    return validatedPermissions;
  }

  // Convert array permissions to structured format
  convertArrayPermissionsToStructured(permissionArray: unknown[]): Record<string, unknown> {
    console.log('🔄 Converting permission array to structured format:', permissionArray.length, 'permissions');
    
    const structured: Record<string, unknown> = {};
    const groupedPermissions: Record<string, string[]> = {};

    permissionArray.forEach((permission: unknown) => {
      if (typeof permission === 'string') {
        const parts = permission.split('.');
        if (parts.length >= 3) {
          const [app, module, ...actionParts] = parts;
          const action = actionParts.join('.');
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

      console.log(`✅ Converted ${resourceKey}: ${operations.length} operations, level: ${level}`);
    });

    console.log('🎉 Array to structured conversion completed:', Object.keys(structured).length, 'resources');
    return structured;
  }

  // Validate restrictions
  async validateRestrictions(restrictions: RestrictionInput | null | undefined): Promise<Record<string, unknown>> {
    console.log('🔍 validateRestrictions called with:', restrictions);
    
    if (!restrictions || typeof restrictions !== 'object') {
      console.log('⚠️ No restrictions provided or invalid type, returning default structure');
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
      console.log('🕐 Validating time restrictions...');
      const tr = restrictions.timeRestrictions as Record<string, unknown>;
      const allowedHours = tr.allowedHours;
      const allowedDays = tr.allowedDays;
      const timezone = tr.timezone;
      const blockWeekends = tr.blockWeekends;
      const blockHolidays = tr.blockHolidays;
      
      if (allowedHours !== undefined) {
        if (!Array.isArray(allowedHours) || (allowedHours as unknown[]).some((h: unknown) => typeof h !== 'number' || (h as number) < 0 || (h as number) > 23)) {
          console.log('❌ Invalid allowed hours:', allowedHours);
          throw new Error('Invalid allowed hours. Must be array of integers 0-23');
        }
        validated.timeRestrictions.allowedHours = allowedHours;
        console.log('✅ Allowed hours validated:', allowedHours);
      }

      if (allowedDays !== undefined) {
        if (!Array.isArray(allowedDays) || (allowedDays as unknown[]).some((d: unknown) => typeof d !== 'number' || (d as number) < 0 || (d as number) > 6)) {
          console.log('❌ Invalid allowed days:', allowedDays);
          throw new Error('Invalid allowed days. Must be array of integers 0-6');
        }
        validated.timeRestrictions.allowedDays = allowedDays;
        console.log('✅ Allowed days validated:', allowedDays);
      }
      if (typeof timezone === 'string') {
        validated.timeRestrictions.timezone = timezone;
        console.log('✅ Timezone validated:', timezone);
      }
      if (typeof blockWeekends === 'boolean') {
        validated.timeRestrictions.blockWeekends = blockWeekends;
        console.log('✅ Block weekends validated:', blockWeekends);
      }
      if (typeof blockHolidays === 'boolean') {
        validated.timeRestrictions.blockHolidays = blockHolidays;
        console.log('✅ Block holidays validated:', blockHolidays);
      }
    }

    if (restrictions.ipRestrictions && typeof restrictions.ipRestrictions === 'object') {
      console.log('🌐 Validating IP restrictions...');
      const ir = restrictions.ipRestrictions as Record<string, unknown>;
      const allowedIPs = ir.allowedIPs;
      const blockedIPs = ir.blockedIPs;
      const allowVPN = ir.allowVPN;
      
      if (allowedIPs && Array.isArray(allowedIPs)) {
        // Basic IP validation - could be enhanced with proper IP regex
        const validIPs = allowedIPs.filter(ip => typeof ip === 'string' && ip.length > 0);
        if (validIPs.length === allowedIPs.length) {
        validated.ipRestrictions.allowedIPs = allowedIPs;
          console.log('✅ Allowed IPs validated:', allowedIPs.length);
        } else {
          console.log('⚠️ Some invalid IPs in allowedIPs list');
        }
      }
      if (blockedIPs && Array.isArray(blockedIPs)) {
        const validIPs = blockedIPs.filter(ip => typeof ip === 'string' && ip.length > 0);
        if (validIPs.length === blockedIPs.length) {
        validated.ipRestrictions.blockedIPs = blockedIPs;
          console.log('✅ Blocked IPs validated:', blockedIPs.length);
        } else {
          console.log('⚠️ Some invalid IPs in blockedIPs list');
        }
      }
      if (typeof allowVPN === 'boolean') {
        validated.ipRestrictions.allowVPN = allowVPN;
        console.log('✅ Allow VPN validated:', allowVPN);
      }
    }

    if (restrictions.dataRestrictions && typeof restrictions.dataRestrictions === 'object') {
      console.log('📊 Validating data restrictions...');
      const dr = restrictions.dataRestrictions as Record<string, unknown>;
      const maxRecordsPerDay = dr.maxRecordsPerDay;
      const maxExportsPerMonth = dr.maxExportsPerMonth;
      const allowedFileTypes = dr.allowedFileTypes;
      const maxFileSize = dr.maxFileSize;
      const dataRetentionDays = dr.dataRetentionDays;
      const customRules = dr.customRules;
      
      if (typeof maxRecordsPerDay === 'number' && maxRecordsPerDay >= 0) {
        validated.dataRestrictions.maxRecordsPerDay = maxRecordsPerDay;
        console.log('✅ Max records per day validated:', maxRecordsPerDay);
      }
      if (typeof maxExportsPerMonth === 'number' && maxExportsPerMonth >= 0) {
        validated.dataRestrictions.maxExportsPerMonth = maxExportsPerMonth;
        console.log('✅ Max exports per month validated:', maxExportsPerMonth);
      }
      if (allowedFileTypes && Array.isArray(allowedFileTypes)) {
        validated.dataRestrictions.allowedFileTypes = (allowedFileTypes as unknown[]).filter((t: unknown) => typeof t === 'string');
        console.log('✅ Allowed file types validated:', (validated.dataRestrictions.allowedFileTypes as unknown[]).length);
      }
      if (typeof maxFileSize === 'number' && maxFileSize >= 0) {
        validated.dataRestrictions.maxFileSize = maxFileSize;
        console.log('✅ Max file size validated:', maxFileSize);
      }
      if (typeof dataRetentionDays === 'number' && dataRetentionDays >= 0) {
        validated.dataRestrictions.dataRetentionDays = dataRetentionDays;
        console.log('✅ Data retention days validated:', dataRetentionDays);
      }
      if (customRules && typeof customRules === 'object') {
        validated.dataRestrictions.customRules = customRules;
        console.log('✅ Custom rules validated');
      }
    }

    if (restrictions.featureRestrictions && typeof restrictions.featureRestrictions === 'object') {
      console.log('⚙️ Validating feature restrictions...');
      const fr = restrictions.featureRestrictions as Record<string, unknown>;
      const allowBulkOperations = fr.allowBulkOperations;
      const allowAPIAccess = fr.allowAPIAccess;
      const allowIntegrations = fr.allowIntegrations;
      const maxApiCalls = fr.maxApiCalls;
      
      if (typeof allowBulkOperations === 'boolean') {
        validated.featureRestrictions.allowBulkOperations = allowBulkOperations;
        console.log('✅ Allow bulk operations validated:', allowBulkOperations);
      }
      if (typeof allowAPIAccess === 'boolean') {
        validated.featureRestrictions.allowAPIAccess = allowAPIAccess;
        console.log('✅ Allow API access validated:', allowAPIAccess);
      }
      if (typeof allowIntegrations === 'boolean') {
        validated.featureRestrictions.allowIntegrations = allowIntegrations;
        console.log('✅ Allow integrations validated:', allowIntegrations);
      }
      if (typeof maxApiCalls === 'number' && maxApiCalls >= 0) {
        validated.featureRestrictions.maxApiCalls = maxApiCalls;
        console.log('✅ Max API calls validated:', maxApiCalls);
      }
    }

    console.log('✅ All restrictions validated successfully');
    return validated;
  }

  // Create role from template with customizations (role templates table removed - stub)
  async createRoleFromTemplate(templateData: Record<string, unknown>): Promise<typeof customRoles.$inferSelect> {
    throw new Error('Role templates have been removed. Use application/module based role creation (getAvailablePermissions + createRole/createAdvancedRole).');
  }

  // Validate role access with context
  async validateRoleAccess(tenantId: string, roleId: string, context: ValidateRoleContext = {}): Promise<{ allowed: boolean; reason?: string; roleData?: unknown }> {
    const { userId, ipAddress, timeOfAccess, requestedResource, requestedAction } = context;

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
      console.log('🔄 updateAdvancedRole called with:', {
        tenantId,
        roleId,
        updateData: {
          name,
          description,
          color,
          hasPermissions: !!permissions,
          hasRestrictions: !!restrictions,
          hasInheritance: !!inheritance,
          hasMetadata: !!metadata,
          updatedBy,
          allowAdvancedUpdate
        }
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
        console.log('❌ Role not found:', roleId);
      throw new Error('Role not found');
    }

      console.log('✅ Found existing role:', {
        roleId: existingRole[0].roleId,
        name: existingRole[0].roleName,
        isSystemRole: existingRole[0].isSystemRole
      });

    if (existingRole[0].isSystemRole) {
        console.log('❌ Attempted to modify system role:', roleId);
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
          console.log('⚠️ Detected role created by CustomRoleService (array permissions)');
          console.log('🛡️ Preventing advanced update to avoid permission corruption');
          console.log('💡 Use CustomRoleService.updateRoleFromAppsAndModules() or set allowAdvancedUpdate=true');
          throw new Error('This role was created using the application/module builder. Use the custom role update API or set allowAdvancedUpdate=true to override this protection.');
        }
      } catch (parseError) {
        console.log('⚠️ Could not parse existing permissions, proceeding with update');
      }
    }

    // Check name uniqueness if name is being changed
    if (name && name !== existingRole[0].roleName) {
        console.log('🔍 Checking name uniqueness for:', name);
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
          console.log('❌ Role name already exists:', name);
        throw new Error(`Role with name "${name}" already exists`);
      }
        console.log('✅ Role name is unique');
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date()
    };

      if (name) {
        updates.roleName = name;
        console.log('📝 Updating role name to:', name);
      }
      if (description !== undefined) {
        updates.description = description;
        console.log('📝 Updating description');
      }
      if (color) {
        updates.color = color;
        console.log('📝 Updating color to:', color);
      }
    
    if (permissions) {
        console.log('🔐 Processing permissions update...');
        try {
      let effectivePermissions: unknown = permissions;
      const inh = inheritance as Record<string, unknown> | undefined;
      if (inh?.parentRoles && Array.isArray(inh.parentRoles) && inh.parentRoles.length > 0) {
            console.log('🧬 Processing inheritance for parent roles:', inh.parentRoles);
        effectivePermissions = await this.processRoleInheritance(tenantId, permissions as Record<string, unknown>, inh);
            console.log('✅ Inheritance processed successfully');
      }

          console.log('🔍 Validating permission structure...');
      const validatedPermissions = await this.validatePermissionStructure(effectivePermissions) as Record<string, unknown>;
          console.log('✅ Permissions validated successfully');

          if (!validatedPermissions || Object.keys(validatedPermissions).length === 0) {
            console.error('⚠️ validatePermissionStructure returned empty result');
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
          console.log('📝 Permissions formatted for storage');
        } catch (err: unknown) {
          const permissionError = err as Error;
          console.error('❌ Permission processing failed:', permissionError);
          throw new Error(`Permission validation failed: ${permissionError.message}`);
        }
    }
    
    if (restrictions !== undefined) {
        console.log('🚫 Processing restrictions update...');
        try {
      const validatedRestrictions = await this.validateRestrictions(restrictions as RestrictionInput);
      updates.restrictions = validatedRestrictions;
          console.log('✅ Restrictions validated and formatted');
        } catch (err: unknown) {
          const restrictionError = err as Error;
          console.error('❌ Restriction processing failed:', restrictionError);
          throw new Error(`Restriction validation failed: ${restrictionError.message}`);
        }
    }

      console.log('💾 Updating role in database...');
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
        console.log('❌ No rows updated in database');
        throw new Error('Failed to update role - no rows affected');
      }

      console.log('✅ Role updated successfully in database');

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
        console.log('✅ Audit event logged');
      } catch (auditError) {
        console.error('⚠️ Failed to log audit event:', auditError);
        // Don't fail the entire operation for audit logging
      }

      // Publish role update event to AWS MQ
      try {
        const row = updatedRole[0] as typeof customRoles.$inferSelect;
        await amazonMQPublisher.publishRoleEventToSuite('role_updated', tenantId, row.roleId, {
          roleId: row.roleId,
          roleName: row.roleName,
          description: row.description,
          permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions as string) : row.permissions,
          restrictions: typeof row.restrictions === 'string' ? JSON.parse(row.restrictions as string) : row.restrictions,
          updatedBy: updatedBy ?? 'system',
          updatedAt: (row.updatedAt ?? new Date()).toISOString()
        });
        console.log('📡 Published role_updated event to AWS MQ');
      } catch (err: unknown) {
        const publishError = err as Error;
        console.warn('⚠️ Failed to publish role_updated event:', publishError.message);
      }

      console.log('🎉 updateAdvancedRole completed successfully');
    return updatedRole[0] as typeof customRoles.$inferSelect;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('🚨 updateAdvancedRole failed:', {
        error: error.message,
        stack: error.stack,
        tenantId,
        roleId,
        updateData: {
          name,
          description,
          color,
          hasPermissions: !!permissions,
          hasRestrictions: !!restrictions,
          hasInheritance: !!inheritance
        }
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
      console.log('⚠️ Could not load available permissions for validation:', error.message);
    }
    return availablePermissionIds;
  }

  // Additional methods as needed...
}

export default new PermissionService(); 