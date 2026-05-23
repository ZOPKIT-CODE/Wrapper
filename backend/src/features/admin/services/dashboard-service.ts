/**
 * Admin Dashboard Service - Independent service for dashboard data aggregation
 * Provides comprehensive business logic without modifying existing services
 */

import { db } from '../../../db/index.js';
import { tenants, entities, credits, creditTransactions, subscriptions } from '../../../db/schema/index.js';
import { eq, desc, sql, count, sum, gte, and } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

export class DashboardService {
  /**
   * Get comprehensive dashboard overview statistics
   */
  static async getOverviewStats() {
    try {
      // Get tenant statistics
      const tenantStats = await db
        .select({
          total: count(),
          active: sql<number>`count(case when ${tenants.isActive} = true then 1 end)`,
          trial: sql<number>`count(case when s.trial_ends_at > now() then 1 end)`,
          paid: sql<number>`count(case when s.trial_ends_at is null or s.trial_ends_at < now() then 1 end)`
        })
        .from(tenants)
        .leftJoin(subscriptions, eq(tenants.tenantId, subscriptions.tenantId));

      // Get entity statistics
      const entityStats = await db
        .select({
          total: count(),
          organizations: sql<number>`count(case when ${entities.entityType} = 'organization' then 1 end)`,
          locations: sql<number>`count(case when ${entities.entityType} = 'location' then 1 end)`,
          departments: sql<number>`count(case when ${entities.entityType} = 'department' then 1 end)`,
          teams: sql<number>`count(case when ${entities.entityType} = 'team' then 1 end)`
        })
        .from(entities);

      // Get credit statistics
      const creditStats = await db
        .select({
          totalCredits: sum(credits.availableCredits),
          totalReserved: sum((credits as any).reservedCredits ?? credits.availableCredits),
          activeEntities: sql<number>`count(case when ${credits.isActive} = true then 1 end)`
        })
        .from(credits);

      // Get low balance alerts count
      const lowBalanceCount = await db
        .select({ count: count() })
        .from(credits)
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} < 100`
        ));

      return {
        tenantStats: tenantStats[0],
        entityStats: entityStats[0],
        creditStats: {
          totalCredits: parseFloat(String(creditStats[0]?.totalCredits ?? 0)),
          totalReserved: parseFloat(String(creditStats[0]?.totalReserved ?? 0)),
          activeEntities: creditStats[0]?.activeEntities || 0,
          lowBalanceAlerts: lowBalanceCount[0]?.count || 0
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-dashboard-stats', 'Error getting dashboard overview stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recent activity across the platform
   */
  static async getRecentActivity(limit = 20) {
    try {
      const activities = [];

      // Recent tenant creations
      const recentTenants = await db
        .select({
          id: tenants.tenantId,
          type: sql<string>`'tenant_created'`,
          title: sql<string>`'New Tenant Created'`,
          description: sql<string>`concat('Tenant "', ${tenants.companyName}, '" was created')`,
          tenantName: tenants.companyName,
          timestamp: tenants.createdAt,
          metadata: sql`json_build_object('tenantId', ${tenants.tenantId}, 'subdomain', ${tenants.subdomain})`
        })
        .from(tenants)
        .orderBy(desc(tenants.createdAt))
        .limit(5);

      // Recent entity creations
      const recentEntities = await db
        .select({
          id: entities.entityId,
          type: sql<string>`'entity_created'`,
          title: sql<string>`'New Entity Created'`,
          description: sql<string>`concat(${entities.entityType}, ' "', ${entities.entityName}, '" was created')`,
          tenantName: tenants.companyName,
          timestamp: entities.createdAt,
          metadata: sql`json_build_object('entityId', ${entities.entityId}, 'entityType', ${entities.entityType}, 'tenantId', ${entities.tenantId})`
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .orderBy(desc(entities.createdAt))
        .limit(5);

      // Recent credit transactions
      const recentTransactions = await db
        .select({
          id: creditTransactions.transactionId,
          type: sql<string>`'credit_transaction'`,
          title: sql<string>`concat(upper(${creditTransactions.transactionType}), ' Transaction')`,
          description: sql<string>`concat('Credit ', ${creditTransactions.transactionType}, ' of ', abs(${creditTransactions.amount}), ' for operation ', ${creditTransactions.operationCode})`,
          tenantName: tenants.companyName,
          timestamp: creditTransactions.createdAt,
          metadata: sql`json_build_object('transactionId', ${creditTransactions.transactionId}, 'amount', ${creditTransactions.amount}, 'operationCode', ${creditTransactions.operationCode})`
        })
        .from(creditTransactions)
        .innerJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(10);

      // Combine and sort all activities
      activities.push(...recentTenants, ...recentEntities, ...recentTransactions);

      activities.sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

      return activities.slice(0, limit);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-recent-activity', 'Error getting recent activity', { error: error.message });
      throw error;
    }
  }

  /**
   * Get dashboard metrics for charts and graphs
   */
  static async getDashboardMetrics(timeRange = '30d') {
    try {
      const endDate = new Date();
      const startDate = new Date();

      // Calculate date range
      switch (timeRange) {
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

      // Tenant growth over time
      const tenantGrowth = await db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${tenants.createdAt}), 'YYYY-MM-DD')`,
          count: count()
        })
        .from(tenants)
        .where(gte(tenants.createdAt, startDate))
        .groupBy(sql`date_trunc('day', ${tenants.createdAt})`)
        .orderBy(sql`date_trunc('day', ${tenants.createdAt})`);

      // Entity growth over time
      const entityGrowth = await db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${entities.createdAt}), 'YYYY-MM-DD')`,
          count: count()
        })
        .from(entities)
        .where(gte(entities.createdAt, startDate))
        .groupBy(sql`date_trunc('day', ${entities.createdAt})`)
        .orderBy(sql`date_trunc('day', ${entities.createdAt})`);

      // Credit usage over time
      const creditUsage = await db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${creditTransactions.createdAt}), 'YYYY-MM-DD')`,
          totalUsed: sql<number>`abs(sum(case when ${creditTransactions.transactionType} = 'consumption' then ${creditTransactions.amount} else 0 end))`,
          totalAdded: sql<number>`sum(case when ${creditTransactions.transactionType} = 'purchase' then ${creditTransactions.amount} else 0 end)`
        })
        .from(creditTransactions)
        .where(gte(creditTransactions.createdAt, startDate))
        .groupBy(sql`date_trunc('day', ${creditTransactions.createdAt})`)
        .orderBy(sql`date_trunc('day', ${creditTransactions.createdAt})`);

      return {
        tenantGrowth,
        entityGrowth,
        creditUsage,
        timeRange,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-dashboard-metrics', 'Error getting dashboard metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get system health indicators
   */
  static async getSystemHealth() {
    try {
      const health: {
        database: { status: string; message: string };
        activeConnections: number;
        lastBackup: null;
        alerts: { level: string; message: string; count: number }[];
      } = {
        database: { status: 'healthy', message: 'Database connection OK' },
        activeConnections: 0,
        lastBackup: null,
        alerts: []
      };

      // Check for critical issues
      const criticalCredits = await db
        .select({ count: count() })
        .from(credits)
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} < 10`
        ));

      if (criticalCredits[0]?.count > 0) {
        health.alerts.push({
          level: 'critical',
          message: `${criticalCredits[0].count} entities have critically low credit balances (< 10)`,
          count: criticalCredits[0].count
        });
      }

      // Check for inactive tenants
      const inactiveTenants = await db
        .select({ count: count() })
        .from(tenants)
        .where(eq(tenants.isActive, false));

      if (inactiveTenants[0]?.count > 0) {
        health.alerts.push({
          level: 'warning',
          message: `${inactiveTenants[0].count} tenants are currently inactive`,
          count: inactiveTenants[0].count
        });
      }

      return health;
    } catch (err: unknown) {
      Logger.log('error', 'general', 'get-system-health', 'Error getting system health', { error: (err as Error).message });
      return {
        database: { status: 'error', message: 'Database connection failed' },
        alerts: [{
          level: 'critical',
          message: 'Unable to connect to database',
          count: 1
        }]
      };
    }
  }

  /**
   * Get comprehensive dashboard data in one call
   */
  static async getFullDashboard(timeRange = '30d') {
    try {
      const [overview, recentActivity, metrics, health] = await Promise.all([
        this.getOverviewStats(),
        this.getRecentActivity(15),
        this.getDashboardMetrics(timeRange),
        this.getSystemHealth()
      ]);

      return {
        overview,
        recentActivity,
        metrics,
        health,
        generatedAt: new Date().toISOString()
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-full-dashboard', 'Error getting full dashboard', { error: error.message });
      throw error;
    }
  }
}
