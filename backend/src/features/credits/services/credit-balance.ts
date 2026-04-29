import { db } from '../../../db/index.js';
import { credits, creditTransactions, subscriptions } from '../../../db/schema/index.js';
import { eq, and, desc, gte, lte, sql, isNotNull } from 'drizzle-orm';

// Extended balance type for UI/alert fields not in current schema
type CreditBalanceRow = typeof credits.$inferSelect & { criticalBalanceThreshold?: number; lowBalanceThreshold?: number; creditExpiry?: Date | string | null; reservedCredits?: string | null };

/**
 * Get current credit balance for a tenant or specific entity
 */
export async function getCurrentBalance(tenantId: string, entityType = 'organization', entityId: string | null = null) {
  try {
    // Normalize entity parameters to match addCreditsToEntity method
    const normalizedEntityType = entityType || 'organization';
    const searchEntityId = entityId || tenantId;

    console.log('🔍 Getting current balance with normalized parameters:', {
      tenantId,
      originalEntityType: entityType,
      normalizedEntityType,
      originalEntityId: entityId,
      searchEntityId
    });

    const [creditBalance] = await db
      .select()
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenantId),
        eq(credits.entityId, searchEntityId)
      ))
      .limit(1);

    if (!creditBalance) {
      // Return default structure for entities without credit records
      return {
        tenantId: tenantId,
        entityId: searchEntityId,
        availableCredits: 0,
        freeCredits: 0,
        paidCredits: 0,
        seasonalCredits: 0,
        reservedCredits: 0,
        lowBalanceThreshold: 100,
        criticalBalanceThreshold: 10,
        lastPurchase: null,
        creditExpiry: null,
        freeCreditsExpiry: null,
        paidCreditsExpiry: null,
        seasonalCreditsExpiry: null,
        plan: 'credit_based',
        status: 'no_credits',
        usageThisPeriod: 0,
        periodLimit: 0,
        periodType: 'month',
        alerts: [{
          id: 'no_credit_record',
          type: 'no_credit_record',
          severity: 'info',
          title: 'No Credit Record',
          message: 'This entity does not have a credit record yet',
          threshold: 0,
          currentValue: 0,
          actionRequired: 'initialize_credits'
        }]
      };
    }

    // Calculate alerts based on current balance (use extended type for optional schema fields)
    const balance = creditBalance as CreditBalanceRow;
    const availableNum = parseFloat(balance.availableCredits ?? '0');
    const criticalThreshold = balance.criticalBalanceThreshold ?? 10;
    const lowThreshold = balance.lowBalanceThreshold ?? 100;
    const alerts: Array<Record<string, unknown>> = [];

    if (availableNum <= criticalThreshold) {
      alerts.push({
        id: 'critical_balance',
        type: 'critical_balance',
        severity: 'critical',
        title: 'Critical Credit Balance',
        message: `You have only ${availableNum} credits remaining`,
        threshold: criticalThreshold,
        currentValue: availableNum,
        actionRequired: 'purchase_credits'
      });
    } else if (availableNum <= lowThreshold) {
      alerts.push({
        id: 'low_balance',
        type: 'low_balance',
        severity: 'warning',
        title: 'Low Credit Balance',
        message: `You have ${availableNum} credits remaining`,
        threshold: lowThreshold,
        currentValue: availableNum,
        actionRequired: 'purchase_credits'
      });
    }

    // Check for expiring credits
    const creditExpiryVal = balance.creditExpiry;
    if (creditExpiryVal) {
      const daysUntilExpiry = Math.floor(
        (new Date(creditExpiryVal).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        alerts.push({
          id: 'expiry_warning',
          type: 'expiry_warning',
          severity: daysUntilExpiry <= 7 ? 'critical' : 'warning',
          title: 'Credits Expiring Soon',
          message: `${availableNum} credits expire in ${daysUntilExpiry} days`,
          threshold: daysUntilExpiry,
          currentValue: availableNum,
          actionRequired: 'purchase_credits'
        });
      }
    }

    // REMOVED: Application credit allocations check - applications manage their own credits
    // Applications consume directly from organization balance in credits table

    // Categorize credits by analyzing transactions and allocations
    let freeCredits = 0;
    let paidCredits = 0;
    let seasonalCredits = 0;
    let freeCreditsExpiry: string | null = null;
    let paidCreditsExpiry: string | null = null;
    let seasonalCreditsExpiry: string | null = null;

    // parallelized — fetch subscription (expiry + plan), purchase transactions, and seasonal allocations concurrently
    const { seasonalCreditAllocations } = await import('../../../db/schema/billing/seasonal-credits.js');

    const [subscriptionResult, purchaseTransactionsResult, activeAllocationsResult] = await Promise.all([
      // Single subscription query that covers currentPeriodEnd (expiry), plan, and canceledAt
      // canceledAt is used to scope credit categorization to the current subscription lifecycle
      // (avoids counting stale purchase transactions from before a cancel+resubscribe)
      // Order by updated_at desc so we use the same subscription row as source of truth (matches Supabase data)
      db
        .select({
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          plan: subscriptions.plan,
          canceledAt: subscriptions.canceledAt,
          updatedAt: subscriptions.updatedAt
        })
        .from(subscriptions)
        .where(and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.status, 'active')
        ))
        .orderBy(desc(subscriptions.updatedAt))
        .limit(1)
        .catch((err: unknown) => {
          console.warn('⚠️ Error fetching subscription:', (err as Error).message);
          return [] as { currentPeriodEnd: Date | null; plan: string; canceledAt: Date | null; updatedAt: Date | null }[];
        }),

      // Purchase transactions for credit categorization
      db
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.tenantId, tenantId),
          eq(creditTransactions.entityId, String(searchEntityId)),
          eq(creditTransactions.transactionType, 'purchase')
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .catch((err: unknown) => {
          console.warn('⚠️ Error fetching credit transactions:', (err as Error).message);
          return [] as (typeof creditTransactions.$inferSelect)[];
        }),

      // Active seasonal allocations for expiry dates
      db
        .select({
          allocatedCredits: seasonalCreditAllocations.allocatedCredits,
          usedCredits: seasonalCreditAllocations.usedCredits,
          expiresAt: seasonalCreditAllocations.expiresAt,
          targetApplication: seasonalCreditAllocations.targetApplication
        })
        .from(seasonalCreditAllocations)
        .where(and(
          eq(seasonalCreditAllocations.tenantId, tenantId),
          eq(seasonalCreditAllocations.entityId, String(searchEntityId)),
          eq(seasonalCreditAllocations.isActive, true),
          eq(seasonalCreditAllocations.isExpired, false),
          isNotNull(seasonalCreditAllocations.expiresAt),
          gte(seasonalCreditAllocations.expiresAt, new Date())
        ))
        .orderBy(seasonalCreditAllocations.expiresAt)
        .catch((err: unknown) => {
          console.warn('⚠️ Error fetching seasonal credit expiry:', (err as Error).message);
          return [] as { allocatedCredits: string; usedCredits: string | null; expiresAt: Date; targetApplication: string | null }[];
        }),
    ]);

    // Derive subscription expiry and plan from the single subscription query result
    let subscriptionExpiry: string | null = null;
    let actualPlan = 'credit_based';
    const subscription = subscriptionResult[0] ?? null;
    if (subscription?.currentPeriodEnd) {
      subscriptionExpiry = new Date(subscription.currentPeriodEnd).toISOString();
      // Free credits expire with subscription period (use DB value so UI shows e.g. May when current_period_end is May)
      freeCreditsExpiry = subscriptionExpiry;
    }
    if (subscription?.plan) {
      actualPlan = subscription.plan;
    }

    // Determine lifecycle boundary: after a cancel+resubscribe, only count transactions
    // from the current subscription lifecycle to avoid phantom credit categorization.
    // If the subscription was previously canceled (canceledAt is set) and has since been
    // reactivated (updatedAt > canceledAt), use canceledAt as the cutoff — any purchase
    // transactions before cancellation belong to the old lifecycle and were already expired.
    let lifecycleBoundary: Date | null = null;
    if (subscription?.canceledAt && subscription?.updatedAt) {
      const canceledTime = new Date(subscription.canceledAt).getTime();
      const updatedTime = new Date(subscription.updatedAt).getTime();
      if (updatedTime > canceledTime) {
        lifecycleBoundary = new Date(subscription.canceledAt);
        console.log(`📊 Credit categorization: using lifecycle boundary ${lifecycleBoundary.toISOString()} (subscription was canceled then reactivated)`);
      }
    }

    // Categorize credits based on operation_code and source
    try {
      for (const transaction of purchaseTransactionsResult) {
        // Skip transactions from before the current subscription lifecycle
        if (lifecycleBoundary && transaction.createdAt && new Date(transaction.createdAt) < lifecycleBoundary) {
          continue;
        }
        const amount = parseFloat(String(transaction.amount ?? 0));
        const operationCode = (transaction.operationCode ?? '') as string;

        // Free credits: from onboarding, subscription, or system allocations
        if (operationCode === 'onboarding' ||
            operationCode === 'subscription' ||
            operationCode === 'trial' ||
            operationCode === 'system') {
          freeCredits += amount;
          // Free credits expire with subscription if available
          if (!freeCreditsExpiry && subscriptionExpiry) {
            freeCreditsExpiry = subscriptionExpiry;
          }
        }
        // Paid credits: from purchases (stripe, manual purchase)
        else if (operationCode === 'purchase' ||
                 operationCode === 'stripe' ||
                 operationCode === 'manual_purchase') {
          paidCredits += amount;
          // Paid credits expire with subscription period (same as free credits)
          if (!paidCreditsExpiry && subscriptionExpiry) {
            paidCreditsExpiry = subscriptionExpiry;
          }
        }
      }
    } catch (err: unknown) {
      const txError = err as Error;
      console.warn('⚠️ Error analyzing credit transactions:', txError.message);
      // Fallback: assume all credits are free if we can't analyze
      freeCredits = parseFloat(String((creditBalance as CreditBalanceRow).availableCredits ?? 0));
    }

    // Process seasonal credit allocations with expiry dates
    let earliestExpiry: string | null = null;
    const applicationExpiryDates: Record<string, string> = {};

    // Calculate seasonal credits and find earliest expiry
    for (const allocation of activeAllocationsResult) {
      const allocated = parseFloat(String(allocation.allocatedCredits ?? 0));
      const used = parseFloat(String(allocation.usedCredits ?? 0));
      const available = allocated - used;
      seasonalCredits += available;

      const expiryDate = new Date(allocation.expiresAt);
      if (!seasonalCreditsExpiry || expiryDate < new Date(seasonalCreditsExpiry)) {
        seasonalCreditsExpiry = expiryDate.toISOString();
      }

      if (!earliestExpiry || expiryDate < new Date(earliestExpiry)) {
        earliestExpiry = expiryDate.toISOString();
      }

      // Group by application
      const appKey = allocation.targetApplication || 'primary_org';
      if (!applicationExpiryDates[appKey] || expiryDate < new Date(applicationExpiryDates[appKey])) {
        applicationExpiryDates[appKey] = expiryDate.toISOString();
      }
    }

    // Calculate total available credits
    const totalAvailable = parseFloat(String((creditBalance as CreditBalanceRow).availableCredits ?? 0));
    const categorizedTotal = freeCredits + paidCredits + seasonalCredits;

    // If balance is zero, all categories must be zero regardless of transaction history
    if (totalAvailable <= 0) {
      freeCredits = 0;
      paidCredits = 0;
      seasonalCredits = 0;
    } else if (freeCredits === 0 && paidCredits === 0 && seasonalCredits === 0 && totalAvailable > 0) {
      // Couldn't categorize from transactions — use total as free credits (onboarding scenario)
      freeCredits = totalAvailable;
      if (subscriptionExpiry) {
        freeCreditsExpiry = subscriptionExpiry;
      }
    } else if (totalAvailable > categorizedTotal) {
      // There's a difference between available credits and categorized credits
      // This can happen if credits were added but not properly categorized in transactions
      // Assign the difference to free credits (most common scenario for subscription credits)
      const uncategorizedCredits = totalAvailable - categorizedTotal;
      freeCredits += uncategorizedCredits;

      // Set expiry if subscription expiry is available
      if (!freeCreditsExpiry && subscriptionExpiry) {
        freeCreditsExpiry = subscriptionExpiry;
      }

      console.log(`📊 Credit categorization: Found ${uncategorizedCredits} uncategorized credits, assigning to free credits`);
    } else if (totalAvailable < categorizedTotal) {
      // Categorized credits exceed available (credits were consumed/expired)
      // Scale down each category proportionally to match the actual balance
      const ratio = categorizedTotal > 0 ? totalAvailable / categorizedTotal : 0;
      paidCredits = Math.round(paidCredits * ratio);
      seasonalCredits = Math.round(seasonalCredits * ratio);
      freeCredits = Math.max(0, totalAvailable - paidCredits - seasonalCredits);
    }

    return {
      tenantId: creditBalance.tenantId,
      entityId: creditBalance.entityId,
      availableCredits: totalAvailable,
      freeCredits: freeCredits,
      paidCredits: paidCredits,
      seasonalCredits: seasonalCredits,
      reservedCredits: parseFloat(String((creditBalance as CreditBalanceRow).reservedCredits ?? '0')),
      lowBalanceThreshold: 100,
      criticalBalanceThreshold: 10,
      lastPurchase: creditBalance.lastUpdatedAt,
      creditExpiry: earliestExpiry || freeCreditsExpiry, // Overall earliest expiry
      freeCreditsExpiry: freeCreditsExpiry, // Free credits expiry (subscription expiry)
      paidCreditsExpiry: paidCreditsExpiry, // Paid credits expiry (subscription period end)
      seasonalCreditsExpiry: seasonalCreditsExpiry, // Seasonal credits expiry
      subscriptionExpiry: subscriptionExpiry, // Subscription plan expiry
      applicationExpiryDates: applicationExpiryDates,
      plan: actualPlan,
      status: totalAvailable > 0 ? 'active' : 'insufficient_credits',
      usageThisPeriod: 0,
      periodLimit: 0,
      periodType: 'month',
      alerts
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching current credit balance:', error);
    throw error;
  }
}

/**
 * Get transaction history for a tenant
 */
export async function getTransactionHistory(tenantId: string, filters: { page?: number; limit?: number; type?: string; startDate?: string | Date; endDate?: string | Date } = {}) {
  try {
    const { page = 1, limit = 50, type, startDate, endDate } = filters;

    const conditions = [eq(creditTransactions.tenantId, tenantId)];
    if (type) conditions.push(eq(creditTransactions.transactionType, type));
    if (startDate) conditions.push(gte(creditTransactions.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(creditTransactions.createdAt, new Date(endDate)));

    const query = db
      .select()
      .from(creditTransactions)
      .where(and(...conditions));

    const transactions = await query
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(creditTransactions)
      .where(and(...conditions));

    return {
      transactions: transactions.map(t => ({
        id: t.transactionId,
        type: t.transactionType,
        amount: parseFloat(t.amount),
        previousBalance: parseFloat(String(t.previousBalance ?? 0)),
        newBalance: parseFloat(String(t.newBalance ?? 0)),
        operationCode: t.operationCode ?? null,
        createdAt: t.createdAt
      })),
      pagination: {
        page,
        limit,
        total: Number(totalCount[0]?.count ?? 0),
        pages: Math.ceil(Number(totalCount[0]?.count ?? 0) / limit)
      }
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching transaction history:', error);
    throw error;
  }
}

/**
 * Get balance for a specific entity
 */
export async function getEntityBalance(tenantId: string, entityType: string, entityId: string | null): Promise<Record<string, unknown> | null> {
  try {
    const [creditBalance] = await db
      .select()
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenantId),
        entityId ? eq(credits.entityId, entityId) : sql`${credits.entityId} IS NULL`
      ))
      .limit(1);

    if (!creditBalance) {
      return null;
    }

    const available = Number(creditBalance.availableCredits ?? 0);
    const reserved = Number((creditBalance as Record<string, unknown>).reservedCredits ?? 0);
    return {
      tenantId: creditBalance.tenantId,
      entityType: entityType,
      entityId: creditBalance.entityId,
      availableCredits: available,
      reservedCredits: reserved,
      lowBalanceThreshold: 100,
      criticalBalanceThreshold: 10,
      lastPurchase: creditBalance.lastUpdatedAt,
      creditExpiry: null,
      plan: 'credit_based',
      status: Number(creditBalance.availableCredits ?? 0) > 0 ? 'active' : 'insufficient_credits'
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching entity balance:', error);
    throw error;
  }
}

/**
 * Get usage summary for a tenant
 */
export async function getUsageSummary(tenantId: string, filters: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  try {
    const { period = 'month', startDate, endDate } = filters as { period?: string; startDate?: string | Date; endDate?: string | Date };

    let dateFilter: { gte: Date; lte: Date };
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else {
      // Default to current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFilter = {
        gte: startOfMonth,
        lte: endOfMonth
      };
    }

    const transactions = await db
      .select({
        type: creditTransactions.transactionType,
        amount: creditTransactions.amount,
        createdAt: creditTransactions.createdAt
      })
      .from(creditTransactions)
      .where(and(
        eq(creditTransactions.tenantId, tenantId),
        gte(creditTransactions.createdAt, dateFilter.gte),
        lte(creditTransactions.createdAt, dateFilter.lte)
      ));

    const summary: Record<string, unknown> = {
      period,
      totalConsumed: 0,
      totalPurchased: 0,
      totalExpired: 0,
      netCredits: 0,
      transactionsByType: {} as Record<string, number>
    };
    const transactionsByType = summary.transactionsByType as Record<string, number>;

    transactions.forEach(t => {
      const amount = parseFloat(t.amount);
      const txType = t.type;

      switch (txType) {
        case 'consumption':
          summary.totalConsumed = (summary.totalConsumed as number) + Math.abs(amount);
          break;
        case 'purchase':
          summary.totalPurchased = (summary.totalPurchased as number) + amount;
          break;
        case 'expiry':
          summary.totalExpired = (summary.totalExpired as number) + Math.abs(amount);
          break;
      }

      if (!transactionsByType[txType]) {
        transactionsByType[txType] = 0;
      }
      transactionsByType[txType] += Math.abs(amount);
    });

    summary.netCredits = (summary.totalPurchased as number) - (summary.totalConsumed as number) - (summary.totalExpired as number);

    return summary;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching usage summary:', error);
    throw error;
  }
}

/**
 * Get credit statistics for dashboard
 */
export async function getCreditStats(tenantId: string): Promise<Record<string, unknown>> {
  try {
    const balance = await getCurrentBalance(tenantId, 'organization', null);
    const usageSummary = await getUsageSummary(tenantId);

    const [transactionStats] = await db
      .select({
        totalTransactions: sql`count(*)`,
        totalAmount: sql`sum(abs(${creditTransactions.amount}))`
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.tenantId, tenantId));

    return {
      balance,
      usage: usageSummary,
      transactions: {
        total: Number(transactionStats?.totalTransactions ?? 0),
        totalAmount: parseFloat(String(transactionStats?.totalAmount ?? 0))
      }
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching credit statistics:', error);
    throw error;
  }
}
