import { pgTable, uuid, decimal, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { entities } from '../organizations/unified-entities.js';

/**
 * Caches the categorized credit breakdown (free / paid / seasonal + expiry dates)
 * for each tenant-entity pair. Invalidated on any credit write; TTL is 5 minutes
 * as a safety net for subscription-driven changes that don't go through this service.
 *
 * Why: getCurrentBalance() fires 3 parallel DB queries to compute the breakdown.
 * On a cache hit we skip all 3 and serve the stored values instead.
 */
export const creditCategorySnapshots = pgTable('credit_category_snapshots', {
  snapshotId: uuid('snapshot_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  entityId: uuid('entity_id').references(() => entities.entityId).notNull(),

  freeCredits:    decimal('free_credits',    { precision: 15, scale: 4 }).notNull().default('0'),
  paidCredits:    decimal('paid_credits',    { precision: 15, scale: 4 }).notNull().default('0'),
  seasonalCredits: decimal('seasonal_credits', { precision: 15, scale: 4 }).notNull().default('0'),

  freeCreditsExpiry:    timestamp('free_credits_expiry',    { withTimezone: true }),
  paidCreditsExpiry:    timestamp('paid_credits_expiry',    { withTimezone: true }),
  seasonalCreditsExpiry: timestamp('seasonal_credits_expiry', { withTimezone: true }),
  subscriptionExpiry:   timestamp('subscription_expiry',    { withTimezone: true }),

  applicationExpiryDates: jsonb('application_expiry_dates').default('{}'),
  subscriptionPlan: jsonb('subscription_plan').default('"credit_based"'),

  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uqTenantEntity: uniqueIndex('uq_credit_snapshot_tenant_entity').on(table.tenantId, table.entityId),
}));
