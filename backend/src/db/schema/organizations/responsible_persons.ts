import { pgTable, uuid, varchar, timestamp, jsonb, boolean, text } from 'drizzle-orm/pg-core';
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

  // Responsibility Scope — application layer sets actual values; DB default is empty.
  // Hardcoded permission defaults were removed (M003): they baked business logic into
  // the schema and diverged from the RBAC system when permissions changed.
  scope: jsonb('scope').default({}),

  // Auto-Assignment Permissions — sourced from custom_roles at runtime
  autoPermissions: jsonb('auto_permissions').default({}),

  // Assignment Details
  assignedBy: uuid('assigned_by').references(() => tenantUsers.userId).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow(),
  assignmentReason: text('assignment_reason'),

  // Time-based Assignment
  isTemporary: boolean('is_temporary').default(false),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),

  // Status
  isActive: boolean('is_active').default(true),
  isConfirmed: boolean('is_confirmed').default(false), // User confirmed acceptance
  confirmedAt: timestamp('confirmed_at'),

  // Delegation Settings
  canDelegate: boolean('can_delegate').default(false),

  // Audit
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

