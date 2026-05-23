import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../services/subscription-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { getPlanLimits } from '../../../middleware/restrictions/planRestrictions.js';
import { db } from '../../../db/index.js';
import { tenants, payments, subscriptions } from '../../../db/schema/index.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';
import { PLAN_ACCESS_MATRIX } from '../../../data/permission-matrix.js';
import Logger from '../../../utils/logger.js';
import { z } from 'zod';

export default async function subscriptionRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  type RequestWithUser = FastifyRequest & { userContext?: Record<string, unknown>; user?: { tenantId?: string }; rawBody?: Buffer; body?: unknown };
  const getTenantId = (req: FastifyRequest): string | undefined => {
    const r = req as any;
    return (r.user?.tenantId ?? (r.userContext as Record<string, unknown> | undefined)?.tenantId) as string | undefined;
  };

  // Get current subscription
  fastify.get('/current', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const uc = (request as RequestWithUser).userContext as Record<string, unknown> | undefined;
      const tenantId = uc?.tenantId as string | undefined;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Subscription', 'User is not associated with any organization');
      }

      const subscription = await SubscriptionService.getCurrentSubscription(tenantId as string);

      if (!subscription) {
        return ErrorResponses.notFound(reply, 'Subscription', 'No active subscription for this organization');
      }

      return {
        success: true,
        data: subscription
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching current subscription:');
      return reply.code(500).send({ error: 'Failed to fetch subscription' });
    }
  });

  // Get available subscription plans (single source of truth for frontend)
  fastify.get('/plans', async (request, reply) => {
    try {
      const plans = await SubscriptionService.getAvailablePlans();
      return {
        success: true,
        data: plans
      };
    } catch (error) {
      request.log.error(error, 'Error fetching plans:');
      return reply.code(500).send({ error: 'Failed to fetch plans' });
    }
  });

  // Get configuration status (internal debugging — requires auth)
  fastify.get('/config-status', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const isStripeConfigured = SubscriptionService.isStripeConfigured();
      const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
      
      const priceIdStatus = {
        starter_yearly_usd: !!process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
        starter_yearly_inr: !!process.env.STRIPE_STARTER_YEARLY_INR_PRICE_ID,
        professional_yearly_usd: !!process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID,
        professional_yearly_inr: !!process.env.STRIPE_PROFESSIONAL_YEARLY_INR_PRICE_ID,
        enterprise_yearly_usd: !!process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
        enterprise_yearly_inr: !!process.env.STRIPE_ENTERPRISE_YEARLY_INR_PRICE_ID
      };
      
      return {
        success: true,
        data: {
          stripeConfigured: isStripeConfigured,
          webhookSecretConfigured: hasWebhookSecret,
          priceIds: priceIdStatus,
          mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 
                process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'unknown',
          mockMode: !isStripeConfigured
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching config status:');
      return reply.code(500).send({ error: 'Failed to fetch config status' });
    }
  });

  // Get plan limits and usage
  fastify.get('/plan-limits', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;
      
      if (!tenantId) {
        return reply.code(401).send({ 
          success: false, 
          error: 'No organization found' 
        });
      }

      const mockReq = { user: { tenantId } };

      // Call the getPlanLimits function directly
      const result = await new Promise<{ statusCode?: number } & Record<string, unknown>>((resolve) => {
        getPlanLimits(mockReq as any, {
          json: resolve as (data: unknown) => void,
          status: (code: number) => ({ json: (data: unknown) => resolve({ statusCode: code, ...(data as object) }) })
        });
      });

      if (result.statusCode && result.statusCode !== 200) {
        return reply.code(result.statusCode).send(result);
      }

      return result as unknown as ReturnType<FastifyReply['send']>;
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching plan limits:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch plan limits' 
      });
    }
  });

  // Zod schemas for POST route bodies
  const changePlanBodySchema = z.object({
    planId: z.string().min(1),
    billingCycle: z.enum(['yearly']).optional().default('yearly'),
    currency: z.enum(['usd', 'inr']).optional().default('usd')
  });

  const portalBodySchema = z.object({
    returnUrl: z.string().url().optional()
  });

  const updatePaymentMethodBodySchema = z.object({
    paymentMethodId: z.string().min(1)
  });

  const applyCouponBodySchema = z.object({
    couponCode: z.string().min(1)
  });

  const refundBodySchema = z.object({
    paymentId: z.string().min(1),
    amount: z.number().positive().optional(),
    reason: z.string().optional().default('customer_request')
  });

  const toggleTrialRestrictionsBodySchema = z.object({
    disable: z.boolean()
  });

  // Create Stripe checkout session for both plans and credit packages
  const checkoutBodySchema = z.union([
    z.object({
      planId: z.string(),
      successUrl: z.string(),
      cancelUrl: z.string(),
      currency: z.enum(['usd', 'inr']).optional().default('usd'),
      /** @deprecated Monthly billing removed; only yearly is supported */
      billingCycle: z.enum(['monthly', 'yearly']).optional()
    }),
    z.object({
      packageId: z.string(),
      credits: z.number().min(1).max(10000), // Dollar amount for credit purchase
      successUrl: z.string(),
      cancelUrl: z.string()
    })
  ]);

  fastify.post('/checkout', {
    preHandler: authenticateToken,
    schema: {
      body: checkoutBodySchema
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { packageId, credits, planId, billingCycle, currency, successUrl, cancelUrl } = body as Record<string, unknown>;
      const uc = (request as any).userContext as unknown as Record<string, unknown> | undefined;
      const tenantId = uc?.tenantId as string | undefined;

      // Determine if this is a plan subscription or credit package purchase
      const isPlanSubscription = !!planId && !packageId;
      const isCreditPurchase = !!(packageId && credits);

      if (!isPlanSubscription && !isCreditPurchase) {
        return reply.code(400).send({
          error: 'Invalid request',
          message: 'Either planId (annual subscription) or packageId/credits (credit purchase) must be provided'
        });
      }

      if (isPlanSubscription && billingCycle === 'monthly') {
        return reply.code(400).send({
          error: 'Monthly billing unavailable',
          message: 'Subscriptions are billed annually only. Omit billingCycle or use yearly.'
        });
      }

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization to create a subscription',
          action: 'redirect_to_onboarding',
          redirectUrl: '/onboarding'
        });
    }

      // Get tenant info for customer creation
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);
      
      if (!tenant) {
        return ErrorResponses.notFound(reply, 'Organization', 'Organization data not found. Please complete onboarding first.', {
          action: 'redirect_to_onboarding',
          redirectUrl: '/onboarding'
        });
      }

      let checkoutParams;

      if (isPlanSubscription) {
        // Validate plan exists
        const plans = await SubscriptionService.getAvailablePlans();
        const selectedPlan = plans.find(p => p.id === planId);

        if (!selectedPlan) {
          return reply.code(400).send({ error: 'Invalid plan selected' });
        }

        // Check if user already has an active subscription
        const currentSubscription = await SubscriptionService.getCurrentSubscription(tenantId);
        if (currentSubscription && currentSubscription.status === 'active') {
          // Allow upgrades from trial to paid plans
          if (currentSubscription.plan !== 'trial' && currentSubscription.plan !== 'free') {
            return reply.code(400).send({
              error: 'Active subscription exists',
              message: 'Use the plan change endpoint for modifying existing subscriptions'
            });
          }
        }

        checkoutParams = {
          tenantId,
          planId,
          billingCycle: 'yearly',
          currency: (currency as 'usd' | 'inr' | undefined) ?? 'usd',
          customerId: tenant.stripeCustomerId || null,
          customerEmail: (uc?.email as string | undefined) ?? undefined,
          successUrl,
          cancelUrl
        };

      } else if (isCreditPurchase) {
        // Check if credit package is valid
        const { CreditService } = await import('../../../features/credits/index.js');
        const packages = await CreditService.getAvailablePackages();
        const selectedPackage = packages.find((p: { id: string }) => p.id === packageId);

        if (!selectedPackage) {
          return reply.code(400).send({ error: 'Invalid credit package selected' });
        }

        // Validate dollar amount is reasonable
        if (Number(credits) < 1 || Number(credits) > 10000) {
          return reply.code(400).send({
            error: 'Invalid amount',
            message: `Amount must be between $1 and $10,000`
          });
        }

        checkoutParams = {
          tenantId,
          planId: packageId,
          credits,
          customerId: tenant.stripeCustomerId || null,
          customerEmail: (uc?.email as string | undefined) ?? undefined,
          successUrl,
          cancelUrl
        };

      }

      // Create Stripe checkout session
      const checkoutUrl = await SubscriptionService.createCheckoutSession(checkoutParams as Parameters<typeof SubscriptionService.createCheckoutSession>[0]);

      // Return appropriate data based on checkout type
      const responseData: Record<string, unknown> = {
        checkoutUrl
      };

      if (isPlanSubscription) {
        responseData.planId = planId;
        responseData.billingCycle = 'yearly';
        responseData.currency = (currency as string) ?? 'usd';
      } else if (isCreditPurchase) {
        responseData.packageId = packageId;
        responseData.amount = credits; // Dollar amount
      }

      return {
        success: true,
        data: responseData
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error creating checkout session:');
      return reply.code(500).send({ 
        error: 'Failed to create checkout session',
        message: error.message
      });
    }
  });

  // Get subscription usage
  fastify.get('/usage', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      const usage = await SubscriptionService.getUsageMetrics(tenantId);
      
      return {
        success: true,
        data: usage
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching usage metrics:');
      return reply.code(500).send({ error: 'Failed to fetch usage metrics' });
    }
  });

  // Get billing history
  fastify.get('/billing-history', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      const billingHistory = await SubscriptionService.getBillingHistory(tenantId);
      
      return {
        success: true,
        data: billingHistory
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching billing history:');
      return reply.code(500).send({
        error: 'Failed to fetch billing history',
        message: 'Unable to retrieve billing history at this time.'
      });
    }
  });


  // Cancel subscription
  fastify.post('/cancel', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      const result = await SubscriptionService.cancelSubscription(tenantId);
      
      return {
        success: true,
        data: result,
        message: 'Subscription cancelled successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error cancelling subscription:');
      return reply.code(500).send({ 
        error: 'Failed to cancel subscription',
        message: error.message
      });
    }
  });

  fastify.post('/change-plan', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bodyResult = changePlanBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyResult.error.issues });
      }
      const { planId, billingCycle, currency } = bodyResult.data;
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      const result = await SubscriptionService.changePlan({
        tenantId,
        planId,
        billingCycle,
        currency
      });

      // If result contains a checkout URL, return it for payment
      if (typeof result === 'string' && (result as string).startsWith('http')) {
        return {
          success: true,
          data: {
            checkoutUrl: result,
            planId,
            billingCycle,
            currency
          },
          message: 'Redirecting to payment for plan change'
        };
      }

      return {
        success: true,
        data: result,
        message: (result as { message?: string })?.message || 'Plan changed successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error changing plan:');
      return reply.code(500).send({
        error: 'Failed to change plan',
        message: error.message
      });
    }
  });

  // Stripe webhook handler for subscription events
  fastify.post('/webhook', {
    // Skip authentication for webhook - no preHandler
    config: {
      // Disable body parsing for webhooks to get raw body
      rawBody: true
    } as Record<string, unknown>
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sig = request.headers['stripe-signature'];
      const sigStr = Array.isArray(sig) ? sig[0] : sig;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sigStr || !endpointSecret) {
        request.log.warn('Webhook received without signature or secret configured');
        return reply.code(400).send({ error: 'Missing webhook signature or secret' });
      }

      // Get raw body for webhook verification
      const reqWithRaw = request as RequestWithUser;
      let rawBody: Buffer;
      if (reqWithRaw.rawBody) {
        rawBody = reqWithRaw.rawBody;
      } else if (request.body) {
        rawBody = Buffer.from(JSON.stringify(request.body));
      } else {
        request.log.error('No raw body found for webhook verification');
        return reply.code(400).send({ error: 'No body content' });
      }

      // Verify webhook signature and process event
      const result = await SubscriptionService.handleWebhook(rawBody, sigStr, endpointSecret);

      return reply.code(200).send({
        success: true,
        received: true,
        eventType: result.eventType
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Webhook processing error');

      if (error.message?.includes('signature') || error.message?.includes('timestamp')) {
        return reply.code(400).send({
          error: 'Webhook signature verification failed',
          message: error.message
        });
      }

      if (error.message?.includes('Missing tenantId or planId') ||
          error.message?.includes('test webhook') ||
          error.message?.includes('already_processed')) {
        return reply.code(200).send({
          success: true,
          message: 'Webhook processed (non-critical issue)',
          details: error.message
        });
      }

      return reply.code(500).send({
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  // Create customer portal session
  fastify.post('/portal', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bodyResult = portalBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyResult.error.issues });
      }
      const { returnUrl } = bodyResult.data;

      const tenantIdForPortal = getTenantId(request);
      const portalUrl = await SubscriptionService.createBillingPortalSession(
        tenantIdForPortal as string,
        returnUrl || `${process.env.FRONTEND_URL}/dashboard/billing`
      );

      if (!portalUrl) {
        return reply.code(503).send({ error: 'Billing portal is not available' });
      }

      return {
        success: true,
        data: { url: portalUrl }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error creating portal session:');
      return reply.code(500).send({ error: 'Failed to create portal session' });
    }
  });

  // Update payment method — not yet implemented
  fastify.post('/payment-method', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)],
    schema: { body: updatePaymentMethodBodySchema }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not implemented' });
  });

  // Reactivate subscription — not yet implemented
  fastify.post('/reactivate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)]
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not implemented' });
  });

  // Apply coupon — not yet implemented
  fastify.post('/coupon', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)],
    schema: { body: applyCouponBodySchema }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not implemented' });
  });

  // Get upcoming invoice — not yet implemented
  fastify.get('/upcoming-invoice', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_READ)]
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not implemented' });
  });

  // Download invoice — not yet implemented
  fastify.get('/invoice/:invoiceId/download', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_READ)],
    schema: {}
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not implemented' });
  });

  // Process refund for a specific payment
  fastify.post('/refund', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bodyResult = refundBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyResult.error.issues });
      }
      const { paymentId, amount, reason } = bodyResult.data;
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      const result = await SubscriptionService.processRefund({
        tenantId,
        paymentId,
        amount,
        reason
      });
      
      return {
        success: true,
        data: result,
        message: 'Refund processed successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error processing refund:');
      return reply.code(500).send({ 
        error: 'Failed to process refund',
        message: error.message
      });
    }
  });

  // Get detailed payment information by paymentId or sessionId
  fastify.get('/payment/:identifier', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const identifier = params.identifier as string;
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      // Mock subscription checkout: return synthetic success so PaymentSuccess page can render
      if (identifier.startsWith('mock_subscription_session_') || identifier.startsWith('mock_')) {
        const query = request.query as Record<string, string>;
        const planId = query?.planId || 'starter';
        const billingCycle = query?.billingCycle || 'yearly';
        const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
        return {
          success: true,
          data: {
            sessionId: identifier,
            transactionId: identifier,
            amount: 0,
            currency: 'USD',
            planId,
            planName,
            billingCycle,
            paymentMethod: 'card',
            status: 'succeeded',
            createdAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
            description: `Mock subscription: ${planName}`,
            subscription: null,
            features: [],
            credits: 0,
            mock: true
          }
        };
      }

      let payment;

      // Select only columns that exist in the DB to avoid "column does not exist" errors
      // when the Drizzle schema is ahead of the actual database (pending migration).
      const safePaymentColumns = {
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
        invoiceNumber: payments.invoiceNumber,
        description: payments.description,
        taxAmount: payments.taxAmount,
        metadata: payments.metadata,
        stripeRawData: payments.stripeRawData,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
      };

      try {
        // Check if identifier is a valid UUID (paymentId) or Stripe ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);

        if (isUUID) {
          const [paymentById] = await db
            .select(safePaymentColumns)
            .from(payments)
            .where(and(eq(payments.paymentId, identifier), eq(payments.tenantId, tenantId)))
            .limit(1);
          if (paymentById) payment = paymentById;
        }

        if (!payment) {
          const [paymentByIntent] = await db
            .select(safePaymentColumns)
            .from(payments)
            .where(and(eq(payments.stripePaymentIntentId, identifier), eq(payments.tenantId, tenantId)))
            .limit(1);
          if (paymentByIntent) payment = paymentByIntent;
        }

        if (!payment && identifier.startsWith('in_')) {
          const [paymentByInvoice] = await db
            .select(safePaymentColumns)
            .from(payments)
            .where(and(eq(payments.stripeInvoiceId, identifier), eq(payments.tenantId, tenantId)))
            .limit(1);
          if (paymentByInvoice) payment = paymentByInvoice;
        }

        if (!payment && (identifier.startsWith('cs_test_') || identifier.startsWith('cs_live_'))) {
          const [paymentBySession] = await db
            .select(safePaymentColumns)
            .from(payments)
            .where(and(
              eq(payments.tenantId, tenantId),
              sql`${payments.metadata}->>'stripeCheckoutSessionId' = ${identifier}`
            ))
            .limit(1);
          if (paymentBySession) payment = paymentBySession;
        }
      } catch (dbError) {
        // Log but DON'T return 500 — fall through to Stripe API lookup below
        Logger.log('error', 'database', 'get-payment-by-identifier', 'Database error in payment lookup (falling through to gateway)', { error: (dbError as Error).message });
      }

      if (!payment) {
        // Real Stripe checkout session: fetch payment details from Stripe (like top-ups)
        if (identifier.startsWith('cs_test_') || identifier.startsWith('cs_live_')) {
          const fromStripe = await SubscriptionService.getPaymentDetailsByCheckoutSessionId(identifier, tenantId);
          if (fromStripe) {
            return fromStripe;
          }
          return reply.code(404).send({
            error: 'Payment not found',
            message: 'Checkout session not found or payment has not been completed yet. Please complete the payment process.',
            code: 'PAYMENT_PENDING'
          });
        }

        return ErrorResponses.notFound(reply, 'Payment', 'Payment not found or does not belong to your organization');
      }

      try {
        // Get plan details from PLAN_ACCESS_MATRIX (payment.planId may be in metadata for records created from checkout)
        const paymentMeta = payment.metadata as Record<string, unknown> | null | undefined;
        const planId = (payment as any).planId || paymentMeta?.planId || paymentMeta?.packageId;
        const planAccess = planId ? PLAN_ACCESS_MATRIX[planId as keyof typeof PLAN_ACCESS_MATRIX] : null;
        const planDetails = planAccess ? {
          name: planId.charAt(0).toUpperCase() + planId.slice(1),
          features: [
            ...(planAccess.applications?.includes('crm') ? ['CRM Suite'] : []),
            ...(planAccess.applications?.includes('hr') ? ['HR Management'] : []),
            ...(planAccess.applications?.includes('affiliateConnect') ? ['Affiliate Connect'] : []),
            `${planAccess.credits?.free || 0} Free Credits`,
            ...(planAccess.applications?.includes('crm') && planAccess.modules?.crm?.includes('leads') ? ['Lead Management'] : []),
            ...(planAccess.applications?.includes('hr') && (planAccess.modules as Record<string, string[]>)?.hr?.includes('employees') ? ['Employee Management'] : []),
          ],
          credits: planAccess.credits?.free || 0
        } : null;

        // Get current subscription for this tenant
        let [subscription] = await db
          .select()
          .from(subscriptions)
          .where(and(
            eq(subscriptions.tenantId, tenantId),
            eq(subscriptions.status, 'active')
          ))
          .limit(1);

        // Return data in the format expected by PaymentSuccess component
        const billingCycle = (paymentMeta?.billingCycle || (payment as any).billingCycle || 'yearly') as string;
        return {
          success: true,
          data: {
            // Identifiers
            sessionId: payment.stripePaymentIntentId || paymentMeta?.stripeCheckoutSessionId,
            transactionId: payment.paymentId,
            stripePaymentIntentId: payment.stripePaymentIntentId,
            stripeInvoiceId: payment.stripeInvoiceId,
            stripeChargeId: payment.stripeChargeId,
            invoiceNumber: payment.invoiceNumber,
            // Financials
            amount: parseFloat(payment.amount),
            currency: payment.currency,
            taxAmount: payment.taxAmount ? parseFloat(payment.taxAmount) : 0,
            // Plan info
            planId,
            planName: planDetails?.name || planId,
            billingCycle,
            // Payment method
            paymentMethod: payment.paymentMethod,
            paymentMethodDetails: payment.paymentMethodDetails,
            // Status + dates
            status: payment.status,
            createdAt: payment.createdAt,
            processedAt: payment.paidAt || payment.createdAt,
            paidAt: payment.paidAt,
            // Description
            description: `Subscription: ${planDetails?.name || planId}`,
            // Subscription details
            subscription: subscription ? {
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              nextBillingDate: subscription.currentPeriodEnd,
              renewalDate: subscription.currentPeriodEnd
            } : null,
            features: planDetails?.features || [],
            credits: planDetails?.credits || 0
          }
        };
        } catch (errInner: unknown) {
          const error = errInner as Error;
          request.log.error(error, 'Error fetching payment details:');
          return reply.code(500).send({
            error: 'Failed to fetch payment details',
            message: error.message
          });
        }
      } catch (err: unknown) {
        const error = err as Error;
        request.log.error(error, 'Error in payment details route:');
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to process payment details request'
        });
      }
    });

  // Get subscription actions history
  fastify.get('/actions', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      // Subscription action history is tracked via Stripe webhooks / event_tracking
      return {
        success: true,
        data: [] as unknown[]
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching subscription actions:');
      return reply.code(500).send({
        error: 'Failed to fetch subscription actions',
        message: error.message
      });
    }
  });

  // Clean up duplicate payment records (billing admin endpoint)
  fastify.post('/cleanup-duplicate-payments', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;
      request.log.info({ tenantId }, 'Starting duplicate payment cleanup');
      
      // Find duplicate payments (same amount, same date, same tenant)
      const duplicates = await db
        .select({
          paymentId: payments.paymentId,
          amount: payments.amount,
          stripePaymentIntentId: payments.stripePaymentIntentId,
          stripeInvoiceId: payments.stripeInvoiceId,
          paidAt: payments.paidAt,
          description: payments.description
        })
        .from(payments)
        .where(eq(payments.tenantId, tenantId as string))
        .orderBy(payments.createdAt);

      // Group by unique criteria
      type DupRow = (typeof duplicates)[0];
      const paymentGroups = new Map<string, DupRow[]>();
      
      duplicates.forEach((payment: DupRow) => {
        const key = `${payment.amount}-${payment.stripePaymentIntentId || ''}-${payment.stripeInvoiceId || ''}`;
        if (!paymentGroups.has(key)) {
          paymentGroups.set(key, []);
        }
        paymentGroups.get(key)!.push(payment);
      });
      
      // Find and remove duplicates (keep the first one)
      let removedCount = 0;
      const duplicatePaymentIds: string[] = [];
      
      for (const [key, group] of paymentGroups) {
        if (group.length > 1) {
          // Keep the first payment, mark others for deletion
          const toDelete = group.slice(1);
          toDelete.forEach(payment => {
            duplicatePaymentIds.push(payment.paymentId);
          });
          removedCount += toDelete.length;
        }
      }
      
      // Delete duplicate payments
      if (duplicatePaymentIds.length > 0) {
        await db
          .delete(payments)
          .where(inArray(payments.paymentId, duplicatePaymentIds));
      }
      
      return {
        success: true,
        message: `Cleaned up ${removedCount} duplicate payments`,
        data: {
          duplicatesRemoved: removedCount,
          remainingPayments: duplicates.length - removedCount
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error cleaning up duplicate payments');
      return reply.code(500).send({
        success: false,
        error: 'Failed to clean up duplicate payments',
        message: error.message
      });
    }
  });

  // Manually toggle off trial restrictions (for upgraded users)
  fastify.post('/toggle-trial-restrictions', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;
      const bodyResult = toggleTrialRestrictionsBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyResult.error.issues });
      }
      const { disable } = bodyResult.data;

      // Trial restrictions are no longer tracked in the database.
      // This endpoint is kept for backwards compatibility.
      return {
        success: true,
        message: `Trial restrictions ${disable ? 'disabled' : 'enabled'} successfully`,
        data: {
          disabled: disable,
          tenantId: tenantId as string
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error toggling trial restrictions');
      return reply.code(500).send({
        success: false,
        error: 'Failed to toggle trial restrictions',
        message: error.message
      });
    }
  });
} 