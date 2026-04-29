import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { PaymentService } from '../services/payment-service.js';
import Stripe from 'stripe';
import { getPaymentGateway } from '../adapters/index.js';
import { RazorpayPaymentGateway } from '../adapters/razorpay.adapter.js';
import type { NormalizedWebhookEvent } from '../adapters/types.js';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, subscriptions, tenantUsers } from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { normalizeStripeSubscriptionStatus } from '../services/subscription-webhook-handler.js';

const paymentGateway = getPaymentGateway();

// Dedicated Razorpay instance for webhook/verify routes.
// Always a RazorpayPaymentGateway regardless of PAYMENT_GATEWAY_PROVIDER,
// so the Razorpay routes are self-contained and never conflict with Stripe.
const razorpayGateway = new RazorpayPaymentGateway();

export default async function paymentRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // Get payment history for current tenant
  fastify.get('/history', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = (request as any).userContext;
    if (!ctx?.isAdmin && !ctx?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = ctx?.tenantId;
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const query = request.query as Record<string, string | undefined>;
      const page = query?.page ?? '1';
      const limit = query?.limit ?? '50';
      const paymentHistory = await PaymentService.getPaymentHistory(tenantId, parseInt(limit, 10));

      return {
        payments: paymentHistory,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      };
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to get payment history');
      return reply.code(500).send({ error: 'Failed to retrieve payment history' });
    }
  });

  // Get payment statistics for current tenant
  fastify.get('/stats', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = (request as any).userContext;
    if (!ctx?.isAdmin && !ctx?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = ctx?.tenantId;
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const stats = await PaymentService.getPaymentStats(tenantId);
      return { stats };
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to get payment stats');
      return reply.code(500).send({ error: 'Failed to retrieve payment statistics' });
    }
  });

  // Get payment methods for current tenant
  fastify.get('/methods', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).userContext?.tenantId;
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const methods = await PaymentService.getPaymentMethods(tenantId);
      return { methods };
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to get payment methods');
      return reply.code(500).send({ error: 'Failed to retrieve payment methods' });
    }
  });

  // Get payment analytics for current tenant
  fastify.get('/analytics', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = (request as any).userContext;
    if (!ctx?.isAdmin && !ctx?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = ctx?.tenantId;
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const stats = await PaymentService.getPaymentStats(tenantId);
      const history = await PaymentService.getPaymentHistory(tenantId, 10);

      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);

      const currentMonthPayments = history.filter(p =>
        (p.paidAt ?? new Date(0)) >= currentMonth && p.status === 'succeeded'
      );
      const lastMonthPayments = history.filter(p =>
        (p.paidAt ?? new Date(0)) >= lastMonth && (p.paidAt ?? new Date(0)) < currentMonth && p.status === 'succeeded'
      );

      const currentMonthRevenue = currentMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const revenueGrowth = lastMonthRevenue > 0
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      return {
        success: true,
        data: {
          totalRevenue: stats.totalPaid,
          monthlyRevenue: stats.monthlySpend,
          growth: {
            revenue: revenueGrowth,
            users: 0
          },
          percentageChange: revenueGrowth
        }
      };
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to get payment analytics');
      return reply.code(500).send({ error: 'Failed to retrieve payment analytics' });
    }
  });

  // Comprehensive Stripe Webhook Handler
  fastify.post('/webhook/stripe', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      request.log.error('STRIPE_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
      const rawBody = request.rawBody || Buffer.from(JSON.stringify(request.body));
      const normalized = await paymentGateway.verifyWebhook(
        rawBody as Buffer,
        (sig ?? '') as string,
        endpointSecret
      );
      event = normalized.rawEvent as Stripe.Event;
    } catch (err: unknown) {
      const e = err as Error;
      request.log.warn({ err: e.message }, 'Stripe webhook signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    try {
      await handleStripeEvent(event);
      return reply.code(200).send({ received: true });
    } catch (err: unknown) {
      request.log.error({ err, eventType: event.type }, 'Stripe webhook handler failed');
      return reply.code(500).send({ error: 'Webhook handler failed' });
    }
  });

  // ---------------------------------------------------------------------------
  // Razorpay Webhook Handler  —  POST /webhook/razorpay
  // ---------------------------------------------------------------------------
  fastify.post('/webhook/razorpay', { schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['x-razorpay-signature'] as string | undefined;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      request.log.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    let normalized: NormalizedWebhookEvent;

    try {
      const rawBody = request.rawBody || Buffer.from(JSON.stringify(request.body));
      normalized = await razorpayGateway.verifyWebhook(rawBody as Buffer, sig ?? '', secret);
    } catch (err: unknown) {
      const e = err as Error;
      request.log.warn({ err: e.message }, 'Razorpay webhook signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    try {
      await handleRazorpayEvent(normalized);
      return reply.code(200).send({ received: true });
    } catch (err: unknown) {
      request.log.error({ err, eventType: normalized.type }, 'Razorpay webhook handler failed');
      return reply.code(500).send({ error: 'Webhook handler failed' });
    }
  });

  // ---------------------------------------------------------------------------
  // Razorpay verify-payment  —  POST /razorpay/verify-payment
  //
  // Called by the frontend after the Razorpay popup closes.
  // We verify the HMAC, record the payment, and activate the plan immediately
  // so users see the update without waiting for the async webhook.
  // The subsequent payment.captured webhook is idempotent.
  // ---------------------------------------------------------------------------
  fastify.post('/razorpay/verify-payment', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = (request.body as Record<string, string>) ?? {};

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return reply.code(400).send({ error: 'Missing required Razorpay payment fields' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return reply.code(500).send({ error: 'Razorpay not configured' });
    }

    // Razorpay HMAC: SHA256( order_id + "|" + payment_id )
    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      request.log.warn('Razorpay payment signature verification failed');
      return reply.code(400).send({ error: 'Invalid payment signature' });
    }

    try {
      const tenantId = (request as any).userContext?.tenantId as string | undefined;
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      // Fetch order from Razorpay to get the real amount + notes/metadata.
      let amountPaise = 0;
      let currency = 'INR';
      let planId: string | undefined;
      let billingCycle = 'yearly';

      try {
        const order = await razorpayGateway.retrieveCheckoutSession(razorpay_order_id);
        amountPaise = order.amountTotal ?? 0;
        currency    = (order.currency ?? 'inr').toUpperCase();
        planId      = order.metadata?.planId;
        billingCycle = order.metadata?.billingCycle ?? 'yearly';
      } catch (fetchErr) {
        request.log.warn({ err: fetchErr }, 'Could not fetch Razorpay order details (non-fatal)');
      }

      // Record payment — the webhook's payment.captured is idempotent and will update this.
      await PaymentService.recordPayment({
        tenantId,
        stripePaymentIntentId: razorpay_payment_id, // reusing column for Razorpay payment_id
        amount:        (amountPaise / 100).toString(),
        currency,
        status:        'succeeded',
        paymentMethod: 'razorpay',
        paymentType:   'subscription',
        description:   `Razorpay payment ${razorpay_payment_id}`,
        metadata:      { razorpay_order_id, razorpay_payment_id },
        paidAt:        new Date(),
      });

      // Activate plan immediately so the user sees the updated subscription without
      // having to wait for the async webhook.
      if (planId) {
        try {
          const { SubscriptionService } = await import('../services/subscription-service.js');
          await SubscriptionService.handleCheckoutCompleted({
            metadata: { tenantId, planId, billingCycle },
            mode:     'payment',
            customer: null,
          });
        } catch (planErr) {
          request.log.error({ err: planErr }, 'Failed to activate plan via verify-payment (non-fatal)');
        }
      }

      return reply.code(200).send({ success: true, paymentId: razorpay_payment_id });
    } catch (err: unknown) {
      request.log.error({ err }, 'Error recording Razorpay payment');
      return reply.code(500).send({ error: 'Failed to record payment' });
    }
  });
}

// =============================================================================
// Stripe Event Dispatcher
// =============================================================================

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const eventType = event.type;
  const data = event.data.object;

  switch (eventType as string) {
    case 'payment_intent.processing':
      await handlePaymentIntentProcessing(data);
      break;

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(data);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(data);
      break;

    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(data);
      break;

    case 'payment_intent.requires_action':
      await handlePaymentIntentRequiresAction(data);
      break;

    case 'invoice.finalized':
      await handleInvoiceFinalized(data);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(data);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(data);
      break;

    case 'invoice.payment_action_required':
      await handleInvoicePaymentActionRequired(data);
      break;

    case 'customer.subscription.created':
      await handleSubscriptionCreated(data);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(data);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(data);
      break;

    case 'charge.succeeded':
      await handleChargeSucceeded(data);
      break;

    case 'charge.failed':
      await handleChargeFailed(data);
      break;

    case 'charge.captured':
      // charge.captured fires when a previously uncaptured charge is captured.
      // For typical card payments the charge is auto-captured; we handle the
      // payment via payment_intent.succeeded / invoice.payment_succeeded instead.
      break;

    case 'charge.refunded':
      await handleChargeRefunded(data);
      break;

    case 'charge.dispute.created':
      await handleDisputeCreated(data);
      break;

    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(data);
      break;

    default:
      // Silently ignore unregistered event types — Stripe sends many events.
      break;
  }
}

// =============================================================================
// Payment Intent Handlers
// =============================================================================

async function handlePaymentIntentProcessing(paymentIntent: any) {
  await PaymentService.updatePaymentStatus(
    paymentIntent.id,
    'processing',
    {
      processing_started: new Date().toISOString(),
      payment_method: paymentIntent.payment_method_types?.[0]
    }
  );
}

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const tenantId = await findTenantByCustomer(paymentIntent.customer);
  if (!tenantId) {
    console.warn('Payment intent succeeded but no tenant found for customer:', paymentIntent.customer);
    return;
  }

  const existingPayment = await PaymentService.getPaymentByIntentId(paymentIntent.id);

  if (existingPayment) {
    await PaymentService.updatePaymentStatus(
      paymentIntent.id,
      'succeeded',
      {
        succeeded_at: new Date().toISOString(),
        latest_charge: paymentIntent.latest_charge,
        processing_fees: paymentIntent.application_fee_amount || 0,
        net_amount: paymentIntent.amount - (paymentIntent.application_fee_amount || 0)
      }
    );
  } else {
    await PaymentService.recordPayment({
      tenantId,
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: paymentIntent.customer,
      stripeChargeId: paymentIntent.latest_charge,
      amount: (paymentIntent.amount / 100).toString(),
      currency: paymentIntent.currency.toUpperCase(),
      status: 'succeeded',
      paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
      paymentType: 'subscription',
      description: paymentIntent.description || 'Subscription payment',
      processingFees: paymentIntent.application_fee_amount ? (paymentIntent.application_fee_amount / 100).toString() : '0',
      netAmount: ((paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100).toString(),
      metadata: paymentIntent.metadata || {},
      stripeRawData: paymentIntent,
      paidAt: new Date()
    });
  }

  // Send payment confirmation email
  try {
    const userInfo = await getTenantAdminEmail(tenantId);
    if (userInfo?.email) {
      const { EmailService } = await import('../../../utils/email.js');
      const emailService = new EmailService();

      const planId = (paymentIntent.metadata?.planId as string) ?? undefined;
      const billingCycle = paymentIntent.metadata?.billingCycle || 'yearly';

      let planName = 'Premium Plan';
      if (planId) {
        const { SubscriptionService } = await import('../services/subscription-service.js');
        const plans = await SubscriptionService.getAvailablePlans();
        const plan = plans.find(p => p.id === planId);
        if (plan) planName = (plan as any).name ?? planName;
      }

      await emailService.sendPaymentConfirmation({
        tenantId,
        userEmail: userInfo.email,
        userName: userInfo.name,
        paymentType: 'subscription',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        transactionId: paymentIntent.id,
        planName,
        billingCycle,
        sessionId: paymentIntent.id
      });
    }
  } catch (emailError) {
    console.error('Failed to send payment confirmation email:', emailError);
  }
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  await PaymentService.updatePaymentStatus(
    paymentIntent.id,
    'failed',
    {
      failed_at: new Date().toISOString(),
      failure_code: paymentIntent.last_payment_error?.code,
      failure_message: paymentIntent.last_payment_error?.message,
      decline_code: paymentIntent.last_payment_error?.decline_code
    }
  );
}

async function handlePaymentIntentCanceled(paymentIntent: any) {
  await PaymentService.updatePaymentStatus(
    paymentIntent.id,
    'canceled',
    {
      canceled_at: new Date().toISOString(),
      cancellation_reason: paymentIntent.cancellation_reason
    }
  );
}

async function handlePaymentIntentRequiresAction(paymentIntent: any) {
  await PaymentService.updatePaymentStatus(
    paymentIntent.id,
    'requires_action',
    {
      action_required_at: new Date().toISOString(),
      next_action: paymentIntent.next_action
    }
  );
}

// =============================================================================
// Invoice Handlers
// =============================================================================

async function handleInvoiceFinalized(invoice: any) {
  // invoice.payment_intent is null for $0 invoices; skip the update if missing.
  if (!invoice.payment_intent) return;

  try {
    const tenantId = await findTenantByCustomer(invoice.customer);
    if (!tenantId) return;

    await PaymentService.updatePaymentStatus(
      invoice.payment_intent,
      'pending',
      {
        invoice_finalized: true,
        invoice_number: invoice.number,
        finalized_at: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error handling invoice finalization:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  const tenantId = await findTenantByCustomer(invoice.customer);
  if (!tenantId) return;

  await PaymentService.recordPayment({
    tenantId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    stripeSubscriptionId: invoice.subscription,
    stripeCustomerId: invoice.customer,
    amount: (invoice.amount_paid / 100).toString(),
    currency: invoice.currency.toUpperCase(),
    status: 'succeeded',
    paymentType: 'subscription',
    billingReason: invoice.billing_reason,
    invoiceNumber: invoice.number,
    description: `Invoice ${invoice.number} payment`,
    taxAmount: (invoice.tax / 100).toString(),
    metadata: invoice.metadata || {},
    stripeRawData: invoice,
    paidAt: new Date(invoice.status_transitions.paid_at * 1000)
  });
}

async function handleInvoicePaymentFailed(invoice: any) {
  const tenantId = await findTenantByCustomer(invoice.customer);
  if (!tenantId) return;

  await PaymentService.recordPayment({
    tenantId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    stripeSubscriptionId: invoice.subscription,
    stripeCustomerId: invoice.customer,
    amount: (invoice.amount_due / 100).toString(),
    currency: invoice.currency.toUpperCase(),
    status: 'failed',
    paymentType: 'subscription',
    billingReason: invoice.billing_reason,
    invoiceNumber: invoice.number,
    description: `Invoice ${invoice.number} payment failed`,
    metadata: invoice.metadata || {},
    stripeRawData: invoice,
    failedAt: new Date()
  });
}

async function handleInvoicePaymentActionRequired(invoice: any) {
  if (!invoice.payment_intent) return;

  try {
    const tenantId = await findTenantByCustomer(invoice.customer);
    if (!tenantId) return;

    await PaymentService.updatePaymentStatus(
      invoice.payment_intent,
      'requires_action',
      {
        action_required: true,
        invoice_id: invoice.id,
        next_action: invoice.payment_intent?.next_action,
        action_required_at: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error handling invoice payment action required:', error);
  }
}

// =============================================================================
// Charge Handlers
// =============================================================================

async function handleChargeSucceeded(charge: any) {
  if (charge.payment_intent) {
    await PaymentService.updatePaymentStatus(
      charge.payment_intent,
      'succeeded',
      {
        charge_id: charge.id,
        receipt_url: charge.receipt_url,
        payment_method_details: charge.payment_method_details,
        outcome: charge.outcome,
        risk_level: charge.outcome?.risk_level,
        risk_score: charge.outcome?.risk_score
      }
    );
  }
}

async function handleChargeFailed(charge: any) {
  if (charge.payment_intent) {
    await PaymentService.updatePaymentStatus(
      charge.payment_intent,
      'failed',
      {
        charge_id: charge.id,
        failure_code: charge.failure_code,
        failure_message: charge.failure_message,
        outcome: charge.outcome
      }
    );
  }
}

async function handleChargeRefunded(charge: any) {
  if (charge.payment_intent) {
    await PaymentService.updatePaymentStatus(
      charge.payment_intent,
      charge.amount_refunded === charge.amount ? 'refunded' : 'partially_refunded',
      {
        refunded_at: new Date().toISOString(),
        amount_refunded: charge.amount_refunded / 100,
        refunds: charge.refunds
      }
    );
  }
}

// =============================================================================
// Dispute Handlers
// =============================================================================

async function handleDisputeCreated(dispute: any) {
  const maybeStripeClient = (paymentGateway as unknown as { getRawClient?: () => Stripe | null }).getRawClient?.();
  if (!maybeStripeClient) {
    console.warn('Stripe client unavailable in current payment gateway; skipping dispute charge lookup');
    return;
  }

  const charge = await maybeStripeClient.charges.retrieve(dispute.charge);
  if (charge.payment_intent) {
    await PaymentService.recordDispute(
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : (charge.payment_intent as any)?.id ?? '',
      {
        disputeId: dispute.id,
        amount: dispute.amount / 100,
        reason: dispute.reason,
        status: dispute.status,
        currency: dispute.currency,
        evidenceDueBy: new Date(dispute.evidence_details.due_by * 1000).toISOString(),
        hasEvidence: dispute.evidence_details.has_evidence
      }
    );
  }
}

// =============================================================================
// Subscription Handlers
// =============================================================================

async function handleSubscriptionCreated(subscription: any) {
  try {
    let tenantId = await findTenantByCustomer(subscription.customer);

    // Fallback: look up by the Stripe subscription ID already stored in our DB
    if (!tenantId) {
      const [existing] = await db
        .select({ tenantId: subscriptions.tenantId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
        .limit(1);
      if (existing) tenantId = existing.tenantId;
    }

    if (!tenantId) {
      console.warn(`No tenant found for subscription ${subscription.id} with customer ${subscription.customer}`);
      return;
    }

    // Backfill stripeCustomerId on the tenant if missing
    const [tenant] = await db
      .select({ stripeCustomerId: tenants.stripeCustomerId })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);

    if (tenant && !tenant.stripeCustomerId) {
      await db
        .update(tenants)
        .set({ stripeCustomerId: subscription.customer, updatedAt: new Date() })
        .where(eq(tenants.tenantId, tenantId));
    }

    // Sync subscription status
    await db
      .update(subscriptions)
      .set({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer,
        status: normalizeStripeSubscriptionStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.tenantId, tenantId));
  } catch (error) {
    console.error('Error handling subscription creation:', error);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  try {
    await db
      .update(subscriptions)
      .set({
        status: normalizeStripeSubscriptionStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  try {
    await db
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

// =============================================================================
// Checkout Session Handler
// =============================================================================

async function handleCheckoutSessionCompleted(session: any) {
  try {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) {
      console.warn('No tenantId in checkout session metadata');
      return;
    }

    const planId = session.metadata?.planId || session.metadata?.packageId;
    if (!planId) {
      console.warn('No planId in checkout session metadata');
      return;
    }

    const { SubscriptionService } = await import('../services/subscription-service.js');

    const availablePlans = await SubscriptionService.getAvailablePlans();
    const planDetails = availablePlans.find(p => p.id === planId);
    if (!planDetails) {
      console.warn(`Could not find plan details for planId: ${planId}`);
      return;
    }

    const checkoutCurrency = String(session.metadata?.checkoutCurrency ?? 'usd').toLowerCase();
    const yearlyUsd = Number((planDetails as { yearlyPrice?: number }).yearlyPrice ?? 0);
    const yearlyInr = Number((planDetails as { yearlyPriceInr?: number }).yearlyPriceInr ?? 0);
    const amountMinor =
      checkoutCurrency === 'inr' ? Math.round(yearlyInr * 100) : Math.round(yearlyUsd * 100);

    const planConfig = {
      id: planDetails.id,
      amount: amountMinor,
      credits: planDetails.credits ?? planDetails.freeCredits ?? 0,
      billingCycle: 'yearly' as const
    };

    // Backfill stripeCustomerId on tenant
    if (session.customer) {
      await db
        .update(tenants)
        .set({ stripeCustomerId: session.customer, updatedAt: new Date() })
        .where(eq(tenants.tenantId, tenantId));
    }

    if (session.mode === 'subscription') {
      await SubscriptionService.handleCheckoutCompleted(session);
    }

    // Send confirmation email for non-subscription modes (e.g. credit purchases)
    if (session.mode !== 'subscription') {
      try {
        const userInfo = await getTenantAdminEmail(tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../utils/email.js');
          const emailService = new EmailService();
          const amount = session.amount_total ? session.amount_total / 100 : planConfig.amount / 100;
          const currency = session.currency?.toUpperCase() || 'USD';
          const dollarAmount = session.metadata?.dollarAmount ? parseFloat(session.metadata.dollarAmount) : null;
          const creditsAdded = dollarAmount ? Math.floor(dollarAmount * 1000) : null;

          await emailService.sendPaymentConfirmation({
            tenantId,
            userEmail: userInfo.email,
            userName: userInfo.name,
            paymentType: 'credit_purchase',
            amount: dollarAmount ?? amount,
            currency,
            transactionId: session.id,
            planName: 'Credit Purchase',
            billingCycle: undefined,
            creditsAdded: creditsAdded ?? undefined,
            sessionId: session.id
          });
        }
      } catch (emailError) {
        console.error('Failed to send payment confirmation email:', emailError);
      }
    }
  } catch (error) {
    console.error('Error handling checkout session completion:', error);
    throw error;
  }
}

// =============================================================================
// Utility Helpers
// =============================================================================

async function findTenantByCustomer(customerId: unknown): Promise<string | null> {
  if (!customerId) return null;

  try {
    const [tenant] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.stripeCustomerId, customerId as string))
      .limit(1);

    return tenant?.tenantId ?? null;
  } catch (error) {
    console.error('Error finding tenant by customer:', error);
    return null;
  }
}

export async function getTenantAdminEmail(tenantId: unknown): Promise<{ email: string; name: string } | null> {
  if (!tenantId) return null;

  try {
    // Prefer the tenant admin user
    const [adminUser] = await db
      .select({ email: tenantUsers.email, name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')` })
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId as string),
        eq(tenantUsers.isTenantAdmin, true),
        eq(tenantUsers.isActive, true)
      ))
      .limit(1);

    if (adminUser?.email) {
      return { email: adminUser.email, name: adminUser.name || 'User' };
    }

    // Fallback: any active user
    const [anyUser] = await db
      .select({ email: tenantUsers.email, name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')` })
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId as string),
        eq(tenantUsers.isActive, true)
      ))
      .limit(1);

    if (anyUser?.email) {
      return { email: anyUser.email, name: anyUser.name || 'User' };
    }

    // Last resort: tenant admin email
    const [tenant] = await db
      .select({ adminEmail: tenants.adminEmail, companyName: tenants.companyName })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId as string))
      .limit(1);

    if (tenant?.adminEmail) {
      return { email: tenant.adminEmail, name: tenant.companyName || 'User' };
    }

    return null;
  } catch (error) {
    console.error('Error getting tenant admin email:', error);
    return null;
  }
}

// =============================================================================
// Razorpay Event Dispatcher
// =============================================================================

async function handleRazorpayEvent(event: NormalizedWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'checkout.completed':
      await handleRazorpayOrderPaid(event.data);
      break;
    case 'payment.succeeded':
      await handleRazorpayPaymentCaptured(event.data);
      break;
    case 'payment.failed':
      await handleRazorpayPaymentFailed(event.data);
      break;
    case 'subscription.created':
      await handleRazorpaySubscriptionActivated(event.data);
      break;
    case 'invoice.payment_paid':
      await handleRazorpaySubscriptionCharged(event.data);
      break;
    case 'subscription.deleted':
      await handleRazorpaySubscriptionCancelled(event.data);
      break;
    default:
      // Silently ignore unregistered Razorpay event types.
      break;
  }
}

// ---------------------------------------------------------------------------
// Helper — extract tenantId from Razorpay entity `notes`
// ---------------------------------------------------------------------------
function findTenantFromRazorpayNotes(data: Record<string, unknown>): string | null {
  const notes = data.notes as Record<string, unknown> | undefined;
  return (notes?.tenantId as string | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// order.paid → checkout.completed
// ---------------------------------------------------------------------------
async function handleRazorpayOrderPaid(data: Record<string, unknown>) {
  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) {
    console.warn('No tenantId in Razorpay order notes — skipping');
    return;
  }

  const amountPaise = (data.amount as number) ?? 0;
  const currency    = ((data.currency as string) ?? 'INR').toUpperCase();

  await PaymentService.recordPayment({
    tenantId,
    stripePaymentIntentId: data.id as string,
    amount:        (amountPaise / 100).toString(),
    currency,
    status:        'succeeded',
    paymentMethod: 'razorpay',
    paymentType:   'subscription',
    description:   `Razorpay order ${data.id as string} paid`,
    metadata:      { razorpay_order_id: data.id as string },
    paidAt:        new Date(),
  });

  const notes = data.notes as Record<string, unknown> | undefined;
  const planId      = notes?.planId as string | undefined;
  const billingCycle = (notes?.billingCycle as string) ?? 'yearly';

  if (planId) {
    try {
      const { SubscriptionService } = await import('../services/subscription-service.js');
      await SubscriptionService.handleCheckoutCompleted({
        metadata: { tenantId, planId, billingCycle },
        mode:     'payment',
        customer: null,
      });
    } catch (err) {
      console.error('Failed to activate plan on Razorpay order.paid:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// payment.captured → payment.succeeded
// ---------------------------------------------------------------------------
async function handleRazorpayPaymentCaptured(data: Record<string, unknown>) {
  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) {
    console.warn('No tenantId in Razorpay payment notes — skipping');
    return;
  }

  const amountPaise = (data.amount as number) ?? 0;

  await PaymentService.recordPayment({
    tenantId,
    stripePaymentIntentId: data.id as string,
    amount:        (amountPaise / 100).toString(),
    currency:      ((data.currency as string) ?? 'INR').toUpperCase(),
    status:        'succeeded',
    paymentMethod: (data.method as string) ?? 'razorpay',
    paymentType:   'subscription',
    description:   `Razorpay payment ${data.id as string} captured`,
    metadata: {
      razorpay_payment_id: data.id as string,
      razorpay_order_id:   (data.order_id as string) ?? '',
    },
    paidAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// payment.failed
// ---------------------------------------------------------------------------
async function handleRazorpayPaymentFailed(data: Record<string, unknown>) {
  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  const amountPaise = (data.amount as number) ?? 0;

  await PaymentService.recordPayment({
    tenantId,
    stripePaymentIntentId: data.id as string,
    amount:        (amountPaise / 100).toString(),
    currency:      ((data.currency as string) ?? 'INR').toUpperCase(),
    status:        'failed',
    paymentMethod: 'razorpay',
    paymentType:   'subscription',
    description:   `Razorpay payment ${data.id as string} failed`,
    metadata: {
      error_code:        (data.error_code as string)        ?? '',
      error_description: (data.error_description as string) ?? '',
    },
    failedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// subscription.activated
// ---------------------------------------------------------------------------
async function handleRazorpaySubscriptionActivated(data: Record<string, unknown>) {
  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  try {
    await db
      .update(subscriptions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, tenantId));
  } catch (error) {
    console.error('Error updating subscription on Razorpay activation:', error);
  }
}

// ---------------------------------------------------------------------------
// subscription.charged (renewal)
// ---------------------------------------------------------------------------
async function handleRazorpaySubscriptionCharged(data: Record<string, unknown>) {
  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  const amountPaise =
    (data.amount_paid as number) ??
    (data.amount      as number) ?? 0;

  await PaymentService.recordPayment({
    tenantId,
    stripePaymentIntentId: data.id as string,
    amount:        (amountPaise / 100).toString(),
    currency:      ((data.currency as string) ?? 'INR').toUpperCase(),
    status:        'succeeded',
    paymentMethod: 'razorpay',
    paymentType:   'subscription',
    description:   `Razorpay subscription ${data.id as string} renewal charged`,
    metadata:      { subscription_id: data.id as string },
    paidAt:        new Date(),
  });
}

// ---------------------------------------------------------------------------
// subscription.cancelled
// ---------------------------------------------------------------------------
async function handleRazorpaySubscriptionCancelled(data: Record<string, unknown>) {
  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  try {
    await db
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, tenantId));
  } catch (error) {
    console.error('Error updating subscription on Razorpay cancellation:', error);
  }
}
