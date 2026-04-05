import { pgTable, uuid, text, jsonb, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';
import { notificationTemplates } from './notification-templates.js';

/**
 * Tenant-level overrides for notification template appearance.
 * One row per tenant+template pair — stores custom branding/UI config.
 */
export const tenantTemplateCustomizations = pgTable('tenant_template_customizations', {
  customizationId: uuid('customization_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  templateId: uuid('template_id').references(() => notificationTemplates.templateId).notNull(),

  // UI overrides (merged on top of the template's uiConfig)
  uiConfig: jsonb('ui_config').notNull(),
  logoUrl: text('logo_url'),
  brandColors: jsonb('brand_colors').default({ primary: null, secondary: null, accent: null }),

  isActive: boolean('is_active').notNull().default(true),

  // Audit
  createdBy: uuid('created_by').references(() => tenantUsers.userId),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantTemplateUnique: uniqueIndex('tenant_template_customizations_tenant_template_unique').on(table.tenantId, table.templateId),
  idxTenantId: index('idx_tenant_template_customizations_tenant_id').on(table.tenantId),
  idxTemplateId: index('idx_tenant_template_customizations_template_id').on(table.templateId),
  idxTenantTemplate: index('idx_tenant_template_customizations_tenant_template').on(table.tenantId, table.templateId),
  idxIsActive: index('idx_tenant_template_customizations_is_active').on(table.isActive),
}));
