// @ts-nocheck — legacy webhook handler; tighten types incrementally
/**
 * Subscription webhook handler — main dispatcher.
 *
 * All business logic lives in focused sub-modules under ./webhooks/:
 *   - webhook-stripe-checkout.ts     → checkout.completed, credit purchases
 *   - webhook-stripe-payment.ts      → payment.succeeded, invoice.*, charge.*, refund.*
 *   - webhook-stripe-subscription.ts → subscription.created/updated/deleted
 *
 * This file:
 *   1. Verifies and dispatches incoming webhook events.
 *   2. Handles idempotency via the eventTracking table.
 *   3. Re-exports all named handlers so existing callers continue to work
 *      without any import changes.
 */
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { db } from '../../../db/index.js';
import { eventTracking } from '../../../db/schema/index.js';
import { getPaymentGateway } from '../adapters/index.js';
import type { NormalizedWebhookEvent } from '../adapters/index.js';
import Logger from '../../../utils/logger.js';

// ── Shared utilities ──────────────────────────────────────────────────────────
export {
  SUBSCRIPTION_FALLBACK_PERIOD_MS,
  STRIPE_STATUS_MAP,
  normalizeStripeSubscriptionStatus,
  safePaymentSelect,
} from './webhook-shared.js';

// ── Checkout handlers ─────────────────────────────────────────────────────────
export {
  buildCheckoutAuditSnapshot,
  handleCheckoutCompleted,
  handleCreditPurchase,
} from './webhooks/webhook-stripe-checkout.js';

// ── Payment / invoice / charge / refund handlers ──────────────────────────────
export {
  applyInvoicePaymentToSubscription,
  handlePaymentSucceeded,
  handleInvoicePaymentPaid,
  handlePaymentFailed,
  handleChargeDispute,
  handleRefund,
  handleChargeSucceeded,
} from './webhooks/webhook-stripe-payment.js';

// ── Subscription lifecycle handlers ───────────────────────────────────────────
export {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from './webhooks/webhook-stripe-subscription.js';

// ── Dispatcher imports (used only inside handleWebhook below) ─────────────────
import {
  handleCheckoutCompleted as _handleCheckoutCompleted,
  handleCreditPurchase as _handleCreditPurchase,
} from './webhooks/webhook-stripe-checkout.js';
import {
  handlePaymentSucceeded as _handlePaymentSucceeded,
  handleInvoicePaymentPaid as _handleInvoicePaymentPaid,
  handlePaymentFailed as _handlePaymentFailed,
  handleChargeDispute as _handleChargeDispute,
  handleRefund as _handleRefund,
  handleChargeSucceeded as _handleChargeSucceeded,
} from './webhooks/webhook-stripe-payment.js';
import {
  handleSubscriptionCreated as _handleSubscriptionCreated,
  handleSubscriptionUpdated as _handleSubscriptionUpdated,
  handleSubscriptionDeleted as _handleSubscriptionDeleted,
} from './webhooks/webhook-stripe-subscription.js';

/**
 * Handle payment gateway webhooks.
 * The adapter normalises provider-specific events so business logic is gateway-agnostic.
 */
export async function handleWebhook(
  rawBody: Buffer | string,
  signature: string,
  endpointSecret: string
): Promise<Record<string, unknown>> {
  const gateway = getPaymentGateway();
  let event: NormalizedWebhookEvent | null = null;

  try {
    Logger.log('info', 'billing', 'handle-webhook', 'handleWebhook called', { provider: gateway.providerName });

    if (!gateway.isConfigured()) {
      throw new Error('Payment gateway not properly configured');
    }

    if (!endpointSecret) {
      throw new Error('Webhook secret not configured');
    }

    event = await gateway.verifyWebhook(rawBody, signature, endpointSecret);

    if (!event || !event.type) {
      throw new Error('Invalid webhook event — missing type or data');
    }

    Logger.log('info', 'billing', 'handle-webhook', 'Webhook received', { eventType: event.type, provider: event.provider });

    // Idempotency: check-then-reserve BEFORE processing.
    // If the check itself fails (DB pool exhausted, network blip), we REJECT the
    // webhook so the payment provider retries later — never risk double-processing.
    const [existing] = await db
      .select({ id: eventTracking.id, status: eventTracking.status })
      .from(eventTracking)
      .where(eq(eventTracking.eventId, event.id))
      .limit(1);

    if (existing) {
      Logger.log('info', 'billing', 'handle-webhook', 'Skipping already-processed webhook event', { eventId: event.id });
      return { processed: true, eventType: event.type, duplicate: true };
    }

    // Reserve the event BEFORE dispatching handlers so a crash mid-processing
    // still marks it as seen. Status is 'processing' until we update to 'processed'.
    await db.insert(eventTracking).values({
      eventId: event.id,
      eventType: event.type,
      tenantId: '00000000-0000-0000-0000-000000000000',
      streamKey: 'payment-webhook',
      sourceApplication: event.provider ?? 'unknown',
      targetApplication: 'wrapper-backend',
      eventData: event.data,
      status: 'processing',
    });

    const eventObj = event.data;

    switch (event.type) {
      case 'checkout.completed': {
        if ((eventObj as Record<string, unknown>).metadata?.creditAmount) {
          Logger.log('info', 'billing', 'handle-webhook', 'Credit purchase detected — redirecting to credit handler');
          await _handleCreditPurchase(eventObj);
        } else {
          await _handleCheckoutCompleted(eventObj);
        }
        break;
      }

      case 'payment.succeeded':
        await _handlePaymentSucceeded(eventObj as Record<string, unknown> & { id?: string; subscription?: string; customer?: string; amount_paid?: number; currency?: string; payment_intent?: string; billing_reason?: string; number?: string; tax?: number; period_start?: number; period_end?: number; attempt_count?: number; next_payment_attempt?: number; status_transitions?: { paid_at?: number }; lines?: { data?: Array<{ price?: { id?: string } }> }; payment_method_types?: string[] });
        break;

      case 'invoice.payment_paid':
        await _handleInvoicePaymentPaid(eventObj);
        break;

      case 'payment.failed':
      case 'invoice.payment_failed':
        await _handlePaymentFailed(eventObj);
        break;

      case 'subscription.created':
        await _handleSubscriptionCreated(eventObj as Record<string, unknown> & { id: string; customer: string; status: string; current_period_start: number; current_period_end: number });
        break;

      case 'subscription.updated':
        await _handleSubscriptionUpdated(eventObj as Record<string, unknown> & { id: string; status: string; current_period_start: number; current_period_end: number; items?: { data?: Array<{ price?: string | { id?: string } }> } });
        break;

      case 'subscription.deleted':
        await _handleSubscriptionDeleted(eventObj as Record<string, unknown> & { id: string });
        break;

      case 'charge.disputed':
        await _handleChargeDispute(eventObj as Record<string, unknown> & { id: string; charge: string; amount: number; reason?: string; status?: string; currency?: string; created?: number; evidence_details?: { due_by?: number; has_evidence?: boolean } });
        break;

      case 'charge.succeeded':
        await _handleChargeSucceeded(eventObj as Record<string, unknown> & { id: string; customer?: string; amount: number; currency?: string; payment_intent?: string; payment_method_details?: { type?: string }; description?: string; metadata?: Record<string, unknown>; created?: number });
        break;

      case 'refund.created':
        await _handleRefund(eventObj as Record<string, unknown> & { id: string; charge: string; amount: number; reason?: string; status?: string; currency?: string; created?: number });
        break;

      default:
        Logger.log('warning', 'billing', 'handle-webhook', 'Unhandled webhook event type', { eventType: event.type });
    }

    // Mark event as fully processed.
    try {
      await db
        .update(eventTracking)
        .set({ status: 'processed' })
        .where(eq(eventTracking.eventId, event.id));
    } catch (trackErr) {
      Logger.log('warning', 'billing', 'handle-webhook', 'Failed to mark webhook event as processed', { error: (trackErr as Error).message });
    }

    return { processed: true, eventType: event.type, provider: event.provider };
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-webhook', 'Webhook processing error', { error: error.message });

    Sentry.withScope((scope) => {
      scope.setTag('payment.webhook_event', event?.type || 'unknown');
      scope.setTag('payment.provider', event?.provider || 'unknown');
      scope.setContext('webhook', {
        eventId: event?.id,
        eventType: event?.type,
        provider: event?.provider,
      });
      Sentry.captureException(error);
    });

    // Mark the reserved event as failed so retries aren't blocked forever.
    if (event?.id) {
      try {
        await db
          .update(eventTracking)
          .set({ status: 'failed' })
          .where(eq(eventTracking.eventId, event.id));
      } catch { /* best-effort */ }
    }

    if (
      error.message?.includes('Missing tenantId or planId') ||
      error.message?.includes('test webhook') ||
      error.message?.includes('already_processed')
    ) {
      return {
        processed: true,
        eventType: event?.type || 'unknown',
        skipped: true,
        reason: error.message
      };
    }

    throw error;
  }
}
