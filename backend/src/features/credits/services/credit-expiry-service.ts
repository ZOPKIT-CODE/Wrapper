import { db, systemDbConnection } from '../../../db/index.js';
import { credits, creditTransactions, notifications } from '../../../db/schema/index.js';
import { eq, and, lte, isNotNull, gte, isNull, asc } from 'drizzle-orm';
import { creditBatches } from '../../../db/schema/billing/credit-batches.js';
import { creditPurchases } from '../../../db/schema/billing/credit_purchases.js';
import { creditExpiryRuns } from '../../../db/schema/billing/credit-expiry-runs.js';
import { randomUUID } from 'crypto';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';

type SeasonalAllocationRow = typeof creditBatches.$inferSelect;

/**
 * Credit Expiry Service
 * Handles credit expiry processing, notifications, and cleanup
 */
export class CreditExpiryService {
  /**
   * Process expired credits for all tenants
   * This method should be called periodically (e.g., via cron job)
   * Handles both primary org and application-specific allocations
   */
  static async processExpiredCredits(options?: { triggerSource?: string; triggeredBy?: string | null }) {
    const triggerSource = options?.triggerSource ?? 'cron';
    const triggeredBy = options?.triggeredBy ?? null;
    const startMs = Date.now();
    const now = new Date();
    console.log(`🕐 [CreditExpiryService] Processing expired credits at ${now.toISOString()}`);

    try {
      // Process in chunks of 500 to avoid loading all rows into memory at once.
      // The atomic UPDATE in processExpiredAllocation (WHERE isExpired=false) ensures
      // idempotency: a second concurrent run will find 0 rows to update and skip gracefully.
      const CHUNK_SIZE = 500;
      let processedCount = 0;
      let errorCount = 0;
      const applicationExpiryMap: Record<string, { count: number; totalUnusedCredits: number }> = {};

      let hasMore = true;
      while (hasMore) {
        const chunk = await db
          .select()
          .from(creditBatches)
          .where(and(
            eq(creditBatches.isActive, true),
            eq(creditBatches.isExpired, false),
            isNotNull(creditBatches.expiresAt),
            lte(creditBatches.expiresAt, now)
          ))
          .limit(CHUNK_SIZE);

        if (chunk.length === 0) break;
        hasMore = chunk.length === CHUNK_SIZE;

        console.log(`📋 [CreditExpiryService] Processing chunk of ${chunk.length} expired allocations`);

        for (const allocation of chunk) {
          try {
            const result = await this.processExpiredAllocation(allocation);
            // result.alreadyProcessed means another concurrent run beat us — not an error
            if (!result.alreadyProcessed) {
              processedCount++;
              if (allocation.targetApplication) {
                if (!applicationExpiryMap[allocation.targetApplication]) {
                  applicationExpiryMap[allocation.targetApplication] = { count: 0, totalUnusedCredits: 0 };
                }
                applicationExpiryMap[allocation.targetApplication].count++;
                applicationExpiryMap[allocation.targetApplication].totalUnusedCredits += result.unusedCredits || 0;
              }
            }
          } catch (error) {
            console.error(`❌ [CreditExpiryService] Error processing allocation ${allocation.allocationId}:`, error);
            errorCount++;
          }
        }
      }

      console.log(`✅ [CreditExpiryService] Processed ${processedCount} expired allocations, ${errorCount} errors`);
      if (Object.keys(applicationExpiryMap).length > 0) {
        console.log(`📊 [CreditExpiryService] Application-specific expiry summary:`, applicationExpiryMap);
      }

      // Also process expired purchased credit batches
      const purchaseExpiry = await this.processExpiredPurchases();
      console.log(`✅ [CreditExpiryService] Expired purchases: ${purchaseExpiry.processedCount} processed, ${purchaseExpiry.errorCount} errors`);

      const result = {
        success: true,
        processedCount,
        errorCount,
        applicationExpiryMap,
        expiredPurchases: purchaseExpiry,
        timestamp: now.toISOString()
      };

      // Record this run for admin cron health monitoring
      await db.insert(creditExpiryRuns).values({
        ranAt: now,
        triggerSource,
        triggeredBy: triggeredBy ?? undefined,
        batchesProcessed: processedCount,
        errorCount,
        durationMs: Date.now() - startMs,
        status: errorCount === 0 ? 'success' : processedCount > 0 ? 'partial' : 'error',
      }).catch((e: unknown) => console.warn('[CreditExpiryService] Failed to write cron run record:', e));

      return result;
    } catch (error) {
      // Record failed run
      await db.insert(creditExpiryRuns).values({
        ranAt: now,
        triggerSource,
        triggeredBy: triggeredBy ?? undefined,
        batchesProcessed: 0,
        errorCount: 1,
        durationMs: Date.now() - startMs,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch(() => {/* ignore secondary failure */});
      console.error('❌ [CreditExpiryService] Error processing expired credits:', error);
      throw error;
    }
  }

  /**
   * Process a single expired allocation
   * @param allocation - The expired credit allocation
   */
  static async processExpiredAllocation(allocation: SeasonalAllocationRow): Promise<{ allocationId: string; unusedCredits: number; deducted: boolean; targetApplication: string; alreadyProcessed?: boolean }> {
    const allocationId = String(allocation.allocationId ?? '');
    const tenantId = String(allocation.tenantId ?? '');
    const entityId = String(allocation.entityId ?? '');
    const targetApplication = allocation.targetApplication ?? null;
    const allocatedCredits = allocation.allocatedCredits;
    const usedCredits = allocation.usedCredits;

    const allocationType = targetApplication ? `application-specific (${targetApplication})` : 'primary org';
    console.log(`🔄 [CreditExpiryService] Processing expired ${allocationType} allocation ${allocationId}`);

    // Calculate unused credits — clamp to 0 so partial transfers that pushed
    // usedCredits beyond allocatedCredits don't cause negative deductions.
    const allocated = parseFloat(String(allocatedCredits ?? 0));
    const used = parseFloat(String(usedCredits ?? 0));
    const unusedCredits = Math.max(0, allocated - used);

    // Wrap batch expiry + balance deduction in a transaction so a crash between
    // the two steps can't leave the batch marked expired without deducting credits.
    // For app-specific batches the downstream revoke is done outside the transaction
    // since it involves an external MQ publish that can't roll back.
    const app = (typeof targetApplication === 'string' ? targetApplication : null) as string | null;

    const result = await db.transaction(async (tx) => {
      // Idempotency guard: only mark expired if still active/not-expired.
      // A concurrent cron run may have beaten us here — if so, skip gracefully.
      const [updated] = await tx
        .update(creditBatches)
        .set({
          isExpired: true,
          isActive: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(creditBatches.allocationId, allocationId),
          eq(creditBatches.isExpired, false), // only update if not already expired
        ))
        .returning({ allocationId: creditBatches.allocationId });

      if (!updated) {
        return { alreadyProcessed: true as const };
      }

      console.log(`✅ [CreditExpiryService] Marked ${allocationType} allocation ${allocationId} as expired`);

      // For org-level allocations, deduct within the same transaction.
      if (unusedCredits > 0 && !app) {
        await CreditExpiryService.deductExpiredCreditsTx(
          tx, String(tenantId), String(entityId), unusedCredits, String(allocationId), null
        );
      }

      return { alreadyProcessed: false as const };
    });

    if (result.alreadyProcessed) {
      return { allocationId, unusedCredits: 0, deducted: false, targetApplication: typeof targetApplication === 'string' ? targetApplication : 'primary_org', alreadyProcessed: true };
    }

    // For app-specific batches, revoke outside the transaction (MQ publish can't roll back).
    if (unusedCredits > 0 && app) {
      await CreditExpiryService.revokeAppCredits(
        String(tenantId), String(entityId), unusedCredits, String(allocationId), app
      );
    }

    return {
      allocationId,
      unusedCredits,
      deducted: unusedCredits > 0,
      targetApplication: typeof targetApplication === 'string' ? targetApplication : 'primary_org'
    };
  }

  /**
   * Process expired purchased credit batches
   * Finds completed purchases whose expiryDate has passed and deducts remaining credits
   */
  private static async processExpiredPurchases(): Promise<{ processedCount: number; errorCount: number }> {
    const now = new Date();

    // Find completed purchases whose expiry date has passed and aren't already expired
    const expiredPurchases = await db
      .select()
      .from(creditPurchases)
      .where(and(
        eq(creditPurchases.status, 'completed'),
        isNotNull(creditPurchases.expiryDate),
        lte(creditPurchases.expiryDate, now),
        isNotNull(creditPurchases.entityId)
      ));

    let processedCount = 0;
    let errorCount = 0;

    for (const purchase of expiredPurchases) {
      try {
        const tenantId = String(purchase.tenantId);
        const entityId = String(purchase.entityId);
        const creditAmount = parseFloat(String(purchase.creditAmount ?? 0));

        if (creditAmount <= 0) continue;

        // Deduct from balance (reuse existing deductExpiredCredits logic)
        await CreditExpiryService.deductExpiredCredits(
          tenantId,
          entityId,
          creditAmount,
          String(purchase.purchaseId),
          null  // null = primary org (no targetApplication for purchases)
        );

        // Mark purchase as expired so we don't process it again
        await db
          .update(creditPurchases)
          .set({ status: 'expired' })
          .where(eq(creditPurchases.purchaseId, purchase.purchaseId));

        processedCount++;
        console.log(`✅ [CreditExpiryService] Expired purchase ${purchase.purchaseId} — deducted ${creditAmount} credits from entity ${entityId}`);
      } catch (err) {
        console.error(`❌ [CreditExpiryService] Error expiring purchase ${purchase.purchaseId}:`, err);
        errorCount++;
      }
    }

    return { processedCount, errorCount };
  }

  /**
   * Deduct expired unused credits from organization balance (standalone — uses systemDbConnection).
   * Used by processExpiredPurchases and other callers that don't have an open transaction.
   */
  static async deductExpiredCredits(tenantId: string, entityId: string, expiredCredits: number, allocationId: string, targetApplication: string | null = null): Promise<void> {
    await CreditExpiryService.deductExpiredCreditsTx(
      systemDbConnection, tenantId, entityId, expiredCredits, allocationId, targetApplication
    );
  }

  /**
   * Deduct expired unused credits from organization balance within an existing
   * transaction (or any Drizzle query runner).
   * @param queryRunner - Drizzle transaction handle or db instance
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async deductExpiredCreditsTx(queryRunner: any, tenantId: string, entityId: string, expiredCredits: number, allocationId: string, targetApplication: string | null = null): Promise<void> {
    try {
      // Find the credit record for this entity
      const [creditRecord] = await queryRunner
        .select()
        .from(credits)
        .where(and(
          eq(credits.tenantId, tenantId),
          eq(credits.entityId, entityId)
        ))
        .limit(1);

      if (!creditRecord) {
        throw new Error(`Credit record not found for entity ${entityId} in tenant ${tenantId}`);
      }

      const currentBalance = parseFloat(String(creditRecord.availableCredits ?? 0));
      const newBalance = Math.max(0, currentBalance - expiredCredits);

      // Update credit balance
      await queryRunner
        .update(credits)
        .set({
          availableCredits: newBalance.toString(),
          lastUpdatedAt: new Date()
        })
        .where(eq(credits.creditId, creditRecord.creditId));

      // Create transaction record for audit trail
      const operationCode = targetApplication
        ? `credit_expiry:${String(targetApplication)}:${allocationId}`
        : `credit_expiry:primary_org:${allocationId}`;

      await queryRunner
        .insert(creditTransactions)
        .values({
          transactionId: randomUUID(),
          tenantId: tenantId,
          entityId: entityId,
          transactionType: 'expiry',
          amount: (-expiredCredits).toString(),
          previousBalance: currentBalance.toString(),
          newBalance: newBalance.toString(),
          operationCode: operationCode,
          createdAt: new Date()
        });

      const allocationType = targetApplication ? `application-specific (${targetApplication})` : 'primary org';
      console.log(`✅ [CreditExpiryService] Deducted ${expiredCredits} expired ${allocationType} credits from entity ${entityId}`);
    } catch (error) {
      console.error(`❌ [CreditExpiryService] Error deducting expired credits:`, error);
      throw error;
    }
  }

  /**
   * Revoke expired credits from a downstream application.
   * Used when targetApplication is set — credits already left the org pool at allocation time,
   * so we do NOT touch credits.available_credits. We only notify the app via MQ and write an audit entry.
   */
  static async revokeAppCredits(
    tenantId: string,
    entityId: string,
    expiredCredits: number,
    allocationId: string,
    targetApplication: string
  ): Promise<void> {
    try {
      // Publish credit.expired event so the downstream app zeros its local balance
      await snsSqsPublisher.publishCreditEvent(
        targetApplication,
        'credit.expired',
        tenantId,
        {
          entityId,
          allocationId,
          expiredCredits,
          reason: 'allocation_expiry',
          expiredAt: new Date().toISOString()
        },
        'system'
      );

      console.log(
        `✅ [CreditExpiryService] Published credit.expired to ${targetApplication} — ${expiredCredits} credits revoked for entity ${entityId}`
      );

      // Write audit ledger entry (no balance change — credits left the org pool at allocation time)
      await systemDbConnection
        .insert(creditTransactions)
        .values({
          transactionId: randomUUID(),
          tenantId,
          entityId,
          transactionType: 'expiry',
          amount: (-expiredCredits).toString(),
          previousBalance: '0',  // org pool was already debited; this is purely an audit record
          newBalance: '0',
          operationCode: `credit_expiry:${targetApplication}:${allocationId}`,
          createdAt: new Date()
        });
    } catch (error) {
      console.error(`❌ [CreditExpiryService] Error revoking app credits for ${targetApplication}:`, error);
      throw error;
    }
  }

  /**
   * Get credits expiring soon (within specified days)
   * @param {number} daysAhead - Number of days to look ahead (default: 7)
   * @param {string} tenantId - Optional tenant ID to filter by
   * @param {string} entityId - Optional entity ID to filter by
   * @param {string} targetApplication - Optional application code to filter by (null for primary org)
   */
  static async getExpiringCredits(daysAhead = 7, tenantId: string | null = null, entityId: string | null = null, targetApplication: string | null = null) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const now = new Date();

    const conditions = [
      eq(creditBatches.isActive, true),
      eq(creditBatches.isExpired, false),
      isNotNull(creditBatches.expiresAt),
      gte(creditBatches.expiresAt, now),
      lte(creditBatches.expiresAt, futureDate)
    ];

    if (tenantId != null && tenantId !== '') {
      conditions.push(eq(creditBatches.tenantId, tenantId));
    }

    if (entityId != null && entityId !== '') {
      conditions.push(eq(creditBatches.entityId, entityId));
    }

    // Filter by target application if specified
    if (targetApplication !== undefined) {
      if (targetApplication === null) {
        // Filter for primary org allocations (targetApplication IS NULL)
        conditions.push(isNull(creditBatches.targetApplication));
      } else {
        // Filter for specific application
        conditions.push(eq(creditBatches.targetApplication, targetApplication));
      }
    }

    const expiringAllocations = await db
      .select()
      .from(creditBatches)
      .where(and(...conditions))
      .orderBy(asc(creditBatches.expiresAt));

    return expiringAllocations.map(allocation => {
      const expiryDate = new Date(allocation.expiresAt);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const unusedCredits = parseFloat(String(allocation.allocatedCredits ?? 0)) - parseFloat(String(allocation.usedCredits ?? 0));
      const allocationType = typeof allocation.targetApplication === 'string' ? `application-specific (${allocation.targetApplication})` : 'primary org';

      return {
        ...allocation,
        daysUntilExpiry,
        unusedCredits,
        expiresAt: expiryDate.toISOString(),
        allocationType
      };
    });
  }

  /**
   * Send expiry warnings to organization admins by creating in-app notifications.
   * Groups batches by tenant so each tenant gets one consolidated notification.
   */
  static async sendExpiryWarnings(daysAhead = 7) {
    const expiringCredits = await this.getExpiringCredits(daysAhead);

    console.log(`📧 [CreditExpiryService] Sending expiry warnings for ${expiringCredits.length} allocations`);

    if (expiringCredits.length === 0) {
      return { warningsSent: 0, totalAllocations: 0 };
    }

    // Group by tenant — one notification per tenant
    type GroupVal = { tenantId: string; totalUnused: number; soonestExpiry: Date; batchCount: number };
    const grouped = expiringCredits.reduce((acc: Record<string, GroupVal>, allocation) => {
      const key = allocation.tenantId;
      if (!acc[key]) {
        acc[key] = {
          tenantId: allocation.tenantId,
          totalUnused: 0,
          soonestExpiry: new Date(allocation.expiresAt),
          batchCount: 0,
        };
      }
      acc[key].totalUnused += allocation.unusedCredits;
      acc[key].batchCount++;
      const expiryDate = new Date(allocation.expiresAt);
      if (expiryDate < acc[key].soonestExpiry) acc[key].soonestExpiry = expiryDate;
      return acc;
    }, {} as Record<string, GroupVal>);

    let warningsSent = 0;

    for (const group of Object.values(grouped)) {
      try {
        const daysUntil = Math.ceil((group.soonestExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const priority = daysUntil <= 1 ? 'urgent' : daysUntil <= 3 ? 'high' : 'medium';

        await db.insert(notifications).values({
          tenantId: group.tenantId,
          type: 'credit_expiry_warning',
          priority,
          title: `Credits Expiring in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          message: `${Math.round(group.totalUnused).toLocaleString()} credits across ${group.batchCount} batch${group.batchCount !== 1 ? 'es' : ''} will expire on ${group.soonestExpiry.toLocaleDateString()}. Use them before they are gone.`,
          metadata: {
            daysUntilExpiry: daysUntil,
            totalUnusedCredits: group.totalUnused,
            batchCount: group.batchCount,
            soonestExpiry: group.soonestExpiry.toISOString(),
          },
          actionUrl: '/dashboard/billing',
          actionLabel: 'View Credits',
        });

        warningsSent++;
      } catch (err) {
        console.error(`[CreditExpiryService] Failed to create expiry warning for tenant ${group.tenantId}:`, err);
      }
    }

    return {
      warningsSent,
      totalAllocations: expiringCredits.length,
    };
  }

  /**
   * Get expiry statistics for a tenant/entity
   * @param {string} tenantId - Tenant ID
   * @param {string} entityId - Entity ID (organization)
   */
  static async getExpiryStats(tenantId: string, entityId: string) {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get expiring within 7 days
    const expiringSoon = await db
      .select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.tenantId, String(tenantId)),
        eq(creditBatches.entityId, String(entityId)),
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
        isNotNull(creditBatches.expiresAt),
        gte(creditBatches.expiresAt, now),
        lte(creditBatches.expiresAt, sevenDaysFromNow)
      ));

    // Get expiring within 30 days
    const expiringWithin30Days = await db
      .select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.tenantId, String(tenantId)),
        eq(creditBatches.entityId, String(entityId)),
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
        isNotNull(creditBatches.expiresAt),
        gte(creditBatches.expiresAt, now),
        lte(creditBatches.expiresAt, thirtyDaysFromNow)
      ));

    // Calculate total unused credits that will expire
    const calculateUnusedCredits = (allocations: SeasonalAllocationRow[]): number => {
      return allocations.reduce((total: number, allocation: SeasonalAllocationRow) => {
        const allocated = parseFloat(String(allocation.allocatedCredits ?? 0));
        const used = parseFloat(String(allocation.usedCredits ?? 0));
        return total + (allocated - used);
      }, 0);
    };

    return {
      expiringSoon: {
        count: expiringSoon.length,
        unusedCredits: calculateUnusedCredits(expiringSoon)
      },
      expiringWithin30Days: {
        count: expiringWithin30Days.length,
        unusedCredits: calculateUnusedCredits(expiringWithin30Days)
      }
    };
  }

  /**
   * Sync non-campaign credit batch expiry dates to a new subscription period end.
   * Used when subscription is first created to set initial expiry dates.
   * NOT used for renewals — renewals expire old credits instead of extending them.
   */
  static async syncPaidCreditBatchExpiry(tenantId: string, newExpiry: Date): Promise<void> {
    await db
      .update(creditBatches)
      .set({ expiresAt: newExpiry, updatedAt: new Date() })
      .where(and(
        eq(creditBatches.tenantId, tenantId),
        eq(creditBatches.isExpired, false),
        isNull(creditBatches.campaignId),
      ));

    console.log(`✅ [CreditExpiryService] Synced non-campaign batch expiry to ${newExpiry.toISOString()} for tenant ${tenantId}`);
  }

  /**
   * Expire all non-campaign credit batches from the previous subscription tenure.
   * Called when a subscription renews — old tenure's credits should not carry over.
   * New tenure credits are granted separately (plan credits, onboarding, etc.).
   *
   * This marks old batches as expired and deducts their unused credits from the
   * org pool balance, just like the regular expiry cron would.
   */
  static async expirePreviousTenureCredits(tenantId: string, previousPeriodEnd: Date): Promise<void> {
    // Find all active non-campaign batches for this tenant that were created
    // before the new period started (i.e., belong to the old tenure).
    const oldBatches = await db
      .select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.tenantId, tenantId),
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
        isNull(creditBatches.campaignId),
        lte(creditBatches.allocatedAt, previousPeriodEnd),
      ));

    let expiredCount = 0;
    for (const batch of oldBatches) {
      try {
        await this.processExpiredAllocation(batch);
        expiredCount++;
      } catch (err) {
        console.error(`❌ [CreditExpiryService] Failed to expire tenure batch ${batch.allocationId}:`, err);
      }
    }

    console.log(`✅ [CreditExpiryService] Expired ${expiredCount}/${oldBatches.length} previous tenure batches for tenant ${tenantId}`);
  }

  /**
   * Expire ALL active credit batches for a tenant AND zero out every entity balance.
   * Called when a subscription is canceled/deleted — all credits must be revoked
   * regardless of type (paid, free, seasonal, purchased).
   */
  static async expireAllActiveBatches(tenantId: string): Promise<{ expiredCount: number; totalBatches: number }> {
    // 1. Expire all credit batches
    const activeBatches = await db
      .select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.tenantId, tenantId),
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
      ));

    let expiredCount = 0;
    for (const batch of activeBatches) {
      try {
        await this.processExpiredAllocation(batch);
        expiredCount++;
      } catch (err) {
        console.error(`❌ [CreditExpiryService] Failed to expire batch ${batch.allocationId} on cancellation:`, err);
      }
    }

    // 2. Zero out ALL entity credit balances for this tenant.
    //    processExpiredAllocation only deducts from the batch's own entity —
    //    transferred credits, purchased credits on sub-orgs, etc. can survive.
    //    On subscription cancellation, everything must go to zero.
    const entityBalances = await db
      .select({
        creditId: credits.creditId,
        entityId: credits.entityId,
        availableCredits: credits.availableCredits,
      })
      .from(credits)
      .where(eq(credits.tenantId, tenantId));

    for (const entity of entityBalances) {
      const remaining = parseFloat(String(entity.availableCredits ?? 0));
      if (remaining > 0) {
        await db
          .update(credits)
          .set({ availableCredits: '0', lastUpdatedAt: new Date() })
          .where(eq(credits.creditId, entity.creditId));

        // Record the expiry transaction for audit trail
        await db.insert(creditTransactions).values({
          tenantId,
          entityId: entity.entityId,
          transactionType: 'expiry',
          amount: (-remaining).toString(),
          previousBalance: remaining.toString(),
          newBalance: '0',
          description: 'Subscription canceled — all credits expired',
          operationCode: 'subscription_canceled',
          initiatedBy: 'system',
        } as any);

        console.log(`🗑️ [CreditExpiryService] Zeroed entity ${entity.entityId}: ${remaining} credits expired`);
      }
    }

    // 3. Mark any pending purchased credit batches as expired too
    await db
      .update(creditPurchases)
      .set({ status: 'expired' })
      .where(and(
        eq(creditPurchases.tenantId, tenantId),
        eq(creditPurchases.status, 'completed'),
      ));

    console.log(`✅ [CreditExpiryService] Subscription canceled — expired ${expiredCount}/${activeBatches.length} batches, zeroed ${entityBalances.length} entity balances for tenant ${tenantId}`);
    return { expiredCount, totalBatches: activeBatches.length };
  }
}

