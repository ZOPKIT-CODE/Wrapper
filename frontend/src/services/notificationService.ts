import api from '@/lib/api';
import { Notification } from '@/features/notifications/types';

export class NotificationService {
  /**
   * Get notifications for the current tenant/user
   */
  static async getNotifications(options: {
    limit?: number;
    offset?: number;
    includeRead?: boolean;
    includeDismissed?: boolean;
    type?: string;
    priority?: string;
  } = {}): Promise<Notification[]> {
    try {
      const params = new URLSearchParams();

      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.includeRead !== undefined) params.append('includeRead', options.includeRead.toString());
      if (options.includeDismissed !== undefined) params.append('includeDismissed', options.includeDismissed.toString());
      if (options.type) params.append('type', options.type);
      if (options.priority) params.append('priority', options.priority);

      const response = await api.get(`/notifications?${params.toString()}`);

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Failed to fetch notifications');
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(): Promise<number> {
    try {
      const response = await api.get('/notifications/unread-count');

      if (response.data.success) {
        return response.data.data.count;
      }

      return 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Failed to mark notification as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark notification as dismissed
   */
  static async markAsDismissed(notificationId: string): Promise<Notification> {
    try {
      const response = await api.put(`/notifications/${notificationId}/dismiss`);

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Failed to dismiss notification');
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<{ markedAsRead: number }> {
    try {
      const response = await api.put('/notifications/mark-all-read');

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Failed to mark all notifications as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Create a test notification (development only)
   */
  static async createTestNotification(data: {
    type?: string;
    title?: string;
    message?: string;
    priority?: string;
  }): Promise<Notification> {
    try {
      const response = await api.post('/notifications/test', data);

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Failed to create test notification');
    } catch (error) {
      console.error('Error creating test notification:', error);
      throw error;
    }
  }

  /**
   * Create sample notifications for testing
   */
  static async createSampleNotifications(): Promise<void> {
    const samples = [
      {
        type: 'seasonal_credits',
        title: '🎄 Holiday Credits Available!',
        message: 'You\'ve received 500 holiday credits to use across all your applications.',
        priority: 'medium'
      },
      {
        type: 'system_update',
        title: '🚀 New Features Released',
        message: 'Check out the latest updates including improved analytics and enhanced security.',
        priority: 'low'
      },
      {
        type: 'billing_reminder',
        title: '💳 Payment Due Soon',
        message: 'Your subscription payment of $29.99 is due in 5 days.',
        priority: 'high'
      },
      {
        type: 'credit_expiry_warning',
        title: '⏰ Credits Expiring Soon',
        message: '1,200 credits will expire in 3 days. Use them before they\'re gone!',
        priority: 'urgent'
      }
    ];

    for (const sample of samples) {
      try {
        await this.createTestNotification(sample);
      } catch (error) {
        console.warn('Failed to create sample notification:', error);
      }
    }
  }
}
