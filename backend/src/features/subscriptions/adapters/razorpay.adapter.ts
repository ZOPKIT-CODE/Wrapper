/**
 * Razorpay Payment Gateway Adapter
 *
 * Implements PaymentGatewayPort using the Razorpay API.
 *
 * Flow differences from Stripe:
 *   - Checkout is popup-based (client-side JS), not a server-side redirect.
 *   - createCheckoutSession() returns { orderId, keyId, url: '' }.
 *   - Frontend initialises Razorpay checkout with orderId + keyId.
 *   - Webhook signature uses HMAC-SHA256 (razorpay.webhooks.validateSignature).
 *
 * Env vars required:
 *   RAZORPAY_KEY_ID        — publishable key (starts with rzp_live_ or rzp_test_)
 *   RAZORPAY_KEY_SECRET    — secret key
 *   RAZORPAY_WEBHOOK_SECRET — webhook signature secret (set in Razorpay dashboard)
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import type { PaymentGatewayPort } from './payment-gateway.port.js';
import Logger from '../../../utils/logger.js';
import type {
  PaymentGatewayProvider,
  CreateCheckoutParams,
  CheckoutResult,
  BillingPortalParams,
  NormalizedWebhookEvent,
  NormalizedEventType,
  CreateRefundParams,
  RefundResult,
  GatewaySubscription,
  UpdateSubscriptionParams,
  CancelSubscriptionParams,
  GatewayCustomer,
  GatewayCheckoutSession,
  GatewayInvoice,
  GatewayConfigStatus,
} from './types.js';

// ---------------------------------------------------------------------------
// Razorpay webhook event → normalised event type
// ---------------------------------------------------------------------------

const RAZORPAY_EVENT_MAP: Record<string, NormalizedEventType> = {
  'order.paid':                'checkout.completed',
  'payment.captured':          'payment.succeeded',
  'payment.failed':            'payment.failed',
  'subscription.activated':    'subscription.created',
  'subscription.updated':      'subscription.updated',
  'subscription.cancelled':    'subscription.deleted',
  'subscription.charged':      'invoice.payment_paid',
  'refund.created':            'refund.created',
  'dispute.created':           'charge.disputed',
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class RazorpayPaymentGateway implements PaymentGatewayPort {
  readonly providerName: PaymentGatewayProvider = 'razorpay';

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly client: Razorpay;

  constructor() {
    this.keyId         = process.env.RAZORPAY_KEY_ID         ?? '';
    this.keySecret     = process.env.RAZORPAY_KEY_SECRET      ?? '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET  ?? '';

    // Razorpay SDK throws if key_id is empty, so only instantiate when configured.
    // isConfigured() returns false when keys are absent, allowing the factory to
    // fall back to the mock gateway without crashing at import time.
    try {
      this.client = new Razorpay({
        key_id:     this.keyId,
        key_secret: this.keySecret,
      });
    } catch {
      this.client = {} as Razorpay; // stub — isConfigured() guards API call paths
    }
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  getConfigStatus(): GatewayConfigStatus {
    return {
      isConfigured:     this.isConfigured(),
      provider:         'razorpay',
      hasSecretKey:     Boolean(this.keySecret),
      hasWebhookSecret: Boolean(this.webhookSecret),
      environment:      this.keyId.startsWith('rzp_live_') ? 'production' : 'test',
      details: {
        keyIdPrefix: this.keyId ? `${this.keyId.slice(0, 12)}…` : 'not set',
      },
    };
  }

  // -----------------------------------------------------------------------
  // Checkout
  //
  // Razorpay does not use server-side redirect URLs. Instead the server
  // creates an Order (one-time) or Subscription (recurring), then returns
  // { orderId, keyId } for the frontend Razorpay checkout popup.
  // -----------------------------------------------------------------------

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    if (params.mode === 'subscription') {
      return this._createSubscriptionCheckout(params);
    }
    return this._createOrderCheckout(params);
  }

  private async _createOrderCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const firstItem = params.lineItems[0];
    const amountPaise = firstItem?.priceData?.unitAmount
      ? firstItem.priceData.unitAmount * (firstItem.quantity ?? 1)
      : 0;
    const currency = (firstItem?.priceData?.currency ?? 'INR').toUpperCase();

    const order = await this.client.orders.create({
      amount:   amountPaise,
      currency,
      receipt:  `receipt_${Date.now()}`,
      notes:    params.metadata as Record<string, string> ?? {},
    });

    return {
      sessionId: order.id,
      url:       '',          // no redirect — frontend opens popup
      orderId:   order.id,
      keyId:     this.keyId,
    };
  }

  private async _createSubscriptionCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const firstItem  = params.lineItems[0];
    const planId     = firstItem?.priceId ?? '';

    if (!planId) {
      throw new Error('Razorpay subscription checkout requires a priceId (Razorpay plan_id)');
    }

    const subscription = await this.client.subscriptions.create({
      plan_id:         planId,
      total_count:     12,      // default: 12 billing cycles
      quantity:        firstItem.quantity ?? 1,
      customer_notify: 1,
      notes:           params.metadata as Record<string, string> ?? {},
    });

    return {
      sessionId: subscription.id,
      url:       (subscription as unknown as Record<string, unknown>).short_url as string ?? '',
      orderId:   subscription.id,
      keyId:     this.keyId,
    };
  }

  // Razorpay has no hosted billing portal — return null.
  async createBillingPortalSession(_params: BillingPortalParams): Promise<string | null> {
    Logger.log('warning', 'general', 'createBillingPortalSession', 'Razorpay does not support a hosted billing portal');
    return null;
  }

  // -----------------------------------------------------------------------
  // Webhooks
  // -----------------------------------------------------------------------

  async verifyWebhook(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
  ): Promise<NormalizedWebhookEvent> {
    const body      = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const expected  = crypto
      .createHmac('sha256', secret || this.webhookSecret)
      .update(body)
      .digest('hex');

    if (expected !== signature) {
      throw new Error('Razorpay webhook signature verification failed');
    }

    const parsed  = JSON.parse(body) as Record<string, unknown>;
    const event   = parsed.event as string ?? 'unknown';
    const payload = parsed.payload as Record<string, unknown> ?? {};

    // Razorpay payload shape: { payment: { entity: {...} }, subscription: { entity: {...} }, ... }
    const entity =
      (payload.payment   as Record<string, unknown>)?.entity ??
      (payload.subscription as Record<string, unknown>)?.entity ??
      (payload.order     as Record<string, unknown>)?.entity ??
      (payload.refund    as Record<string, unknown>)?.entity ??
      payload;

    return {
      id:       (parsed.account_id as string) ?? `rzp_evt_${Date.now()}`,
      type:     RAZORPAY_EVENT_MAP[event] ?? 'unknown',
      data:     entity as Record<string, unknown>,
      rawEvent: parsed,
      provider: 'razorpay',
    };
  }

  // -----------------------------------------------------------------------
  // Refunds
  // -----------------------------------------------------------------------

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const paymentId = params.paymentIntentId ?? params.chargeId ?? '';
    if (!paymentId) {
      throw new Error('Razorpay refund requires a paymentIntentId (Razorpay payment_id)');
    }

    const refund = await this.client.payments.refund(paymentId, {
      amount: params.amount,
      notes:  params.metadata as Record<string, string> ?? {},
    });

    return {
      refundId:        refund.id,
      amount:          refund.amount ?? 0,
      currency:        refund.currency,
      status:          refund.status,
      paymentIntentId: params.paymentIntentId,
      chargeId:        params.chargeId,
    };
  }

  // -----------------------------------------------------------------------
  // Subscription Management
  // -----------------------------------------------------------------------

  async retrieveSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    const sub = await this.client.subscriptions.fetch(subscriptionId) as unknown as Record<string, unknown>;

    const periodStart = sub.current_start as number ?? Math.floor(Date.now() / 1000);
    const periodEnd   = sub.current_end   as number ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

    return {
      id:                 sub.id as string,
      customerId:         sub.customer_id as string ?? '',
      status:             sub.status as string,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd:   new Date(periodEnd   * 1000),
      items: [{
        id:      sub.id as string,
        priceId: sub.plan_id as string ?? '',
      }],
      metadata: sub.notes as Record<string, string> ?? {},
    };
  }

  async updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams,
  ): Promise<GatewaySubscription> {
    const updatePayload: Record<string, unknown> = {};

    if (params.cancelAtPeriodEnd) {
      // Razorpay: schedule cancellation at end of current billing cycle
      await this.client.subscriptions.cancel(subscriptionId, true);
    } else if (params.items?.[0]?.priceId) {
      updatePayload['plan_id'] = params.items[0].priceId;
      await (this.client.subscriptions as unknown as {
        update(id: string, data: Record<string, unknown>): Promise<unknown>
      }).update(subscriptionId, updatePayload);
    }

    return this.retrieveSubscription(subscriptionId);
  }

  async cancelSubscription(
    subscriptionId: string,
    params?: CancelSubscriptionParams,
  ): Promise<void> {
    // cancelAtEnd=true means cancel at period end; false means cancel immediately
    const cancelAtEnd = params?.invoiceNow === false;
    await this.client.subscriptions.cancel(subscriptionId, cancelAtEnd);
  }

  // -----------------------------------------------------------------------
  // Customer
  //
  // Razorpay customer IDs are created separately. Fetch by customer_id.
  // -----------------------------------------------------------------------

  async retrieveCustomer(customerId: string): Promise<GatewayCustomer> {
    const customer = await this.client.customers.fetch(customerId) as unknown as Record<string, unknown>;

    return {
      id:       customer.id       as string,
      email:    customer.email    as string | null ?? null,
      name:     customer.name     as string | null ?? null,
      metadata: customer.notes    as Record<string, string> ?? {},
      deleted:  false,
    };
  }

  // -----------------------------------------------------------------------
  // Session / Invoice retrieval
  //
  // Razorpay uses Orders (not sessions) and Invoices (different structure).
  // We map them to the gateway-agnostic types as closely as possible.
  // -----------------------------------------------------------------------

  async retrieveCheckoutSession(sessionId: string, _expand?: string[]): Promise<GatewayCheckoutSession> {
    // sessionId is a Razorpay order_id (order_xxx) or subscription_id (sub_xxx)
    if (sessionId.startsWith('sub_')) {
      const sub = await this.retrieveSubscription(sessionId);
      return {
        id:             sessionId,
        mode:           'subscription',
        paymentStatus:  sub.status === 'active' ? 'paid' : 'unpaid',
        status:         sub.status,
        amountTotal:    0,
        currency:       'INR',
        subscriptionId: sub.id,
        metadata:       sub.metadata ?? {},
        created:        Math.floor(sub.currentPeriodStart.getTime() / 1000),
        subscription:   sub,
      };
    }

    const order = await this.client.orders.fetch(sessionId) as unknown as Record<string, unknown>;
    return {
      id:            order.id as string,
      mode:          'payment',
      paymentStatus: order.status === 'paid' ? 'paid' : 'unpaid',
      status:        order.status as string,
      amountTotal:   order.amount as number ?? 0,
      currency:      (order.currency as string ?? 'INR').toLowerCase(),
      metadata:      order.notes as Record<string, string> ?? {},
      created:       order.created_at as number ?? Math.floor(Date.now() / 1000),
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<GatewayInvoice> {
    const invoice = await (this.client as unknown as {
      invoices: { fetch(id: string): Promise<unknown> }
    }).invoices.fetch(invoiceId) as Record<string, unknown>;

    return {
      id:           invoice.id          as string,
      customerId:   invoice.customer_id as string ?? '',
      amountPaid:   invoice.amount_paid as number ?? 0,
      amountDue:    invoice.amount_due  as number ?? 0,
      currency:     (invoice.currency   as string ?? 'INR').toLowerCase(),
      status:       invoice.status      as string ?? 'unknown',
      invoiceNumber: invoice.invoice_number as string | undefined,
      lineItems:    [],
      rawData:      invoice,
    };
  }
}
