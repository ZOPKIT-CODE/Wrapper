import { db } from '../../../db/index.js';
import { notifications } from '../../../db/schema/index.js';
import { eq, sql, gte, lte, and } from 'drizzle-orm';
import { aiServiceFactory } from './ai/ai-service-factory.js';
import Logger from '../../../utils/logger.js';

export interface NotificationAnalyticsFilters {
  startDate?: string | Date;
  endDate?: string | Date;
  tenantId?: string;
  type?: string;
  adminUserId?: string;
}

/**
 * Notification Analytics Service
 * Tracks and analyzes notification performance metrics
 */
class NotificationAnalyticsService {
  /**
   * Get notification statistics
   */
  async getStats(filters: NotificationAnalyticsFilters = {}): Promise<Record<string, unknown>> {
    try {
      const {
        startDate,
        endDate,
        tenantId,
        type,
        adminUserId
      } = filters;

      const whereConditions = [];

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      if (tenantId) {
        whereConditions.push(eq(notifications.tenantId, tenantId));
      }

      if (type) {
        whereConditions.push(eq(notifications.type, type));
      }

      // Filter for admin-sent notifications if adminUserId provided
      if (adminUserId) {
        whereConditions.push(sql`${notifications.metadata}->>'adminUserId' = ${adminUserId}`);
      }

      const stats = await db
        .select({
          totalSent: sql`count(*)`,
          readCount: sql`count(case when ${notifications.isRead} = true then 1 end)`,
          unreadCount: sql`count(case when ${notifications.isRead} = false then 1 end)`,
          dismissedCount: sql`count(case when ${notifications.isDismissed} = true then 1 end)`,
          byType: sql`json_object_agg(${notifications.type}, count(*))`,
          byPriority: sql`json_object_agg(${notifications.priority}, count(*))`
        })
        .from(notifications)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      const result = (stats[0] || {
        totalSent: 0,
        readCount: 0,
        unreadCount: 0,
        dismissedCount: 0,
        byType: {},
        byPriority: {}
      }) as { totalSent: string | number; readCount: string | number; dismissedCount: string | number; [k: string]: unknown };

      // Calculate rates
      const total = parseInt(String(result.totalSent)) || 0;
      const read = parseInt(String(result.readCount)) || 0;
      const dismissed = parseInt(String(result.dismissedCount)) || 0;

      return {
        ...result,
        readRate: total > 0 ? (read / total) * 100 : 0,
        dismissalRate: total > 0 ? (dismissed / total) * 100 : 0,
        engagementRate: total > 0 ? ((read + dismissed) / total) * 100 : 0
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getStats', 'Error getting notification stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get delivery rates
   */
  async getDeliveryRates(filters: NotificationAnalyticsFilters = {}): Promise<Record<string, unknown>> {
    try {
      const { startDate, endDate, tenantId } = filters;

      const whereConditions = [
        sql`${notifications.metadata}->>'sentByAdmin' = 'true' OR ${notifications.metadata}->>'sentByExternalApp' = 'true'`
      ];

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      if (tenantId) {
        whereConditions.push(eq(notifications.tenantId, tenantId));
      }

      const deliveryStats = await db
        .select({
          totalSent: sql`count(*)`,
          delivered: sql`count(case when ${notifications.isActive} = true then 1 end)`,
          failed: sql`count(case when ${notifications.metadata}->>'error' is not null then 1 end)`
        })
        .from(notifications)
        .where(and(...whereConditions));

      const result = (deliveryStats[0] || { totalSent: 0, delivered: 0, failed: 0 }) as { totalSent: string | number; delivered: string | number; failed: string | number };
      const total = parseInt(String(result.totalSent)) || 0;

      return {
        totalSent: total,
        delivered: parseInt(String(result.delivered)) || 0,
        failed: parseInt(String(result.failed)) || 0,
        deliveryRate: total > 0 ? ((parseInt(String(result.delivered)) || 0) / total) * 100 : 0
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getDeliveryRates', 'Error getting delivery rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get read rates over time
   */
  async getReadRatesOverTime(filters: NotificationAnalyticsFilters = {}): Promise<{ date: unknown; total: number; read: number; readRate: number }[]> {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate = new Date(),
        tenantId
      } = filters;

      const whereConditions = [
        gte(notifications.createdAt, new Date(startDate)),
        lte(notifications.createdAt, new Date(endDate))
      ];

      if (tenantId) {
        whereConditions.push(eq(notifications.tenantId, tenantId));
      }

      const timeSeries = await db
        .select({
          date: sql`date_trunc('day', ${notifications.createdAt})`,
          total: sql`count(*)`,
          read: sql`count(case when ${notifications.isRead} = true then 1 end)`
        })
        .from(notifications)
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('day', ${notifications.createdAt})`)
        .orderBy(sql`date_trunc('day', ${notifications.createdAt})`);

      return timeSeries.map((row: { date: unknown; total: unknown; read: unknown }) => ({
        date: row.date,
        total: parseInt(String(row.total)) || 0,
        read: parseInt(String(row.read)) || 0,
        readRate: parseInt(String(row.total)) > 0 ? ((parseInt(String(row.read)) || 0) / parseInt(String(row.total))) * 100 : 0
      }));
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getReadRatesOverTime', 'Error getting read rates over time', { error: error.message });
      throw error;
    }
  }

  /**
   * Get click-through rates (if actionUrl is tracked)
   */
  async getClickThroughRates(filters: NotificationAnalyticsFilters = {}): Promise<Record<string, unknown>> {
    try {
      const { startDate, endDate, tenantId } = filters;

      const whereConditions = [
        sql`${notifications.actionUrl} is not null`
      ];

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      if (tenantId) {
        whereConditions.push(eq(notifications.tenantId, tenantId));
      }

      const ctrStats = await db
        .select({
          totalWithAction: sql`count(*)`,
          clicked: sql`count(case when ${notifications.metadata}->>'clicked' = 'true' then 1 end)`
        })
        .from(notifications)
        .where(and(...whereConditions));

      const result = (ctrStats[0] || { totalWithAction: 0, clicked: 0 }) as { totalWithAction: string | number; clicked: string | number };
      const total = parseInt(String(result.totalWithAction)) || 0;

      return {
        totalWithAction: total,
        clicked: parseInt(String(result.clicked)) || 0,
        clickThroughRate: total > 0 ? ((parseInt(String(result.clicked)) || 0) / total) * 100 : 0
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getClickThroughRates', 'Error getting click-through rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get performance metrics by type
   */
  async getPerformanceByType(filters: NotificationAnalyticsFilters = {}): Promise<{ type: string; total: number; read: number; dismissed: number; readRate: number }[]> {
    try {
      const { startDate, endDate } = filters;

      const whereConditions = [];

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      const performance = await db
        .select({
          type: notifications.type,
          total: sql`count(*)`,
          read: sql`count(case when ${notifications.isRead} = true then 1 end)`,
          dismissed: sql`count(case when ${notifications.isDismissed} = true then 1 end)`
        })
        .from(notifications)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .groupBy(notifications.type);

      return performance.map((row: { type: string; total: unknown; read: unknown; dismissed: unknown }) => ({
        type: row.type,
        total: parseInt(String(row.total)) || 0,
        read: parseInt(String(row.read)) || 0,
        dismissed: parseInt(String(row.dismissed)) || 0,
        readRate: parseInt(String(row.total)) > 0 ? ((parseInt(String(row.read)) || 0) / parseInt(String(row.total))) * 100 : 0
      }));
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getPerformanceByType', 'Error getting performance by type', { error: error.message });
      throw error;
    }
  }

  /**
   * Get AI cost statistics
   */
  async getAICostStats(_filters: NotificationAnalyticsFilters = {}): Promise<Record<string, unknown>> {
    try {
      const costStats = aiServiceFactory.getCostStats();
      return costStats;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getAICostStats', 'Error getting AI cost stats', { error: error.message });
      return {
        openai: { requests: 0, tokens: 0, cost: 0 },
        anthropic: { requests: 0, tokens: 0, cost: 0 },
        total: { requests: 0, tokens: 0, cost: 0 }
      };
    }
  }

  /**
   * Get per-application usage statistics
   */
  async getApplicationUsageStats(filters: NotificationAnalyticsFilters = {}): Promise<{ appId: unknown; appName: unknown; totalSent: number; read: number; readRate: number }[]> {
    try {
      const { startDate, endDate } = filters;

      const whereConditions = [
        sql`${notifications.metadata}->>'sentByExternalApp' = 'true'`
      ];

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      const appStats = await db
        .select({
          appId: sql`${notifications.metadata}->>'appId'`,
          appName: sql`${notifications.metadata}->>'appName'`,
          totalSent: sql`count(*)`,
          read: sql`count(case when ${notifications.isRead} = true then 1 end)`
        })
        .from(notifications)
        .where(and(...whereConditions))
        .groupBy(
          sql`${notifications.metadata}->>'appId'`,
          sql`${notifications.metadata}->>'appName'`
        );

      return appStats.map((row: { appId: unknown; appName: unknown; totalSent: unknown; read: unknown }) => ({
        appId: row.appId,
        appName: row.appName,
        totalSent: parseInt(String(row.totalSent)) || 0,
        read: parseInt(String(row.read)) || 0,
        readRate: parseInt(String(row.totalSent)) > 0 ? ((parseInt(String(row.read)) || 0) / parseInt(String(row.totalSent))) * 100 : 0
      }));
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getApplicationUsageStats', 'Error getting application usage stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  async getDashboardData(filters: NotificationAnalyticsFilters = {}): Promise<Record<string, unknown>> {
    try {
      const [
        stats,
        deliveryRates,
        readRatesOverTime,
        clickThroughRates,
        performanceByType,
        aiCosts,
        appUsage
      ] = await Promise.all([
        this.getStats(filters),
        this.getDeliveryRates(filters),
        this.getReadRatesOverTime(filters),
        this.getClickThroughRates(filters),
        this.getPerformanceByType(filters),
        this.getAICostStats(),
        this.getApplicationUsageStats(filters)
      ]);

      return {
        stats,
        deliveryRates,
        readRatesOverTime,
        clickThroughRates,
        performanceByType,
        aiCosts,
        appUsage,
        generatedAt: new Date().toISOString()
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getDashboardData', 'Error getting dashboard data', { error: error.message });
      throw error;
    }
  }
}

export const notificationAnalyticsService = new NotificationAnalyticsService();
export default notificationAnalyticsService;











