import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../services/subscription-service.js';
import { TenantService } from '../../../services/tenant-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { getPlanLimits } from '../../../middleware/restrictions/planRestrictions.js';
import { db } from '../../../db/index.js';
import { tenants, payments, subscriptions } from '../../../db/schema/index.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';
import { PLAN_ACCESS_MATRIX } from '../../../data/permission-matrix.js';
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
      const userId = uc?.userId as string | undefined;
      const tenantId = uc?.tenantId as string | undefined;

      console.log('🔍 Subscription /current endpoint called:', {
        userId,
        tenantId,
        hasTenantId: !!tenantId
      });

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Subscription', 'User is not associated with any organization');
      }

      const subscription = await SubscriptionService.getCurrentSubscription(tenantId as string);

      const subId = subscription ? String((subscription as Record<string, unknown>).id ?? '') : '';
      const subscriptionType = subscription ? (subId.startsWith('credit_') ? 'credit-based' : 'traditional') : 'none';
      console.log('📋 Subscription lookup result:', {
        tenantId,
        subscriptionFound: !!subscription,
        subscriptionType,
        plan: subscription?.plan,
        status: subscription?.status,
        availableCredits: subscription?.availableCredits
      });

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
      const query = request.query as { page?: string; limit?: string; [key: string]: unknown };
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(Math.max(1, parseInt(query.limit || '20', 10)), 100);
      const offset = (page - 1) * limit;

      const allPlans = await SubscriptionService.getAvailablePlans();
      const sliced = allPlans.slice(offset, offset + limit + 1);
      const hasMore = sliced.length > limit;
      const items = hasMore ? sliced.slice(0, limit) : sliced;

      return {
        success: true,
        data: items,
        meta: { page, limit, hasMore }
      };
    } catch (error) {
      request.log.error(error, 'Error fetching plans:');
      return reply.code(500).send({ error: 'Failed to fetch plans' });
    }
  });

  // Get available credit packages (alias; same data as /plans)
  fastify.get('/credit-packages', async (request, reply) => {
    try {
      const query = request.query as { page?: string; limit?: string; [key: string]: unknown };
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(Math.max(1, parseInt(query.limit || '20', 10)), 100);
      const offset = (page - 1) * limit;

      const allPackages = await SubscriptionService.getAvailablePlans();
      const sliced = allPackages.slice(offset, offset + limit + 1);
      const hasMore = sliced.length > limit;
      const items = hasMore ? sliced.slice(0, limit) : sliced;

      return {
        success: true,
        data: items,
        meta: { page, limit, hasMore }
      };
    } catch (error) {
      request.log.error(error, 'Error fetching credit packages:');
      return reply.code(500).send({ error: 'Failed to fetch credit packages' });
    }
  });

  // Get configuration status (for debugging)
  fastify.get('/config-status', async (request, reply) => {
    try {
      const isStripeConfigured = SubscriptionService.isStripeConfigured();
      const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
      
      const priceIdStatus = {
        starter_monthly: !!process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
        starter_yearly: !!process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
        professional_monthly: !!process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID,
        professional_yearly: !!process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID,
        enterprise_monthly: !!process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
        enterprise_yearly: !!process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID
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

      // Mock req/res objects for the middleware function
      const mockReq = { user: { tenantId } };
      const mockRes = {
        json: (data: unknown) => data,
        status: (code: number) => ({ json: (data: unknown) => ({ statusCode: code, ...(data as object) }) })
      };

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

  // Create Stripe checkout session for both plans and credit packages
  const checkoutBodySchema = z.union([
    z.object({
      planId: z.string(),
      billingCycle: z.enum(['monthly', 'yearly']),
      successUrl: z.string(),
      cancelUrl: z.string()
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
      const { packageId, credits, planId, billingCycle, successUrl, cancelUrl } = body;
      const uc = (request as any).userContext as unknown as Record<string, unknown> | undefined;
      const tenantId = uc?.tenantId as string | undefined;
      const userId = uc?.userId as string | undefined;

      // Determine if this is a plan subscription or credit package purchase
      const isPlanSubscription = !!(planId && billingCycle);
      const isCreditPurchase = !!(packageId && credits);

      if (!isPlanSubscription && !isCreditPurchase) {
        return reply.code(400).send({
          error: 'Invalid request',
          message: 'Either planId/billingCycle (for plan subscription) or packageId/credits (for credit purchase) must be provided'
        });
      }

      console.log('🔍 Checkout - User context:', {
        tenantId,
        userId,
        email: uc?.email,
        organization: uc?.organization
      });

      if (!tenantId) {
        console.log('❌ Checkout - No tenantId found, user needs onboarding');
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
        console.log('❌ Checkout - Tenant not found in database:', tenantId);
        return ErrorResponses.notFound(reply, 'Organization', 'Organization data not found. Please complete onboarding first.', {
          action: 'redirect_to_onboarding',
          redirectUrl: '/onboarding'
        });
      }

      console.log('✅ Checkout - Found tenant:', tenant.companyName);

      let checkoutParams;
      let itemDescription;

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
          if (currentSubscription.plan === 'trial') {
            console.log('🔄 Allowing upgrade from trial to paid plan:', planId);
          } else if (currentSubscription.plan !== 'free') {
            return reply.code(400).send({
              error: 'Active subscription exists',
              message: 'Use the plan change endpoint for modifying existing subscriptions'
            });
          }
        }

        checkoutParams = {
          tenantId,
          planId,
          billingCycle,
          customerId: tenant.stripeCustomerId || null,
          customerEmail: (uc?.email as string | undefined) ?? undefined,
          successUrl,
          cancelUrl
        };

        itemDescription = `Plan subscription: ${selectedPlan.name}`;
        console.log('🎯 Checkout - Creating checkout session for plan subscription:', selectedPlan.name);

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

        itemDescription = `Credit purchase: $${credits} for ${selectedPackage.name}`;
        console.log('🎯 Checkout - Creating checkout session for credit purchase:', selectedPackage.name, 'for $', credits);
      }

      // Create Stripe checkout session
      const checkoutUrl = await SubscriptionService.createCheckoutSession(checkoutParams as Parameters<typeof SubscriptionService.createCheckoutSession>[0]);

      console.log('✅ Checkout - Session created successfully');

      // Return appropriate data based on checkout type
      const responseData: Record<string, unknown> = {
        checkoutUrl
      };

      if (isPlanSubscription) {
        responseData.planId = planId;
        responseData.billingCycle = billingCycle;
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

      const query = request.query as { page?: string; limit?: string; [key: string]: unknown };
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(Math.max(1, parseInt(query.limit || '20', 10)), 100);
      const offset = (page - 1) * limit;

      const allBillingHistory = await SubscriptionService.getBillingHistory(tenantId);
      const sliced = allBillingHistory.slice(offset, offset + limit + 1);
      const hasMore = sliced.length > limit;
      const items = hasMore ? sliced.slice(0, limit) : sliced;

      return {
        success: true,
        data: items,
        meta: { page, limit, hasMore }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching billing history:');
      console.error('❌ Billing history error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 300)
      });

      // Check if it's a database table issue
      if (error.message?.includes('relation "credit_purchases" does not exist')) {
        return reply.code(503).send({
          error: 'Billing History Unavailable',
          message: 'Billing history is not yet available. Please contact support if this persists.',
          details: 'Database table not found'
        });
      }

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
      const userId = ((request as any).userContext as Record<string, unknown> | undefined)?.userId as string | undefined;

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

  // Plan changes disabled - credit-based system uses credit purchases instead
  fastify.post('/change-plan', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const planId = body.planId as string;
      const billingCycle = (body.billingCycle as string) ?? 'monthly';
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      console.log('🔄 Plan change requested:', { tenantId, planId, billingCycle });

      const result = await SubscriptionService.changePlan({
        tenantId,
        planId,
        billingCycle
      });

      // If result contains a checkout URL, return it for payment
      if (typeof result === 'string' && (result as string).startsWith('http')) {
        return {
          success: true,
          data: {
            checkoutUrl: result,
            planId,
            billingCycle
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
    console.log('🎣 SUBSCRIPTION WEBHOOK ENDPOINT HIT - URL:', request.url);
    console.log('🎣 Request method:', request.method);
    console.log('🎣 Request headers:', Object.keys(request.headers));

    try {
      const sig = request.headers['stripe-signature'];
      const sigStr = Array.isArray(sig) ? sig[0] : sig;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sigStr || !endpointSecret) {
        console.error('❌ Webhook configuration missing:', { 
          hasSignature: !!sigStr,
          hasSecret: !!endpointSecret 
        });
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
        console.error('❌ No raw body found for webhook verification');
        return reply.code(400).send({ error: 'No body content' });
      }
      
      console.log('🎣 Processing Stripe webhook with signature verification');
      console.log('📝 Raw body length:', rawBody.length);
      console.log('🔑 Has signature:', !!sigStr);
      console.log('🔐 Has secret:', !!endpointSecret);
      console.log('🔍 Debug info:', {
        rawBodyType: typeof rawBody,
        rawBodyIsBuffer: Buffer.isBuffer(rawBody),
        signatureType: typeof sigStr,
        signatureValue: sigStr ? String(sigStr).substring(0, 20) + '...' : 'none',
        secretType: typeof endpointSecret,
        secretValue: endpointSecret ? endpointSecret.substring(0, 10) + '...' : 'none'
      });

      // Verify webhook signature and process event
      const result = await SubscriptionService.handleWebhook(rawBody, sigStr, endpointSecret);
      
      console.log('✅ Webhook processed successfully:', result.eventType);
      
      return reply.code(200).send({
        success: true,
        received: true,
        eventType: result.eventType
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Webhook processing error:', error);
      request.log.error(error, 'Webhook processing error:');
      
      // Return 200 to prevent Stripe from retrying if it's a non-retryable error
      if (error.message?.includes('signature') || error.message?.includes('timestamp')) {
        console.log('🔄 Non-retryable error, returning 400');
        return reply.code(400).send({ 
          error: 'Webhook signature verification failed',
          message: error.message
        });
      }
      
      // Check if it's a test webhook or missing metadata (should not retry)
      if (error.message?.includes('Missing tenantId or planId') || 
          error.message?.includes('test webhook') ||
          error.message?.includes('already_processed')) {
        console.log('🔄 Non-critical error, returning 200 to prevent retry');
        return reply.code(200).send({ 
          success: true,
          message: 'Webhook processed (non-critical issue)',
          details: error.message
        });
      }
      
      // Return 500 for retryable errors
      console.log('🔄 Retryable error, returning 500');
      return reply.code(500).send({ 
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  // Create customer portal session
  fastify.post('/portal', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { returnUrl } = body;
      
      const tenantIdForPortal = getTenantId(request);
      const session = await (SubscriptionService as any).createPortalSession(
        tenantIdForPortal as string,
        (returnUrl as string) || `${process.env.FRONTEND_URL}/dashboard/billing`
      );
      
      return {
        success: true,
        data: {
          url: session.url
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error creating portal session:');
      return reply.code(500).send({ error: 'Failed to create portal session' });
    }
  });

  // Update payment method
  fastify.post('/payment-method', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { paymentMethodId } = body;
      
      await (SubscriptionService as any).updatePaymentMethod(
        getTenantId(request) as string,
        paymentMethodId as string
      );
      
      return {
        success: true,
        message: 'Payment method updated successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error updating payment method:');
      return reply.code(500).send({ error: 'Failed to update payment method' });
    }
  });

  // Reactivate subscription
  fastify.post('/reactivate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await (SubscriptionService as any).reactivateSubscription(getTenantId(request) as string);
      
      return {
        success: true,
        data: result,
        message: 'Subscription reactivated successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error reactivating subscription:');
      return reply.code(500).send({ error: 'Failed to reactivate subscription' });
    }
  });

  // Apply coupon
  fastify.post('/coupon', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { couponCode } = body;
      
      const result = await (SubscriptionService as any).applyCoupon(
        getTenantId(request) as string,
        couponCode as string
      );
      
      return {
        success: true,
        data: result,
        message: 'Coupon applied successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error applying coupon:');
      if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
        return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to apply coupon' });
    }
  });

  // Get upcoming invoice
  fastify.get('/upcoming-invoice', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_READ)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const invoice = await (SubscriptionService as any).getUpcomingInvoice(getTenantId(request) as string);
      
      return {
        success: true,
        data: invoice
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching upcoming invoice:');
      return reply.code(500).send({ error: 'Failed to fetch upcoming invoice' });
    }
  });

  // Download invoice
  fastify.get('/invoice/:invoiceId/download', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.BILLING_PLANS_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { invoiceId } = params;
      
      const invoiceUrl = await (SubscriptionService as any).getInvoiceDownloadUrl(
        getTenantId(request) as string,
        invoiceId
      );
      
      return reply.redirect(invoiceUrl);
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error downloading invoice:');
      return reply.code(500).send({ error: 'Failed to download invoice' });
    }
  });

  // Downgrade disabled - credit-based system uses credit purchases instead
  /*
  fastify.post('/immediate-downgrade', {
    preHandler: authenticateToken,
    schema: {
      body: {
        type: 'object',
        required: ['newPlan'],
        properties: {
          newPlan: { type: 'string' },
          reason: { type: 'string' },
          refundRequested: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { newPlan, reason = 'customer_request', refundRequested = false } = request.body;
      const tenantId = request.userContext.tenantId;

      if (!tenantId) {
        return reply.code(400).send({ 
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      console.log('🔄 Plan change requested:', { tenantId, newPlan, refundRequested });

      // Use changePlan which will automatically schedule downgrades (never immediate)
      const result = await SubscriptionService.changePlan({
        tenantId,
        planId: newPlan,
        billingCycle: 'yearly' // Annual billing only
      });

      return {
        success: true,
        data: result,
        message: 'Plan change scheduled successfully'
      };
    } catch (error) {
      request.log.error(error, 'Error processing immediate downgrade:');
      return reply.code(500).send({
        error: 'Failed to process downgrade',
        message: error.message
      });
    }
  });
  */

  // Process refund for a specific payment
  fastify.post('/refund', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { paymentId, amount, reason = 'customer_request' } = body;
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({ 
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      console.log('💸 Refund requested:', { tenantId, paymentId, amount, reason });

      const result = await SubscriptionService.processRefund({
        tenantId: tenantId as string,
        paymentId: paymentId as string,
        amount: amount as number | undefined,
        reason: reason as string
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

      try {
        // Check if identifier is a valid UUID (paymentId) or Stripe ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);

        if (isUUID) {
          // Try to find by paymentId first (if it's a UUID)
          let [paymentById] = await db
            .select()
            .from(payments)
            .where(and(
              eq(payments.paymentId, identifier),
              eq(payments.tenantId, tenantId)
            ))
            .limit(1);

          if (paymentById) {
            payment = paymentById;
          }
        }

        // If not found by paymentId or identifier is not a UUID, try by Stripe payment intent ID
        if (!payment) {
          let [paymentByIntent] = await db
            .select()
            .from(payments)
            .where(and(
              eq(payments.stripePaymentIntentId, identifier),
              eq(payments.tenantId, tenantId)
            ))
            .limit(1);

          if (paymentByIntent) {
            payment = paymentByIntent;
          }
        }

        // Also try by Stripe invoice ID (for invoice-based payments)
        if (!payment && identifier.startsWith('in_')) {
          let [paymentByInvoice] = await db
            .select()
            .from(payments)
            .where(and(
              eq(payments.stripeInvoiceId, identifier),
              eq(payments.tenantId, tenantId)
            ))
            .limit(1);

          if (paymentByInvoice) {
            payment = paymentByInvoice;
          }
        }

        // Try by Stripe checkout session ID (stored in metadata, real implementation like top-ups)
        if (!payment && (identifier.startsWith('cs_test_') || identifier.startsWith('cs_live_'))) {
          const [paymentBySession] = await db
            .select()
            .from(payments)
            .where(and(
              eq(payments.tenantId, tenantId),
              sql`${payments.metadata}->>'stripeCheckoutSessionId' = ${identifier}`
            ))
            .limit(1);
          if (paymentBySession) {
            payment = paymentBySession;
          }
        }
      } catch (dbError) {
        console.error('Database error in payment lookup:', dbError);
        return reply.code(500).send({
          error: 'Database error',
          message: 'Failed to query payment records'
        });
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
            sessionId: payment.stripePaymentIntentId || paymentMeta?.stripeCheckoutSessionId,
            transactionId: payment.paymentId,
            amount: parseFloat(payment.amount),
            currency: payment.currency,
            planId: planId,
            planName: planDetails?.name || planId,
            billingCycle,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            createdAt: payment.createdAt,
            processedAt: payment.paidAt || payment.createdAt,
            description: `Subscription: ${planDetails?.name || planId}`,
            subscription: subscription ? {
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              nextBillingDate: subscription.currentPeriodEnd
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
    fastify.get('/actions', {}, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;

      if (!tenantId) {
        return reply.code(400).send({ 
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      // Get subscription actions
      // Subscription actions are now handled by Stripe webhooks
      // Return empty array for now
      const formattedActions: unknown[] = [];
      
      return {
        success: true,
        data: formattedActions
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

  // Clean up duplicate payment records (admin endpoint)
  fastify.post('/cleanup-duplicate-payments', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;
      
      console.log(`🧹 Starting duplicate payment cleanup for tenant: ${tenantId}`);
      
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
          
          console.log(`🗑️ Found ${group.length} duplicates for key ${key}, removing ${toDelete.length}`);
        }
      }
      
      // Delete duplicate payments
      if (duplicatePaymentIds.length > 0) {
        await db
          .delete(payments)
          .where(inArray(payments.paymentId, duplicatePaymentIds));
        
        console.log(`✅ Cleaned up ${removedCount} duplicate payments for tenant: ${tenantId}`);
      } else {
        console.log(`✅ No duplicate payments found for tenant: ${tenantId}`);
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
      console.error('❌ Error cleaning up duplicate payments:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to clean up duplicate payments',
        message: error.message
      });
    }
  });

  // Manually toggle off trial restrictions (for upgraded users)
  fastify.post('/toggle-trial-restrictions', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).userContext as Record<string, unknown> | undefined)?.tenantId as string | undefined;
      const body = request.body as Record<string, unknown>;
      const { disable } = body;
      
      console.log(`🔧 Toggling trial restrictions for tenant: ${tenantId}, disable: ${disable}`);
      
      // Update subscription - trial restrictions are no longer used
      // This endpoint is deprecated and should not update database fields
      const updatedSubscription = { tenantId };

      if (!updatedSubscription) {
        return ErrorResponses.notFound(reply, 'Subscription', 'Subscription not found');
      }
      
      console.log(`✅ Trial restrictions ${disable ? 'disabled' : 'enabled'} for tenant: ${tenantId}`);
      
      return {
        success: true,
        message: `Trial restrictions ${disable ? 'disabled' : 'enabled'} successfully`,
        data: {
          disabled: disable as boolean,
          tenantId: tenantId as string
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error toggling trial restrictions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to toggle trial restrictions',
        message: error.message
      });
    }
  });
} 