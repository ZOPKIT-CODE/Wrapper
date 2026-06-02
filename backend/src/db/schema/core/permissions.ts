import { type AnyPgColumn, pgTable, uuid, varchar, jsonb, boolean, timestamp, text, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantUsers } from './users.js';

export const customRoles = pgTable('custom_roles', {
  roleId: uuid('role_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity Context for Scoped Roles
  organizationId: uuid('organization_id').references(() => tenants.tenantId),
  locationId: uuid('location_id'),
  scope: varchar('scope', { length: 20 }).default('organization'), // 'global', 'organization', 'location'
  isInheritable: boolean('is_inheritable').default(true), // Can be inherited by sub-entities
  parentRoleId: uuid('parent_role_id').references((): AnyPgColumn => customRoles.roleId),

  // Role Details
  roleName: varchar('role_name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#6b7280'), // For UI display

  // IdP (Cognito) role mapping
  idpRoleId: varchar('idp_role_id', { length: 255 }),
  idpRoleKey: varchar('idp_role_key', { length: 255 }),

  // Permissions Structure
  permissions: jsonb('permissions').notNull(),

  // Advanced Restrictions
  restrictions: jsonb('restrictions').default({}),

  // Role Metadata
  isSystemRole: boolean('is_system_role').default(false),
  isDefault: boolean('is_default').default(false),
  priority: integer('priority').default(0), // For role hierarchy

  // Audit
  createdBy: uuid('created_by').references(() => tenantUsers.userId).notNull(),
  lastModifiedBy: uuid('last_modified_by').references(() => tenantUsers.userId),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Role templates table REMOVED - using application/module based role creation instead

// User role assignments
export const userRoleAssignments = pgTable('user_role_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => tenantUsers.userId).notNull(),
  roleId: uuid('role_id').references(() => customRoles.roleId, { onDelete: 'cascade' }).notNull(),

  // Entity Context for Scoped Assignments
  organizationId: uuid('organization_id').references(() => tenants.tenantId),
  locationId: uuid('location_id'),
  scope: varchar('scope', { length: 20 }).default('organization'), // 'global', 'organization', 'location'
  isResponsiblePerson: boolean('is_responsible_person').default(false), // Auto-admin flag
  inheritedFrom: uuid('inherited_from').references((): AnyPgColumn => userRoleAssignments.id),

  // Assignment Details
  assignedBy: uuid('assigned_by').references(() => tenantUsers.userId).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow(),

  // Temporary role assignments
  isTemporary: boolean('is_temporary').default(false),
  expiresAt: timestamp('expires_at'),

  // Status
  isActive: boolean('is_active').default(true),
  deactivatedAt: timestamp('deactivated_at'),
  deactivatedBy: uuid('deactivated_by').references(() => tenantUsers.userId),
});

 