import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer, text } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';

// Entity responsibility assignments
export const responsiblePersons = pgTable('responsible_persons', {
  assignmentId: uuid('assignment_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity Context
  entityType: varchar('entity_type', { length: 20 }).notNull(), // 'organization', 'location', 'tenant'
  entityId: uuid('entity_id'), // NULL for tenant-level

  // Responsible Person
  userId: uuid('user_id').references(() => tenantUsers.userId).notNull(),
  responsibilityLevel: varchar('responsibility_level', { length: 20 }).default('primary'), // 'primary', 'secondary', 'backup'

  // Responsibility Scope
  scope: jsonb('scope').default({
    creditManagement: true,
    userManagement: true,
    auditAccess: true,
    configurationManagement: true,
    reportingAccess: true
  }),

  // Auto-Assignment Permissions
  autoPermissions: jsonb('auto_permissions').default({
    canApproveTransfers: true,
    canPurchaseCredits: true,
    canManageUsers: true,
    canViewAllAuditLogs: true,
    canConfigureEntity: true,
    canGenerateReports: true
  }),

  // Notification Preferences
  notificationPreferences: jsonb('notification_preferences').default({
    creditAlerts: true,
    userActivities: true,
    systemAlerts: true,
    weeklyReports: true,
    monthlyReports: true
  }),

  // Assignment Details
  assignedBy: uuid('assigned_by').references(() => tenantUsers.userId).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow(),
  assignmentReason: text('assignment_reason'),

  // Time-based Assignment
  isTemporary: boolean('is_temporary').default(false),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  autoExpire: boolean('auto_expire').default(false),

  // Status
  isActive: boolean('is_active').default(true),
  isConfirmed: boolean('is_confirmed').default(false), // User confirmed acceptance
  confirmedAt: timestamp('confirmed_at'),

  // Delegation Settings
  canDelegate: boolean('can_delegate').default(false),
  delegationLimits: jsonb('delegation_limits').default({}),

  // Emergency Contact
  isEmergencyContact: boolean('is_emergency_contact').default(false),
  emergencyContactOrder: integer('emergency_contact_order'), // 1, 2, 3, etc.

  // Audit
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Responsibility history (for audit trails)
export const responsibilityHistory = pgTable('responsibility_history', {
  historyId: uuid('history_id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => responsiblePersons.assignmentId, { onDelete: 'cascade' }).notNull(),

  // Change Details
  changeType: varchar('change_type', { length: 50 }).notNull(), // 'assigned', 'unassigned', 'scope_changed', 'confirmed'
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  changeReason: text('change_reason'),

  // Context
  changedBy: uuid('changed_by').references(() => tenantUsers.userId).notNull(),
  changeSource: varchar('change_source', { length: 50 }).default('manual'), // 'manual', 'system', 'import'

  // Metadata
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});
