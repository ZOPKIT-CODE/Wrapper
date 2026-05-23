import { db } from '../../../db/index.js';
import { notifications, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../../../db/schema/notifications/notifications.js';
import { and, eq, or, lt, lte, gte, desc, sql, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NewNotification } from '../../../db/schema/types.js';
import Logger from '../../../utils/logger.js';

export interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  includeRead?: boolean;
  includeDismissed?: boolean;
  type?: string | null;
  priority?: string | null;
}

class NotificationService {

  async createNotification(notificationData: NewNotification | Record<string, unknown>) {
    try {
      const {
        tenantId,
        type,
        priority = NOTIFICATION_PRIORITIES.MEDIUM,
        title,
        message,
        actionUrl,
        actionLabel,
        metadata = {},
        expiresAt,
        scheduledAt,
        targetUserId
      } = notificationData;

      const [notification] = await db
        .insert(notifications)
        .values({
          tenantId: (notificationData as Record<string, unknown>).tenantId as string,
          type: (notificationData as Record<string, unknown>).type as string,
          priority: ((notificationData as Record<string, unknown>).priority as string) ?? NOTIFICATION_PRIORITIES.MEDIUM,
          title: (notificationData as Record<string, unknown>).title as string,
          message: (notificationData as Record<string, unknown>).message as string,
          actionUrl: (notificationData as Record<string, unknown>).actionUrl as string | undefined,
          actionLabel: (notificationData as Record<string, unknown>).actionLabel as string | undefined,
          metadata: ((notificationData as Record<string, unknown>).metadata as Record<string, unknown>) ?? {},
          expiresAt: (notificationData as Record<string, unknown>).expiresAt as Date | undefined,
          scheduledAt: (notificationData as Record<string, unknown>).scheduledAt as Date | undefined,
          targetUserId: (notificationData as Record<string, unknown>).targetUserId as string | undefined
        })
        .returning();

      Logger.log('info', 'general', 'createNotification', 'Created notification', { title, tenantId });
      return notification;

    } catch (error) {
      Logger.log('error', 'general', 'createNotification', 'Error creating notification', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get notifications for a tenant/user
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID (optional, for user-specific notifications)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Notifications
   */
  async getNotifications(tenantId: string, userId: string | null = null, options: GetNotificationsOptions = {}): Promise<unknown[]> {
    try {
      const {
        limit = 50,
        offset = 0,
        includeRead = true,
        includeDismissed = false,
        type = null,
        priority = null
      } = options;

      const whereConditions: SQL[] = [
        eq(notifications.tenantId, tenantId),
        eq(notifications.isActive, true)
      ];
      if (userId) {
        const c = or(eq(notifications.targetUserId, userId), isNull(notifications.targetUserId));
        if (c) whereConditions.push(c);
      } else {
        const c = isNull(notifications.targetUserId);
        if (c) whereConditions.push(c);
      }
      if (!includeRead) whereConditions.push(eq(notifications.isRead, false));
      if (!includeDismissed) whereConditions.push(eq(notifications.isDismissed, false));
      if (type) whereConditions.push(eq(notifications.type, type));
      if (priority) whereConditions.push(eq(notifications.priority, priority));
      const expiryCond = or(isNull(notifications.expiresAt), gte(notifications.expiresAt, new Date()));
      if (expiryCond) whereConditions.push(expiryCond);

      const validConditions = whereConditions.filter((c): c is SQL => c != null);
      const notificationList = await db
        .select()
        .from(notifications)
        .where(and(...validConditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return notificationList;

    } catch (error) {
      Logger.log('error', 'general', 'getNotifications', 'Error getting notifications', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get unread notification count for a tenant/user
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID (optional)
   * @returns {Promise<number>} Count of unread notifications
   */
  async getUnreadCount(tenantId: string, userId: string | null = null): Promise<number> {
    try {
      let whereConditions = [
        eq(notifications.tenantId, tenantId),
        eq(notifications.isActive, true),
        eq(notifications.isRead, false),
        eq(notifications.isDismissed, false)
      ];

      // Filter by user
      if (userId) {
        const cond = or(
          eq(notifications.targetUserId, userId),
          isNull(notifications.targetUserId)
        );
        if (cond) whereConditions.push(cond);
      } else {
        const cond = isNull(notifications.targetUserId);
        if (cond) whereConditions.push(cond);
      }

      // Filter out expired notifications
      const expiryCond = or(
        isNull(notifications.expiresAt),
        gte(notifications.expiresAt, new Date())
      );
      if (expiryCond) whereConditions.push(expiryCond);

      const result = await db
        .select({ count: sql`count(*)` })
        .from(notifications)
        .where(and(...whereConditions));

      return parseInt(String(result[0].count ?? 0), 10) || 0;

    } catch (error) {
      Logger.log('error', 'general', 'getUnreadCount', 'Error getting unread notification count', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} tenantId - Tenant ID (for security)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId: string, tenantId: string) {
    try {
      const [notification] = await db
        .update(notifications)
        .set({
          isRead: true,
          updatedAt: new Date()
        })
        .where(and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.tenantId, tenantId)
        ))
        .returning();

      if (notification) {
        Logger.log('info', 'general', 'markAsRead', 'Marked notification as read', { notificationId });
      }

      return notification;

    } catch (error) {
      Logger.log('error', 'general', 'markAsRead', 'Error marking notification as read', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Mark notification as dismissed
   * @param {string} notificationId - Notification ID
   * @param {string} tenantId - Tenant ID (for security)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsDismissed(notificationId: string, tenantId: string) {
    try {
      const [notification] = await db
        .update(notifications)
        .set({
          isDismissed: true,
          updatedAt: new Date()
        })
        .where(and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.tenantId, tenantId)
        ))
        .returning();

      if (notification) {
        Logger.log('info', 'general', 'markAsDismissed', 'Dismissed notification', { notificationId });
      }

      return notification;

    } catch (error) {
      Logger.log('error', 'general', 'markAsDismissed', 'Error dismissing notification', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a tenant/user
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID (optional)
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(tenantId: string, userId: string | null = null): Promise<number> {
    try {
      let whereConditions = [
        eq(notifications.tenantId, tenantId),
        eq(notifications.isActive, true),
        eq(notifications.isRead, false),
        eq(notifications.isDismissed, false)
      ];

      // Filter by user
      if (userId) {
        const cond = or(
          eq(notifications.targetUserId, userId),
          isNull(notifications.targetUserId)
        );
        if (cond) whereConditions.push(cond);
      } else {
        const cond = isNull(notifications.targetUserId);
        if (cond) whereConditions.push(cond);
      }

      const validConditions = whereConditions.filter((c): c is SQL => c != null);
      const result = await db
        .update(notifications)
        .set({
          isRead: true,
          updatedAt: new Date()
        })
        .where(and(...validConditions))
        .returning();

      Logger.log('info', 'general', 'markAllAsRead', 'Marked notifications as read', { count: result.length, tenantId });
      return result.length;

    } catch (error) {
      Logger.log('error', 'general', 'markAllAsRead', 'Error marking all notifications as read', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete expired notifications
   * @returns {Promise<number>} Number of notifications deleted
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await db
        .delete(notifications)
        .where(and(
          lt(notifications.expiresAt, new Date()),
          eq(notifications.isActive, true)
        ))
        .returning();

      Logger.log('info', 'general', 'cleanupExpiredNotifications', 'Cleaned up expired notifications', { count: result.length });
      return result.length;

    } catch (error) {
      Logger.log('error', 'general', 'cleanupExpiredNotifications', 'Error cleaning up expired notifications', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create a seasonal credit notification
   * @param {string} tenantId - Tenant ID
   * @param {Object} creditData - Credit allocation data
   * @returns {Promise<Object>} Created notification
   */
  async createSeasonalCreditNotification(tenantId: string, creditData: Record<string, unknown>) {
    const { campaignName, campaignId, allocatedCredits, creditType, expiresAt, applications = [] } = creditData;
    const creditsNum = Number(allocatedCredits);
    const creditTypeStr = String(creditType ?? '');
    const emoji = this.getCreditTypeEmoji(creditTypeStr);
    const title = `${emoji} Credits Added to Your Account`;
    const message = `You've received ${creditsNum.toLocaleString()} ${String(campaignName ?? '')} credits!`;
    const actionUrl = '/dashboard?tab=credits';
    const actionLabel = 'View Credits';

    const expiresDate = new Date(expiresAt as string | Date);
    const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    Logger.log('info', 'general', 'createSeasonalCreditNotification', 'Creating seasonal credit notification', {
      tenantId,
      title,
      message,
      creditType: creditTypeStr,
      allocatedCredits: creditsNum,
      campaignName
    });

    const notificationData = {
      tenantId,
      type: NOTIFICATION_TYPES.SEASONAL_CREDITS,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata: {
        campaignId,
        campaignName,
        allocatedCredits: creditsNum,
        creditType: creditTypeStr,
        expiresAt,
        daysUntilExpiry,
        applications
      },
      expiresAt: expiresDate,
      targetUserId: null // Explicitly set to null to ensure it's a general notification
    };

    Logger.log('info', 'general', 'createSeasonalCreditNotification', 'Notification data prepared', { notificationData });

    const result = await this.createNotification(notificationData);
    Logger.log('info', 'general', 'createSeasonalCreditNotification', 'Notification created successfully');
    return result;
  }

  /**
   * Create a purchase success notification
   * @param {string} tenantId - Tenant ID
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Created notification
   */
  async createPurchaseNotification(tenantId: string, purchaseData: Record<string, unknown>) {
    const { itemName, amount, currency = 'USD', purchaseId } = purchaseData;

    const title = '🎉 Purchase Successful';
    const message = `Your purchase of ${itemName} for ${currency} ${amount} has been completed!`;
    const actionUrl = '/dashboard?tab=billing';
    const actionLabel = 'View Receipt';

    return this.createNotification({
      tenantId,
      type: NOTIFICATION_TYPES.PURCHASE_SUCCESS,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata: {
        itemName,
        amount,
        currency,
        purchaseId
      }
    });
  }

  /**
   * Create a credit expiry warning notification
   * @param {string} tenantId - Tenant ID
   * @param {Object} expiryData - Expiry warning data
   * @returns {Promise<Object>} Created notification
   */
  async createExpiryWarningNotification(tenantId: string, expiryData: Record<string, unknown>) {
    const { credits, daysUntilExpiry } = expiryData as { credits: { availableCredits: number }[]; daysUntilExpiry: number };
    const totalCredits = (credits ?? []).reduce((sum: number, c: { availableCredits: number }) => sum + c.availableCredits, 0);

    const title = '⏰ Credits Expiring Soon';
    const message = `${totalCredits.toLocaleString()} credits will expire in ${daysUntilExpiry} days`;
    const actionUrl = '/dashboard?tab=credits';
    const actionLabel = 'View Credits';

    const priority = daysUntilExpiry <= 3 ? NOTIFICATION_PRIORITIES.HIGH :
                    daysUntilExpiry <= 7 ? NOTIFICATION_PRIORITIES.MEDIUM :
                    NOTIFICATION_PRIORITIES.LOW;

    return this.createNotification({
      tenantId,
      type: NOTIFICATION_TYPES.CREDIT_EXPIRY_WARNING,
      priority,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata: {
        credits,
        daysUntilExpiry,
        totalCredits
      },
      expiresAt: new Date(Date.now() + (daysUntilExpiry * 24 * 60 * 60 * 1000))
    });
  }

  /**
   * Create a system update notification
   * @param {string} tenantId - Tenant ID
   * @param {Object} updateData - Update information
   * @returns {Promise<Object>} Created notification
   */
  async createSystemUpdateNotification(tenantId: string, updateData: Record<string, unknown>) {
    const { version, features = [], scheduledAt } = updateData;

    const title = '🚀 System Update Available';
    const message = `New version ${version} is now available with exciting new features!`;
    const actionUrl = '/dashboard?tab=settings';
    const actionLabel = 'View Details';

    return this.createNotification({
      tenantId,
      type: NOTIFICATION_TYPES.SYSTEM_UPDATE,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata: {
        version,
        features,
        scheduledAt
      },
      scheduledAt
    });
  }

  /**
   * Create a billing reminder notification
   * @param {string} tenantId - Tenant ID
   * @param {Object} billingData - Billing reminder data
   * @returns {Promise<Object>} Created notification
   */
  async createBillingReminderNotification(tenantId: string, billingData: Record<string, unknown>) {
    const { daysUntilDue, amount, currency = 'USD' } = billingData;
    const days = Number(daysUntilDue);
    const amt = amount;
    const curr = String(currency ?? 'USD');

    const title = '💳 Payment Due Soon';
    const message = `Your payment of ${curr} ${amt} is due in ${days} days`;
    const actionUrl = '/dashboard?tab=billing';
    const actionLabel = 'Pay Now';

    const priority = days <= 3 ? NOTIFICATION_PRIORITIES.URGENT :
                    days <= 7 ? NOTIFICATION_PRIORITIES.HIGH :
                    NOTIFICATION_PRIORITIES.MEDIUM;

    return this.createNotification({
      tenantId,
      type: NOTIFICATION_TYPES.BILLING_REMINDER,
      priority,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata: {
        daysUntilDue: days,
        amount: amt,
        currency: curr
      }
    });
  }

  /**
   * Bulk create notifications
   * @param {Array<Object>} notificationsData - Array of notification data objects
   * @returns {Promise<Array>} Created notifications
   */
  async bulkCreateNotifications(notificationsData: Record<string, unknown>[]) {
    try {
      if (!Array.isArray(notificationsData) || notificationsData.length === 0) {
        throw new Error('Notifications data must be a non-empty array');
      }

      // Batch insert in chunks of 100 to avoid overwhelming the database
      const batchSize = 100;
      const allNotifications = [];

      for (let i = 0; i < notificationsData.length; i += batchSize) {
        const batch = notificationsData.slice(i, i + batchSize);
        
        const created = await db
          .insert(notifications)
          .values(batch.map((data: Record<string, unknown>) => ({
            tenantId: String(data.tenantId ?? ''),
            type: (data.type as string) || NOTIFICATION_TYPES.SYSTEM_UPDATE,
            priority: (data.priority as string) || NOTIFICATION_PRIORITIES.MEDIUM,
            title: String(data.title ?? ''),
            message: String(data.message ?? ''),
            actionUrl: (data.actionUrl as string) ?? undefined,
            actionLabel: (data.actionLabel as string) ?? undefined,
            metadata: (data.metadata as Record<string, unknown>) || {},
            expiresAt: data.expiresAt ? new Date(data.expiresAt as string | Date) : null,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt as string | Date) : null,
            targetUserId: (data.targetUserId as string) ?? null
          })))
          .returning();

        allNotifications.push(...created);
      }

      Logger.log('info', 'general', 'bulkCreateNotifications', 'Bulk created notifications', { count: allNotifications.length });
      return allNotifications;

    } catch (error) {
      Logger.log('error', 'general', 'bulkCreateNotifications', 'Error bulk creating notifications', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Send notification to multiple tenants
   * @param {Array<string>} tenantIds - Array of tenant IDs
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Result with sent count and notifications
   */
  async sendToTenants(tenantIds: string[], notificationData: Record<string, unknown>) {
    try {
      const notificationsToCreate = tenantIds.map((tenantId: string) => ({
        tenantId,
        ...notificationData
      }));

      const createdNotifications = await this.bulkCreateNotifications(notificationsToCreate);

      return {
        sentCount: createdNotifications.length,
        totalTenants: tenantIds.length,
        notifications: createdNotifications
      };
    } catch (error) {
      Logger.log('error', 'general', 'sendToTenants', 'Error sending notifications to tenants', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get notification statistics for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Statistics
   */
  async getNotificationStats(tenantId: string, options: { startDate?: string | Date; endDate?: string | Date } = {}): Promise<Record<string, unknown>> {
    try {
      const { startDate, endDate } = options;

      const whereConditions = [
        eq(notifications.tenantId, tenantId),
        eq(notifications.isActive, true)
      ];

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      const stats = await db
        .select({
          total: sql`count(*)`,
          unread: sql`count(case when ${notifications.isRead} = false then 1 end)`,
          read: sql`count(case when ${notifications.isRead} = true then 1 end)`,
          dismissed: sql`count(case when ${notifications.isDismissed} = true then 1 end)`,
          byType: sql`json_object_agg(${notifications.type}, count(*))`,
          byPriority: sql`json_object_agg(${notifications.priority}, count(*))`
        })
        .from(notifications)
        .where(and(...whereConditions));

      return stats[0] || {
        total: 0,
        unread: 0,
        read: 0,
        dismissed: 0,
        byType: {},
        byPriority: {}
      };
    } catch (error) {
      Logger.log('error', 'general', 'getNotificationStats', 'Error getting notification stats', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get sent notifications history (admin)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} History with pagination
   */
  async getSentNotificationsHistory(filters: {
    page?: number;
    limit?: number;
    tenantId?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    type?: string;
    adminUserId?: string;
  } = {}): Promise<Record<string, unknown>> {
    try {
      const {
        page = 1,
        limit = 50,
        tenantId,
        startDate,
        endDate,
        type,
        adminUserId
      } = filters;

      const offset = (page - 1) * limit;
      const whereConditions = [
        sql`${notifications.metadata}->>'sentByAdmin' = 'true'`
      ];

      if (tenantId) {
        whereConditions.push(eq(notifications.tenantId, tenantId));
      }

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      if (type) {
        whereConditions.push(eq(notifications.type, type));
      }

      if (adminUserId) {
        whereConditions.push(sql`${notifications.metadata}->>'adminUserId' = ${adminUserId}`);
      }

      const validWhere = whereConditions.filter((c): c is SQL => c != null);
      const [notificationsList, totalResult] = await Promise.all([
        db
          .select()
          .from(notifications)
          .where(and(...validWhere))
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql`count(*)` })
          .from(notifications)
          .where(and(...validWhere))
      ]);

      const total = parseInt(String(totalResult[0]?.count ?? 0), 10);

      return {
        notifications: notificationsList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      Logger.log('error', 'general', 'getSentNotificationsHistory', 'Error getting sent notifications history', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Helper function to get emoji for credit type
   * @param {string} creditType - Credit type
   * @returns {string} Emoji
   */
  getCreditTypeEmoji(creditType: string): string {
    switch (creditType) {
      case 'seasonal': return '🎄';
      case 'bonus': return '🎁';
      case 'promotional': return '📢';
      case 'event': return '🎉';
      case 'partnership': return '🤝';
      case 'trial_extension': return '⏰';
      default: return '💰';
    }
  }
}

export { NotificationService };
export default NotificationService;



