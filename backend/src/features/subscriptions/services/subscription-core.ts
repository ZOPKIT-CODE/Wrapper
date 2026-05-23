import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import {
  subscriptions,
  creditPurchases,
  payments,
} from '../../../db/schema/index.js';
import { CreditService } from '../../credits/index.js';
import { getPaymentGateway } from '../adapters/index.js';
import type { PaymentGatewayPort } from '../adapters/index.js';
import { getAvailablePlans as _getAvailablePlans, getPlanApplications, getPlanLimits } from '../../../data/plans.js';
import Logger from '../../../utils/logger.js';

// Inlined from subscription-repository.ts (only 2 methods, single caller)
async function getLatestActiveSubscription(tenantId: string): Promise<typeof subscriptions.$inferSelect | null> {
  const [sub] = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
    .orderBy(desc(subscriptions.createdAt)).limit(1);
  return sub ?? null;
}

async function getLatestSubscription(tenantId: string): Promise<typeof subscriptions.$inferSelect | null> {
  const [sub] = await db.select().from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt)).limit(1);
  return sub ?? null;
}

// ---------------------------------------------------------------------------
// Payment Gateway (adapter pattern) — primary API
// ---------------------------------------------------------------------------

export { getPaymentGateway };
export type { PaymentGatewayPort };

// Get current subscription (now returns credit-based information)
export async function getCurrentSubscription(tenantId: string): Promise<Record<string, unknown>> {
  try {
    // FIRST: Check for actual subscription record in database
    let actualSubscription: typeof subscriptions.$inferSelect | null = null;
    try {
      const subscriptionRecord = await getLatestActiveSubscription(tenantId);

      if (subscriptionRecord) {
        actualSubscription = subscriptionRecord;
        Logger.log('info', 'billing', 'get-current-subscription', 'Found active subscription', {
          plan: subscriptionRecord.plan,
          status: subscriptionRecord.status
        });
      }
    } catch (err: unknown) {
      const subError = err as Error;
      Logger.log('warning', 'billing', 'get-current-subscription', 'Error checking subscription table', { error: subError.message });
    }

    const plan = actualSubscription?.plan || 'free';
    const currentPeriodEnd = actualSubscription?.currentPeriodEnd || null;

    return {
      id: actualSubscription?.subscriptionId || `sub_${tenantId}`,
      tenantId,
      plan,
      status: actualSubscription?.status || 'active',
      isTrialUser: actualSubscription?.isTrialUser || false,
      applications: getPlanApplications(plan),
      limits: getPlanLimits(plan),
      monthlyPrice: (actualSubscription as any)?.monthlyPrice != null ? parseFloat(String((actualSubscription as any).monthlyPrice)) : 0,
      yearlyPrice: actualSubscription?.yearlyPrice != null ? parseFloat(String(actualSubscription.yearlyPrice)) : 0,
      billingCycle: actualSubscription?.billingCycle || 'yearly',
      trialStart: (actualSubscription as any)?.trialStart || null,
      trialEnd: (actualSubscription as any)?.trialEnd || null,
      currentPeriodStart: actualSubscription?.currentPeriodStart || new Date(),
      currentPeriodEnd,
      stripeSubscriptionId: actualSubscription?.stripeSubscriptionId || null,
      stripeCustomerId: actualSubscription?.stripeCustomerId || null,
      hasEverUpgraded: (actualSubscription as any)?.hasEverUpgraded ?? false,
      trialToggledOff: (actualSubscription as any)?.trialToggledOff ?? true,
      createdAt: actualSubscription?.createdAt || new Date(),
      updatedAt: actualSubscription?.updatedAt || new Date()
    };
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'get-current-subscription', 'Error getting current subscription', { error: error.message });

    // Fallback: try to get traditional subscription if no credits found
    try {
      const subscription = await getLatestSubscription(tenantId);

      if (subscription) {
        return subscription as unknown as Record<string, unknown>;
      }

      // Final fallback: return free plan
      return {
        plan: 'free',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId
      };
    } catch (fallbackErr: unknown) {
      const fallbackError = fallbackErr as Error;
      Logger.log('error', 'billing', 'get-current-subscription', 'Error fetching fallback subscription', { error: fallbackError.message });
      // Return free plan as final fallback
      return {
        plan: 'free',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId
      };
    }
  }
}

// Get available plans — sourced from the single authoritative definition in data/plans.ts
export async function getAvailablePlans(): Promise<Record<string, unknown>[]> {
  return _getAvailablePlans() as unknown as Record<string, unknown>[];
}

// Get usage metrics for a tenant (now credit-based)
export async function getUsageMetrics(tenantId: string): Promise<Record<string, unknown>> {
  try {
    // Get credit balance and usage data
    const creditData = await CreditService.getCurrentBalance(tenantId);
    const usageSummary = await CreditService.getUsageSummary(tenantId);

    const totalCredits = (creditData as Record<string, unknown> | null)?.totalCredits;
    const totalCreditsNum = typeof totalCredits === 'number' ? totalCredits : Number(totalCredits ?? 1000);
    const totalConsumed = (usageSummary as Record<string, unknown> | null)?.totalConsumed;
    const totalConsumedNum = typeof totalConsumed === 'number' ? totalConsumed : Number(totalConsumed ?? 0);

    // Default limits for credit-based system
    const defaultLimits = {
      users: 100,
      projects: -1, // Unlimited
      credits: totalCreditsNum || 1000
    };

    // Mock usage data - credit-based plan: only credits consumed
    const mockUsage = {
      users: 2,
      projects: 1,
      creditsConsumed: totalConsumedNum
    };

    return {
      current: mockUsage,
      limits: defaultLimits,
      plan: 'credit_based',
      percentUsed: {
        users: Math.round((mockUsage.users / defaultLimits.users) * 100),
        projects: defaultLimits.projects > 0 ?
          Math.round((mockUsage.projects / defaultLimits.projects) * 100) : 0,
        credits: totalCreditsNum ?
          Math.round((totalConsumedNum / totalCreditsNum) * 100) : 0
      }
    };
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'get-usage-metrics', 'Error getting usage metrics', { error: error.message });
    throw error;
  }
}

// Get billing history for a tenant (credit purchases + plan upgrade entries)
export async function getBillingHistory(tenantId: string): Promise<Record<string, unknown>[]> {
  Logger.log('info', 'billing', 'get-billing-history', 'Fetching billing history for tenant', { tenantId });

  // ── 1. Real payment records from the payments table ───────────────────────
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.tenantId, tenantId))
    .orderBy(desc(payments.createdAt));

  const paymentEntries = paymentRows.map(p => ({
    id: p.paymentId,
    type: p.paymentType ?? 'subscription',
    status: p.status,
    description: p.description ?? '',
    amount: parseFloat(String(p.amount ?? 0)),
    currency: p.currency ?? 'USD',
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    billingReason: p.billingReason,
    paymentMethod: p.paymentMethod,
    paymentMethodDetails: p.paymentMethodDetails,
    invoiceNumber: p.invoiceNumber,
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeInvoiceId: p.stripeInvoiceId,
    stripeChargeId: p.stripeChargeId,
    taxAmount: p.taxAmount ? parseFloat(String(p.taxAmount)) : 0,
    amountRefunded: p.amountRefunded ? parseFloat(String(p.amountRefunded)) : 0,
    refundReason: p.refundReason,
    isPartialRefund: p.isPartialRefund,
    refundedAt: p.refundedAt,
    subscriptionId: p.subscriptionId,
  }));

  // ── 2. Credit-purchase metadata (credits count, expiry) ───────────────────
  // Join by stripePaymentIntentId to enrich paymentEntries where applicable.
  let creditMeta: Map<string, { creditsPurchased: number; expiryDate: Date | null }> = new Map();
  try {
    const cpRows = await db
      .select({
        stripePaymentIntentId: creditPurchases.stripePaymentIntentId,
        creditAmount: creditPurchases.creditAmount,
        expiryDate: creditPurchases.expiryDate,
      })
      .from(creditPurchases)
      .where(eq(creditPurchases.tenantId, tenantId));

    for (const cp of cpRows) {
      if (cp.stripePaymentIntentId) {
        creditMeta.set(cp.stripePaymentIntentId, {
          creditsPurchased: parseFloat(String(cp.creditAmount ?? 0)),
          expiryDate: cp.expiryDate ?? null,
        });
      }
    }
  } catch {
    // credit_purchases table might not exist yet — non-fatal
  }

  const enrichedPaymentEntries = paymentEntries.map(entry => {
    const meta = entry.stripePaymentIntentId ? creditMeta.get(entry.stripePaymentIntentId) : undefined;
    return meta ? { ...entry, creditsPurchased: meta.creditsPurchased, expiryDate: meta.expiryDate } : entry;
  });

  // ── 3. Current plan as a plan_upgrade entry ───────────────────────────────
  const planUpgradeEntries: Record<string, unknown>[] = [];
  try {
    const subscription = await getLatestSubscription(tenantId);
    if (subscription && subscription.plan && subscription.plan !== 'free') {
      const planDisplayName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
      // Only add if there are no subscription payment rows already (avoid duplication)
      const hasSubscriptionPayments = enrichedPaymentEntries.some(e => e.type === 'subscription');
      if (!hasSubscriptionPayments) {
        planUpgradeEntries.push({
          id: `plan-${subscription.subscriptionId}`,
          type: 'plan_upgrade',
          status: subscription.status === 'active' || subscription.status === 'trialing' ? 'succeeded' : subscription.status,
          description: `${planDisplayName} Plan`,
          plan: subscription.plan,
          planDisplayName,
          createdAt: subscription.createdAt,
          paidAt: subscription.currentPeriodStart || subscription.createdAt,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          billingCycle: subscription.billingCycle ?? 'yearly',
          amount: subscription.yearlyPrice ? parseFloat(String(subscription.yearlyPrice)) : 0,
          currency: 'USD',
          invoiceNumber: null,
        });
      }
    }
  } catch (errSub: unknown) {
    Logger.log('warning', 'billing', 'get-billing-history', 'Could not fetch subscription for billing history', { error: (errSub as Error).message });
  }

  const combined = [...enrichedPaymentEntries, ...planUpgradeEntries].sort((a, b) => {
    const toMs = (v: unknown) => v ? new Date(v as string).getTime() : 0;
    return toMs(b.paidAt || b.createdAt) - toMs(a.paidAt || a.createdAt);
  });

  Logger.log('info', 'billing', 'get-billing-history', 'Billing history fetched', { paymentCount: enrichedPaymentEntries.length, planEntryCount: planUpgradeEntries.length });
  return combined;
}

// Helper: get plan ID from Stripe price ID
export async function getPlanIdFromPriceId(priceId: string): Promise<string | null> {
  try {
    const plans = await getAvailablePlans();

    for (const plan of plans) {
      if (
        plan.stripePriceId === priceId ||
        plan.stripeYearlyPriceId === priceId ||
        plan.stripeYearlyPriceIdInr === priceId
      ) {
        return plan.id as string;
      }
    }

    Logger.log('warning', 'billing', 'get-plan-id-from-price-id', 'Plan not found for price ID', { priceId });
    return null;
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'get-plan-id-from-price-id', 'Error getting plan ID from price ID', { error: error.message });
    return null;
  }
}
