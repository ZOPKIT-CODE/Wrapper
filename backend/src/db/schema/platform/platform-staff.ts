import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, index
} from 'drizzle-orm/pg-core';
import { tenantUsers } from '../core/users.js';

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM STAFF
//
// A platform staff member is an internal operator (e.g. support engineer,
// billing ops) who needs cross-tenant write access to a SPECIFIC set of
// operations — NOT full super-admin access.
//
// Key properties:
//   • Completely separate from the tenant user system
//   • Access is always time-limited (expiresAt is required, max 30 days)
//   • Access is revocable instantly via isActive = false
//   • Every write action is logged to platform_audit_logs (immutable)
//   • A reason is required when granting access (audit trail)
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_PERMISSIONS = [
  'credit_config:read',
  'credit_config:write',
  'org_assignments:read',
  'org_assignments:write',
] as const;

export type PlatformPermission = typeof PLATFORM_PERMISSIONS[number];

export const platformStaff = pgTable('platform_staff', {
  staffId:    uuid('staff_id').primaryKey().defaultRandom(),

  // Links to the staff member's IdP (Cognito) account.
  // They log in via the normal Cognito flow — no separate auth system needed.
  idpSub: varchar('idp_sub', { length: 255 }).notNull().unique(),
  email:       varchar('email', { length: 255 }).notNull(),
  name:        varchar('name', { length: 255 }).notNull(),

  // Comma-separated list of PlatformPermission values.
  // Stored as text array: ['credit_config:read', 'credit_config:write']
  grantedPermissions: text('granted_permissions').array().notNull(),

  // Who granted access (must be an existing super-admin tenant user).
  grantedBy:  uuid('granted_by').references(() => tenantUsers.userId).notNull(),
  grantedAt:  timestamp('granted_at').defaultNow().notNull(),

  // Access MUST expire. Max 30 days enforced in the grant endpoint.
  expiresAt:  timestamp('expires_at').notNull(),

  // Why this access was granted — required for audit trail.
  reason:     text('reason').notNull(),

  // Set to false to revoke instantly without waiting for expiry.
  isActive:   boolean('is_active').default(true).notNull(),

  revokedBy:     uuid('revoked_by').references(() => tenantUsers.userId),
  revokedAt:     timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idpSubIdx: index('idx_platform_staff_idp_sub').on(table.idpSub),
  activeIdx:      index('idx_platform_staff_active').on(table.isActive, table.expiresAt),
}));

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM AUDIT LOGS
//
// Immutable log of every action taken by a platform staff member.
// Rows are NEVER deleted — this is the legal audit trail.
// Captures the full before/after state so changes can be reconstructed.
// ─────────────────────────────────────────────────────────────────────────────

export const platformAuditLogs = pgTable('platform_audit_logs', {
  auditId:   uuid('audit_id').primaryKey().defaultRandom(),

  // Who did this.
  staffId:     uuid('staff_id').references(() => platformStaff.staffId).notNull(),
  idpSub:      varchar('idp_sub', { length: 255 }).notNull(),
  staffEmail:  varchar('staff_email',   { length: 255 }).notNull(),

  // What they did.
  // e.g. 'credit_config.update', 'org_assignment.create', 'org_assignment.delete'
  action:         varchar('action', { length: 100 }).notNull(),

  // Which tenant was affected.
  targetTenantId: uuid('target_tenant_id').notNull(),

  // Which specific resource (e.g. 'credit_configuration', 'org_application').
  targetResource:   varchar('target_resource',    { length: 100 }).notNull(),
  targetResourceId: varchar('target_resource_id', { length: 255 }),

  // Full HTTP context so the action can be replayed or reversed.
  requestPath:   varchar('request_path',   { length: 500 }).notNull(),
  requestMethod: varchar('request_method', { length: 10  }).notNull(),

  // Snapshot of the data before and after the change.
  // NULL for read-only actions (credit_config:read).
  changesBefore: text('changes_before'), // JSON string
  changesAfter:  text('changes_after'),  // JSON string

  // Network context.
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  // Immutable timestamp — never updated.
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  staffIdIdx:      index('idx_platform_audit_staff_id').on(table.staffId),
  targetTenantIdx: index('idx_platform_audit_target_tenant').on(table.targetTenantId),
  actionIdx:       index('idx_platform_audit_action').on(table.action),
  createdAtIdx:    index('idx_platform_audit_created_at').on(table.createdAt),
}));
