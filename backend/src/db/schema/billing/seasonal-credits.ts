import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer, decimal, text, index } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';
import { entities } from '../organizations/unified-entities.js';

/**
 * Seasonal Credit Campaigns Table
 * Stores campaign metadata for distributing free credits to tenants
 */
export const seasonalCreditCampaigns = pgTable('seasonal_credit_campaigns', {
  campaignId: uuid('campaign_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  
  // Campaign Metadata
  campaignName: varchar('campaign_name', { length: 255 }).notNull(),
  creditType: varchar('credit_type', { length: 50 }).notNull(), // 'free_distribution', 'promotional', 'holiday', etc.
  description: text('description'),
  
  // Credit Distribution Settings
  totalCredits: decimal('total_credits', { precision: 15, scale: 4 }).notNull(),
  creditsPerTenant: decimal('credits_per_tenant', { precision: 15, scale: 4 }),
  distributionMethod: varchar('distribution_method', { length: 50 }).default('equal'), // 'equal', 'proportional', 'custom'
  
  // Targeting
  targetAllTenants: boolean('target_all_tenants').default(false),
  targetTenantIds: uuid('target_tenant_ids').array(), // Specific tenants if not all
  targetApplications: jsonb('target_applications').default(['crm', 'hr', 'affiliate', 'system']),
  
  // Distribution Status
  distributionStatus: varchar('distribution_status', { length: 50 }).default('pending'), // 'pending', 'processing', 'completed', 'failed', 'partial_success'
  distributedCount: integer('distributed_count').default(0),
  failedCount: integer('failed_count').default(0),
  
  // Timing
  startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  distributedAt: timestamp('distributed_at', { withTimezone: true }),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  // Audit
  createdBy: uuid('created_by').references(() => tenantUsers.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),

  // Additional Configuration
  metadata: jsonb('metadata'),
  sendNotifications: boolean('send_notifications').default(true),
  notificationTemplate: text('notification_template'),
}, (table) => ({
  idxSeasonalCampaignsTenant: index('idx_seasonal_campaigns_tenant').on(table.tenantId),
  idxSeasonalCampaignsStatus: index('idx_seasonal_campaigns_status').on(table.distributionStatus, table.isActive),
}));

/**
 * Seasonal Credit Allocations Table
 * Tracks individual credit allocations to tenants' primary organizations
 * Supports both organization-wide and application-specific allocations
 */
export const seasonalCreditAllocations = pgTable('seasonal_credit_allocations', {
  allocationId: uuid('allocation_id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => seasonalCreditCampaigns.campaignId).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  
  // Organization Context (Primary Organization)
  entityId: uuid('entity_id').references(() => entities.entityId).notNull(),
  entityType: varchar('entity_type', { length: 50 }).default('organization'),
  
  // Application Targeting
  // NULL = allocated to primary org (all applications can use)
  // Specific app code (e.g., 'crm', 'hr') = allocated only to that application
  targetApplication: varchar('target_application', { length: 50 }),
  
  // Credit Details
  allocatedCredits: decimal('allocated_credits', { precision: 15, scale: 4 }).notNull(),
  usedCredits: decimal('used_credits', { precision: 15, scale: 4 }).default('0'),
  
  // Distribution Status
  distributionStatus: varchar('distribution_status', { length: 50 }).default('pending'), // 'pending', 'completed', 'failed'
  distributionError: text('distribution_error'),
  
  // Status
  isActive: boolean('is_active').default(true),
  isExpired: boolean('is_expired').default(false),
  
  // Timing
  allocatedAt: timestamp('allocated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxSeasonalAllocationsCampaign: index('idx_seasonal_allocations_campaign').on(table.campaignId),
  idxSeasonalAllocationsTenantEntity: index('idx_seasonal_allocations_tenant_entity').on(table.tenantId, table.entityId),
  idxSeasonalAllocationsTargetApp: index('idx_seasonal_allocations_target_app').on(table.targetApplication),
  idxSeasonalAllocationsExpiry: index('idx_seasonal_allocations_expiry').on(table.expiresAt, table.isActive, table.isExpired),
  idxSeasonalAllocationsExpiryApp: index('idx_seasonal_allocations_expiry_app').on(table.expiresAt, table.targetApplication, table.isActive, table.isExpired),
}));
