import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// Import existing tables for proper foreign key references
import { tenants } from './tenants.js';

// Applications registry
export const applications = pgTable('applications', {
  appId: uuid('app_id').primaryKey().defaultRandom(),
  appCode: varchar('app_code', { length: 50 }).notNull().unique(), // 'crm', 'hr', 'affiliate'
  appName: varchar('app_name', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 255 }),
  baseUrl: varchar('base_url', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, inactive, maintenance
  version: varchar('version', { length: 20 }),
  isCore: boolean('is_core').default(false), // Core apps vs optional
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Application modules (features within each app)
export const applicationModules = pgTable('application_modules', {
  moduleId: uuid('module_id').primaryKey().defaultRandom(),
  appId: uuid('app_id').references(() => applications.appId),
  moduleCode: varchar('module_code', { length: 50 }).notNull(), // 'contacts', 'deals', 'reports'
  moduleName: varchar('module_name', { length: 100 }).notNull(),
  description: text('description'),
  isCore: boolean('is_core').default(false),
  permissions: jsonb('permissions'), // Remove the type annotation that's causing the error
  createdAt: timestamp('created_at').defaultNow()
});

// Organization application access
export const organizationApplications = pgTable('organization_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId),
  appId: uuid('app_id').references(() => applications.appId),
  isEnabled: boolean('is_enabled').default(true),
  enabledModules: jsonb('enabled_modules'), // Array of module codes
  customPermissions: jsonb('custom_permissions'), // Override default permissions
  licenseCount: integer('license_count').default(0), // Number of licenses purchased
  maxUsers: integer('max_users'), // Maximum users for this app
  subscriptionTier: varchar('subscription_tier', { length: 50 }), // 'basic', 'pro', 'enterprise'
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  // Ensure no duplicate tenant-app combinations
  tenantAppUnique: uniqueIndex('organization_applications_tenant_app_unique').on(table.tenantId, table.appId)
}));


