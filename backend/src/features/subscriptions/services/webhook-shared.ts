// @ts-nocheck — legacy webhook handler; tighten types incrementally
import { payments } from '../../../db/schema/index.js';

/**
 * Fallback subscription period in milliseconds.
 * Used only when Stripe does not provide currentPeriodEnd in the webhook payload.
 * Stripe fires subscription.updated immediately after checkout.session.completed,
 * which will overwrite this with the authoritative value.
 * Override via SUBSCRIPTION_FALLBACK_PERIOD_DAYS (default 365).
 */
export const SUBSCRIPTION_FALLBACK_PERIOD_MS =
  Number(process.env.SUBSCRIPTION_FALLBACK_PERIOD_DAYS ?? 365) * 24 * 60 * 60 * 1000;

/**
 * Maps raw Stripe subscription status values to the allowed values in the
 * `chk_subscription_status` DB constraint:
 *   'active','inactive','trialing','past_due','canceled','paused','trial'
 *
 * Stripe may send statuses (e.g. 'incomplete', 'incomplete_expired', 'unpaid')
 * that are not in the constraint. This helper normalizes them so inserts/updates
 * never violate the check constraint.
 */
export const STRIPE_STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  trial: 'trial',
  past_due: 'past_due',
  canceled: 'canceled',
  paused: 'paused',
  inactive: 'inactive',
  // Stripe-specific statuses that don't exist in our constraint:
  incomplete: 'inactive',
  incomplete_expired: 'canceled',
  unpaid: 'past_due',
};

export function normalizeStripeSubscriptionStatus(stripeStatus: string): string {
  return STRIPE_STATUS_MAP[stripeStatus] ?? 'inactive';
}

// Safe column selection — avoids "column does not exist" when DB is behind the Drizzle schema.
export const safePaymentSelect = {
  paymentId: payments.paymentId,
  tenantId: payments.tenantId,
  subscriptionId: payments.subscriptionId,
  stripePaymentIntentId: payments.stripePaymentIntentId,
  stripeInvoiceId: payments.stripeInvoiceId,
  stripeChargeId: payments.stripeChargeId,
  amount: payments.amount,
  currency: payments.currency,
  status: payments.status,
  paymentMethod: payments.paymentMethod,
  paymentMethodDetails: payments.paymentMethodDetails,
  paymentType: payments.paymentType,
  billingReason: payments.billingReason,
  description: payments.description,
  taxAmount: payments.taxAmount,
  metadata: payments.metadata,
  stripeRawData: payments.stripeRawData,
  paidAt: payments.paidAt,
  createdAt: payments.createdAt,
  updatedAt: payments.updatedAt,
};
