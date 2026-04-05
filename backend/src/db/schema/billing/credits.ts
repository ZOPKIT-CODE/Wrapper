import { pgTable, uuid, varchar, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';
import { entities } from '../organizations/unified-entities.js';

// Main credit balance table
export const credits = pgTable('credits', {
  creditId: uuid('credit_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity Context — NOT NULL: a credit balance must always belong to an entity
  entityId: uuid('entity_id').references(() => entities.entityId).notNull(),

  // Credit Balance — NOT NULL + UNIQUE(tenant_id, entity_id) enforced at DB level
  availableCredits: decimal('available_credits', { precision: 15, scale: 4 }).notNull().default('0'),

  // Status
  isActive: boolean('is_active').default(true),

  // Audit
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Credit transaction ledger (immutable record of all credit movements) - SIMPLIFIED
export const creditTransactions = pgTable('credit_transactions', {
  transactionId: uuid('transaction_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity Context - Now references unified entities table
  entityId: uuid('entity_id').references(() => entities.entityId), // References unified entities table

  // Transaction Details - SIMPLIFIED
  transactionType: varchar('transaction_type', { length: 30 }).notNull(),
  // 'purchase','consumption','expiry','adjustment','transfer','initialization','allocation','transfer_in','transfer_out'

  amount: decimal('amount', { precision: 15, scale: 4 }).notNull(),
  previousBalance: decimal('previous_balance', { precision: 15, scale: 4 }),
  newBalance: decimal('new_balance', { precision: 15, scale: 4 }),

  // Transaction Context - SIMPLIFIED
  operationCode: varchar('operation_code', { length: 255 }), // 'crm.leads.create', 'hr.payroll.process'

  // Audit - SIMPLIFIED
  initiatedBy: uuid('initiated_by').references(() => tenantUsers.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// REMOVED: creditAlerts table - Use external monitoring for alerts
