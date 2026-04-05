import { pgTable, uuid, varchar, timestamp, boolean, decimal, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';

// Hybrid credit configuration system (global + tenant-specific)
export const creditConfigurations = pgTable('credit_configurations', {
  configId: uuid('config_id').primaryKey().defaultRandom(),

  // Configuration Target - SIMPLIFIED
  tenantId: uuid('tenant_id').references(() => tenants.tenantId), // NULL for global, set for tenant-specific
  operationCode: varchar('operation_code', { length: 255 }).notNull(), // 'crm.leads.create', 'hr.payroll.process'

  // Configuration Type
  isGlobal: boolean('is_global').default(true), // True for global configs, false for tenant-specific

  // Credit Cost Configuration
  creditCost: decimal('credit_cost', { precision: 10, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 20 }).default('operation'), // 'operation', 'record', 'minute', 'MB', 'GB'
  unitMultiplier: decimal('unit_multiplier', { precision: 10, scale: 4 }).default('1'), // How many units per operation

  // Advanced Configuration (primarily for tenant-specific configs)
  operationName: varchar('operation_name', { length: 255 }), // Display name for the operation
  category: varchar('category', { length: 100 }), // Category grouping
  freeAllowance: integer('free_allowance'), // Free operations per period
  freeAllowancePeriod: varchar('free_allowance_period', { length: 20 }), // 'daily', 'weekly', 'monthly'
  volumeTiers: varchar('volume_tiers'), // JSON string for tiered pricing
  allowOverage: boolean('allow_overage').default(false), // Allow operations beyond limits
  overageLimit: integer('overage_limit'), // Maximum overage allowed
  overagePeriod: varchar('overage_period', { length: 20 }), // Period for overage calculation
  overageCost: decimal('overage_cost', { precision: 10, scale: 4 }), // Cost per overage operation
  scope: varchar('scope', { length: 20 }).default('global'), // 'global', 'tenant'
  priority: integer('priority').default(100), // Priority for configuration precedence

  // Status
  isActive: boolean('is_active').default(true),

  // Audit & Tracking
  createdBy: uuid('created_by').references(() => tenantUsers.userId).notNull(),
  updatedBy: uuid('updated_by').references(() => tenantUsers.userId),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

}, (table) => ({
  uniqueCreditConfig: uniqueIndex('unique_credit_config').on(table.tenantId, table.operationCode),
  idxCreditConfigLookup: index('idx_credit_config_lookup').on(table.tenantId, table.operationCode, table.isActive),
  uniqueGlobalCreditConfig: uniqueIndex('unique_global_credit_config').on(table.operationCode),
  uniqueTenantCreditConfig: uniqueIndex('unique_tenant_credit_config').on(table.tenantId, table.operationCode),
}));

// REMOVED: moduleCreditConfigurations - Use simple operation-level configs only

// REMOVED: appCreditConfigurations - Use simple operation-level configs only

// REMOVED: creditConfigurationTemplates - No templates needed for MVP

// REMOVED: configurationChangeHistory - Basic audit in main config tables
