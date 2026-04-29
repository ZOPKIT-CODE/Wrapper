import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer, decimal, text, index } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';
import { entities } from '../organizations/unified-entities.js';

/**
 * Seasonal Credit Campaigns Table
 * Stores campaign metadata for distributing promotional credits to tenants.
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
  distributionMethod: varchar('distribution_method', { length: 50 }).default('equal'),

  // Targeting
  targetAllTenants: boolean('target_all_tenants').default(false),
  targetTenantIds: uuid('target_tenant_ids').array(),
  targetApplications: jsonb('target_applications').default(['crm', 'hr', 'affiliate', 'system']),

  // Distribution Status
  distributionStatus: varchar('distribution_status', { length: 50 }).default('pending'),
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
 * Credit Batches Table  (formerly seasonal_credit_allocations)
 *
 * Consolidated batch tracker for ALL credit types:
 *   - 'seasonal'  — admin campaign/promotional credits (shortest expiry)
 *   - 'free'      — admin manual grants, onboarding, trial credits
 *   - 'paid'      — Stripe purchases (expires with subscription plan)
 *
 * Two roles in one table, distinguished by targetApplication:
 *   targetApplication = NULL   → org-pool batch (not yet sent to any app)
 *   targetApplication = 'crm'  → app-level batch (already allocated, tracked for expiry)
 *
 * FIFO allocation order: seasonal → free → paid (soonest-expiring first within each type).
 * Never-expires sentinel: expiresAt = 9999-12-31
 */
export const creditBatches = pgTable('credit_batches', {
  allocationId: uuid('allocation_id').primaryKey().defaultRandom(),

  // Optional link to the campaign that created this batch (null for free/paid)
  campaignId: uuid('campaign_id').references(() => seasonalCreditCampaigns.campaignId),

  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity that owns these credits
  entityId: uuid('entity_id').references(() => entities.entityId).notNull(),
  entityType: varchar('entity_type', { length: 50 }).default('organization'),

  // NULL = org-pool batch; app code (e.g. 'crm') = allocated to that specific app
  targetApplication: varchar('target_application', { length: 50 }),

  // Origin of this batch — drives FIFO order: seasonal → free → paid
  creditType: varchar('credit_type', { length: 20 }).default('free'),

  // Credit amounts
  allocatedCredits: decimal('allocated_credits', { precision: 15, scale: 4 }).notNull(),
  // For org-pool batches: updated during FIFO allocation so expiry cron can compute unusedCredits.
  // For app-level batches: not updated by wrapper (app tracks its own consumption).
  usedCredits: decimal('used_credits', { precision: 15, scale: 4 }).default('0'),

  // Distribution status
  distributionStatus: varchar('distribution_status', { length: 50 }).default('pending'),
  distributionError: text('distribution_error'),

  // Status flags
  isActive: boolean('is_active').default(true),
  isExpired: boolean('is_expired').default(false),

  // Timing
  allocatedAt: timestamp('allocated_at', { withTimezone: true }).defaultNow(),
  // 9999-12-31 sentinel = never expires
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxCreditBatchesCampaign:     index('idx_credit_batches_campaign').on(table.campaignId),
  idxCreditBatchesTenantEntity: index('idx_credit_batches_tenant_entity').on(table.tenantId, table.entityId),
  idxCreditBatchesTargetApp:    index('idx_credit_batches_target_app').on(table.targetApplication),
  idxCreditBatchesExpiry:       index('idx_credit_batches_expiry').on(table.expiresAt, table.isActive, table.isExpired),
  idxCreditBatchesExpiryApp:    index('idx_credit_batches_expiry_app').on(table.expiresAt, table.targetApplication, table.isActive, table.isExpired),
}));
