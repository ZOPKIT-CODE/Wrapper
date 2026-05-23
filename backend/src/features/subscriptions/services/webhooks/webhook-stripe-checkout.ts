// @ts-nocheck — legacy webhook handler; tighten types incrementally
import { eq, and, sql, gte, count } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { db } from '../../../../db/index.js';
import {
  subscriptions,
  payments,
  tenants,
  entities,
  creditTransactions
} from '../../../../db/schema/index.js';
import { v4 as uuidv4 } from 'uuid';
import { CreditService } from '../../../credits/index.js';
import { getPaymentGateway } from '../../adapters/index.js';
import Logger from '../../../../utils/logger.js';
import {
  getAvailablePlans,
  getCurrentSubscription
} from '../subscription-core.js';
import { updateAdministratorRolesForPlan } from '../subscription-plan-roles.js';
import { PaymentService } from '../payment-service.js';
import { SUBSCRIPTION_FALLBACK_PERIOD_MS } from '../webhook-shared.js';

export function buildCheckoutAuditSnapshot(session: Record<string, unknown>): Record<string, unknown> {
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

// Handle checkout session completed webhook
export async function handleCheckoutCompleted(session: Record<string, unknown>): Promise<void> {
  try {
    const meta = (session.metadata ?? {}) as Record<string, unknown>;
    const checkoutAuditSnapshot = buildCheckoutAuditSnapshot(session);
    Logger.log('info', 'billing', 'handle-checkout-completed', 'Processing checkout completion', { sessionId: session.id });

    const tenantId = meta.tenantId as string | undefined;
    const packageId = (meta.packageId || meta.planId) as string | undefined;
    const billingCycle = 'yearly';
    const dollarAmount = parseFloat(String(meta.dollarAmount ?? 0));
    const totalAmount = parseFloat(String(meta.totalAmount ?? 0));
    const creditAmount = Math.floor(dollarAmount * 1000);

    Logger.log('info', 'billing', 'handle-checkout-completed', 'Checkout session metadata', {
      tenantId,
      packageId,
      billingCycle,
      dollarAmount,
      creditAmount,
      totalAmount,
      sessionMode: session.mode as string
    });

    if (!tenantId) {
      Logger.log('warning', 'billing', 'handle-checkout-completed', 'Missing tenantId in checkout session metadata');
      throw new Error('Missing tenantId in checkout session metadata');
    }

    const gateway = getPaymentGateway();

    // Handle credit purchases (payment mode)
    if (session.mode === 'payment' && creditAmount > 0) {
      Logger.log('info', 'billing', 'handle-checkout-completed', 'Processing credit purchase completion');

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
          Logger.log('info', 'billing', 'handle-checkout-completed', 'Payment recorded — credits will be allocated when tenant data is available');
          return;
        }
      } catch (errDb: unknown) {
        const dbError = errDb as Error;
        Logger.log('warning', 'billing', 'handle-checkout-completed', 'Could not verify tenant existence', { error: dbError.message });
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

      Logger.log('info', 'billing', 'handle-checkout-completed', 'Credit purchase processed for tenant', { tenantId });

      try {
        const { PaymentService } = await import('../payment-service.js');
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
        Logger.log('error', 'billing', 'handle-checkout-completed', 'Failed to create payment record for credit purchase', { error: (err as Error).message });
      }

      try {
        const paymentsModule = await import('../../routes/payments.js');
        const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
        const userInfo = await getTenantAdminEmail(tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../../utils/email.js');
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
        Logger.log('error', 'email', 'handle-checkout-completed', 'Failed to send credit purchase confirmation email', { error: (err as Error).message });
      }

      return;
    }

    // Subscription handling
    if (session.mode === 'subscription') {
      Logger.log('info', 'billing', 'handle-checkout-completed', 'Processing subscription completion');

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
        Logger.log('info', 'billing', 'handle-checkout-completed', 'Updating existing subscription for tenant', { tenantId });

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
          const onboardingOrgSetup = (await import('../../../onboarding/services/onboarding-organization-setup.js')).default;
          await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(tenantId, planId, { skipIfRecentlyUpdated: true });
        } catch (errOrgApp: unknown) {
          Logger.log('error', 'billing', 'handle-checkout-completed', 'Failed to update organization applications', { error: (errOrgApp as Error).message });
        }

        subscriptionRecord = existingSubscription;
      } else {
        Logger.log('info', 'billing', 'handle-checkout-completed', 'Creating new subscription for tenant', { tenantId });

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

      Logger.log('info', 'billing', 'handle-checkout-completed', 'Checkout completed — payment will be recorded by payment.succeeded webhook');

      const [updatedTenant] = await db
        .update(tenants)
        .set({
          stripeCustomerId: (session as Record<string, unknown>).customer ?? undefined,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId))
        .returning();

      if (!updatedTenant) {
        Logger.log('warning', 'billing', 'handle-checkout-completed', 'Failed to update tenant with customer ID', { tenantId });
      }

      // Persist enterprise-grade checkout audit data at checkout completion time.
      try {
        const { PaymentService } = await import('../payment-service.js');
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
        Logger.log('error', 'billing', 'handle-checkout-completed', 'Failed to persist checkout audit snapshot', { error: (errAudit as Error).message });
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
              Logger.log('info', 'billing', 'handle-checkout-completed', 'Plan credits already allocated for tenant in current period — skipping', { tenantId });
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
                Logger.log('info', 'billing', 'handle-checkout-completed', 'Allocated plan credits for tenant', { tenantId, planCredits });
              }
            }
          } finally {
            // Always release the advisory lock, even if credit allocation fails.
            await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${tenantId} || '_plan_credits'))`);
          }
        }
      } catch (errCredit: unknown) {
        Logger.log('error', 'billing', 'handle-checkout-completed', 'Failed to allocate plan credits', { error: (errCredit as Error).message });
      }

      // Send confirmation email
      try {
        const paymentsModule = await import('../../routes/payments.js');
        const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
        const userInfo = await getTenantAdminEmail(tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../../utils/email.js');
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
        Logger.log('error', 'email', 'handle-checkout-completed', 'Failed to send subscription confirmation email', { error: (err as Error).message });
      }

      // Notify downstream apps about the new/reactivated subscription
      // This is critical for apps like Financial Accounting that need to know
      // the plan and enabled modules to update their sidebar and permissions.
      try {
        const { snsSqsPublisher } = await import('../../../messaging/utils/sns-sqs-publisher.js');
        const { getPlan } = await import('../../../../data/plans.js');
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
        Logger.log('info', 'billing', 'handle-checkout-completed', 'Published subscription.activated to downstream apps', { appCount: targetApps.length, planId });
      } catch (pubErr: unknown) {
        Logger.log('error', 'billing', 'handle-checkout-completed', 'Failed to publish subscription.activated', { error: (pubErr as Error).message });
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-checkout-completed', 'Error handling checkout completed', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'checkout.completed');
      scope.setContext('checkout', { sessionId: session.id, mode: session.mode });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle credit purchase checkout completion
export async function handleCreditPurchase(session: Record<string, unknown>): Promise<void> {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  const gateway = getPaymentGateway();
  try {
    Logger.log('info', 'billing', 'handle-credit-purchase', 'Processing credit purchase checkout', { sessionId: session.id });

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
      Logger.log('warning', 'billing', 'handle-credit-purchase', 'Payment not completed for credit purchase');
      return;
    }

    await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, false)`);
    await db.execute(sql`SELECT set_config('app.user_id', ${finalUserId}, false)`);
    await db.execute(sql`SELECT set_config('app.is_admin', 'true', false)`);

    const { CreditService } = await import('../../../credits/index.js');

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
      const { PaymentService } = await import('../payment-service.js');
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
      Logger.log('error', 'billing', 'handle-credit-purchase', 'Failed to create payment record for credit purchase', { error: (err as Error).message });
    }

    Logger.log('info', 'billing', 'handle-credit-purchase', 'Credit purchase processed', {
      purchaseId: (purchaseResult as Record<string, unknown>)?.purchaseId,
      creditsAllocated: creditAmount,
      tenantId,
      provider: gateway.providerName,
    });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-credit-purchase', 'Error processing credit purchase', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'credit_purchase');
      scope.setContext('credit_purchase', { tenantId: meta.tenantId, creditAmount: meta.creditAmount, sessionId: session.id });
      Sentry.captureException(error);
    });
    throw error;
  }
}
