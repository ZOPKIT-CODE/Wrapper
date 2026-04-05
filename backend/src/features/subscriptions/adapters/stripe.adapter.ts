/**
 * Stripe Payment Gateway Adapter
 *
 * Concrete implementation of PaymentGatewayPort for Stripe.
 * Wraps the Stripe SDK and normalises responses into gateway-agnostic types.
 */

import Stripe from 'stripe';
import type { PaymentGatewayPort } from './payment-gateway.port.js';
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

// -------------------------------------------------------------------------
// Stripe-specific event → normalised event mapping
// -------------------------------------------------------------------------

const STRIPE_EVENT_MAP: Record<string, NormalizedEventType> = {
  'checkout.session.completed': 'checkout.completed',
  'checkout.session.async_payment_succeeded': 'checkout.completed',
  'invoice.paid': 'payment.succeeded',
  'invoice.payment_paid': 'invoice.payment_paid',
  'invoice.payment_succeeded': 'payment.succeeded',
  'invoice_payment.paid': 'invoice.payment_paid',
  'invoice.payment_failed': 'payment.failed',
  'customer.subscription.created': 'subscription.created',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.deleted',
  'charge.succeeded': 'charge.succeeded',
  'charge.dispute.created': 'charge.disputed',
  'refund.created': 'refund.created',
};

export class StripePaymentGateway implements PaymentGatewayPort {
  readonly providerName: PaymentGatewayProvider = 'stripe';

  private stripe: Stripe | null = null;
  private configured = false;

  constructor() {
    this.initialise();
  }

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  private initialise(): void {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.warn('⚠️ STRIPE_SECRET_KEY not configured — Stripe adapter inactive');
      return;
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured — webhook verification will fail');
    }
    if (secretKey.startsWith('sk_test_')) {
      console.log('🧪 Stripe adapter initialised in TEST mode');
    } else if (secretKey.startsWith('sk_live_')) {
      console.log('🚀 Stripe adapter initialised in LIVE mode');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      timeout: Number(process.env.STRIPE_TIMEOUT_MS ?? 10_000)
    });
    this.configured = true;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  isConfigured(): boolean {
    return this.configured && this.stripe !== null;
  }

  getConfigStatus(): GatewayConfigStatus {
    return {
      isConfigured: this.isConfigured(),
      provider: 'stripe',
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV || 'development',
      details: {
        stripeInitialized: !!this.stripe,
        secretKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) ?? 'not set',
        webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) ?? 'not set',
      },
    };
  }

  // -----------------------------------------------------------------------
  // Checkout
  // -----------------------------------------------------------------------

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const s = this.ensureStripe();

    const lineItems = params.lineItems.map((li) => {
      if (li.priceId) {
        return { price: li.priceId, quantity: li.quantity };
      }
      return {
        price_data: {
          currency: li.priceData!.currency,
          product_data: {
            name: li.priceData!.productData.name,
            description: li.priceData!.productData.description,
          },
          unit_amount: li.priceData!.unitAmount,
        },
        quantity: li.quantity,
      };
    });

    const sessionConfig: Record<string, unknown> = {
      mode: params.mode,
      payment_method_types: params.paymentMethodTypes ?? ['card'],
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata ?? {},
    };

    if (params.customerId) {
      sessionConfig.customer = params.customerId;
      sessionConfig.customer_update = {
        address: 'auto',
        name: 'auto',
      };
    } else if (params.customerEmail) {
      sessionConfig.customer_email = params.customerEmail;
    }

    if (params.requireBillingAddress !== false) {
      sessionConfig.billing_address_collection = 'required';
    }

    if (params.collectPhoneNumber !== false) {
      sessionConfig.phone_number_collection = { enabled: true };
    }

    if (params.collectTaxId !== false) {
      sessionConfig.tax_id_collection = { enabled: true };
    }

    const session = await s.checkout.sessions.create(sessionConfig as Stripe.Checkout.SessionCreateParams);

    return {
      sessionId: session.id,
      url: session.url ?? '',
    };
  }

  async createBillingPortalSession(params: BillingPortalParams): Promise<string | null> {
    const s = this.ensureStripe();

    const session = await s.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    return session.url ?? null;
  }

  // -----------------------------------------------------------------------
  // Webhooks
  // -----------------------------------------------------------------------

  async verifyWebhook(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
  ): Promise<NormalizedWebhookEvent> {
    const s = this.ensureStripe();

    const bypassSig = process.env.BYPASS_WEBHOOK_SIGNATURE === 'true';

    // Hard gate: NEVER allow signature bypass in production, even if the flag leaks.
    if (bypassSig && process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: BYPASS_WEBHOOK_SIGNATURE=true is set in production. ' +
        'This would allow forged webhooks. Remove the variable and restart.'
      );
    }

    const isDev = process.env.NODE_ENV === 'development';

    let stripeEvent: Stripe.Event;

    if (isDev && bypassSig) {
      console.log('⚠️ DEV MODE: Bypassing Stripe webhook signature verification');
      const parsed = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString());
      const parsedRecord = parsed as Record<string, unknown>;
      const nestedEvent = (parsedRecord.event ?? {}) as Record<string, unknown>;
      const nestedData = (parsedRecord.data ?? {}) as Record<string, unknown>;

      let rawType = (
        parsedRecord.type ??
        nestedEvent.type ??
        parsedRecord.eventType ??
        nestedData.type
      ) as string | undefined;

      // Some local forwarders/proxies send only the Stripe object, not the full Event envelope.
      if (!rawType) {
        const objectType = String(parsedRecord.object ?? '');
        if (objectType === 'checkout.session') rawType = 'checkout.session.completed';
        else if (objectType === 'invoice') rawType = 'invoice.payment_succeeded';
        else if (objectType === 'customer.subscription') rawType = 'customer.subscription.updated';
      }

      const eventObject =
        (nestedData.object as Record<string, unknown> | undefined) ??
        ((nestedEvent.data as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined) ??
        parsedRecord;

      stripeEvent = {
        id: (parsedRecord.id as string | undefined) ?? (nestedEvent.id as string | undefined) ?? `dev_${Date.now()}`,
        type: rawType ?? 'unknown',
        data: { object: eventObject },
        created: (parsedRecord.created as number | undefined) ?? Math.floor(Date.now() / 1000),
      } as unknown as Stripe.Event;
    } else {
      stripeEvent = s.webhooks.constructEvent(rawBody, signature, secret);
    }

    const normalizedType = STRIPE_EVENT_MAP[stripeEvent.type] ?? 'unknown';

    return {
      id: stripeEvent.id,
      type: normalizedType,
      data: (stripeEvent.data as { object: Record<string, unknown> }).object ?? {},
      rawEvent: stripeEvent,
      provider: 'stripe',
    };
  }

  // -----------------------------------------------------------------------
  // Refunds
  // -----------------------------------------------------------------------

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const s = this.ensureStripe();

    const refundData: Stripe.RefundCreateParams = {
      amount: params.amount,
      reason: (params.reason as Stripe.RefundCreateParams['reason']) ?? undefined,
      metadata: params.metadata ?? {},
    };

    if (params.paymentIntentId) {
      refundData.payment_intent = params.paymentIntentId;
    } else if (params.chargeId) {
      refundData.charge = params.chargeId;
    }

    const refund = await s.refunds.create(refundData);

    return {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status ?? 'succeeded',
      paymentIntentId: typeof refund.payment_intent === 'string' ? refund.payment_intent : undefined,
      chargeId: typeof refund.charge === 'string' ? refund.charge : undefined,
    };
  }

  // -----------------------------------------------------------------------
  // Subscription Management
  // -----------------------------------------------------------------------

  async retrieveSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    const s = this.ensureStripe();
    const sub = await s.subscriptions.retrieve(subscriptionId, { expand: ['items.data'] });
    return this.mapSubscription(sub);
  }

  async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<GatewaySubscription> {
    const s = this.ensureStripe();

    const updateParams: Stripe.SubscriptionUpdateParams = {};

    if (params.items) {
      updateParams.items = params.items.map((item) => ({
        id: item.id,
        price: item.priceId,
      }));
    }
    if (params.prorationBehavior) {
      updateParams.proration_behavior = params.prorationBehavior;
    }
    if (params.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = params.cancelAtPeriodEnd;
    }

    const sub = await s.subscriptions.update(subscriptionId, updateParams);
    return this.mapSubscription(sub);
  }

  async cancelSubscription(subscriptionId: string, params?: CancelSubscriptionParams): Promise<void> {
    const s = this.ensureStripe();
    await s.subscriptions.cancel(subscriptionId, {
      prorate: params?.prorate,
      invoice_now: params?.invoiceNow,
    });
  }

  // -----------------------------------------------------------------------
  // Customer
  // -----------------------------------------------------------------------

  async retrieveCustomer(customerId: string): Promise<GatewayCustomer> {
    const s = this.ensureStripe();
    const customer = await s.customers.retrieve(customerId);

    if (customer.deleted) {
      return { id: customerId, email: null, deleted: true };
    }

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata as Record<string, string>,
      deleted: false,
    };
  }

  // -----------------------------------------------------------------------
  // Session / Invoice retrieval
  // -----------------------------------------------------------------------

  async retrieveCheckoutSession(sessionId: string, expand?: string[]): Promise<GatewayCheckoutSession> {
    const s = this.ensureStripe();

    const session = await s.checkout.sessions.retrieve(sessionId, {
      expand: expand ?? [],
    });

    let subscription: GatewaySubscription | undefined;
    if (session.subscription && typeof session.subscription !== 'string') {
      subscription = this.mapSubscription(session.subscription as Stripe.Subscription);
    }

    return {
      id: session.id,
      mode: session.mode ?? '',
      paymentStatus: session.payment_status ?? '',
      status: session.status ?? '',
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      customerId: typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer)?.id,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription)?.id,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      metadata: (session.metadata ?? {}) as Record<string, string>,
      url: session.url ?? undefined,
      created: session.created,
      subscription,
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<GatewayInvoice> {
    const s = this.ensureStripe();
    const invoice = await s.invoices.retrieve(invoiceId);
    return this.mapInvoice(invoice);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Access the raw Stripe SDK instance.
   * Use sparingly — prefer the adapter methods for gateway-agnostic code.
   */
  getRawClient(): Stripe | null {
    return this.stripe;
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
    }
    return this.stripe;
  }

  private mapSubscription(sub: Stripe.Subscription): GatewaySubscription {
    return {
      id: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      items: (sub.items?.data ?? []).map((item) => ({
        id: item.id,
        priceId: typeof item.price === 'string' ? item.price : item.price.id,
      })),
      metadata: sub.metadata as Record<string, string>,
    };
  }

  private mapInvoice(invoice: Stripe.Invoice): GatewayInvoice {
    return {
      id: invoice.id,
      customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as Stripe.Customer)?.id ?? '',
      subscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as Stripe.Subscription)?.id,
      amountPaid: invoice.amount_paid ?? 0,
      amountDue: invoice.amount_due ?? 0,
      currency: invoice.currency ?? 'usd',
      status: invoice.status ?? '',
      paymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : undefined,
      chargeId: typeof invoice.charge === 'string' ? invoice.charge : undefined,
      billingReason: invoice.billing_reason ?? undefined,
      invoiceNumber: invoice.number ?? undefined,
      tax: invoice.tax ?? undefined,
      periodStart: invoice.period_start ?? undefined,
      periodEnd: invoice.period_end ?? undefined,
      attemptCount: invoice.attempt_count ?? undefined,
      nextPaymentAttempt: invoice.next_payment_attempt ?? undefined,
      paidAt: invoice.status_transitions?.paid_at ?? undefined,
      lineItems: (invoice.lines?.data ?? []).map((line) => ({
        priceId: typeof line.price === 'object' && line.price ? line.price.id : undefined,
      })),
      paymentMethodTypes: (invoice as unknown as Record<string, unknown>).payment_method_types as string[] | undefined,
      lastFinalizationError: invoice.last_finalization_error
        ? { message: invoice.last_finalization_error.message ?? undefined, code: invoice.last_finalization_error.code ?? undefined }
        : undefined,
      rawData: JSON.parse(JSON.stringify(invoice)) as Record<string, unknown>,
    };
  }
}
