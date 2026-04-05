import { pgTable, text, timestamp, boolean, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';

/**
 * Notification types supported by the system
 */
export const NOTIFICATION_TYPES = {
  SEASONAL_CREDITS: 'seasonal_credits',
  CREDIT_EXPIRY_WARNING: 'credit_expiry_warning',
  PURCHASE_SUCCESS: 'purchase_success',
  PLAN_UPGRADE: 'plan_upgrade',
  SYSTEM_UPDATE: 'system_update',
  FEATURE_ANNOUNCEMENT: 'feature_announcement',
  MAINTENANCE_SCHEDULED: 'maintenance_scheduled',
  SECURITY_ALERT: 'security_alert',
  BILLING_REMINDER: 'billing_reminder'
};

/**
 * Notification priorities
 */
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

/**
 * Notifications table
 * Stores all notifications for tenants and their users
 */
export const notifications = pgTable('notifications', {
  notificationId: uuid('notification_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Notification metadata
  type: text('type').notNull(), // e.g., 'seasonal_credits', 'purchase_success'
  priority: text('priority').default('medium').notNull(), // 'low', 'medium', 'high', 'urgent'
  title: text('title').notNull(),
  message: text('message').notNull(),
  actionUrl: text('action_url'), // Optional URL to navigate to when clicked
  actionLabel: text('action_label'), // Optional label for the action button

  // Additional data for specific notification types
  metadata: jsonb('metadata'), // Flexible JSON data for notification-specific information

  // Status and visibility
  isRead: boolean('is_read').default(false).notNull(),
  isDismissed: boolean('is_dismissed').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Timing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional expiration date
  scheduledAt: timestamp('scheduled_at'), // For scheduled notifications

  // Target user (null means all users in tenant)
  targetUserId: uuid('target_user_id'), // If null, notification is for all tenant users
}, (table) => ({
  tenantIdIdx: index('idx_notifications_tenant_id').on(table.tenantId),
  typeIdx: index('idx_notifications_type').on(table.type),
  priorityIdx: index('idx_notifications_priority').on(table.priority),
  isReadIdx: index('idx_notifications_is_read').on(table.isRead),
  isDismissedIdx: index('idx_notifications_is_dismissed').on(table.isDismissed),
  isActiveIdx: index('idx_notifications_is_active').on(table.isActive),
  createdAtIdx: index('idx_notifications_created_at').on(table.createdAt),
  expiresAtIdx: index('idx_notifications_expires_at').on(table.expiresAt),
  scheduledAtIdx: index('idx_notifications_scheduled_at').on(table.scheduledAt),
  targetUserIdIdx: index('idx_notifications_target_user_id').on(table.targetUserId),
}));

// Indexes for efficient querying
export const notificationsIndexes = {
  tenantId: 'idx_notifications_tenant_id',
  type: 'idx_notifications_type',
  priority: 'idx_notifications_priority',
  isRead: 'idx_notifications_is_read',
  isDismissed: 'idx_notifications_is_dismissed',
  isActive: 'idx_notifications_is_active',
  createdAt: 'idx_notifications_created_at',
  expiresAt: 'idx_notifications_expires_at',
  scheduledAt: 'idx_notifications_scheduled_at',
  targetUserId: 'idx_notifications_target_user_id'
};
