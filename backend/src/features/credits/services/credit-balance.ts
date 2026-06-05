import { db, getReadDb } from '../../../db/index.js';
import { credits, creditTransactions, subscriptions, creditCategorySnapshots } from '../../../db/schema/index.js';
import { eq, and, desc, gte, lte, sql, isNotNull } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CategorySnapshot {
  freeCredits: number;
  paidCredits: number;
  seasonalCredits: number;
  freeCreditsExpiry: string | null;
  paidCreditsExpiry: string | null;
  seasonalCreditsExpiry: string | null;
  subscriptionExpiry: string | null;
  subscriptionPlan: string;
  applicationExpiryDates: Record<string, string>;
}

async function readCategorySnapshot(tenantId: string, entityId: string): Promise<CategorySnapshot | null> {
  try {
    const [snap] = await getReadDb()
      .select()
      .from(creditCategorySnapshots)
      .where(and(
        eq(creditCategorySnapshots.tenantId, tenantId),
        eq(creditCategorySnapshots.entityId, entityId),
      ))
      .limit(1);

    if (!snap) return null;
    if (Date.now() - new Date(snap.computedAt!).getTime() > SNAPSHOT_TTL_MS) return null;

    return {
      freeCredits:           Number(snap.freeCredits    ?? 0),
      paidCredits:           Number(snap.paidCredits    ?? 0),
      seasonalCredits:       Number(snap.seasonalCredits ?? 0),
      freeCreditsExpiry:     snap.freeCreditsExpiry    ? new Date(snap.freeCreditsExpiry).toISOString()    : null,
      paidCreditsExpiry:     snap.paidCreditsExpiry    ? new Date(snap.paidCreditsExpiry).toISOString()    : null,
      seasonalCreditsExpiry: snap.seasonalCreditsExpiry ? new Date(snap.seasonalCreditsExpiry).toISOString() : null,
      subscriptionExpiry:    snap.subscriptionExpiry   ? new Date(snap.subscriptionExpiry).toISOString()   : null,
      subscriptionPlan:      (snap.subscriptionPlan as string) ?? 'credit_based',
      applicationExpiryDates: (snap.applicationExpiryDates as Record<string, string>) ?? {},
    };
  } catch {
    return null; // cache miss is non-fatal
  }
}

async function writeCategorySnapshot(tenantId: string, entityId: string, data: CategorySnapshot): Promise<void> {
  try {
    await db
      .insert(creditCategorySnapshots)
      .values({
        tenantId,
        entityId,
        freeCredits:           data.freeCredits.toString(),
        paidCredits:           data.paidCredits.toString(),
        seasonalCredits:       data.seasonalCredits.toString(),
        freeCreditsExpiry:     data.freeCreditsExpiry    ? new Date(data.freeCreditsExpiry)    : null,
        paidCreditsExpiry:     data.paidCreditsExpiry    ? new Date(data.paidCreditsExpiry)    : null,
        seasonalCreditsExpiry: data.seasonalCreditsExpiry ? new Date(data.seasonalCreditsExpiry) : null,
        subscriptionExpiry:    data.subscriptionExpiry   ? new Date(data.subscriptionExpiry)   : null,
        applicationExpiryDates: data.applicationExpiryDates,
        subscriptionPlan: data.subscriptionPlan,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [creditCategorySnapshots.tenantId, creditCategorySnapshots.entityId], // uq_credit_snapshot_tenant_entity
        set: {
          freeCredits:           data.freeCredits.toString(),
          paidCredits:           data.paidCredits.toString(),
          seasonalCredits:       data.seasonalCredits.toString(),
          freeCreditsExpiry:     data.freeCreditsExpiry    ? new Date(data.freeCreditsExpiry)    : null,
          paidCreditsExpiry:     data.paidCreditsExpiry    ? new Date(data.paidCreditsExpiry)    : null,
          seasonalCreditsExpiry: data.seasonalCreditsExpiry ? new Date(data.seasonalCreditsExpiry) : null,
          subscriptionExpiry:    data.subscriptionExpiry   ? new Date(data.subscriptionExpiry)   : null,
          applicationExpiryDates: data.applicationExpiryDates,
          subscriptionPlan: data.subscriptionPlan,
          computedAt: new Date(),
        },
      });
  } catch {
    // snapshot write failure is non-fatal; next request will recompute
  }
}

export async function invalidateCategorySnapshot(tenantId: string, entityId: string): Promise<void> {
  try {
    await db
      .delete(creditCategorySnapshots)
      .where(and(
        eq(creditCategorySnapshots.tenantId, tenantId),
        eq(creditCategorySnapshots.entityId, entityId),
      ));
  } catch {
    // non-fatal; the TTL will expire it within 5 minutes
  }
}

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

    Logger.log('info', 'billing', 'get-current-balance', 'Getting current balance', {
      tenantId,
      entityType: normalizedEntityType,
      entityId: searchEntityId
    });

    const [creditBalance] = await getReadDb()
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

    // Categorize credits by analyzing transactions and allocations.
    // Check the snapshot cache first — if it is fresh (< 5 min), skip the 3 DB queries.
    const cachedSnapshot = await readCategorySnapshot(tenantId, searchEntityId);

    let freeCredits = cachedSnapshot?.freeCredits ?? 0;
    let paidCredits = cachedSnapshot?.paidCredits ?? 0;
    let seasonalCredits = cachedSnapshot?.seasonalCredits ?? 0;
    let freeCreditsExpiry: string | null = cachedSnapshot?.freeCreditsExpiry ?? null;
    let paidCreditsExpiry: string | null = cachedSnapshot?.paidCreditsExpiry ?? null;
    let seasonalCreditsExpiry: string | null = cachedSnapshot?.seasonalCreditsExpiry ?? null;
    let subscriptionExpiry: string | null = cachedSnapshot?.subscriptionExpiry ?? null;
    let actualPlan = cachedSnapshot?.subscriptionPlan ?? 'credit_based';
    let applicationExpiryDates: Record<string, string> = cachedSnapshot?.applicationExpiryDates ?? {};
    let earliestExpiry: string | null = null;

    if (cachedSnapshot) {
      // Fast path: all categorization data came from the cache.
      // We still need actualPlan and earliestExpiry for the return value.
      earliestExpiry = [freeCreditsExpiry, paidCreditsExpiry, seasonalCreditsExpiry]
        .filter(Boolean)
        .sort()[0] ?? null;
    } else {
    // Slow path: compute from DB and persist to cache.
    // credit_batches is the canonical table (seasonal_credit_allocations was renamed
    // to it in prod). Querying the old name silently returned [] via the .catch below,
    // undercounting batch-allocated credits in the balance.
    const { creditBatches } = await import('../../../db/schema/billing/credit-batches.js');

    const readDb = getReadDb();
    const [subscriptionResult, purchaseTransactionsResult, activeAllocationsResult] = await Promise.all([
      readDb
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
          Logger.log('warning', 'billing', 'get-current-balance', 'Error fetching subscription', { error: (err as Error).message });
          return [] as { currentPeriodEnd: Date | null; plan: string; canceledAt: Date | null; updatedAt: Date | null }[];
        }),

      readDb
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.tenantId, tenantId),
          eq(creditTransactions.entityId, String(searchEntityId)),
          eq(creditTransactions.transactionType, 'purchase')
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .catch((err: unknown) => {
          Logger.log('warning', 'billing', 'get-current-balance', 'Error fetching credit transactions', { error: (err as Error).message });
          return [] as (typeof creditTransactions.$inferSelect)[];
        }),

      readDb
        .select({
          allocatedCredits: creditBatches.allocatedCredits,
          usedCredits: creditBatches.usedCredits,
          expiresAt: creditBatches.expiresAt,
          targetApplication: creditBatches.targetApplication
        })
        .from(creditBatches)
        .where(and(
          eq(creditBatches.tenantId, tenantId),
          eq(creditBatches.entityId, String(searchEntityId)),
          eq(creditBatches.isActive, true),
          eq(creditBatches.isExpired, false),
          isNotNull(creditBatches.expiresAt),
          gte(creditBatches.expiresAt, new Date())
        ))
        .orderBy(creditBatches.expiresAt)
        .catch((err: unknown) => {
          Logger.log('warning', 'billing', 'get-current-balance', 'Error fetching seasonal credit expiry', { error: (err as Error).message });
          return [] as { allocatedCredits: string; usedCredits: string | null; expiresAt: Date; targetApplication: string | null }[];
        }),
    ]);

    // Derive subscription expiry and plan from the single subscription query result
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
        Logger.log('info', 'billing', 'get-current-balance', 'Using lifecycle boundary for credit categorization', { lifecycleBoundary: lifecycleBoundary.toISOString() });
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
      Logger.log('warning', 'billing', 'get-current-balance', 'Error analyzing credit transactions', { error: txError.message });
      // Fallback: assume all credits are free if we can't analyze
      freeCredits = parseFloat(String((creditBalance as CreditBalanceRow).availableCredits ?? 0));
    }

    // Process seasonal credit allocations with expiry dates

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
    const slowTotalAvailable = parseFloat(String((creditBalance as CreditBalanceRow).availableCredits ?? 0));
    const categorizedTotal = freeCredits + paidCredits + seasonalCredits;

    // If balance is zero, all categories must be zero regardless of transaction history
    if (slowTotalAvailable <= 0) {
      freeCredits = 0;
      paidCredits = 0;
      seasonalCredits = 0;
    } else if (freeCredits === 0 && paidCredits === 0 && seasonalCredits === 0 && slowTotalAvailable > 0) {
      // Couldn't categorize from transactions — use total as free credits (onboarding scenario)
      freeCredits = slowTotalAvailable;
      if (subscriptionExpiry) {
        freeCreditsExpiry = subscriptionExpiry;
      }
    } else if (slowTotalAvailable > categorizedTotal) {
      const uncategorizedCredits = slowTotalAvailable - categorizedTotal;
      freeCredits += uncategorizedCredits;
      if (!freeCreditsExpiry && subscriptionExpiry) {
        freeCreditsExpiry = subscriptionExpiry;
      }
      Logger.log('info', 'billing', 'get-current-balance', 'Found uncategorized credits, assigning to free credits', { uncategorizedCredits });
    } else if (slowTotalAvailable < categorizedTotal) {
      const ratio = categorizedTotal > 0 ? slowTotalAvailable / categorizedTotal : 0;
      paidCredits = Math.round(paidCredits * ratio);
      seasonalCredits = Math.round(seasonalCredits * ratio);
      freeCredits = Math.max(0, slowTotalAvailable - paidCredits - seasonalCredits);
    }

    // Persist computed breakdown to the snapshot cache so the next call can skip these 3 queries.
    void writeCategorySnapshot(tenantId, searchEntityId, {
      freeCredits, paidCredits, seasonalCredits,
      freeCreditsExpiry, paidCreditsExpiry, seasonalCreditsExpiry,
      subscriptionExpiry, subscriptionPlan: actualPlan, applicationExpiryDates,
    });
    } // end slow path

    // Always read the live balance from the primary row (not the snapshot).
    const totalAvailable = parseFloat(String((creditBalance as CreditBalanceRow).availableCredits ?? 0));

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
    Logger.log('error', 'billing', 'get-current-balance', 'Error fetching current credit balance', { error: error.message });
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
    Logger.log('error', 'billing', 'get-transaction-history', 'Error fetching transaction history', { error: error.message });
    throw error;
  }
}

/**
 * Get balance for a specific entity
 */
export async function getEntityBalance(tenantId: string, entityType: string, entityId: string | null): Promise<Record<string, unknown> | null> {
  try {
    const [creditBalance] = await getReadDb()
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
    Logger.log('error', 'billing', 'get-entity-balance', 'Error fetching entity balance', { error: error.message });
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

    const transactions = await getReadDb()
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
    Logger.log('error', 'billing', 'get-usage-summary', 'Error fetching usage summary', { error: error.message });
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
    Logger.log('error', 'billing', 'get-credit-stats', 'Error fetching credit statistics', { error: error.message });
    throw error;
  }
}
