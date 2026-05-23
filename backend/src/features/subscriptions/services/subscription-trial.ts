import { eq, and, lt, gt, isNull } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import {
  subscriptions,
  payments,
  credits,
  creditTransactions
} from '../../../db/schema/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentSubscription } from './subscription-core.js';
import { getPaymentGateway } from '../adapters/index.js';
import Logger from '../../../utils/logger.js';

/**
 * Create trial subscription for new tenant (creates initial credit balance).
 */
export async function createTrialSubscription(
  tenantId: string,
  planData: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  Logger.log('info', 'billing', 'create-trial-subscription', 'Creating trial credit balance for tenant', { tenantId, planData });

  try {
    const initialCredits = Number(planData.credits) || 1000;
    const validityMonths = Number(planData.validityMonths) || 1;
    const userId = planData.userId as string | undefined;
    const selectedPackage = (planData.selectedPackage as string) || 'trial';

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);

    const [creditRecord] = await db
      .insert(credits)
      .values({
        tenantId,
        entityType: 'organization',
        availableCredits: initialCredits.toString(),
        totalCredits: initialCredits.toString(),
        periodType: 'month',
        creditExpiry: expiryDate,
        lastUpdatedBy: userId ?? null
      } as any)
      .returning();

    Logger.log('info', 'billing', 'create-trial-subscription', 'Created initial credit balance', { creditId: (creditRecord as any)?.creditId });

    await db
      .insert(creditTransactions)
      .values({
        tenantId,
        transactionType: 'purchase',
        amount: initialCredits.toString(),
        description: `Initial credit balance from ${selectedPackage} package`,
        metadata: {
          package: selectedPackage,
          validityMonths,
          source: 'onboarding'
        },
        initiatedBy: userId ?? null
      } as any);

    const subscriptionData = {
      tenantId: tenantId,
      plan: 'credit_based',
      status: 'active',
      isTrialUser: false,
      yearlyPrice: 0,
      billingCycle: 'yearly',
      trialStart: new Date(),
      trialEnd: expiryDate,
      currentPeriodStart: new Date(),
      currentPeriodEnd: expiryDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return subscriptionData;
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'create-trial-subscription', 'Error creating trial credit balance', { error: error.message });
    throw error;
  }
}

/**
 * Create free subscription for new tenant with expiry period.
 */
export async function createFreeSubscription(
  tenantId: string,
  planData: Record<string, unknown> = {}
): Promise<{ subscription: Record<string, unknown> }> {
  Logger.log('info', 'billing', 'create-free-subscription', 'Creating free subscription for tenant', { tenantId, planData });

  try {
    const freeCredits = Number(planData.credits) || 1000;
    const validityMonths = Number(planData.validityMonths) || 3;
    const userId = planData.userId as string | undefined;

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);

    const [creditRecord] = await db
      .insert(credits)
      .values({
        tenantId,
        entityType: 'organization',
        availableCredits: freeCredits.toString(),
        totalCredits: freeCredits.toString(),
        periodType: 'month',
        creditExpiry: expiryDate,
        lastUpdatedBy: userId ?? null
      } as any)
      .returning();

    Logger.log('info', 'billing', 'create-free-subscription', 'Created free plan credit balance', { creditId: (creditRecord as any)?.creditId });

    await db
      .insert(creditTransactions)
      .values({
        tenantId,
        transactionType: 'purchase',
        amount: freeCredits.toString(),
        description: `Free plan initial credits (${validityMonths} months validity)`,
        metadata: {
          package: 'free',
          validityMonths,
          source: 'onboarding',
          expiryDate: expiryDate.toISOString()
        },
        initiatedBy: userId ?? null
      } as any);

    const subscriptionData = {
      tenantId: tenantId,
      plan: 'free',
      status: 'active',
      isTrialUser: false,
      yearlyPrice: 0,
      billingCycle: 'yearly',
      trialStart: new Date(),
      trialEnd: expiryDate,
      currentPeriodStart: new Date(),
      currentPeriodEnd: expiryDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    Logger.log('info', 'billing', 'create-free-subscription', 'Free subscription created successfully');
    return { subscription: subscriptionData };
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'create-free-subscription', 'Error creating free subscription', { error: error.message });
    throw error;
  }
}

/**
 * Check if tenant has used trial before.
 */
export async function checkTrialHistory(tenantId: string): Promise<boolean> {
  const [trialHistory] = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.tenantId, tenantId),
      eq(subscriptions.plan, 'trial')
    ))
    .limit(1);

  return !!trialHistory;
}

/**
 * Cancel subscription for tenant at the end of the current billing period.
 * The subscription stays active until currentPeriodEnd — the user keeps full
 * access. When the period ends, Stripe fires `customer.subscription.deleted`
 * and our webhook handler expires all credits and marks it canceled.
 */
export async function cancelSubscription(
  tenantId: string,
  reason: string = 'User requested cancellation'
): Promise<Record<string, unknown>> {
  try {
    const currentSubscription = await getCurrentSubscription(tenantId) as Record<string, unknown>;
    const gateway = getPaymentGateway();

    if (!currentSubscription) {
      throw new Error('No subscription found to cancel');
    }

    if (currentSubscription.plan === 'trial') {
      throw new Error('Cannot cancel trial plan');
    }

    const subId = (currentSubscription.subscriptionId ?? currentSubscription.id) as string;
    const periodEnd = currentSubscription.currentPeriodEnd
      ? new Date(currentSubscription.currentPeriodEnd as string | Date)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    if (currentSubscription.stripeSubscriptionId && gateway.isConfigured()) {
      // Schedule cancellation at end of billing period (NOT immediate)
      await gateway.updateSubscription(currentSubscription.stripeSubscriptionId as string, {
        cancelAtPeriodEnd: true,
      });

      await db
        .update(subscriptions)
        .set({
          cancelAt: periodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.subscriptionId, subId));

      await db.insert(payments).values({
        paymentId: uuidv4(),
        tenantId: tenantId,
        subscriptionId: subId,
        stripeInvoiceId: null,
        amount: '0.00',
        currency: 'USD',
        status: 'cancelled',
        paymentMethod: 'subscription_cancel',
        description: `Subscription scheduled to cancel on ${periodEnd.toLocaleDateString()} for ${currentSubscription.plan} plan`,
        metadata: {
          canceledStripeSubscriptionId: currentSubscription.stripeSubscriptionId,
          cancelReason: reason,
          cancelAt: periodEnd.toISOString(),
          refundEligible: false,
        },
        createdAt: new Date(),
      });

      Logger.log('info', 'billing', 'cancel-subscription', 'Subscription scheduled to cancel', { subscriptionId: subId, cancelAt: periodEnd.toISOString() });

      return {
        subscriptionId: subId,
        stripeSubscriptionId: currentSubscription.stripeSubscriptionId,
        status: 'active',
        cancelAt: periodEnd,
        message: `Your subscription will remain active until ${periodEnd.toLocaleDateString()}. You will not be charged again.`,
      };
    } else {
      // No Stripe subscription — schedule cancellation at period end in DB only
      await db
        .update(subscriptions)
        .set({
          cancelAt: periodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.subscriptionId, subId));

      return {
        subscriptionId: subId,
        status: 'active',
        cancelAt: periodEnd,
        message: `Your subscription will remain active until ${periodEnd.toLocaleDateString()}.`,
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'cancel-subscription', 'Error scheduling subscription cancellation', { error: error.message });
    throw error;
  }
}

/**
 * Handle trial expiration - suspend accounts that haven't upgraded.
 */
export async function handleExpiredTrials(): Promise<number> {
  const expiredTrials = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, 'trialing'),
      lt(subscriptions.currentPeriodEnd!, new Date()),
      isNull(subscriptions.stripeSubscriptionId)
    ));

  for (const subscription of expiredTrials) {
    Logger.log('warning', 'billing', 'handle-expired-trials', 'Trial expired for tenant', { tenantId: subscription.tenantId });

    await db
      .update(subscriptions)
      .set({
        status: 'suspended',
        suspendedAt: new Date(),
        suspendedReason: 'Trial expired - upgrade required'
      })
      .where(eq(subscriptions.subscriptionId, subscription.subscriptionId));

    Logger.log('info', 'email', 'handle-expired-trials', 'Sending trial expiration notice to tenant', { tenantId: subscription.tenantId });
  }

  return expiredTrials.length;
}

/**
 * Send trial reminder emails.
 */
export async function sendTrialReminders(): Promise<number> {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const expiringTrials = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, 'trialing'),
      lt(subscriptions.currentPeriodEnd!, threeDaysFromNow),
      gt(subscriptions.currentPeriodEnd!, new Date())
    ));

  for (const subscription of expiringTrials) {
    const endDate = subscription.currentPeriodEnd;
    const daysRemaining = endDate
      ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    Logger.log('info', 'email', 'send-trial-reminders', 'Sending trial reminder to tenant', { tenantId: subscription.tenantId, daysRemaining });
  }

  return expiringTrials.length;
}
