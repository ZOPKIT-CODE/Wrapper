import { pgTable, uuid, varchar, timestamp, decimal, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';
import { tenantUsers } from '../core/users.js';
import { entities } from '../organizations/unified-entities.js';

// Credit purchase orders - SIMPLIFIED
export const creditPurchases = pgTable('credit_purchases', {
  purchaseId: uuid('purchase_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Purchase Context - FIXED REFERENCES
  entityId: uuid('entity_id').references(() => entities.entityId), // References unified entities table

  // Purchase Details - SIMPLIFIED
  creditAmount: decimal('credit_amount', { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 4 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),

  // Credit Batch Details - SIMPLIFIED
  batchId: uuid('batch_id').notNull(),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),

  // Payment Information - SIMPLIFIED
  paymentMethod: varchar('payment_method', { length: 50 }), // 'stripe', 'bank_transfer', 'check'
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  // payment_status_deprecated column exists in DB (renamed from payment_status via M010)
  // — do not use; remove from queries and drop in a follow-up migration.

  // Purchase Status — canonical column
  // 'pending','processing','completed','failed','cancelled'
  status: varchar('status', { length: 20 }).default('pending'),

  // Timestamps
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  creditedAt: timestamp('credited_at', { withTimezone: true }),

  // Audit
  requestedBy: uuid('requested_by').references(() => tenantUsers.userId).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  batchIdUnique: uniqueIndex('credit_purchases_batch_id_unique').on(table.batchId),
}));

// REMOVED: All complex tables for MVP simplicity
// - discountTiers: No volume discounts needed
// - purchaseTemplates: Handle auto-purchase in application code
// - purchaseHistory: Track status changes in main purchase table
