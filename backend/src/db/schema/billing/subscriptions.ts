import { pgTable, uuid, varchar, timestamp, jsonb, decimal, boolean, text, index } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';

// Main subscriptions
export const subscriptions = pgTable('subscriptions', {
  subscriptionId: uuid('subscription_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Plan information
  plan: varchar('plan', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'active', 'past_due', 'canceled', 'trialing', 'suspended'

  // Stripe subscription details
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),

  // Trial information
  isTrialUser: boolean('is_trial_user').default(false),
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

  // Upgrade tracking
  hasEverUpgraded: boolean('has_ever_upgraded').default(false), // Track if user ever had a paid plan

  // Billing cycle and pricing
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'), // 'monthly', 'yearly'
  yearlyPrice: decimal('yearly_price', { precision: 10, scale: 2 }).default('0'),

  // Current period information
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  // Cancellation information
  cancelAt: timestamp('cancel_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspendedReason: text('suspended_reason'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Every subscription query filters by tenantId — without this index
  // Postgres does a full sequential scan of the entire table.
  tenantIdIdx: index('idx_subscriptions_tenant_id').on(table.tenantId),
  // Status lookups (e.g. "get active subscription for tenant") are very frequent.
  tenantStatusIdx: index('idx_subscriptions_tenant_status').on(table.tenantId, table.status),
  // Stripe webhook lookups by stripe subscription ID.
  stripeSubIdIdx: index('idx_subscriptions_stripe_sub_id').on(table.stripeSubscriptionId),
}));

// Payment history - STREAMLINED
export const payments = pgTable('payments', {
  paymentId: uuid('payment_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.subscriptionId),

  // Stripe Payment Details
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).unique(),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  stripeChargeId: varchar('stripe_charge_id', { length: 255 }),

  // Payment Info
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(), // Must come from Stripe event or tenant.defaultCurrency — no default to avoid mismatch
  status: varchar('status', { length: 20 }).notNull(), // 'succeeded', 'failed', 'pending', 'canceled'
  paymentMethod: varchar('payment_method', { length: 50 }), // 'card', 'bank_transfer', etc.
  paymentMethodDetails: jsonb('payment_method_details').default({}), // Card brand, last4, etc.

  // Payment Type & Context
  paymentType: varchar('payment_type', { length: 30 }).default('subscription'), // 'subscription', 'credit_purchase'
  billingReason: varchar('billing_reason', { length: 50 }), // 'subscription_cycle', 'credit_topup'

  // Invoice Details
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  description: text('description'),

  // Refund tracking
  amountRefunded: decimal('amount_refunded', { precision: 10, scale: 2 }).default('0'),
  refundReason: varchar('refund_reason', { length: 100 }),
  isPartialRefund: boolean('is_partial_refund').default(false),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),

  // Tax Information
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),

  // Metadata
  metadata: jsonb('metadata').default({}),
  stripeRawData: jsonb('stripe_raw_data').default({}), // Full Stripe event data for debugging

  // Payment gateway provider ('stripe' | 'razorpay')
  provider: varchar('provider', { length: 20 }).default('stripe'),

  // Dates
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tenantIdIdx: index('idx_payments_tenant_id').on(table.tenantId),
  tenantCreatedAtIdx: index('idx_payments_tenant_created_at').on(table.tenantId, table.createdAt),
  // JOIN from payments → subscriptions needs this index to avoid full scan.
  subscriptionIdIdx: index('idx_payments_subscription_id').on(table.subscriptionId),
  // Stripe webhook deduplication looks up by paymentIntentId.
  stripePaymentIntentIdx: index('idx_payments_stripe_payment_intent').on(table.stripePaymentIntentId),
}));
