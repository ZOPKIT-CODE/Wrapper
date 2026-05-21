// @ts-nocheck — legacy webhook handler; tighten types incrementally
import { eq, and, sql, gte, count } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { db } from '../../../db/index.js';
import {
  subscriptions,
  payments,
  tenants,
  entities,
  tenantUsers,
  eventTracking,
  creditTransactions
} from '../../../db/schema/index.js';
import { EmailService } from '../../../utils/email.js';
import { v4 as uuidv4 } from 'uuid';
import { CreditService } from '../../credits/index.js';
import type { RequestContext } from '../../../services/activityLogger.js';
import { getPaymentGateway } from '../adapters/index.js';
import type { NormalizedWebhookEvent } from '../adapters/index.js';
import {
  getAvailablePlans,
  getPlanIdFromPriceId,
  getCurrentSubscription
} from './subscription-core.js';
import { updateAdministratorRolesForPlan } from './subscription-plan-roles.js';
import { PaymentService } from './payment-service.js';

/**
 * Fallback subscription period in milliseconds.
 * Used only when Stripe does not provide currentPeriodEnd in the webhook payload.
 * Stripe fires subscription.updated immediately after checkout.session.completed,
 * which will overwrite this with the authoritative value.
 * Override via SUBSCRIPTION_FALLBACK_PERIOD_DAYS (default 365).
 */
const SUBSCRIPTION_FALLBACK_PERIOD_MS =
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
const STRIPE_STATUS_MAP: Record<string, string> = {
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
const safePaymentSelect = {
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

function buildCheckoutAuditSnapshot(session: Record<string, unknown>): Record<string, unknown> {
  const customerDetails = (session.customer_details ?? {}) as Record<string, unknown>;
  const customerAddress = (customerDetails.address ?? {}) as Record<string, unknown>;
  const taxIdsRaw = Array.isArray(customerDetails.tax_ids) ? customerDetails.tax_ids : [];

  return {
    checkoutSessionId: session.id ?? null,
    paymentIntentId: session.payment_intent ?? null,
    customerId: session.customer ?? null,
    customerEmail: customerDetails.email ?? session.customer_email ?? null,
    customerName: customerDetails.name ?? null,
    customerPhone: customerDetails.phone ?? null,
    receiptEmail: customerDetails.email ?? session.customer_email ?? null,
    billingAddress: {
      line1: customerAddress.line1 ?? null,
      line2: customerAddress.line2 ?? null,
      city: customerAddress.city ?? null,
      state: customerAddress.state ?? null,
      postalCode: customerAddress.postal_code ?? null,
      country: customerAddress.country ?? null,
    },
    taxIds: taxIdsRaw.map((taxId) => {
      const t = taxId as Record<string, unknown>;
      return {
        type: t.type ?? null,
        value: t.value ?? null,
      };
    }),
    currency: session.currency ?? null,
    amountTotal: session.amount_total ?? null,
    paymentStatus: session.payment_status ?? null,
    mode: session.mode ?? null,
    provider: 'stripe',
    capturedAt: new Date().toISOString(),
  };
}

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
    console.log('🚀 handleWebhook called — provider:', gateway.providerName);

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

    console.log('🎣 Webhook received:', event.type, '(provider:', event.provider + ')');

    // Idempotency: check-then-reserve BEFORE processing.
    // If the check itself fails (DB pool exhausted, network blip), we REJECT the
    // webhook so the payment provider retries later — never risk double-processing.
    const [existing] = await db
      .select({ id: eventTracking.id, status: eventTracking.status })
      .from(eventTracking)
      .where(eq(eventTracking.eventId, event.id))
      .limit(1);

    if (existing) {
      console.log('⏭️ Skipping already-processed webhook event:', event.id);
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
          console.log('🎯 CREDIT PURCHASE DETECTED — redirecting to credit handler');
          await handleCreditPurchase(eventObj);
        } else {
          await handleCheckoutCompleted(eventObj);
        }
        break;
      }

      case 'payment.succeeded':
        await handlePaymentSucceeded(eventObj as Record<string, unknown> & { id?: string; subscription?: string; customer?: string; amount_paid?: number; currency?: string; payment_intent?: string; billing_reason?: string; number?: string; tax?: number; period_start?: number; period_end?: number; attempt_count?: number; next_payment_attempt?: number; status_transitions?: { paid_at?: number }; lines?: { data?: Array<{ price?: { id?: string } }> }; payment_method_types?: string[] });
        break;

      case 'invoice.payment_paid':
        await handleInvoicePaymentPaid(eventObj);
        break;

      case 'payment.failed':
      case 'invoice.payment_failed':
        await handlePaymentFailed(eventObj);
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(eventObj as Record<string, unknown> & { id: string; customer: string; status: string; current_period_start: number; current_period_end: number });
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(eventObj as Record<string, unknown> & { id: string; status: string; current_period_start: number; current_period_end: number; items?: { data?: Array<{ price?: string | { id?: string } }> } });
        break;

      case 'subscription.deleted':
        await handleSubscriptionDeleted(eventObj as Record<string, unknown> & { id: string });
        break;

      case 'charge.disputed':
        await handleChargeDispute(eventObj as Record<string, unknown> & { id: string; charge: string; amount: number; reason?: string; status?: string; currency?: string; created?: number; evidence_details?: { due_by?: number; has_evidence?: boolean } });
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(eventObj as Record<string, unknown> & { id: string; customer?: string; amount: number; currency?: string; payment_intent?: string; payment_method_details?: { type?: string }; description?: string; metadata?: Record<string, unknown>; created?: number });
        break;

      case 'refund.created':
        await handleRefund(eventObj as Record<string, unknown> & { id: string; charge: string; amount: number; reason?: string; status?: string; currency?: string; created?: number });
        break;

      default:
        console.log(`⚠️ Unhandled webhook event type: ${event.type}`);
    }

    // Mark event as fully processed.
    try {
      await db
        .update(eventTracking)
        .set({ status: 'processed' })
        .where(eq(eventTracking.eventId, event.id));
    } catch (trackErr) {
      console.warn('⚠️ Failed to mark webhook event as processed:', (trackErr as Error).message);
    }

    return { processed: true, eventType: event.type, provider: event.provider };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ Webhook processing error:', error);

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

// Handle checkout session completed webhook
export async function handleCheckoutCompleted(session: Record<string, unknown>): Promise<void> {
  try {
    const meta = (session.metadata ?? {}) as Record<string, unknown>;
    const checkoutAuditSnapshot = buildCheckoutAuditSnapshot(session);
    console.log('🛒 Processing checkout completion:', session.id);

    const tenantId = meta.tenantId as string | undefined;
    const packageId = (meta.packageId || meta.planId) as string | undefined;
    const billingCycle = 'yearly';
    const dollarAmount = parseFloat(String(meta.dollarAmount ?? 0));
    const totalAmount = parseFloat(String(meta.totalAmount ?? 0));
    const creditAmount = Math.floor(dollarAmount * 1000);

    console.log('📦 Checkout session metadata:', {
      tenantId,
      packageId,
      billingCycle,
      dollarAmount,
      creditAmount,
      totalAmount,
      sessionMode: session.mode
    });

    if (!tenantId) {
      console.warn('⚠️ Missing tenantId in checkout session metadata');
      throw new Error('Missing tenantId in checkout session metadata');
    }

    const gateway = getPaymentGateway();

    // Handle credit purchases (payment mode)
    if (session.mode === 'payment' && creditAmount > 0) {
      console.log('💰 Processing credit purchase completion');

      if (!creditAmount) {
        throw new Error('Missing credit amount in checkout session metadata');
      }

      const entityType = (meta.entityType as string) || 'organization';
      let entityId = meta.entityId as string | undefined;

      if (!entityId) {
        const rootOrgId = await CreditService.findRootOrganization(tenantId);
        if (rootOrgId) {
          entityId = rootOrgId;
        } else {
          entityId = tenantId;
        }
      }

      try {
        const tenantExists = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
        if (tenantExists.length === 0) {
          console.log('📝 Payment recorded — credits will be allocated when tenant data is available');
          return;
        }
      } catch (errDb: unknown) {
        const dbError = errDb as Error;
        console.warn('⚠️ Could not verify tenant existence:', dbError.message);
      }

      const purchaseResult = await CreditService.purchaseCredits({
        tenantId,
        userId: null as unknown as string,
        creditAmount,
        paymentMethod: gateway.providerName,
        currency: 'USD',
        entityType,
        entityId: entityId ?? tenantId,
        isWebhookCompletion: true,
        sessionId: session.id as string,
        notes: `Completed payment for ${creditAmount} credits (${entityType})`
      });

      console.log('✅ Credit purchase processed for tenant:', tenantId);

      try {
        const { PaymentService } = await import('./payment-service.js');
        const amountTotal = Number(session.amount_total ?? 0);
        const paymentAmount = dollarAmount || totalAmount || amountTotal / 100;
        const paymentIntentId = String(session.payment_intent || session.id);

        const existingPayment = await PaymentService.getPaymentByIntentId(paymentIntentId);

        if (!existingPayment) {
          await PaymentService.recordPayment({
            tenantId,
            stripePaymentIntentId: paymentIntentId,
            stripeCustomerId: session.customer as string | undefined,
            amount: paymentAmount.toString(),
            currency: String(session.currency || 'USD').toUpperCase(),
            status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
            paymentMethod: 'card',
            paymentType: 'credit_purchase',
            description: `Credit purchase: ${creditAmount.toLocaleString()} credits for $${paymentAmount.toFixed(2)}`,
            metadata: {
              checkoutSessionId: session.id,
              checkoutAuditSnapshot,
              creditAmount: creditAmount.toString(),
              entityType,
              entityId: entityId ?? tenantId,
              purchaseId: (purchaseResult as Record<string, unknown>)?.purchaseId,
              provider: gateway.providerName,
              ...(typeof session.metadata === 'object' && session.metadata !== null ? (session.metadata as Record<string, unknown>) : {})
            },
            stripeRawData: {
              checkoutSessionAudit: checkoutAuditSnapshot,
              checkoutSession: session
            },
            paidAt: session.payment_status === 'paid' ? new Date() : undefined
          });
        } else {
          await PaymentService.updatePaymentStatus(
            paymentIntentId,
            session.payment_status === 'paid' ? 'succeeded' : 'pending',
            {
              checkoutSessionId: session.id,
              paid_at: session.payment_status === 'paid' ? new Date().toISOString() : undefined
            }
          );
        }
      } catch (err: unknown) {
        console.error('❌ Failed to create payment record for credit purchase:', err);
      }

      try {
        const paymentsModule = await import('../routes/payments.js');
        const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
        const userInfo = await getTenantAdminEmail(tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../utils/email.js');
          const emailService = new EmailService();

          await emailService.sendPaymentConfirmation({
            tenantId,
            userEmail: userInfo.email,
            userName: userInfo.name,
            paymentType: 'credit_purchase',
            amount: dollarAmount || totalAmount,
            currency: 'USD',
            transactionId: session.id as string,
            planName: 'Credit Purchase',
            billingCycle: undefined,
            creditsAdded: creditAmount,
            sessionId: session.id as string
          });
        }
      } catch (err: unknown) {
        console.error('❌ Failed to send credit purchase confirmation email:', err);
      }

      return;
    }

    // Subscription handling
    if (session.mode === 'subscription') {
      console.log('📋 Processing subscription completion');

      const planId = packageId;
      if (!planId) {
        throw new Error('Missing planId in subscription checkout session metadata');
      }

      const plans = await getAvailablePlans();
      const plan = plans.find((p: Record<string, unknown>) => p.id === planId);

      if (!plan) {
        throw new Error(`Invalid plan ID: ${planId}`);
      }

      const existingSubscription = await getCurrentSubscription(tenantId);

      let subscriptionRecord: Record<string, unknown>;

      if (existingSubscription) {
        console.log('🔄 Updating existing subscription for tenant:', tenantId);

        const updateData = {
          plan: planId,
          status: 'active',
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer,
          yearlyPrice: String((plan as { yearlyPrice?: number }).yearlyPrice ?? 0),
          billingCycle,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_FALLBACK_PERIOD_MS),
          updatedAt: new Date()
        } as Record<string, unknown>;

        if (planId !== 'trial' && planId !== 'free') {
          updateData.hasEverUpgraded = true;
          updateData.isTrialUser = false;
        }

        const [updatedSubscription] = await db
          .update(subscriptions)
          .set(updateData as Record<string, unknown>)
          .where(eq(subscriptions.tenantId, tenantId))
          .returning();

        if (!updatedSubscription) {
          throw new Error(`Failed to update subscription for tenant: ${tenantId}`);
        }

        await updateAdministratorRolesForPlan(tenantId, planId);

        try {
          const onboardingOrgSetup = (await import('../../onboarding/services/onboarding-organization-setup.js')).default;
          await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(tenantId, planId, { skipIfRecentlyUpdated: true });
        } catch (errOrgApp: unknown) {
          console.error('❌ Failed to update organization applications:', (errOrgApp as Error).message);
        }

        subscriptionRecord = existingSubscription;
      } else {
        console.log('🆕 Creating new subscription for tenant:', tenantId);

        const [newSubscription] = await db
          .insert(subscriptions)
          .values({
            subscriptionId: uuidv4(),
            tenantId,
            plan: planId,
            status: 'active',
            stripeSubscriptionId: (session as Record<string, unknown>).subscription ?? null,
            stripeCustomerId: (session as Record<string, unknown>).customer ?? null,
            yearlyPrice: String((plan as { yearlyPrice?: number }).yearlyPrice ?? 0),
            billingCycle,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_FALLBACK_PERIOD_MS),
            hasEverUpgraded: true,
            isTrialUser: false,
            createdAt: new Date(),
            updatedAt: new Date()
          } as Record<string, unknown>)
          .returning();

        subscriptionRecord = newSubscription as unknown as Record<string, unknown>;
      }

      console.log('💰 Checkout completed — payment will be recorded by payment.succeeded webhook');

      const [updatedTenant] = await db
        .update(tenants)
        .set({
          stripeCustomerId: (session as Record<string, unknown>).customer ?? undefined,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId))
        .returning();

      if (!updatedTenant) {
        console.warn('⚠️ Failed to update tenant with customer ID:', tenantId);
      }

      // Persist enterprise-grade checkout audit data at checkout completion time.
      try {
        const { PaymentService } = await import('./payment-service.js');
        const checkoutPaymentIntentId = String(session.payment_intent ?? session.id);
        const amountTotal = Number(session.amount_total ?? 0);
        const checkoutAmount = amountTotal > 0 ? amountTotal / 100 : 0;
        const existingCheckoutPayment = await PaymentService.getPaymentByIntentId(checkoutPaymentIntentId);

        if (!existingCheckoutPayment) {
          await PaymentService.recordPayment({
            tenantId,
            subscriptionId: (subscriptionRecord?.subscriptionId as string | undefined) ?? undefined,
            stripePaymentIntentId: checkoutPaymentIntentId,
            stripeCustomerId: (session.customer as string | undefined) ?? undefined,
            amount: checkoutAmount.toString(),
            currency: String(session.currency ?? 'USD').toUpperCase(),
            status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
            paymentMethod: 'card',
            paymentType: 'subscription_checkout',
            billingReason: 'checkout_completed',
            description: `Checkout completed for ${String((plan as Record<string, unknown>).name ?? planId)} plan`,
            metadata: {
              checkoutSessionId: session.id,
              checkoutAuditSnapshot,
              planId,
              billingCycle,
              provider: gateway.providerName,
              ...(typeof session.metadata === 'object' && session.metadata !== null ? (session.metadata as Record<string, unknown>) : {})
            },
            stripeRawData: {
              checkoutSessionAudit: checkoutAuditSnapshot,
              checkoutSession: session
            },
            paidAt: session.payment_status === 'paid' ? new Date() : undefined
          });
        } else {
          await db
            .update(payments)
            .set({
              metadata: {
                ...((existingCheckoutPayment.metadata as Record<string, unknown>) || {}),
                checkoutSessionId: session.id,
                checkoutAuditSnapshot,
                planId,
                billingCycle,
                provider: gateway.providerName,
              } as Record<string, unknown>,
              stripeRawData: {
                ...((existingCheckoutPayment.stripeRawData as Record<string, unknown>) || {}),
                checkoutSessionAudit: checkoutAuditSnapshot,
                checkoutSession: session
              } as Record<string, unknown>,
              updatedAt: new Date()
            } as Record<string, unknown>)
            .where(eq(payments.paymentId, (existingCheckoutPayment as Record<string, unknown>).paymentId as string));
        }
      } catch (errAudit: unknown) {
        console.error('❌ Failed to persist checkout audit snapshot:', errAudit);
      }

      // Allocate plan credits — with dedup guard to prevent double allocation.
      // Both checkout.completed and subscription.created fire for the same Stripe
      // subscription, so we acquire a tenant-scoped advisory lock THEN check for
      // an existing credit transaction with operation_code = 'subscription' in
      // this billing period.  The advisory lock serialises the two concurrent
      // handlers so the check-then-insert is atomic.
      try {
        const planCredits = Number((plan as Record<string, unknown>).credits) || 0;
        if (planCredits > 0) {
          // Acquire an advisory lock keyed on the tenant to serialise concurrent
          // webhook handlers.  hashtext() returns a stable int for the tenant UUID.
          await db.execute(sql`SELECT pg_advisory_lock(hashtext(${tenantId} || '_plan_credits'))`);

          try {
            const periodStart = existingSubscription?.currentPeriodStart
              ? new Date(existingSubscription.currentPeriodStart as string | number)
              : new Date(Date.now() - 60_000); // 1min ago fallback for brand-new subscriptions

            // The dedup guard must match what addCreditsToEntity actually writes:
            //   transaction_type = 'purchase', operation_code = 'subscription'
            const [alreadyAllocated] = await db
              .select({ total: count() })
              .from(creditTransactions)
              .where(and(
                eq(creditTransactions.tenantId, tenantId),
                eq(creditTransactions.transactionType, 'purchase'),
                eq(creditTransactions.operationCode, 'subscription'),
                gte(creditTransactions.createdAt, periodStart)
              ));

            if ((alreadyAllocated?.total ?? 0) > 0) {
              console.log(`⏭️ Plan credits already allocated for tenant ${tenantId} in current period — skipping (checkout.completed)`);
            } else {
              // Order by entityLevel + createdAt so the onboarding org (first created) is picked
              const orgEntities = await db
                .select()
                .from(entities)
                .where(and(eq(entities.tenantId, tenantId), eq(entities.entityType, 'organization'), eq(entities.isActive, true)))
                .orderBy(entities.entityLevel, entities.createdAt);

              const defaultEntity = orgEntities[0];

              if (defaultEntity) {
                await CreditService.addCreditsToEntity({
                  tenantId,
                  entityType: 'organization',
                  entityId: defaultEntity.entityId,
                  creditAmount: planCredits,
                  source: 'subscription',
                  sourceId: (session as Record<string, unknown>).id || (subscriptionRecord?.subscriptionId as string),
                  description: `${(plan as Record<string, unknown>).name} plan credits (${planCredits.toLocaleString()} annual credits)`,
                  initiatedBy: 'system'
                });
                console.log(`✅ Allocated ${planCredits.toLocaleString()} plan credits for tenant ${tenantId} (checkout.completed)`);
              }
            }
          } finally {
            // Always release the advisory lock, even if credit allocation fails.
            await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${tenantId} || '_plan_credits'))`);
          }
        }
      } catch (errCredit: unknown) {
        console.error('❌ Failed to allocate plan credits:', (errCredit as Error).message);
      }

      // Send confirmation email
      try {
        const paymentsModule = await import('../routes/payments.js');
        const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
        const userInfo = await getTenantAdminEmail(tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../utils/email.js');
          const emailService = new EmailService();

          const checkoutCur = String(meta.checkoutCurrency ?? 'usd').toLowerCase();
          const amountForEmail =
            checkoutCur === 'inr'
              ? Number((plan as { yearlyPriceInr?: number }).yearlyPriceInr ?? 0)
              : Number((plan as { yearlyPrice?: number }).yearlyPrice ?? 0);
          const currencyForEmail = checkoutCur === 'inr' ? 'INR' : 'USD';

          await emailService.sendPaymentConfirmation({
            tenantId,
            userEmail: userInfo.email,
            userName: userInfo.name,
            paymentType: 'subscription',
            amount: amountForEmail,
            currency: currencyForEmail,
            transactionId: (session as Record<string, unknown>).id,
            planName: (plan as Record<string, unknown>).name,
            billingCycle,
            sessionId: (session as Record<string, unknown>).id
          });
        }
      } catch (err: unknown) {
        console.error('❌ Failed to send subscription confirmation email:', err);
      }

      // Notify downstream apps about the new/reactivated subscription
      // This is critical for apps like Financial Accounting that need to know
      // the plan and enabled modules to update their sidebar and permissions.
      try {
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        const { getPlan } = await import('../../../data/plans.js');
        const targetApps = (process.env.BUSINESS_SUITE_TARGET_APPS || 'crm,accounting,ops').split(',').map(a => a.trim());

        const planDef = getPlan(planId as string);
        const planModules = planDef?.modules ?? {};

        for (const app of targetApps) {
          const appModules = planModules[app] ?? [];
          const isNewApp = (planDef?.applications ?? []).includes(app);

          await snsSqsPublisher.publishInterAppEvent({
            eventType: 'subscription.upgraded',
            sourceApplication: 'wrapper',
            targetApplication: app,
            tenantId,
            eventData: {
              tenantId,
              previousPlan: 'free',
              newPlan: planId,
              previousPlanName: 'Free',
              newPlanName: planDef?.name ?? planId,
              status: 'active',
              effectiveAt: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_FALLBACK_PERIOD_MS).toISOString(),
              isNewApp,
              modules: appModules === '*' ? ['*'] : appModules,
              addedModules: appModules === '*' ? ['*'] : appModules,
              action: 'plan_upgrade',
            },
            publishedBy: 'system',
          });
        }
        console.log(`✅ Published subscription.activated to ${targetApps.length} downstream apps for plan ${planId}`);
      } catch (pubErr: unknown) {
        console.error('❌ Failed to publish subscription.activated:', (pubErr as Error).message);
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling checkout completed:', error);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'checkout.completed');
      scope.setContext('checkout', { sessionId: session.id, mode: session.mode });
      Sentry.captureException(error);
    });
    throw error;
  }
}

/** Apply invoice payment to a subscription (fallback when lookup by stripeSubscriptionId fails). */
export async function applyInvoicePaymentToSubscription(
  subscriptionRecord: Record<string, unknown>,
  stripeSubscriptionId: string,
  invoice: Record<string, unknown> & {
    lines?: { data?: Array<{ price?: { id?: string } }> };
    billing_reason?: string;
  }
): Promise<void> {
  const linePriceId = invoice.lines?.data?.[0]?.price?.id;
  const planId = linePriceId ? await getPlanIdFromPriceId(linePriceId) : null;
  const setPayload: Record<string, unknown> = {
    stripeSubscriptionId: stripeSubscriptionId,
    status: 'active',
    updatedAt: new Date()
  };
  if (planId) {
    const plans = await getAvailablePlans();
    const plan = plans.find((p: Record<string, unknown>) => p.id === planId) as Record<string, unknown> | undefined;
    if (plan) {
      setPayload.plan = planId;
      setPayload.yearlyPrice = String((plan.yearlyPrice ?? 0) as number);
    }
  }
  await db
    .update(subscriptions)
    .set(setPayload as Record<string, unknown>)
    .where(eq(subscriptions.subscriptionId, (subscriptionRecord.subscriptionId ?? subscriptionRecord.subscription_id) as string));

  if (planId) {
    console.log(`🔄 Triggering role upgrade for plan: ${planId}`);
    await updateAdministratorRolesForPlan(subscriptionRecord.tenantId as string, planId);
    try {
      const onboardingOrgSetup = (await import('../../onboarding/services/onboarding-organization-setup.js')).default;
      await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(
        subscriptionRecord.tenantId as string,
        planId,
        { skipIfRecentlyUpdated: true }
      );
    } catch (errOrgApp: unknown) {
      console.error('❌ Failed to update organization applications:', (errOrgApp as Error).message);
    }
  }
}

// Handle payment succeeded webhook
export async function handlePaymentSucceeded(
  invoice: Record<string, unknown> & {
    id?: string;
    subscription?: string;
    customer?: string;
    amount_paid?: number;
    currency?: string;
    payment_intent?: string;
    billing_reason?: string;
    number?: string;
    tax?: number;
    period_start?: number;
    period_end?: number;
    attempt_count?: number;
    next_payment_attempt?: number;
    status_transitions?: { paid_at?: number };
    lines?: { data?: Array<{ price?: { id?: string } }> };
    payment_method_types?: string[];
    charge?: string;
  }
): Promise<void> {
  try {
    console.log('💰 Processing payment succeeded for invoice:', invoice.id);

    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1);

      if (!subscription) {
        console.error('❌ Subscription not found for payment:', subscriptionId);

        const [fallbackSubscription] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId, (invoice.customer ?? '') as string))
          .limit(1);

        if (fallbackSubscription) {
          await applyInvoicePaymentToSubscription(fallbackSubscription as unknown as Record<string, unknown>, subscriptionId, invoice);
          return;
        }

        const [tenantByCustomer] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.stripeCustomerId, (invoice.customer ?? '') as string))
          .limit(1);

        if (tenantByCustomer) {
          const [subByTenant] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.tenantId, tenantByCustomer.tenantId))
            .limit(1);

          if (subByTenant) {
            await applyInvoicePaymentToSubscription(subByTenant as unknown as Record<string, unknown>, subscriptionId, invoice);
            return;
          }
        }

        // Attempt customer lookup via gateway
        const gateway = getPaymentGateway();
        if (gateway.isConfigured() && invoice.customer) {
          try {
            const gatewayCustomer = await gateway.retrieveCustomer(invoice.customer as string);
            const customerEmail = gatewayCustomer.deleted ? null : gatewayCustomer.email;
            if (customerEmail) {
              const [tenantUserByEmail] = await db
                .select()
                .from(tenantUsers)
                .where(eq(tenantUsers.email, customerEmail))
                .limit(1);

              if (tenantUserByEmail) {
                const [subByTenant] = await db
                  .select()
                  .from(subscriptions)
                  .where(eq(subscriptions.tenantId, tenantUserByEmail.tenantId))
                  .limit(1);

                if (subByTenant) {
                  console.log('✅ Found subscription by customer email:', customerEmail);
                  await applyInvoicePaymentToSubscription(subByTenant as unknown as Record<string, unknown>, subscriptionId, invoice);
                  await db
                    .update(tenants)
                    .set({ stripeCustomerId: invoice.customer, updatedAt: new Date() })
                    .where(eq(tenants.tenantId, tenantUserByEmail.tenantId));
                  return;
                }
              }
            }
          } catch (errGw: unknown) {
            console.warn('⚠️ Gateway customer lookup fallback failed:', (errGw as Error)?.message);
          }
        }

        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      // For proration invoices (subscription_update), the first line item is the
      // CREDIT for the old plan and the last line item is the CHARGE for the new plan.
      // Always use the last positive-amount line item to resolve the plan.
      const invoiceLines = ((invoice as Record<string, unknown>).lines as { data?: Array<{ price?: { id?: string }; amount?: number }> })?.data ?? [];
      const chargeLine = [...invoiceLines].reverse().find(l => (l.amount ?? 0) > 0) ?? invoiceLines[0];
      const invoicePriceId = chargeLine?.price?.id ?? null;
      const planId = invoicePriceId ? await getPlanIdFromPriceId(invoicePriceId as string) : null;
      const setPayload: Record<string, unknown> = {
        status: 'active',
        updatedAt: new Date()
      };
      if (planId) {
        const plans = await getAvailablePlans();
        const plan = plans.find((p: Record<string, unknown>) => p.id === planId) as Record<string, unknown> | undefined;
        if (plan) {
          setPayload.plan = planId;
          setPayload.yearlyPrice = String((plan.yearlyPrice ?? 0) as number);
        }
      }
      await db
        .update(subscriptions)
        .set(setPayload as Record<string, unknown>)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

      if (planId) {
        await updateAdministratorRolesForPlan(subscription.tenantId, planId);
        try {
          const onboardingOrgSetup = (await import('../../onboarding/services/onboarding-organization-setup.js')).default;
          await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(subscription.tenantId, planId, { skipIfRecentlyUpdated: true });
        } catch (errOrgApp: unknown) {
          console.error('❌ Failed to update organization applications:', (errOrgApp as Error).message);
        }
      }

      const amountPaid = (invoice as Record<string, unknown>).amount_paid ?? 0;
      const invoiceTax = (invoice as Record<string, unknown>).tax ?? 0;
      const invoiceCurrency = (invoice as Record<string, unknown>).currency ?? 'USD';
      const paymentIntentId = (invoice as Record<string, unknown>).payment_intent as string | undefined;

      let existingPaymentByIntent: Record<string, unknown> | null = null;
      if (paymentIntentId) {
        const [existing] = await db
          .select(safePaymentSelect)
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, paymentIntentId))
          .limit(1);
        existingPaymentByIntent = (existing as unknown as Record<string, unknown>) || null;
      }

      if (existingPaymentByIntent) {
        const existingMeta = (existingPaymentByIntent.metadata as Record<string, unknown>) || {};
        const existingRaw = (existingPaymentByIntent.stripeRawData as Record<string, unknown>) || {};
        await db
          .update(payments)
          .set({
            tenantId: (subscription as Record<string, unknown>).tenantId,
            subscriptionId: ((subscription as Record<string, unknown>).subscriptionId ?? undefined) as string | undefined,
            stripeInvoiceId: invoice.id as string,
            stripeChargeId: (invoice as Record<string, unknown>).charge as string | undefined,
            amount: String(amountPaid / 100),
            currency: String(invoiceCurrency).toUpperCase(),
            status: 'completed',
            paymentMethod: 'card',
            paymentType: 'subscription',
            billingReason: (invoice as Record<string, unknown>).billing_reason as string | undefined,
            invoiceNumber: (invoice as Record<string, unknown>).number as string | undefined,
            description: `Subscription payment for ${(subscription as Record<string, unknown>).plan as string} plan`,
            taxAmount: String(invoiceTax / 100),
            metadata: {
              ...existingMeta,
              stripeCustomerId: (invoice as Record<string, unknown>).customer,
              billingReason: (invoice as Record<string, unknown>).billing_reason,
              subscriptionPeriod: {
                start: new Date(((invoice as Record<string, unknown>).period_start ?? 0) * 1000),
                end: new Date(((invoice as Record<string, unknown>).period_end ?? 0) * 1000)
              },
              attempt_count: (invoice as Record<string, unknown>).attempt_count,
              nextPaymentAttempt: (invoice as Record<string, unknown>).next_payment_attempt ? new Date((invoice as Record<string, unknown>).next_payment_attempt * 1000) : null
            } as Record<string, unknown>,
            stripeRawData: {
              ...existingRaw,
              invoice
            } as Record<string, unknown>,
            paidAt: new Date(((invoice as Record<string, unknown>).status_transitions?.paid_at ?? 0) * 1000),
            updatedAt: new Date()
          } as Record<string, unknown>)
          .where(eq(payments.paymentId, (existingPaymentByIntent.paymentId as string)));
      } else {
        await PaymentService.createPaymentRecord({
          tenantId: (subscription as Record<string, unknown>).tenantId,
          subscriptionId: ((subscription as Record<string, unknown>).subscriptionId ?? undefined) as string | undefined,
          stripePaymentIntentId: (invoice as Record<string, unknown>).payment_intent,
          stripeInvoiceId: invoice.id,
          stripeChargeId: (invoice as Record<string, unknown>).charge,
          amount: amountPaid / 100,
          currency: String(invoiceCurrency).toUpperCase(),
          status: 'succeeded',
          paymentMethod: 'card',
          paymentType: 'subscription',
          billingReason: (invoice as Record<string, unknown>).billing_reason,
          invoiceNumber: (invoice as Record<string, unknown>).number,
          description: `Subscription payment for ${(subscription as Record<string, unknown>).plan as string} plan`,
          taxAmount: invoiceTax / 100,
          processingFees: 0,
          netAmount: (amountPaid - invoiceTax) / 100,
          paymentMethodDetails: {},
          riskLevel: 'normal',
          metadata: {
            stripeCustomerId: (invoice as Record<string, unknown>).customer,
            billingReason: (invoice as Record<string, unknown>).billing_reason,
            subscriptionPeriod: {
              start: new Date(((invoice as Record<string, unknown>).period_start ?? 0) * 1000),
              end: new Date(((invoice as Record<string, unknown>).period_end ?? 0) * 1000)
            },
            attempt_count: (invoice as Record<string, unknown>).attempt_count,
            nextPaymentAttempt: (invoice as Record<string, unknown>).next_payment_attempt ? new Date((invoice as Record<string, unknown>).next_payment_attempt * 1000) : null
          },
          stripeRawData: invoice,
          paidAt: new Date(((invoice as Record<string, unknown>).status_transitions?.paid_at ?? 0) * 1000)
        });
      }

      console.log('✅ Payment succeeded for tenant:', subscription.tenantId, 'amount:', amountPaid / 100);

      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        const [tenantUser] = await db
          .select()
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, subscription.tenantId))
          .limit(1);

        if (tenantUser) {
          const requestContext: RequestContext = {
            ipAddress: undefined,
            userAgent: 'payment-webhook',
            sessionId: undefined,
            source: 'webhook'
          };

          await ActivityLogger.logActivity(
            tenantUser.userId,
            subscription.tenantId,
            null,
            'payment.topup_success',
            {
              invoiceId: invoice.id,
              subscriptionId: subscription.subscriptionId,
              amount: amountPaid / 100,
              currency: invoiceCurrency,
              paymentMethod: invoice.payment_method_types?.[0] || 'card',
              planId: invoice.lines?.data?.[0]?.price?.id
            },
            requestContext
          );
        }
      } catch (errLog: unknown) {
        console.warn('⚠️ Failed to log payment success activity:', (errLog as Error).message);
      }
    } else {
      console.log('⚠️ Payment succeeded but no subscription ID found in invoice:', invoice.id);
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling payment succeeded:', error);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'payment.succeeded');
      scope.setContext('invoice', { invoiceId: invoice.id, subscriptionId: invoice.subscription, amount: invoice.amount_paid });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle invoice payment paid webhook
export async function handleInvoicePaymentPaid(invoicePayment: Record<string, unknown>): Promise<void> {
  try {
    console.log('💰 Processing invoice payment paid:', invoicePayment.id);

    const gateway = getPaymentGateway();

    if (!gateway.isConfigured()) {
      console.log('⚠️ Gateway not configured — skipping invoice payment processing');
      return;
    }

    try {
      const gatewayInvoice = await gateway.retrieveInvoice(invoicePayment.invoice as string);
      console.log('📄 Retrieved invoice:', { id: gatewayInvoice.id, customer: gatewayInvoice.customerId, subscription: gatewayInvoice.subscriptionId });

      // Map gateway invoice back to the shape handlePaymentSucceeded expects
      const invoiceObj = gatewayInvoice.rawData as Record<string, unknown>;
      await handlePaymentSucceeded(invoiceObj as Record<string, unknown> & { id?: string; subscription?: string; customer?: string; amount_paid?: number; currency?: string; payment_intent?: string; billing_reason?: string; number?: string; tax?: number; period_start?: number; period_end?: number; attempt_count?: number; next_payment_attempt?: number; status_transitions?: { paid_at?: number }; lines?: { data?: Array<{ price?: { id?: string } }> }; payment_method_types?: string[]; charge?: string });
    } catch (err: unknown) {
      const gwError = err as Error;
      console.error('❌ Failed to retrieve invoice:', gwError);

      const paymentIntent = (invoicePayment as Record<string, unknown>).payment?.payment_intent;
      if (paymentIntent) {
        const [payment] = await db
          .select(safePaymentSelect)
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, paymentIntent as string))
          .limit(1);

        if (payment) {
          const paidAt = (invoicePayment as Record<string, unknown>).status_transitions?.paid_at;
          await db
            .update(payments)
            .set({
              status: 'completed',
              paidAt: paidAt != null ? new Date((paidAt as number) * 1000) : new Date(),
              updatedAt: new Date()
            })
            .where(eq(payments.paymentId, payment.paymentId));
        }
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling invoice payment paid:', error);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'invoice.payment_paid');
      scope.setContext('invoice', { invoiceId: invoicePayment.id });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle payment failed webhook
export async function handlePaymentFailed(invoice: Record<string, unknown>): Promise<void> {
  try {
    console.log('❌ Processing payment failed for invoice:', invoice.id);

    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId as string))
        .limit(1);

      if (!subscription) {
        console.error('❌ Subscription not found for failed payment:', subscriptionId);
        return;
      }

      // Atomic: mark subscription as past_due + record the failed payment together.
      const inv = invoice as Record<string, unknown>;
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({ status: 'past_due', updatedAt: new Date() } as Record<string, unknown>)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId as string));

        await tx.insert(payments).values({
          tenantId: subscription.tenantId,
          subscriptionId: subscription.subscriptionId ?? undefined,
          stripePaymentIntentId: inv.payment_intent as string | undefined,
          stripeInvoiceId: inv.id as string | undefined,
          amount: String(Number(inv.amount_due ?? 0) / 100),
          currency: String(inv.currency ?? 'USD').toUpperCase(),
          status: 'failed',
          paymentMethod: 'card',
          paymentType: 'subscription',
          billingReason: inv.billing_reason as string | undefined,
          invoiceNumber: inv.number as string | undefined,
          description: `Failed subscription payment for ${subscription.plan} plan`,
          metadata: {
            stripeCustomerId: inv.customer,
            failureReason: (inv.last_finalization_error as Error)?.message || 'Payment failed',
            failureCode: (inv.last_finalization_error as Record<string, unknown>)?.code,
            attemptCount: inv.attempt_count,
            nextPaymentAttempt: inv.next_payment_attempt ? new Date((inv.next_payment_attempt as number) * 1000) : null,
            billingReason: inv.billing_reason
          },
          stripeRawData: invoice as Record<string, unknown>,
          paidAt: new Date()
        } as any);
      });

      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        const [tenantUser] = await db
          .select()
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, subscription.tenantId))
          .limit(1);

        if (tenantUser) {
          const requestContext: RequestContext = {
            ipAddress: undefined,
            userAgent: 'payment-webhook',
            sessionId: undefined,
            source: 'webhook'
          };

          await ActivityLogger.logActivity(
            tenantUser.userId,
            subscription.tenantId,
            null,
            'payment.topup_failed',
            {
              invoiceId: invoice.id,
              subscriptionId: subscription.subscriptionId,
              amount: Number((invoice as Record<string, unknown>).amount_due ?? 0) / 100,
              currency: String((invoice as Record<string, unknown>).currency ?? 'USD'),
              failureReason: ((invoice as Record<string, unknown>).last_finalization_error as Error)?.message || 'Payment failed',
              failureCode: ((invoice as Record<string, unknown>).last_finalization_error as Record<string, unknown>)?.code,
              attemptCount: (invoice as Record<string, unknown>).attempt_count,
              nextPaymentAttempt: (invoice as Record<string, unknown>).next_payment_attempt != null ? new Date(Number((invoice as Record<string, unknown>).next_payment_attempt) * 1000) : null
            },
            requestContext
          );
        }
      } catch (errLog: unknown) {
        console.warn('⚠️ Failed to log payment failure activity:', (errLog as Error).message);
      }

      const emailService = new EmailService();
      await emailService.sendPaymentFailedNotification({
        tenantId: subscription.tenantId,
        amount: (invoice as Record<string, unknown>).amount_due / 100,
        currency: ((invoice as Record<string, unknown>).currency as string).toUpperCase(),
        nextAttempt: (invoice as Record<string, unknown>).next_payment_attempt ? new Date((invoice as Record<string, unknown>).next_payment_attempt * 1000) : undefined,
        failureReason: ((invoice as Record<string, unknown>).last_finalization_error as Error)?.message || 'Payment failed'
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling payment failed:', error);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'payment.failed');
      scope.setContext('invoice', { invoiceId: invoice.id, subscriptionId: invoice.subscription });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle charge dispute webhook
export async function handleChargeDispute(
  dispute: Record<string, unknown> & {
    id: string;
    charge: string;
    amount: number;
    reason?: string;
    status?: string;
    currency?: string;
    created?: number;
    evidence_details?: { due_by?: number; has_evidence?: boolean };
  }
): Promise<void> {
  try {
    console.log('⚖️ Processing charge dispute:', dispute.id);

    const [payment] = await db
      .select(safePaymentSelect)
      .from(payments)
      .where(eq(payments.stripeChargeId, dispute.charge))
      .limit(1);

    if (!payment) {
      console.error('❌ Payment not found for dispute:', dispute.charge);
      return;
    }

    await db
      .update(payments)
      .set({
        status: 'disputed',
        updatedAt: new Date(),
        metadata: {
          ...(payment.metadata as Record<string, unknown> || {}),
          dispute: {
            id: dispute.id,
            reason: dispute.reason,
            status: dispute.status,
            amount: dispute.amount / 100,
            currency: dispute.currency,
            evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
            has_evidence: dispute.evidence_details?.has_evidence || false
          }
        },
        stripeRawData: {
          ...(payment.stripeRawData as Record<string, unknown> || {}),
          dispute: dispute
        }
      } as Record<string, unknown>)
      .where(eq(payments.paymentId, payment.paymentId));

    const emailServiceDispute = new EmailService();
    await emailServiceDispute.sendDisputeNotification({
      tenantId: payment.tenantId,
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      currency: String(dispute.currency ?? 'USD'),
      reason: dispute.reason ?? '',
      evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : undefined
    });

    console.log('⚖️ Dispute recorded for payment:', payment.paymentId);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling charge dispute:', error);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'charge.disputed');
      scope.setContext('dispute', { disputeId: dispute.id, chargeId: dispute.charge, amount: dispute.amount });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle refund webhook
export async function handleRefund(
  refund: Record<string, unknown> & {
    id: string;
    charge: string;
    amount: number;
    reason?: string;
    status?: string;
    currency?: string;
    created?: number;
  }
): Promise<void> {
  const refundCreated = (refund.created ?? 0) as number;
  const refundCurrency = (refund.currency ?? 'USD') as string;
  try {
    console.log('💸 Processing refund:', refund.id);

    const [payment] = await db
      .select(safePaymentSelect)
      .from(payments)
      .where(eq(payments.stripeChargeId, refund.charge))
      .limit(1);

    if (!payment) {
      console.error('❌ Payment not found for refund:', refund.charge);
      return;
    }

    const refundAmount = refund.amount / 100;
    const isPartialRefund = refundAmount < parseFloat(String(payment.amount));

    const existingMeta = (payment.metadata as Record<string, unknown>) || {};

    // Atomic: update original payment + create refund record in one transaction.
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: isPartialRefund ? 'partially_refunded' : 'refunded',
          updatedAt: new Date(),
          metadata: {
            ...existingMeta,
            amountRefunded: refundAmount,
            stripeRefundId: refund.id,
            refund: {
              id: refund.id,
              amount: refundAmount,
              reason: refund.reason,
              status: refund.status,
              created: new Date(refundCreated * 1000)
            }
          }
        } as Record<string, unknown>)
        .where(eq(payments.paymentId, payment.paymentId));

      await tx.insert(payments).values({
        tenantId: payment.tenantId,
        subscriptionId: payment.subscriptionId ?? undefined,
        stripeChargeId: refund.charge,
        amount: String(-refundAmount),
        currency: String(refundCurrency).toUpperCase(),
        status: (refund.status ?? 'succeeded') as string,
        paymentType: 'refund',
        billingReason: 'refund',
        description: `Refund for ${refund.reason || 'customer request'}`,
        metadata: {
          originalPaymentId: payment.paymentId,
          refundReason: refund.reason,
          isPartialRefund
        },
        stripeRawData: refund,
        paidAt: new Date(refundCreated * 1000)
      } as any);
    });

    console.log('💸 Refund recorded:', refund.id, 'amount:', refundAmount);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling refund:', error);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'refund.created');
      scope.setContext('refund', { refundId: refund.id, chargeId: refund.charge, amount: refund.amount });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle subscription updated webhook
export async function handleSubscriptionUpdated(
  subscription: Record<string, unknown> & {
    id: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    items?: { data?: Array<{ price?: string | { id?: string } }> };
  }
): Promise<void> {
  try {
    // Read the CURRENT DB state BEFORE updating — needed to detect plan changes vs renewals
    const [existing] = await db
      .select({
        tenantId: subscriptions.tenantId,
        plan: subscriptions.plan,
        currentPeriodStart: subscriptions.currentPeriodStart,
      })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    const priceRef = subscription.items?.data?.[0]?.price;
    const priceId = typeof priceRef === 'string' ? priceRef : (priceRef && typeof priceRef === 'object' && 'id' in priceRef ? (priceRef as { id?: string }).id : null);
    const planId = priceId ? await getPlanIdFromPriceId(priceId) : null;

    const setPayload: Record<string, unknown> = {
      status: normalizeStripeSubscriptionStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    };

    // Sync cancellation scheduling from Stripe
    const cancelAt = (subscription as Record<string, unknown>).cancel_at;
    const cancelAtPeriodEnd = (subscription as Record<string, unknown>).cancel_at_period_end;
    if (cancelAt) {
      setPayload.cancelAt = new Date((cancelAt as number) * 1000);
    } else if (cancelAtPeriodEnd === true) {
      setPayload.cancelAt = new Date(subscription.current_period_end * 1000);
    } else if (cancelAtPeriodEnd === false && !cancelAt) {
      // Cancellation was revoked (user resubscribed)
      setPayload.cancelAt = null;
    }

    if (planId) {
      const plans = await getAvailablePlans();
      const plan = plans.find((p: Record<string, unknown>) => p.id === planId) as Record<string, unknown> | undefined;
      if (plan) {
        setPayload.plan = planId;
        setPayload.yearlyPrice = String((plan.yearlyPrice ?? 0) as number);
      }
    }

    // Now update the DB with the new state from Stripe
    await db
      .update(subscriptions)
      .set(setPayload as Record<string, unknown>)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

    if (existing?.tenantId && planId) {
      await updateAdministratorRolesForPlan(existing.tenantId, planId);
      try {
        const onboardingOrgSetup = (await import('../../onboarding/services/onboarding-organization-setup.js')).default;
        await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(existing.tenantId, planId, { skipIfRecentlyUpdated: true });
      } catch (errOrgApp: unknown) {
        console.error('❌ Failed to update organization applications:', (errOrgApp as Error).message);
      }
    }

    // ── Detect: plan change (mid-cycle upgrade) vs renewal (period boundary) ──
    // Uses the DB state captured BEFORE the update above.
    if (existing?.tenantId) {
      const dbPlan = existing.plan ?? null;
      const dbPeriodStart = existing.currentPeriodStart;
      const newPeriodStart = new Date(subscription.current_period_start * 1000);
      const newPeriodEnd = new Date(subscription.current_period_end * 1000);

      // Period changed = renewal (start date moved forward by ~1 year)
      const isRenewal = dbPeriodStart
        ? Math.abs(newPeriodStart.getTime() - new Date(dbPeriodStart as string | Date).getTime()) > 86_400_000 // > 1 day difference
        : false;
      // Plan changed = mid-cycle upgrade/downgrade
      const isPlanChange = planId && dbPlan && planId !== dbPlan;

      console.log(`📊 Subscription update type: renewal=${isRenewal}, planChange=${isPlanChange} (${dbPlan} → ${planId})`);

      // ── Helper: resolve new plan's credit amount ──
      const resolveNewPlanCredits = async () => {
        const items = (subscription as Record<string, unknown>).items as { data?: Array<{ price?: { id?: string } | string }> } | undefined;
        const newPriceId = items?.data?.[0]?.price
          ? (typeof items.data[0].price === 'string' ? items.data[0].price : items.data[0].price.id)
          : null;
        const newPlanId = newPriceId ? await getPlanIdFromPriceId(newPriceId) : (planId || null);
        const plans = await getAvailablePlans();
        const newPlan = plans.find((p: Record<string, unknown>) => p.id === newPlanId);
        return { newPlanId, newPlan, credits: Number((newPlan as Record<string, unknown>)?.credits) || 0 };
      };

      // ── Helper: allocate credits to the onboarding org ──
      const allocateCredits = async (creditAmount: number, planName: string, description: string) => {
        const orgEntities = await db
          .select()
          .from(entities)
          .where(and(eq(entities.tenantId, existing.tenantId), eq(entities.entityType, 'organization'), eq(entities.isActive, true)))
          .orderBy(entities.entityLevel, entities.createdAt);
        const defaultEntity = orgEntities[0];
        if (defaultEntity) {
          await CreditService.addCreditsToEntity({
            tenantId: existing.tenantId,
            entityType: 'organization',
            entityId: defaultEntity.entityId,
            creditAmount,
            source: 'subscription',
            sourceId: subscription.id,
            description,
            initiatedBy: 'system'
          });
          console.log(`✅ Allocated ${creditAmount.toLocaleString()} ${planName} credits for tenant ${existing.tenantId}`);
        }
      };

      if (isPlanChange && !isRenewal) {
        // ── MID-CYCLE PLAN UPGRADE ──
        // Expire old plan's subscription credits, allocate new plan's full credits.
        // Stripe handles the prorated payment; we handle the credit swap.
        console.log(`🔄 Mid-cycle plan change: ${dbPlan} → ${planId} for tenant ${existing.tenantId}`);

        // Expire old plan credits (non-campaign batches for current period)
        try {
          const { CreditExpiryService } = await import('../../credits/services/credit-expiry-service.js');
          await CreditExpiryService.expirePreviousTenureCredits(existing.tenantId, newPeriodStart);
          console.log(`✅ Expired old plan (${dbPlan}) credits on upgrade`);
        } catch (syncErr: unknown) {
          console.error('❌ Failed to expire old plan credits on upgrade:', (syncErr as Error).message);
        }

        // Allocate new plan credits
        try {
          const { newPlan, credits } = await resolveNewPlanCredits();
          if (credits > 0) {
            await allocateCredits(credits, (newPlan as Record<string, unknown>)?.name as string ?? planId,
              `${(newPlan as Record<string, unknown>)?.name ?? planId} plan upgrade credits (${credits.toLocaleString()} annual credits)`);
          }
        } catch (errCredit: unknown) {
          console.error('❌ Failed to allocate upgrade credits:', (errCredit as Error).message);
        }

        // Notify downstream apps about the plan change
        try {
          const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
          const { getPlan } = await import('../../../data/plans.js');
          const targetApps = (process.env.BUSINESS_SUITE_TARGET_APPS || 'crm,accounting,ops').split(',').map(a => a.trim());

          const previousPlanDef = getPlan(dbPlan as string);
          const newPlanDef = getPlan(planId as string);

          // Compute which applications and modules were added in this upgrade
          const previousApps = new Set(previousPlanDef?.applications ?? []);
          const newApps = newPlanDef?.applications ?? [];
          const addedApplications = newApps.filter(app => !previousApps.has(app));

          const previousModules = previousPlanDef?.modules ?? {};
          const newModules = newPlanDef?.modules ?? {};
          const addedModules: Record<string, string[]> = {};
          for (const [app, mods] of Object.entries(newModules)) {
            const prev = previousModules[app];
            if (!prev) {
              // Entire app is new
              addedModules[app] = mods === '*' ? ['*'] : mods;
            } else if (mods === '*' && prev !== '*') {
              addedModules[app] = ['*'];
            } else if (Array.isArray(mods) && Array.isArray(prev)) {
              const prevSet = new Set(prev);
              const added = mods.filter(m => !prevSet.has(m));
              if (added.length > 0) addedModules[app] = added;
            }
          }

          for (const app of targetApps) {
            // Each app only receives its own modules — not other apps' data
            const appModules = newModules[app] ?? [];
            const appAddedModules = addedModules[app] ?? [];
            const isNewApp = addedApplications.includes(app);

            await snsSqsPublisher.publishInterAppEvent({
              eventType: 'subscription.upgraded',
              sourceApplication: 'wrapper',
              targetApplication: app,
              tenantId: existing.tenantId,
              eventData: {
                tenantId: existing.tenantId,
                previousPlan: dbPlan,
                newPlan: planId,
                previousPlanName: previousPlanDef?.name ?? dbPlan,
                newPlanName: newPlanDef?.name ?? planId,
                status: subscription.status,
                effectiveAt: new Date().toISOString(),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                isNewApp,
                modules: appModules,
                addedModules: appAddedModules,
                action: 'plan_upgrade',
              },
              publishedBy: 'system',
            });
          }
          console.log(`✅ Published subscription.upgraded to ${targetApps.length} downstream apps`);
        } catch (pubErr: unknown) {
          console.error('❌ Failed to publish subscription.upgraded:', (pubErr as Error).message);
        }

      } else if (cancelAtPeriodEnd === true) {
        // ── CANCELLATION SCHEDULED ──
        // User scheduled cancellation — notify downstream apps so they can
        // show warnings, start data export flows, or prompt retention.
        const cancelDate = cancelAt
          ? new Date((cancelAt as number) * 1000)
          : new Date(subscription.current_period_end * 1000);

        console.log(`📅 Cancellation scheduled for tenant ${existing.tenantId} at ${cancelDate.toISOString()}`);

        try {
          const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
          const targetApps = (process.env.BUSINESS_SUITE_TARGET_APPS || 'crm,accounting,ops').split(',').map(a => a.trim());
          for (const app of targetApps) {
            await snsSqsPublisher.publishInterAppEvent({
              eventType: 'subscription.cancel_scheduled',
              sourceApplication: 'wrapper',
              targetApplication: app,
              tenantId: existing.tenantId,
              entityId: existing.tenantId,
              eventData: {
                tenantId: existing.tenantId,
                plan: planId || dbPlan,
                status: subscription.status,
                cancelAt: cancelDate.toISOString(),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                action: 'cancel_scheduled',
              },
              publishedBy: 'system',
            });
          }
          console.log(`✅ Published subscription.cancel_scheduled to ${targetApps.length} downstream apps`);
        } catch (pubErr: unknown) {
          console.error('❌ Failed to publish subscription.cancel_scheduled:', (pubErr as Error).message);
        }

        // Send cancellation confirmation email to tenant admin
        try {
          const paymentsModule = await import('../routes/payments.js');
          const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
          const userInfo = await getTenantAdminEmail(existing.tenantId);
          if (userInfo?.email) {
            const { EmailService } = await import('../../../utils/email.js');
            const emailService = new EmailService();
            await emailService.sendEmail({
              to: [{ email: userInfo.email, name: userInfo.name }],
              subject: 'Subscription Cancellation Scheduled',
              htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px;">
                  <h2 style="color: #1B2E5A; margin-bottom: 16px;">Subscription Cancellation Scheduled</h2>
                  <p style="color: #475569; line-height: 1.6;">
                    Your subscription has been scheduled for cancellation. Here are the details:
                  </p>
                  <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 4px 0;"><strong>Plan:</strong> ${(planId || dbPlan || 'N/A').charAt(0).toUpperCase() + (planId || dbPlan || 'N/A').slice(1)}</p>
                    <p style="margin: 4px 0;"><strong>Active until:</strong> ${cancelDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p style="margin: 4px 0;"><strong>Status:</strong> Active (no further charges)</p>
                  </div>
                  <p style="color: #475569; line-height: 1.6;">
                    You will continue to have full access to all features until the date above.
                    If you change your mind, you can resubscribe at any time from your billing page.
                  </p>
                </div>
              `,
            });
            console.log(`📧 Sent cancellation confirmation email to ${userInfo.email}`);
          }
        } catch (emailErr: unknown) {
          console.error('❌ Failed to send cancellation confirmation email:', (emailErr as Error).message);
        }

      } else if (isRenewal) {
        // ── ANNUAL RENEWAL ──
        // Expire all old tenure credits, allocate new tenure credits.
        const previousPeriodEnd = newPeriodStart; // renewal boundary

        try {
          const { CreditExpiryService } = await import('../../credits/services/credit-expiry-service.js');
          await CreditExpiryService.expirePreviousTenureCredits(existing.tenantId, previousPeriodEnd);
          console.log(`✅ Expired previous tenure credits (before ${previousPeriodEnd.toISOString()}) for tenant ${existing.tenantId}`);
        } catch (syncErr: unknown) {
          console.error('❌ Failed to expire previous tenure credits:', (syncErr as Error).message);
        }

        // Allocate new tenure credits
        try {
          const { newPlan, credits } = await resolveNewPlanCredits();
          if (credits > 0) {
            await allocateCredits(credits, (newPlan as Record<string, unknown>)?.name as string ?? planId,
              `${(newPlan as Record<string, unknown>)?.name ?? planId} plan renewal credits (${credits.toLocaleString()} annual credits)`);
          }
        } catch (errRenewalCredits: unknown) {
          console.error('❌ Failed to allocate renewal credits:', (errRenewalCredits as Error).message);
        }

        // Notify downstream apps
        try {
          const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
          const targetApps = (process.env.BUSINESS_SUITE_TARGET_APPS || 'crm,accounting,ops').split(',').map(a => a.trim());
          for (const app of targetApps) {
            await snsSqsPublisher.publishInterAppEvent({
              eventType: 'subscription.renewed',
              sourceApplication: 'wrapper',
              targetApplication: app,
              tenantId: existing.tenantId,
              entityId: existing.tenantId,
              eventData: {
                tenantId: existing.tenantId,
                plan: planId || subscription.status,
                previousPeriodEnd: previousPeriodEnd.toISOString(),
                newPeriodEnd: newPeriodEnd.toISOString(),
                status: subscription.status,
                action: 'expire_previous_tenure',
              },
              publishedBy: 'system',
            });
          }
          console.log(`✅ Published subscription.renewed to ${targetApps.length} downstream apps`);
        } catch (pubErr: unknown) {
          console.error('❌ Failed to publish subscription.renewed:', (pubErr as Error).message);
        }
      }
    }

    console.log('🔄 Subscription updated:', subscription.id);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling subscription updated:', error);
    Sentry.captureException(error, { tags: { 'payment.handler': 'subscription.updated' } });
    throw error;
  }
}

// Handle subscription created webhook
export async function handleSubscriptionCreated(
  subscription: Record<string, unknown> & {
    id: string;
    customer: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
  }
): Promise<void> {
  try {
    console.log('🆕 Processing subscription created:', subscription.id);

    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, subscription.customer))
      .limit(1);

    if (existingSubscription) {
      await db
        .update(subscriptions)
        .set({
          stripeSubscriptionId: subscription.id,
          status: normalizeStripeSubscriptionStatus(subscription.status),
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          updatedAt: new Date()
        })
        .where(eq(subscriptions.subscriptionId, existingSubscription.subscriptionId));

      console.log('✅ Updated existing subscription with provider subscription ID');

      // Sync credit batch expiry dates with the new subscription period
      const newPeriodEnd = new Date(subscription.current_period_end * 1000);
      try {
        const { CreditExpiryService } = await import('../../credits/services/credit-expiry-service.js');
        await CreditExpiryService.syncPaidCreditBatchExpiry(existingSubscription.tenantId, newPeriodEnd);
      } catch (syncErr: unknown) {
        console.error('❌ Failed to sync credit batch expiry on create:', (syncErr as Error).message);
      }

      // Allocate plan credits if not already allocated in this period.
      // This handles subscriptions created outside the checkout flow (e.g., test clocks,
      // direct API creation) where handleCheckoutCompleted doesn't fire.
      // Uses the same advisory-lock + dedup pattern as handleCheckoutCompleted to
      // prevent double allocation when both webhooks fire for the same subscription.
      try {
        // Extract price ID from subscription items
        const items = (subscription as Record<string, unknown>).items as { data?: Array<{ price?: { id?: string } | string }> } | undefined;
        const priceId = items?.data?.[0]?.price
          ? (typeof items.data[0].price === 'string' ? items.data[0].price : items.data[0].price.id)
          : null;
        const planId = priceId ? await getPlanIdFromPriceId(priceId) : null;
        const plans = await getAvailablePlans();
        const plan = plans.find((p: Record<string, unknown>) => p.id === planId);
        const planCredits = Number((plan as Record<string, unknown>)?.credits) || 0;

        if (planCredits > 0) {
          // Acquire an advisory lock keyed on the tenant to serialise concurrent
          // webhook handlers.  hashtext() returns a stable int for the tenant UUID.
          await db.execute(sql`SELECT pg_advisory_lock(hashtext(${existingSubscription.tenantId} || '_plan_credits'))`);

          try {
            const periodStart = new Date(subscription.current_period_start * 1000);

            // The dedup guard must match what addCreditsToEntity actually writes:
            //   transaction_type = 'purchase', operation_code = 'subscription'
            const [alreadyAllocated] = await db
              .select({ total: count() })
              .from(creditTransactions)
              .where(and(
                eq(creditTransactions.tenantId, existingSubscription.tenantId),
                eq(creditTransactions.transactionType, 'purchase'),
                eq(creditTransactions.operationCode, 'subscription'),
                gte(creditTransactions.createdAt, periodStart)
              ));

            if ((alreadyAllocated?.total ?? 0) > 0) {
              console.log(`⏭️ Plan credits already allocated for tenant ${existingSubscription.tenantId} — skipping (subscription.created)`);
            } else {
              // Order by entityLevel + createdAt so the onboarding org (first created) is picked
              const orgEntities = await db
                .select()
                .from(entities)
                .where(and(eq(entities.tenantId, existingSubscription.tenantId), eq(entities.entityType, 'organization'), eq(entities.isActive, true)))
                .orderBy(entities.entityLevel, entities.createdAt);

              const defaultEntity = orgEntities[0];
              if (defaultEntity) {
                await CreditService.addCreditsToEntity({
                  tenantId: existingSubscription.tenantId,
                  entityType: 'organization',
                  entityId: defaultEntity.entityId,
                  creditAmount: planCredits,
                  source: 'subscription',
                  sourceId: subscription.id,
                  description: `${(plan as Record<string, unknown>).name} plan credits (${planCredits.toLocaleString()} annual credits)`,
                  initiatedBy: 'system'
                });
                console.log(`✅ Allocated ${planCredits.toLocaleString()} plan credits for tenant ${existingSubscription.tenantId} via subscription.created`);
              }
            }
          } finally {
            // Always release the advisory lock, even if credit allocation fails.
            await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${existingSubscription.tenantId} || '_plan_credits'))`);
          }
        }
      } catch (errCredit: unknown) {
        console.error('❌ Failed to allocate plan credits on subscription.created:', (errCredit as Error).message);
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling subscription created:', error);
    Sentry.captureException(error, { tags: { 'payment.handler': 'subscription.created' } });
    throw error;
  }
}

// Handle charge succeeded webhook
export async function handleChargeSucceeded(
  charge: Record<string, unknown> & {
    id: string;
    customer?: string;
    amount: number;
    currency?: string;
    payment_intent?: string;
    payment_method_details?: { type?: string };
    description?: string;
    metadata?: Record<string, unknown>;
    created?: number;
  }
): Promise<void> {
  try {
    console.log('💳 Processing charge succeeded:', charge.id);

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, (charge.customer ?? '') as string))
      .limit(1);

    if (subscription) {
      await PaymentService.createPaymentRecord({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.subscriptionId ?? undefined,
        stripeChargeId: charge.id,
        stripePaymentIntentId: charge.payment_intent as string | undefined,
        stripeCustomerId: (charge.customer ?? undefined) as string | undefined,
        amount: (charge.amount / 100).toString(),
        currency: String(charge.currency ?? 'USD').toUpperCase(),
        status: 'succeeded',
        paymentMethod: (charge.payment_method_details as Record<string, unknown>)?.type || 'card',
        paymentType: 'subscription',
        description: (charge.description as string) || 'Subscription payment',
        metadata: (charge.metadata as Record<string, unknown>) || {},
        stripeRawData: charge,
        paidAt: new Date((charge.created ?? 0) * 1000)
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling charge succeeded:', error);
    Sentry.captureException(error, { tags: { 'payment.handler': 'charge.succeeded' } });
    throw error;
  }
}

// Handle credit purchase checkout completion
export async function handleCreditPurchase(session: Record<string, unknown>): Promise<void> {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  const gateway = getPaymentGateway();
  try {
    console.log('💰 Processing credit purchase checkout:', session.id);

    const tenantId = meta.tenantId as string | undefined;
    const userId = meta.userId as string | undefined;
    const creditAmount = parseInt(String(meta.creditAmount ?? '0'), 10);
    const entityType = (meta.entityType as string) || 'organization';
    const entityId = (meta.entityId as string) || tenantId;

    if (!tenantId || !creditAmount) {
      throw new Error('Missing required metadata for credit purchase');
    }

    let finalUserId: string | undefined = userId as string | undefined;
    if (!finalUserId) {
      try {
        await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, false)`);
        await db.execute(sql`SELECT set_config('app.is_admin', 'true', false)`);

        const adminUsers = await db.execute(sql`
          SELECT user_id 
          FROM tenant_users 
          WHERE tenant_id = ${tenantId} 
          AND is_tenant_admin = true 
          AND is_active = true
          LIMIT 1
        `);

        if (adminUsers.length > 0) {
          finalUserId = (adminUsers[0] as Record<string, unknown>).user_id as string;
        } else {
          const anyUsers = await db.execute(sql`
            SELECT user_id 
            FROM tenant_users 
            WHERE tenant_id = ${tenantId} 
            AND is_active = true
            LIMIT 1
          `);

          if (anyUsers.length > 0) {
            finalUserId = (anyUsers[0] as Record<string, unknown>).user_id as string;
          } else {
            throw new Error('No active users found for tenant');
          }
        }
      } catch (errFind: unknown) {
        throw new Error(`Cannot process credit purchase: ${(errFind as Error).message}`);
      }
    }

    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not completed for credit purchase');
      return;
    }

    await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, false)`);
    await db.execute(sql`SELECT set_config('app.user_id', ${finalUserId}, false)`);
    await db.execute(sql`SELECT set_config('app.is_admin', 'true', false)`);

    const { CreditService } = await import('../../credits/index.js');

    const purchaseResult = await CreditService.purchaseCredits({
      tenantId: tenantId!,
      userId: finalUserId!,
      creditAmount,
      paymentMethod: gateway.providerName,
      currency: 'USD',
      entityType,
      entityId: entityId ?? tenantId!,
      notes: `Payment checkout: ${String(session.id)}`,
      isWebhookCompletion: true,
      sessionId: String(session.id)
    });

    try {
      const { PaymentService } = await import('./payment-service.js');
      const dollarAmount = parseFloat(String(meta.dollarAmount ?? meta.totalAmount ?? 0));
      const amountTotal = Number(session.amount_total ?? 0);
      const paymentAmount = dollarAmount || (amountTotal ? amountTotal / 100 : 0);
      const paymentIntentId = String(session.payment_intent ?? session.id);

      const existingPayment = await PaymentService.getPaymentByIntentId(paymentIntentId);

      if (!existingPayment) {
        await PaymentService.recordPayment({
          tenantId: tenantId!,
          stripePaymentIntentId: paymentIntentId,
          // stripeCustomerId is NOT a column in the payments table — store in metadata instead
          amount: paymentAmount.toString(),
          currency: String(session.currency ?? 'USD').toUpperCase(),
          status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
          paymentMethod: 'card',
          paymentType: 'credit_purchase',
          description: `Credit purchase: ${creditAmount.toLocaleString()} credits for $${paymentAmount.toFixed(2)}`,
          metadata: {
            creditAmount: creditAmount.toString(),
            entityType,
            entityId: entityId ?? tenantId!,
            purchaseId: (purchaseResult as Record<string, unknown>)?.purchaseId,
            provider: gateway.providerName,
            stripeCustomerId: session.customer != null ? String(session.customer) : undefined,
            ...(typeof session.metadata === 'object' && session.metadata !== null ? (session.metadata as Record<string, unknown>) : {})
          },
          paidAt: (session.payment_status === 'paid' ? new Date() : undefined) as Date | undefined
        } as Record<string, unknown>);
      } else {
        await PaymentService.updatePaymentStatus(paymentIntentId, session.payment_status === 'paid' ? 'succeeded' : 'pending', {
          checkout_session_id: session.id,
          paid_at: session.payment_status === 'paid' ? new Date().toISOString() : undefined
        });
      }
    } catch (err: unknown) {
      console.error('❌ Failed to create payment record for credit purchase:', err);
    }

    console.log('✅ Credit purchase processed:', {
      purchaseId: (purchaseResult as Record<string, unknown>)?.purchaseId,
      creditsAllocated: creditAmount,
      tenantId,
      provider: gateway.providerName,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ Error processing credit purchase:', error.message);
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'credit_purchase');
      scope.setContext('credit_purchase', { tenantId: meta.tenantId, creditAmount: meta.creditAmount, sessionId: session.id });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle subscription deleted webhook
export async function handleSubscriptionDeleted(subscription: Record<string, unknown> & { id: string }): Promise<void> {
  try {
    // 1. Find the tenant and subscription details before updating
    const [existing] = await db
      .select({
        tenantId: subscriptions.tenantId,
        plan: subscriptions.plan,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAt: subscriptions.cancelAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    // 2. Mark subscription as canceled
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

    // 3. Expire all credit batches for this tenant
    let expiredCredits = { expiredCount: 0, totalBatches: 0 };
    if (existing?.tenantId) {
      try {
        const { CreditExpiryService } = await import('../../credits/services/credit-expiry-service.js');
        expiredCredits = await CreditExpiryService.expireAllActiveBatches(existing.tenantId);
        console.log(`🗑️ Expired ${expiredCredits.expiredCount}/${expiredCredits.totalBatches} credit batches for canceled subscription`);
      } catch (expiryErr: unknown) {
        console.error('❌ Failed to expire credits on subscription deletion:', (expiryErr as Error).message);
      }

      // 4. Notify downstream apps with full context
      try {
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        const targetApps = (process.env.BUSINESS_SUITE_TARGET_APPS || 'crm,accounting,ops').split(',').map(a => a.trim());
        for (const app of targetApps) {
          await snsSqsPublisher.publishInterAppEvent({
            eventType: 'subscription.canceled',
            sourceApplication: 'wrapper',
            targetApplication: app,
            tenantId: existing.tenantId,
            entityId: existing.tenantId,
            eventData: {
              tenantId: existing.tenantId,
              stripeSubscriptionId: subscription.id,
              plan: existing.plan,
              canceledAt: new Date().toISOString(),
              wasScheduled: !!existing.cancelAt,
              periodStart: existing.currentPeriodStart ? new Date(existing.currentPeriodStart).toISOString() : null,
              periodEnd: existing.currentPeriodEnd ? new Date(existing.currentPeriodEnd).toISOString() : null,
              creditBatchesExpired: expiredCredits.expiredCount,
              totalCreditBatches: expiredCredits.totalBatches,
              action: 'expire_all_credits',
            },
            publishedBy: 'system',
          });
        }
        console.log(`✅ Published subscription.canceled to ${targetApps.length} downstream apps`);
      } catch (pubErr: unknown) {
        console.error('❌ Failed to publish subscription.canceled:', (pubErr as Error).message);
      }

      // 5. Send subscription expired email to tenant admin
      try {
        const paymentsModule = await import('../routes/payments.js');
        const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
        const userInfo = await getTenantAdminEmail(existing.tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../utils/email.js');
          const emailService = new EmailService();
          const planName = (existing.plan || 'N/A').charAt(0).toUpperCase() + (existing.plan || 'N/A').slice(1);
          const billingUrl = `${process.env.FRONTEND_URL || 'https://app.wrapper.app'}/dashboard/billing`;
          await emailService.sendEmail({
            to: [{ email: userInfo.email, name: userInfo.name }],
            subject: 'Your Subscription Has Expired',
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px;">
                <h2 style="color: #1B2E5A; margin-bottom: 16px;">Your Subscription Has Expired</h2>
                <p style="color: #475569; line-height: 1.6;">
                  Your subscription has expired. Here are the details:
                </p>
                <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
                  <p style="margin: 4px 0;"><strong>Plan:</strong> ${planName}</p>
                  <p style="margin: 4px 0;"><strong>Status:</strong> Expired</p>
                </div>
                <p style="color: #475569; line-height: 1.6;">
                  Your data is safe and fully preserved. You still have read-only access to your account.
                  To restore full access, please resubscribe from your billing page.
                </p>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${billingUrl}" style="display: inline-block; background-color: #1B2E5A; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                    Resubscribe Now
                  </a>
                </div>
              </div>
            `,
          });
          console.log(`📧 Sent subscription expired email to ${userInfo.email}`);
        }
      } catch (emailErr: unknown) {
        console.error('❌ Failed to send subscription expired email:', (emailErr as Error).message);
      }
    }

    console.log('🗑️ Subscription deleted:', subscription.id);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling subscription deleted:', error);
    Sentry.captureException(error, { tags: { 'payment.handler': 'subscription.deleted' } });
    throw error;
  }
}
