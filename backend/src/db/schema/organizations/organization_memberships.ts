import { pgTable, uuid, varchar, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';
import { customRoles } from '../core/permissions.js';
import { entities } from './unified-entities.js';

// User membership across organizations and locations
export const organizationMemberships = pgTable('organization_memberships', {
  membershipId: uuid('membership_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => tenantUsers.userId, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity Membership - FIXED REFERENCES
  entityId: uuid('entity_id').references(() => entities.entityId).notNull(), // References unified entities table
  entityType: varchar('entity_type', { length: 20 }).default('organization'), // For compatibility, derived from entities table

  // Role Assignment
  roleId: uuid('role_id').references(() => customRoles.roleId),

  // Membership Details
  membershipType: varchar('membership_type', { length: 20 }).default('direct'), // 'direct', 'inherited', 'temporary'
  membershipStatus: varchar('membership_status', { length: 20 }).default('active'), // 'active', 'inactive', 'suspended', 'pending'

  // Access Control
  accessLevel: varchar('access_level', { length: 20 }).default('standard'), // 'admin', 'manager', 'standard', 'limited'
  isPrimary: boolean('is_primary').default(false), // Is this the user's primary membership for this entity type
  canAccessSubEntities: boolean('can_access_sub_entities').default(false), // Can access child organizations/locations

  // Time-based Access
  isTemporary: boolean('is_temporary').default(false),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Kolkata'),

  // Audit & Tracking
  invitedBy: uuid('invited_by').references(() => tenantUsers.userId),
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at'),

  // Metadata
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by').references(() => tenantUsers.userId).notNull(),
  updatedBy: uuid('updated_by').references(() => tenantUsers.userId),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

