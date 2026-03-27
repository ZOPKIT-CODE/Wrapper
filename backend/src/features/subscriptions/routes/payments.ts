import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { PaymentService } from '../services/payment-service.js';
import Stripe from 'stripe';
import { getPaymentGateway } from '../adapters/index.js';
import { RazorpayPaymentGateway } from '../adapters/razorpay.adapter.js';
import type { NormalizedWebhookEvent } from '../adapters/types.js';

const paymentGateway = getPaymentGateway();

// Dedicated Razorpay instance for webhook/verify routes.
// Always a RazorpayPaymentGateway regardless of PAYMENT_GATEWAY_PROVIDER,
// so the Razorpay routes are self-contained and never conflict with Stripe.
const razorpayGateway = new RazorpayPaymentGateway();

export default async function paymentRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  type ReqWithUser = FastifyRequest & { userContext?: { isAuthenticated?: boolean; tenantId?: string; isAdmin?: boolean; isTenantAdmin?: boolean } };
  // Get payment history for current tenant
  fastify.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as any).userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can view payment history
    if (!(request as any).userContext?.isAdmin && !(request as any).userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = (request as any).userContext?.tenantId;
      
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const query = request.query as Record<string, string | undefined>;
      const page = query?.page ?? '1';
      const limit = query?.limit ?? '50';
      const paymentHistory = await PaymentService.getPaymentHistory(tenantId, parseInt(limit, 10));
      
      return {
        success: true,
        data: {
          payments: paymentHistory,
          pagination: { page: parseInt(page), limit: parseInt(limit) }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment history:', error);
      return reply.code(500).send({ error: 'Failed to retrieve payment history' });
    }
  });

  // Get payment statistics for current tenant
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as any).userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!(request as any).userContext?.isAdmin && !(request as any).userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = (request as any).userContext?.tenantId;
      
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const stats = await PaymentService.getPaymentStats(tenantId);
      return { success: true, data: { stats } };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment stats:', error);
      return reply.code(500).send({ error: 'Failed to retrieve payment statistics' });
    }
  });

  // Get payment methods for current tenant
  fastify.get('/methods', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as any).userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = (request as any).userContext?.tenantId;
      
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      const methods = await PaymentService.getPaymentMethods(tenantId);
      return { success: true, data: { methods } };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment methods:', error);
      return reply.code(500).send({ error: 'Failed to retrieve payment methods' });
    }
  });

  // Get payment analytics for current tenant (proxy to analytics endpoint)
  fastify.get('/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as any).userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!(request as any).userContext?.isAdmin && !(request as any).userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = (request as any).userContext?.tenantId;
      
      if (!tenantId) {
        return reply.code(400).send({ error: 'Tenant ID required' });
      }

      // Return basic payment analytics for dashboard
      const stats = await PaymentService.getPaymentStats(tenantId);
      const history = await PaymentService.getPaymentHistory(tenantId, 10);
      
      // Calculate revenue growth
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
          subscriptions: {
            active: 1, // This would come from subscription service
            trial: 0,
            expired: 0
          },
          growth: {
            revenue: revenueGrowth,
            users: 0 // This would come from user service
          },
          percentageChange: revenueGrowth
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment analytics:', error);
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
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
      // Get raw body for webhook verification
      const rawBody = request.rawBody || Buffer.from(JSON.stringify(request.body));
      
      // Verify and normalize with the payment gateway adapter.
      const normalized = await paymentGateway.verifyWebhook(
        rawBody as Buffer,
        (sig ?? '') as string,
        endpointSecret
      );
      event = normalized.rawEvent as Stripe.Event;
      console.log('✅ Webhook signature verified:', event.type);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('❌ Webhook signature verification failed:', e.message);
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    // Handle the event
    try {
      await handleStripeEvent(event);
      return reply.code(200).send({ received: true });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error handling webhook event:', error);
      return reply.code(500).send({ error: 'Webhook handler failed' });
    }
  });

  // ---------------------------------------------------------------------------
  // Razorpay Webhook Handler  —  POST /webhook/razorpay
  //
  // Uses a dedicated RazorpayPaymentGateway instance so this route always works
  // regardless of the PAYMENT_GATEWAY_PROVIDER env var (Stripe stays untouched).
  // ---------------------------------------------------------------------------
  fastify.post('/webhook/razorpay', { schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['x-razorpay-signature'] as string | undefined;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('❌ RAZORPAY_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    let normalized: NormalizedWebhookEvent;

    try {
      const rawBody = request.rawBody || Buffer.from(JSON.stringify(request.body));
      normalized = await razorpayGateway.verifyWebhook(rawBody as Buffer, sig ?? '', secret);
      console.log('✅ Razorpay webhook signature verified:', normalized.type);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('❌ Razorpay webhook signature verification failed:', e.message);
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    try {
      await handleRazorpayEvent(normalized);
      return reply.code(200).send({ received: true });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error handling Razorpay webhook event:', error);
      return reply.code(500).send({ error: 'Webhook handler failed' });
    }
  });

  // ---------------------------------------------------------------------------
  // Razorpay verify-payment  —  POST /razorpay/verify-payment
  //
  // Called by the frontend immediately after the Razorpay popup closes
  // (razorpay_payment_id + razorpay_order_id + razorpay_signature).
  // We verify the HMAC, fetch the order from Razorpay to get the amount/metadata,
  // then record the payment and trigger plan activation.
  // The subsequent payment.captured webhook is idempotent — it updates the same record.
  // ---------------------------------------------------------------------------
  fastify.post('/razorpay/verify-payment', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as any).userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

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
      console.error('❌ Razorpay payment signature verification failed');
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
        console.warn('⚠️ Could not fetch Razorpay order details (non-fatal):', fetchErr);
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
          console.log(`✅ Plan ${planId} activated for tenant ${tenantId} via verify-payment`);
        } catch (planErr) {
          console.error('❌ Failed to activate plan via verify-payment (non-fatal):', planErr);
        }
      }

      console.log(`✅ Razorpay payment verified: ${razorpay_payment_id} for tenant ${tenantId}`);
      return reply.code(200).send({ success: true, paymentId: razorpay_payment_id });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error recording Razorpay payment:', error);
      return reply.code(500).send({ error: 'Failed to record payment' });
    }
  });
}

// Comprehensive Stripe Event Handler
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const eventType = event.type;
  const data = event.data.object;

  console.log(`🔔 Processing Stripe event: ${eventType}`);

  try {
    switch (eventType as string) {
      // Payment Intent Events
      case 'payment_intent.created':
        await handlePaymentIntentCreated(data);
        break;
      
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

      // Payment Method Events
      case 'payment_method.attached':
        await handlePaymentMethodAttached(data);
        break;
      
      case 'payment_method.detached':
        await handlePaymentMethodDetached(data);
        break;

      // Invoice Events
      case 'invoice.created':
        await handleInvoiceCreated(data);
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

      // Subscription Events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(data);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(data);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data);
        break;

      // Charge Events
      case 'charge.succeeded':
        await handleChargeSucceeded(data);
        break;
      
      case 'charge.failed':
        await handleChargeFailed(data);
        break;
      
      case 'charge.captured':
        await handleChargeCaptured(data);
        break;
      
      case 'charge.refunded':
        await handleChargeRefunded(data);
        break;

      // Dispute Events
      case 'charge.dispute.created':
        await handleDisputeCreated(data);
        break;
      
      case 'charge.dispute.updated':
        await handleDisputeUpdated(data);
        break;
      
      case 'charge.dispute.closed':
        await handleDisputeClosed(data);
        break;

      // Refund Events
      case 'charge.refund.created':
        await handleRefundCreated(data);
        break;
      
      case 'charge.refund.updated':
        await handleRefundUpdated(data);
        break;

      // Customer Events
      case 'customer.created':
        await handleCustomerCreated(data);
        break;
      
      case 'customer.updated':
        await handleCustomerUpdated(data);
        break;
      
      case 'customer.deleted':
        await handleCustomerDeleted(data);
        break;

      // Checkout Events
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(data);
        break;
      
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(data);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${eventType}`);
        break;
    }

    console.log(`✅ Successfully processed ${eventType}`);
  } catch (error) {
    console.error(`❌ Error processing ${eventType}:`, error);
    throw error;
  }
}

// Payment Intent Event Handlers
async function handlePaymentIntentCreated(paymentIntent: any) {
  console.log('💳 Payment Intent Created:', paymentIntent.id);
  
  // Find tenant by customer ID
  const tenantId = await findTenantByCustomer(paymentIntent.customer);
  if (!tenantId) return;

  await PaymentService.recordPayment({
    tenantId,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer,
    amount: (paymentIntent.amount / 100).toString(),
    currency: paymentIntent.currency.toUpperCase(),
    status: 'processing',
    paymentMethod: paymentIntent.payment_method_types?.[0] || 'unknown',
    paymentType: 'subscription',
    description: paymentIntent.description || 'Subscription payment',
    metadata: paymentIntent.metadata || {},
    stripeRawData: paymentIntent
  });
}

async function handlePaymentIntentProcessing(paymentIntent: any) {
  console.log('⏳ Payment Intent Processing:', paymentIntent.id);
  
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
  console.log('✅ Payment Intent Succeeded:', paymentIntent.id);

  const tenantId = await findTenantByCustomer(paymentIntent.customer);
  if (!tenantId) {
    console.warn('⚠️ Payment intent succeeded but no tenant found for customer:', paymentIntent.customer);
    return;
  }

  // Check if payment record already exists
  const existingPayment = await PaymentService.getPaymentByIntentId(paymentIntent.id);

  if (existingPayment) {
    // Update existing payment
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
    // Create new payment record
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
      
      // Get plan name
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
    } else {
      console.warn('⚠️ Could not find user email for tenant:', tenantId);
    }
  } catch (emailError) {
    console.error('❌ Failed to send payment confirmation email:', emailError);
    // Don't fail the webhook if email fails
  }
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  console.log('❌ Payment Intent Failed:', paymentIntent.id);
  
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
  console.log('🚫 Payment Intent Canceled:', paymentIntent.id);
  
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
  console.log('⚠️ Payment Intent Requires Action:', paymentIntent.id);
  
  await PaymentService.updatePaymentStatus(
    paymentIntent.id, 
    'requires_action',
    { 
      action_required_at: new Date().toISOString(),
      next_action: paymentIntent.next_action
    }
  );
}

// Invoice Event Handlers
async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('📄 Invoice Payment Succeeded:', invoice.id);
  
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
  console.log('❌ Invoice Payment Failed:', invoice.id);
  
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

// Charge Event Handlers
async function handleChargeSucceeded(charge: any) {
  console.log('💰 Charge Succeeded:', charge.id);
  
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
  console.log('💸 Charge Failed:', charge.id);
  
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
  console.log('💸 Charge Refunded:', charge.id);
  
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

// Dispute Event Handlers
async function handleDisputeCreated(dispute: any) {
  console.log('⚖️ Dispute Created:', dispute.id);

  const maybeStripeClient = (paymentGateway as unknown as { getRawClient?: () => Stripe | null }).getRawClient?.();
  if (!maybeStripeClient) {
    console.warn('⚠️ Stripe client unavailable in current payment gateway; skipping dispute charge lookup');
    return;
  }

  const charge = await maybeStripeClient.charges.retrieve(dispute.charge);
  if (charge.payment_intent) {
    await PaymentService.recordDispute(typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent as any)?.id ?? '', {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      reason: dispute.reason,
      status: dispute.status,
      currency: dispute.currency,
      evidenceDueBy: new Date(dispute.evidence_details.due_by * 1000).toISOString(),
      hasEvidence: dispute.evidence_details.has_evidence
    });
  }
}

// Utility function to find tenant by Stripe customer ID
async function findTenantByCustomer(customerId: any) {
  if (!customerId) return null;

  try {
    const { db } = await import('../../../db/index.js');
    const { tenants } = await import('../../../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    const [tenant] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.stripeCustomerId, customerId))
      .limit(1);

    return tenant?.tenantId || null;
  } catch (error) {
    console.error('Error finding tenant by customer:', error);
    return null;
  }
}

// Export utility function to get tenant admin email
export async function getTenantAdminEmail(tenantId: any) {
  if (!tenantId) return null;

  try {
    const { db } = await import('../../../db/index.js');
    const { tenants, tenantUsers } = await import('../../../db/schema/index.js');
    const { eq, and } = await import('drizzle-orm');

    // First try to get from tenant admin users
    const [adminUser] = await db
      .select({ email: tenantUsers.email, name: tenantUsers.name })
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.isTenantAdmin, true),
        eq(tenantUsers.isActive, true)
      ))
      .limit(1);

    if (adminUser?.email) {
      return { email: adminUser.email, name: adminUser.name || 'User' };
    }

    // Fallback: get any active user from tenant
    const [anyUser] = await db
      .select({ email: tenantUsers.email, name: tenantUsers.name })
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.isActive, true)
      ))
      .limit(1);

    if (anyUser?.email) {
      return { email: anyUser.email, name: anyUser.name || 'User' };
    }

    // Last resort: try to get from Stripe customer
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
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

// Placeholder handlers for other events
async function handlePaymentMethodAttached(paymentMethod: any) {
  console.log('🔗 Payment Method Attached:', paymentMethod.id);

  try {
    const tenantId = await findTenantByCustomer(paymentMethod.customer);
    if (!tenantId) return;

    // Update payment method status in our database
    await PaymentService.recordPayment({
      tenantId,
      paymentMethod: paymentMethod.type,
      paymentMethodDetails: paymentMethod.card || paymentMethod,
      status: 'active',
      description: `Payment method ${paymentMethod.id} attached`
    } as any);
  } catch (error) {
    console.error('❌ Error handling payment method attachment:', error);
  }
}

async function handlePaymentMethodDetached(paymentMethod: any) {
  console.log('🔓 Payment Method Detached:', paymentMethod.id);

  try {
    const tenantId = await findTenantByCustomer(paymentMethod.customer);
    if (!tenantId) return;

    // Mark payment method as inactive in our database
    await PaymentService.recordPayment({
      tenantId,
      paymentMethod: paymentMethod.type,
      paymentMethodDetails: paymentMethod.card || paymentMethod,
      status: 'inactive',
      description: `Payment method ${paymentMethod.id} detached`
    } as any);
  } catch (error) {
    console.error('❌ Error handling payment method detachment:', error);
  }
}

async function handleInvoiceCreated(invoice: any) {
  console.log('📝 Invoice Created:', invoice.id);

  try {
    const tenantId = await findTenantByCustomer(invoice.customer);
    if (!tenantId) return;

    // Record invoice creation
    await PaymentService.recordPayment({
      tenantId,
      stripeInvoiceId: invoice.id,
      amount: (invoice.amount_due / 100).toString(),
      currency: invoice.currency.toUpperCase(),
      status: 'pending',
      paymentType: 'subscription',
      billingReason: invoice.billing_reason,
      invoiceNumber: invoice.number,
      description: `Invoice ${invoice.number} created`,
      metadata: {
        invoice_status: invoice.status,
        subscription_id: invoice.subscription
      }
    });
  } catch (error) {
    console.error('❌ Error handling invoice creation:', error);
  }
}

async function handleInvoiceFinalized(invoice: any) {
  console.log('✅ Invoice Finalized:', invoice.id);

  try {
    const tenantId = await findTenantByCustomer(invoice.customer);
    if (!tenantId) return;

    // Update invoice status to finalized
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
    console.error('❌ Error handling invoice finalization:', error);
  }
}

async function handleInvoicePaymentActionRequired(invoice: any) {
  console.log('⚠️ Invoice Payment Action Required:', invoice.id);

  try {
    const tenantId = await findTenantByCustomer(invoice.customer);
    if (!tenantId) return;

    // Update payment status to requires_action
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
    console.error('❌ Error handling invoice payment action required:', error);
  }
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('🔄 Subscription Created:', subscription.id);

  try {
    let tenantId = await findTenantByCustomer(subscription.customer);

    // If tenant not found by customer ID, try to find by subscription ID first
    if (!tenantId) {
      const { db } = await import('../../../db/index.js');
      const { subscriptions } = await import('../../../db/schema/index.js');
      const { eq } = await import('drizzle-orm');

      const [existingSubscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
        .limit(1);

      if (existingSubscription) {
        tenantId = existingSubscription.tenantId;
        console.log(`✅ Found tenant ${tenantId} by existing subscription ${subscription.id}`);
      }
    }

    if (!tenantId) {
      console.warn(`⚠️ No tenant found for subscription ${subscription.id} with customer ${subscription.customer}`);
      return;
    }

    // Update tenant with customer ID if not already set
    const { db } = await import('../../../db/index.js');
    const { tenants, subscriptions } = await import('../../../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    // Check if tenant already has customer ID
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);

    if (tenant && !tenant.stripeCustomerId) {
      await db
        .update(tenants)
        .set({
          stripeCustomerId: subscription.customer,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId));

      console.log(`✅ Updated tenant ${tenantId} with Stripe customer ID: ${subscription.customer}`);
    }

    // Update subscription status in our database
    await db
      .update(subscriptions)
      .set({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.tenantId, tenantId));

    console.log(`✅ Updated subscription for tenant ${tenantId} with Stripe IDs`);
  } catch (error) {
    console.error('❌ Error handling subscription creation:', error);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('🔄 Subscription Updated:', subscription.id);

  try {
    const tenantId = await findTenantByCustomer(subscription.customer);
    if (!tenantId) return;

    // Update subscription details in our database
    const { db } = await import('../../../db/index.js');
    const { subscriptions } = await import('../../../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    await db
      .update(subscriptions)
      .set({
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    console.error('❌ Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('🗑️ Subscription Deleted:', subscription.id);

  try {
    const tenantId = await findTenantByCustomer(subscription.customer);
    if (!tenantId) return;

    // Mark subscription as canceled in our database
    const { db } = await import('../../../db/index.js');
    const { subscriptions } = await import('../../../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error);
  }
}

async function handleChargeCaptured(charge: any) {
  console.log('💳 Charge Captured:', charge.id);
}

async function handleDisputeUpdated(dispute: any) {
  console.log('⚖️ Dispute Updated:', dispute.id);
}

async function handleDisputeClosed(dispute: any) {
  console.log('⚖️ Dispute Closed:', dispute.id);
}

async function handleRefundCreated(refund: any) {
  console.log('💸 Refund Created:', refund.id);
}

async function handleRefundUpdated(refund: any) {
  console.log('💸 Refund Updated:', refund.id);
}

async function handleCustomerCreated(customer: any) {
  console.log('👤 Customer Created:', customer.id);
}

async function handleCustomerUpdated(customer: any) {
  console.log('👤 Customer Updated:', customer.id);
}

async function handleCustomerDeleted(customer: any) {
  console.log('👤 Customer Deleted:', customer.id);
}

async function handleCheckoutSessionCompleted(session: any) {
  console.log('🛒 Checkout Session Completed:', session.id);

  try {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) {
      console.warn('⚠️ No tenantId in checkout session metadata');
      return;
    }

    // Get plan details from metadata
    const planId = session.metadata?.planId || session.metadata?.packageId;
    const billingCycle = session.metadata?.billingCycle || 'yearly';
    if (!planId) {
      console.warn('⚠️ No planId in checkout session metadata');
      return;
    }

    // Import SubscriptionService for processing
    const { SubscriptionService } = await import('../services/subscription-service.js');

    // Get plan configuration from available plans
    const availablePlans = await SubscriptionService.getAvailablePlans();
    const planDetails = availablePlans.find(p => p.id === planId);
    if (!planDetails) {
      console.warn(`⚠️ Could not find plan details for planId: ${planId}`);
      return;
    }

    // Create compatible planConfig object for processApplicationPlanSubscription
    const planConfig = {
      id: planDetails.id,
      amount: billingCycle === 'yearly' ? (planDetails as any).yearlyPrice * 100 : (planDetails as any).monthlyPrice * 100, // Convert dollars to cents
      credits: planDetails.credits ?? planDetails.freeCredits ?? 0,
      billingCycle: billingCycle
    };

    // Update tenant with customer ID if available
    if (session.customer) {
      const { db } = await import('../../../db/index.js');
      const { tenants } = await import('../../../db/schema/index.js');
      const { eq } = await import('drizzle-orm');

      await db
        .update(tenants)
        .set({
          stripeCustomerId: session.customer,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId));

      console.log(`✅ Updated tenant ${tenantId} with Stripe customer ID: ${session.customer}`);
    }

    // Create or update subscription record and allocate plan credits
    if (session.mode === 'subscription') {
      // Use handleCheckoutCompleted so subscription is created/updated AND plan credits are allocated
      await SubscriptionService.handleCheckoutCompleted(session);

      console.log(`✅ Subscription record created/updated and credits allocated for tenant ${tenantId}, plan ${planId}`);
    } else if (session.mode === 'payment') {
      // For payment mode (credit purchases), the credit processing happens via invoice payment webhook
      console.log(`💳 Credit purchase session completed for tenant ${tenantId}, plan ${planId}`);
    }

    // Send payment confirmation email (subscription emails are sent by handleCheckoutCompleted)
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
        } else {
          console.warn('⚠️ Could not find user email for tenant:', tenantId);
        }
      } catch (emailError) {
        console.error('❌ Failed to send payment confirmation email:', emailError);
      }
    }

  } catch (error) {
    console.error('❌ Error handling checkout session completion:', error);
    throw error;
  }
}

async function handleCheckoutSessionExpired(session: any) {
  console.log('🛒 Checkout Session Expired:', session.id);
}

// =============================================================================
// Razorpay Event Handlers
// =============================================================================

/**
 * Top-level dispatcher for normalised Razorpay webhook events.
 * Maps NormalizedEventType → individual handlers below.
 */
async function handleRazorpayEvent(event: NormalizedWebhookEvent): Promise<void> {
  console.log(`🔔 Processing Razorpay event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.completed':    // order.paid
        await handleRazorpayOrderPaid(event.data);
        break;

      case 'payment.succeeded':     // payment.captured
        await handleRazorpayPaymentCaptured(event.data);
        break;

      case 'payment.failed':
        await handleRazorpayPaymentFailed(event.data);
        break;

      case 'subscription.created':  // subscription.activated
        await handleRazorpaySubscriptionActivated(event.data);
        break;

      case 'invoice.payment_paid':  // subscription.charged (renewal)
        await handleRazorpaySubscriptionCharged(event.data);
        break;

      case 'subscription.deleted':  // subscription.cancelled
        await handleRazorpaySubscriptionCancelled(event.data);
        break;

      default:
        console.log(`⚠️ Unhandled Razorpay event type: ${event.type}`);
        break;
    }
    console.log(`✅ Successfully processed Razorpay ${event.type}`);
  } catch (error) {
    console.error(`❌ Error processing Razorpay ${event.type}:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helper — extract tenantId from Razorpay entity `notes`
//
// We always store tenantId in notes/metadata when creating orders/subscriptions
// (see razorpay.adapter.ts createCheckoutSession → notes: params.metadata).
// ---------------------------------------------------------------------------
function findTenantFromRazorpayNotes(data: Record<string, unknown>): string | null {
  const notes = data.notes as Record<string, unknown> | undefined;
  return (notes?.tenantId as string | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// order.paid → checkout.completed
//
// Fires when the full order amount is settled.  We record the payment AND
// activate the plan so users don't wait for the async verify-payment call.
// The verify-payment endpoint is idempotent — duplicate records are safe.
// ---------------------------------------------------------------------------
async function handleRazorpayOrderPaid(data: Record<string, unknown>) {
  console.log('🛒 Razorpay Order Paid:', data.id);

  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) {
    console.warn('⚠️ No tenantId in Razorpay order notes — skipping');
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

  // Activate the purchased plan (notes carry planId / billingCycle set by our server).
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
      console.log(`✅ Plan ${planId} activated for tenant ${tenantId} via order.paid`);
    } catch (err) {
      console.error('❌ Failed to activate plan on Razorpay order.paid:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// payment.captured → payment.succeeded
//
// Fires when an individual payment is captured (may be after order.paid).
// We record / upsert the payment record with full details.
// ---------------------------------------------------------------------------
async function handleRazorpayPaymentCaptured(data: Record<string, unknown>) {
  console.log('💳 Razorpay Payment Captured:', data.id);

  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) {
    console.warn('⚠️ No tenantId in Razorpay payment notes — skipping');
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
// payment.failed → payment.failed
// ---------------------------------------------------------------------------
async function handleRazorpayPaymentFailed(data: Record<string, unknown>) {
  console.log('❌ Razorpay Payment Failed:', data.id);

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
// subscription.activated → subscription.created
// ---------------------------------------------------------------------------
async function handleRazorpaySubscriptionActivated(data: Record<string, unknown>) {
  console.log('🔄 Razorpay Subscription Activated:', data.id);

  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  try {
    const { db }            = await import('../../../db/index.js');
    const { subscriptions } = await import('../../../db/schema/index.js');
    const { eq }            = await import('drizzle-orm');

    await db
      .update(subscriptions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, tenantId));

    console.log(`✅ Subscription activated for tenant ${tenantId}`);
  } catch (error) {
    console.error('❌ Error updating subscription on Razorpay activation:', error);
  }
}

// ---------------------------------------------------------------------------
// subscription.charged → invoice.payment_paid  (recurring renewal)
// ---------------------------------------------------------------------------
async function handleRazorpaySubscriptionCharged(data: Record<string, unknown>) {
  console.log('💰 Razorpay Subscription Charged:', data.id);

  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  // Razorpay subscription entity carries amount_paid for the latest charge.
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
// subscription.cancelled → subscription.deleted
// ---------------------------------------------------------------------------
async function handleRazorpaySubscriptionCancelled(data: Record<string, unknown>) {
  console.log('🗑️ Razorpay Subscription Cancelled:', data.id);

  const tenantId = findTenantFromRazorpayNotes(data);
  if (!tenantId) return;

  try {
    const { db }            = await import('../../../db/index.js');
    const { subscriptions } = await import('../../../db/schema/index.js');
    const { eq }            = await import('drizzle-orm');

    await db
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, tenantId));

    console.log(`✅ Subscription cancelled for tenant ${tenantId}`);
  } catch (error) {
    console.error('❌ Error updating subscription on Razorpay cancellation:', error);
  }
}