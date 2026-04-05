import { pgTable, uuid, varchar, timestamp, boolean, jsonb, text, index, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { entities } from '../organizations/unified-entities.js';

// Tenant users
export const tenantUsers = pgTable('tenant_users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  kindeUserId: varchar('kinde_user_id', { length: 255 }), // Made nullable for pending invitations
  
  // Basic Info
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),

  // Enhanced User Profile Fields
  phone: varchar('phone', { length: 50 }),

  // Multi-Entity Support
  primaryOrganizationId: uuid('primary_organization_id').references(() => entities.entityId),
  isResponsiblePerson: boolean('is_responsible_person').default(false),

  // Status
  isActive: boolean('is_active').default(true),
  isVerified: boolean('is_verified').default(false),
  isTenantAdmin: boolean('is_tenant_admin').default(false),

  // User Management (removed duplicate invitation fields)
  invitedAt: timestamp('invited_at'),
  // Note: invitationToken, invitationExpiresAt, invitationAcceptedAt moved to tenant_invitations table

  // Activity
  lastActiveAt: timestamp('last_active_at'),

  // Preferences
  preferences: jsonb('preferences').default({}), // Dashboard layout, notifications, etc.

  // Onboarding
  onboardingCompleted: boolean('onboarding_completed').default(false),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('idx_tenant_users_tenant_id').on(table.tenantId),
  emailIdx: index('idx_tenant_users_email').on(table.email),
  kindeUserIdIdx: index('idx_tenant_users_kinde_user_id').on(table.kindeUserId),
}));


// Audit logs for tracking user actions and changes
export const auditLogs = pgTable('audit_logs', {
  logId: uuid('log_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  userId: uuid('user_id').references(() => tenantUsers.userId),

  // Entity Context for Hierarchical Access
  organizationId: uuid('organization_id').references(() => tenants.tenantId),
  locationId: uuid('location_id'),
  entityType: varchar('entity_type', { length: 20 }).default('organization'), // 'organization', 'location', 'user'
  accessLevel: varchar('access_level', { length: 20 }).default('direct'), // 'direct', 'inherited', 'hierarchical'

  // Action details
  action: varchar('action', { length: 100 }).notNull(), // 'create', 'update', 'delete', 'assign', etc.
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'role', 'user', 'permission', etc.
  resourceId: varchar('resource_id', { length: 255 }), // ID of the affected resource

  // Change tracking
  oldValues: jsonb('old_values'), // Previous state of the resource
  newValues: jsonb('new_values'), // New state of the resource
  details: jsonb('details'), // Additional context or metadata

  // Request context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('idx_audit_logs_tenant_id').on(table.tenantId),
  tenantCreatedAtIdx: index('idx_audit_logs_tenant_created_at').on(table.tenantId, table.createdAt),
}));