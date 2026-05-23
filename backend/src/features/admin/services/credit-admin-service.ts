/**
 * Admin Credit Service - Independent service for credit administration
 * Provides comprehensive credit monitoring without modifying existing services
 */

import { randomUUID } from 'crypto';
import { db } from '../../../db/index.js';
import { credits, creditTransactions, tenants, entities } from '../../../db/schema/index.js';
import { eq, and, desc, sql, count, gte, lte } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';

export class CreditAdminService {
  /**
   * Get comprehensive credit overview
   */
  static async getCreditOverview(): Promise<Record<string, unknown>> {
    try {
      // Total credit statistics
      const totalStats = await db
        .select({
          totalCredits: sql<number>`coalesce(sum(${credits.availableCredits}), 0)`,
          totalReserved: sql<number>`coalesce(sum(${(credits as any).reservedCredits}), 0)`,
          totalEntities: sql<number>`count(distinct ${credits.entityId})`,
          totalTenants: sql<number>`count(distinct ${credits.tenantId})`
        })
        .from(credits);

      // Credit distribution by tenant (top 10)
      const tenantDistribution = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          totalCredits: sql<number>`coalesce(sum(${credits.availableCredits}), 0)`,
          reservedCredits: sql<number>`coalesce(sum(${(credits as any).reservedCredits}), 0)`,
          entityCount: sql<number>`count(distinct ${credits.entityId})`
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .groupBy(tenants.tenantId, tenants.companyName)
        .orderBy(desc(sql`sum(${credits.availableCredits})`))
        .limit(10);

      // Low balance alerts
      const lowBalanceAlerts = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          alertLevel: sql<string>`case when ${credits.availableCredits} < 10 then 'critical' else 'warning' end`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} < 100`
        ))
        .orderBy(credits.availableCredits);

      // Recent credit transactions
      const recentTransactions = await db
        .select({
          transactionId: creditTransactions.transactionId,
          tenantId: creditTransactions.tenantId,
          companyName: tenants.companyName,
          transactionType: creditTransactions.transactionType,
          amount: creditTransactions.amount,
          operationCode: creditTransactions.operationCode,
          createdAt: creditTransactions.createdAt
        })
        .from(creditTransactions)
        .innerJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(10);

      return {
        totalStats: totalStats[0],
        tenantDistribution,
        lowBalanceAlerts,
        recentTransactions,
        generatedAt: new Date().toISOString()
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-credit-overview', 'Error getting credit overview', { error: error.message });
      throw error;
    }
  }

  /**
   * Get credit usage analytics
   */
  static async getCreditAnalytics(filters: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    try {
      const { period = '30d', groupBy = 'day' } = filters as { period?: string; groupBy?: string };

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Usage by operation type
      const usageByOperation = await db
        .select({
          operationCode: creditTransactions.operationCode,
          totalUsed: sql<number>`abs(sum(${creditTransactions.amount}))`,
          transactionCount: count(),
          avgPerTransaction: sql<number>`abs(avg(${creditTransactions.amount}))`
        })
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.transactionType, 'consumption'),
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate)
        ))
        .groupBy(creditTransactions.operationCode)
        .orderBy(desc(sql`abs(sum(${creditTransactions.amount}))`))
        .limit(10);

      // Usage by tenant
      const usageByTenant = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          totalUsed: sql<number>`abs(sum(${creditTransactions.amount}))`,
          transactionCount: count()
        })
        .from(creditTransactions)
        .innerJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .where(and(
          eq(creditTransactions.transactionType, 'consumption'),
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate)
        ))
        .groupBy(tenants.tenantId, tenants.companyName)
        .orderBy(desc(sql`abs(sum(${creditTransactions.amount}))`))
        .limit(10);

      // Daily usage trend
      const dateTruncSql = groupBy === 'month'
        ? sql`DATE_TRUNC('month', ${creditTransactions.createdAt})`
        : groupBy === 'week'
          ? sql`DATE_TRUNC('week', ${creditTransactions.createdAt})`
          : sql`DATE_TRUNC('day', ${creditTransactions.createdAt})`;

      const usageTrend = await db
        .select({
          period: sql<string>`to_char(${dateTruncSql}, 'YYYY-MM-DD')`,
          totalUsed: sql<number>`abs(sum(case when ${creditTransactions.transactionType} = 'consumption' then ${creditTransactions.amount} else 0 end))`,
          totalAdded: sql<number>`sum(case when ${creditTransactions.transactionType} = 'purchase' then ${creditTransactions.amount} else 0 end)`,
          transactionCount: count()
        })
        .from(creditTransactions)
        .where(and(
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate)
        ))
        .groupBy(dateTruncSql)
        .orderBy(dateTruncSql);

      return {
        usageByOperation,
        usageByTenant,
        usageTrend,
        period,
        groupBy,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-credit-analytics', 'Error getting credit analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get credit alerts and warnings
   */
  static async getCreditAlerts(): Promise<Record<string, unknown>> {
    try {
      // Critical alerts (very low balance)
      const criticalAlerts = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          alertLevel: sql<string>`'critical'`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} < 10`
        ))
        .orderBy(credits.availableCredits);

      // Warning alerts (low balance)
      const warningAlerts = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          alertLevel: sql<string>`'warning'`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} between 10 and 99`
        ))
        .orderBy(credits.availableCredits);

      // Inactive credits (no recent activity)
      const inactiveCredits = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          daysSinceUpdate: sql<number>`extract(day from now() - ${credits.lastUpdatedAt})`,
          alertLevel: sql<string>`'inactive'`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.lastUpdatedAt} < now() - interval '90 days'`,
          sql`${credits.availableCredits} > 0`
        ))
        .orderBy(desc(sql`extract(day from now() - ${credits.lastUpdatedAt})`));

      return {
        critical: criticalAlerts,
        warning: warningAlerts,
        inactive: inactiveCredits,
        summary: {
          criticalCount: criticalAlerts.length,
          warningCount: warningAlerts.length,
          inactiveCount: inactiveCredits.length,
          totalAlerts: criticalAlerts.length + warningAlerts.length + inactiveCredits.length
        },
        generatedAt: new Date().toISOString()
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-credit-alerts', 'Error getting credit alerts', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk allocate credits to multiple entities
   */
  static async bulkAllocateCredits(allocations: Array<{ entityId: string; amount: number; operationCode?: string }>, reason: string | null = null, adminUserId: string | null = null): Promise<Record<string, unknown>> {
    try {
      const results = [];

      for (const allocation of allocations) {
        const { entityId, amount, operationCode = 'admin.bulk_allocation' } = allocation;

        try {
          // Check if entity exists
          const entityCheck = await db
            .select({
              entityId: entities.entityId,
              tenantId: entities.tenantId,
              entityName: entities.entityName
            })
            .from(entities)
            .where(eq(entities.entityId, entityId))
            .limit(1);

          if (!entityCheck.length) {
            results.push({
              entityId,
              success: false,
              error: 'Entity not found'
            });
            continue;
          }

          const tenantId = entityCheck[0].tenantId;

          // Ensure credit record exists
          await db
            .insert(credits)
            .values({
              tenantId,
              entityId,
              availableCredits: '0',
              isActive: true,
              lastUpdatedAt: new Date(),
              createdAt: new Date()
            })
            .onConflictDoNothing();

          // Update credit balance
          await db
            .update(credits)
            .set({
              availableCredits: sql`${credits.availableCredits} + ${amount}`,
              lastUpdatedAt: new Date()
            })
            .where(eq(credits.entityId, entityId));

          // Record transaction
          await db
            .insert(creditTransactions)
            .values({
              tenantId,
              entityId,
              transactionType: 'purchase',
              amount: amount.toString(),
              previousBalance: '0', // Would need to calculate actual previous balance
              newBalance: amount.toString(),
              operationCode,
              initiatedBy: adminUserId,
              createdAt: new Date()
            });

          results.push({
            entityId,
            entityName: entityCheck[0].entityName,
            success: true,
            amount,
            newBalance: amount
          });
        } catch (err: unknown) {
          const error = err as Error;
          Logger.log('error', 'billing', 'bulk-allocate-credits', 'Error allocating credits to entity', { entityId, error: error.message });
          results.push({
            entityId,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      Logger.log('info', 'billing', 'bulk-allocate-credits', 'Admin bulk allocated credits', { adminUserId, successCount, reason });

      return {
        success: true,
        data: {
          results,
          summary: {
            total: allocations.length,
            successful: successCount,
            failed: failureCount
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'bulk-allocate-credits', 'Error bulk allocating credits', { error: error.message });
      throw error;
    }
  }

  /**
   * Get credit transaction history with filtering
   */
  static async getCreditTransactions(filters: Record<string, unknown> = {}, pagination: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    try {
      const f = { ...filters, ...pagination } as Record<string, unknown>;
      const tenantId = f.tenantId as string | undefined;
      const entityId = f.entityId as string | undefined;
      const transactionType = f.transactionType as string | undefined;
      const startDate = f.startDate as string | Date | undefined;
      const endDate = f.endDate as string | Date | undefined;
      const minAmount = f.minAmount as number | undefined;
      const maxAmount = f.maxAmount as number | undefined;
      const page = (f.page as number) ?? 1;
      const limit = (f.limit as number) ?? 50;

      let query: any = db
        .select({
          transactionId: creditTransactions.transactionId,
          tenantId: creditTransactions.tenantId,
          companyName: tenants.companyName,
          entityId: creditTransactions.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          transactionType: creditTransactions.transactionType,
          amount: creditTransactions.amount,
          previousBalance: creditTransactions.previousBalance,
          newBalance: creditTransactions.newBalance,
          operationCode: creditTransactions.operationCode,
          initiatedBy: creditTransactions.initiatedBy,
          createdAt: creditTransactions.createdAt
        })
        .from(creditTransactions)
        .leftJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .leftJoin(entities, eq(creditTransactions.entityId, entities.entityId));

      // Apply filters (must apply where before orderBy for Drizzle typing)
      if (tenantId) {
        query = query.where(eq(creditTransactions.tenantId, tenantId));
      }
      if (entityId) {
        query = query.where(eq(creditTransactions.entityId, entityId));
      }
      if (transactionType) {
        query = query.where(eq(creditTransactions.transactionType, transactionType));
      }
      if (startDate) {
        query = query.where(gte(creditTransactions.createdAt, new Date(startDate as string | Date)));
      }
      if (endDate) {
        query = query.where(lte(creditTransactions.createdAt, new Date(endDate as string | Date)));
      }
      if (minAmount !== undefined) {
        query = query.where(gte(sql`abs(${creditTransactions.amount})`, String(minAmount)));
      }
      if (maxAmount !== undefined) {
        query = query.where(lte(sql`abs(${creditTransactions.amount})`, String(maxAmount)));
      }

      query = query.orderBy(desc(creditTransactions.createdAt));

      // Get total count
      const totalCount = await this.getCreditTransactionCount(filters as Record<string, unknown>);

      // Apply pagination
      const offset = (page - 1) * limit;
      const transactions = await query.limit(limit).offset(offset);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-credit-transactions', 'Error getting credit transactions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get credit transaction count with filters
   */
  static async getCreditTransactionCount(filters: Record<string, unknown> = {}): Promise<number> {
    try {
      const tenantId = filters.tenantId as string | undefined;
      const entityId = filters.entityId as string | undefined;
      const transactionType = filters.transactionType as string | undefined;
      const startDate = filters.startDate as string | Date | undefined;
      const endDate = filters.endDate as string | Date | undefined;
      const minAmount = filters.minAmount as number | undefined;
      const maxAmount = filters.maxAmount as number | undefined;

      let query: any = db.select({ count: count() }).from(creditTransactions);

      if (tenantId) {
        query = query.where(eq(creditTransactions.tenantId, tenantId));
      }
      if (entityId) {
        query = query.where(eq(creditTransactions.entityId, entityId));
      }
      if (transactionType) {
        query = query.where(eq(creditTransactions.transactionType, transactionType));
      }
      if (startDate) {
        query = query.where(gte(creditTransactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        query = query.where(lte(creditTransactions.createdAt, new Date(endDate)));
      }
      if (minAmount !== undefined) {
        query = query.where(gte(sql`abs(${creditTransactions.amount})`, String(minAmount)));
      }
      if (maxAmount !== undefined) {
        query = query.where(lte(sql`abs(${creditTransactions.amount})`, String(maxAmount)));
      }

      const result = await query;
      return Number(result[0]?.count ?? 0);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-credit-transactions', 'Error getting credit transaction count', { error: error.message });
      throw error;
    }
  }

  /**
   * Revoke previously allocated credits from a downstream application.
   * Reduces the org pool balance, writes an audit transaction, then emits
   * credit.revoked so the target app reduces its allocated_credits mirror.
   *
   * Failures to publish the event are logged but do not roll back the DB
   * write — the audit row + balance change is the source of truth.
   */
  static async revokeAllocatedCredits(params: {
    tenantId: string;
    entityId: string;
    targetApplication: string;
    amount: number;
    reason?: string;
    revokedBy?: string | null;
    allocationId?: string;
  }): Promise<{
    success: boolean;
    revokedAmount: number;
    previousBalance: number;
    newBalance: number;
    transactionId: string;
  }> {
    const { tenantId, entityId, targetApplication, amount, reason, revokedBy, allocationId } = params;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('revokeAllocatedCredits: amount must be a positive number');
    }
    if (!tenantId || !entityId || !targetApplication) {
      throw new Error('revokeAllocatedCredits: tenantId, entityId, and targetApplication are required');
    }

    const [existing] = await db
      .select({ availableCredits: credits.availableCredits })
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenantId),
        eq(credits.entityId, entityId),
        eq(credits.isActive, true),
      ))
      .limit(1);

    const previousBalance = Number(existing?.availableCredits ?? 0);
    // Revocation refunds the credits back to the org pool; mirror app's
    // allocated_credits gets reduced on the consumer side via the event.
    const newBalance = previousBalance + amount;
    const transactionId = randomUUID();

    if (existing) {
      await db
        .update(credits)
        .set({
          availableCredits: sql`${credits.availableCredits} + ${amount}`,
          lastUpdatedAt: new Date(),
        })
        .where(and(
          eq(credits.tenantId, tenantId),
          eq(credits.entityId, entityId),
          eq(credits.isActive, true),
        ));
    } else {
      await db
        .insert(credits)
        .values({
          tenantId,
          entityId,
          availableCredits: newBalance.toString(),
          isActive: true,
          lastUpdatedAt: new Date(),
          createdAt: new Date(),
        });
    }

    await db
      .insert(creditTransactions)
      .values({
        transactionId,
        tenantId,
        entityId,
        transactionType: 'revocation',
        amount: amount.toString(),
        previousBalance: previousBalance.toString(),
        newBalance: newBalance.toString(),
        operationCode: `admin.revoke:${targetApplication}${allocationId ? `:${allocationId}` : ''}`,
        initiatedBy: revokedBy ?? null,
        createdAt: new Date(),
      });

    Logger.log('info', 'billing', 'revoke-allocated-credits', 'Admin revoked allocated credits', {
      tenantId, entityId, targetApplication, amount, revokedBy, allocationId, reason,
    });

    // Publish credit.revoked AFTER the DB write so consumers see the
    // authoritative reduction. We do not swallow errors silently — they go
    // to the Logger so missing publishes are debuggable.
    try {
      await snsSqsPublisher.publishCreditRevoked(
        targetApplication,
        tenantId,
        entityId,
        amount,
        {
          allocationId,
          reason: reason ?? 'admin_revocation',
          revokedBy: revokedBy ?? 'system',
          transactionId,
        },
        revokedBy ?? 'system'
      );
    } catch (publishErr: unknown) {
      Logger.log('error', 'billing', 'revoke-allocated-credits', 'Failed to publish credit.revoked event', {
        tenantId, entityId, targetApplication, amount,
        error: (publishErr as Error).message,
      });
    }

    return {
      success: true,
      revokedAmount: amount,
      previousBalance,
      newBalance,
      transactionId,
    };
  }

  /**
   * Get credit summary for a specific tenant
   */
  static async getTenantCreditSummary(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const summary = await db
        .select({
          totalCredits: sql<number>`coalesce(sum(${credits.availableCredits}), 0)`,
          totalReserved: sql<number>`coalesce(sum(${(credits as any).reservedCredits}), 0)`,
          entityCount: sql<number>`count(distinct ${credits.entityId})`,
          lowBalanceCount: sql<number>`count(case when ${credits.availableCredits} < 100 then 1 end)`
        })
        .from(credits)
        .where(eq(credits.tenantId, tenantId));

      const recentTransactions = await db
        .select({
          transactionId: creditTransactions.transactionId,
          transactionType: creditTransactions.transactionType,
          amount: creditTransactions.amount,
          operationCode: creditTransactions.operationCode,
          createdAt: creditTransactions.createdAt
        })
        .from(creditTransactions)
        .where(eq(creditTransactions.tenantId, tenantId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(5);

      return {
        summary: summary[0],
        recentTransactions,
        generatedAt: new Date().toISOString()
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-tenant-credit-summary', 'Error getting tenant credit summary', { error: error.message });
      throw error;
    }
  }
}
