// @ts-nocheck — legacy webhook handler; tighten types incrementally
import { eq, and, sql, gte, count } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { db } from '../../../../db/index.js';
import {
  subscriptions,
  entities,
  creditTransactions
} from '../../../../db/schema/index.js';
import { CreditService } from '../../../credits/index.js';
import Logger from '../../../../utils/logger.js';
import {
  getAvailablePlans,
  getPlanIdFromPriceId,
} from '../subscription-core.js';
import { updateAdministratorRolesForPlan } from '../subscription-plan-roles.js';
import { normalizeStripeSubscriptionStatus } from '../webhook-shared.js';

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
        const onboardingOrgSetup = (await import('../../../onboarding/services/onboarding-organization-setup.js')).default;
        await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(existing.tenantId, planId, { skipIfRecentlyUpdated: true });
      } catch (errOrgApp: unknown) {
        Logger.log('error', 'billing', 'handle-subscription-updated', 'Failed to update organization applications', { error: (errOrgApp as Error).message });
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

      Logger.log('info', 'billing', 'handle-subscription-updated', 'Subscription update type determined', { isRenewal, isPlanChange: !!isPlanChange, previousPlan: dbPlan, newPlan: planId });

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
          Logger.log('info', 'billing', 'handle-subscription-updated', 'Allocated plan credits for tenant', { creditAmount, planName, tenantId: existing.tenantId });
        }
      };

      if (isPlanChange && !isRenewal) {
        // ── MID-CYCLE PLAN UPGRADE ──
        // Expire old plan's subscription credits, allocate new plan's full credits.
        // Stripe handles the prorated payment; we handle the credit swap.
        Logger.log('info', 'billing', 'handle-subscription-updated', 'Mid-cycle plan change detected', { previousPlan: dbPlan, newPlan: planId, tenantId: existing.tenantId });

        // Expire old plan credits (non-campaign batches for current period)
        try {
          const { CreditExpiryService } = await import('../../../credits/services/credit-expiry-service.js');
          await CreditExpiryService.expirePreviousTenureCredits(existing.tenantId, newPeriodStart);
          Logger.log('info', 'billing', 'handle-subscription-updated', 'Expired old plan credits on upgrade', { previousPlan: dbPlan });
        } catch (syncErr: unknown) {
          Logger.log('error', 'billing', 'handle-subscription-updated', 'Failed to expire old plan credits on upgrade', { error: (syncErr as Error).message });
        }

        // Allocate new plan credits
        try {
          const { newPlan, credits } = await resolveNewPlanCredits();
          if (credits > 0) {
            await allocateCredits(credits, (newPlan as Record<string, unknown>)?.name as string ?? planId,
              `${(newPlan as Record<string, unknown>)?.name ?? planId} plan upgrade credits (${credits.toLocaleString()} annual credits)`);
          }
        } catch (errCredit: unknown) {
          Logger.log('error', 'billing', 'handle-subscription-updated', 'Failed to allocate upgrade credits', { error: (errCredit as Error).message });
        }

        // Notify downstream apps about the plan change (errors are fatal — let Stripe retry).
        {
          const { snsSqsPublisher } = await import('../../../messaging/utils/sns-sqs-publisher.js');
          const { getPlan } = await import('../../../../data/plans.js');
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
              entityId: existing.tenantId,
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
          Logger.log('info', 'billing', 'handle-subscription-updated', 'Published subscription.upgraded to downstream apps', { appCount: targetApps.length });
        }

      } else if (cancelAtPeriodEnd === true) {
        // ── CANCELLATION SCHEDULED ──
        // User scheduled cancellation — notify downstream apps so they can
        // show warnings, start data export flows, or prompt retention.
        const cancelDate = cancelAt
          ? new Date((cancelAt as number) * 1000)
          : new Date(subscription.current_period_end * 1000);

        Logger.log('info', 'billing', 'handle-subscription-updated', 'Cancellation scheduled for tenant', { tenantId: existing.tenantId, cancelAt: cancelDate.toISOString() });

        {
          const { snsSqsPublisher } = await import('../../../messaging/utils/sns-sqs-publisher.js');
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
          Logger.log('info', 'billing', 'handle-subscription-updated', 'Published subscription.cancel_scheduled to downstream apps', { appCount: targetApps.length });
        }

        // Send cancellation confirmation email to tenant admin
        try {
          const paymentsModule = await import('../../routes/payments.js');
          const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
          const userInfo = await getTenantAdminEmail(existing.tenantId);
          if (userInfo?.email) {
            const { EmailService } = await import('../../../../utils/email.js');
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
            Logger.log('info', 'email', 'handle-subscription-updated', 'Sent cancellation confirmation email', { email: userInfo.email });
          }
        } catch (emailErr: unknown) {
          Logger.log('error', 'email', 'handle-subscription-updated', 'Failed to send cancellation confirmation email', { error: (emailErr as Error).message });
        }

      } else if (isRenewal) {
        // ── ANNUAL RENEWAL ──
        // Expire all old tenure credits, allocate new tenure credits.
        const previousPeriodEnd = newPeriodStart; // renewal boundary

        try {
          const { CreditExpiryService } = await import('../../../credits/services/credit-expiry-service.js');
          await CreditExpiryService.expirePreviousTenureCredits(existing.tenantId, previousPeriodEnd);
          Logger.log('info', 'billing', 'handle-subscription-updated', 'Expired previous tenure credits', { before: previousPeriodEnd.toISOString(), tenantId: existing.tenantId });
        } catch (syncErr: unknown) {
          Logger.log('error', 'billing', 'handle-subscription-updated', 'Failed to expire previous tenure credits', { error: (syncErr as Error).message });
        }

        // Allocate new tenure credits
        try {
          const { newPlan, credits } = await resolveNewPlanCredits();
          if (credits > 0) {
            await allocateCredits(credits, (newPlan as Record<string, unknown>)?.name as string ?? planId,
              `${(newPlan as Record<string, unknown>)?.name ?? planId} plan renewal credits (${credits.toLocaleString()} annual credits)`);
          }
        } catch (errRenewalCredits: unknown) {
          Logger.log('error', 'billing', 'handle-subscription-updated', 'Failed to allocate renewal credits', { error: (errRenewalCredits as Error).message });
        }

        // Notify downstream apps (errors are fatal — let Stripe retry).
        {
          const { snsSqsPublisher } = await import('../../../messaging/utils/sns-sqs-publisher.js');
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
          Logger.log('info', 'billing', 'handle-subscription-updated', 'Published subscription.renewed to downstream apps', { appCount: targetApps.length });
        }
      }
    }

    Logger.log('info', 'billing', 'handle-subscription-updated', 'Subscription updated', { subscriptionId: subscription.id });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-subscription-updated', 'Error handling subscription updated', { error: error.message });
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
    Logger.log('info', 'billing', 'handle-subscription-created', 'Processing subscription created', { subscriptionId: subscription.id });

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

      Logger.log('info', 'billing', 'handle-subscription-created', 'Updated existing subscription with provider subscription ID');

      // Sync credit batch expiry dates with the new subscription period
      const newPeriodEnd = new Date(subscription.current_period_end * 1000);
      try {
        const { CreditExpiryService } = await import('../../../credits/services/credit-expiry-service.js');
        await CreditExpiryService.syncPaidCreditBatchExpiry(existingSubscription.tenantId, newPeriodEnd);
      } catch (syncErr: unknown) {
        Logger.log('error', 'billing', 'handle-subscription-created', 'Failed to sync credit batch expiry on create', { error: (syncErr as Error).message });
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
              Logger.log('info', 'billing', 'handle-subscription-created', 'Plan credits already allocated for tenant — skipping', { tenantId: existingSubscription.tenantId });
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
                Logger.log('info', 'billing', 'handle-subscription-created', 'Allocated plan credits for tenant via subscription.created', { planCredits, tenantId: existingSubscription.tenantId });
              }
            }
          } finally {
            // Always release the advisory lock, even if credit allocation fails.
            await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${existingSubscription.tenantId} || '_plan_credits'))`);
          }
        }
      } catch (errCredit: unknown) {
        Logger.log('error', 'billing', 'handle-subscription-created', 'Failed to allocate plan credits on subscription.created', { error: (errCredit as Error).message });
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-subscription-created', 'Error handling subscription created', { error: error.message });
    Sentry.captureException(error, { tags: { 'payment.handler': 'subscription.created' } });
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
        const { CreditExpiryService } = await import('../../../credits/services/credit-expiry-service.js');
        expiredCredits = await CreditExpiryService.expireAllActiveBatches(existing.tenantId);
        Logger.log('info', 'billing', 'handle-subscription-deleted', 'Expired credit batches for canceled subscription', { expiredCount: expiredCredits.expiredCount, totalBatches: expiredCredits.totalBatches });
      } catch (expiryErr: unknown) {
        Logger.log('error', 'billing', 'handle-subscription-deleted', 'Failed to expire credits on subscription deletion', { error: (expiryErr as Error).message });
      }

      // 4. Notify downstream apps with full context (errors are fatal — let Stripe retry).
      {
        const { snsSqsPublisher } = await import('../../../messaging/utils/sns-sqs-publisher.js');
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
        Logger.log('info', 'billing', 'handle-subscription-deleted', 'Published subscription.canceled to downstream apps', { appCount: targetApps.length });
      }

      // 5. Send subscription expired email to tenant admin
      try {
        const paymentsModule = await import('../../routes/payments.js');
        const getTenantAdminEmail = paymentsModule.getTenantAdminEmail || (async () => null);
        const userInfo = await getTenantAdminEmail(existing.tenantId);
        if (userInfo?.email) {
          const { EmailService } = await import('../../../../utils/email.js');
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
          Logger.log('info', 'email', 'handle-subscription-deleted', 'Sent subscription expired email', { email: userInfo.email });
        }
      } catch (emailErr: unknown) {
        Logger.log('error', 'email', 'handle-subscription-deleted', 'Failed to send subscription expired email', { error: (emailErr as Error).message });
      }
    }

    Logger.log('info', 'billing', 'handle-subscription-deleted', 'Subscription deleted', { subscriptionId: subscription.id });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-subscription-deleted', 'Error handling subscription deleted', { error: error.message });
    Sentry.captureException(error, { tags: { 'payment.handler': 'subscription.deleted' } });
    throw error;
  }
}
