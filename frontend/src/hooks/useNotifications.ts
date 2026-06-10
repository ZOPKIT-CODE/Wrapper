import { useCallback } from 'react'
import { NotificationService } from '@/services/notificationService'
import {
  useNotifications as useNotificationsQuery,
  useUnreadCount as useUnreadCountQuery,
  useInvalidateQueries,
} from '@/hooks/useSharedQueries'
import { toast } from 'sonner'

export const useNotifications = () => {
  // Use shared hooks with caching instead of direct API calls
  const {
    data: notifications = [],
    isLoading: loading,
    error: notificationsError,
    refetch: refetchNotifications,
  } = useNotificationsQuery({})
  const { data: unreadCount = 0 } = useUnreadCountQuery()
  const { invalidateNotifications, invalidateUnreadCount } =
    useInvalidateQueries()

  // Load notifications (now uses cached hook)
  const loadNotifications = useCallback(
    async (_options = {}) => {
      invalidateNotifications()
      await refetchNotifications()
    },
    [invalidateNotifications, refetchNotifications]
  )

  // Load unread count (derived from the notifications cache)
  const loadUnreadCount = useCallback(async () => {
    invalidateUnreadCount()
    await refetchNotifications()
  }, [invalidateUnreadCount, refetchNotifications])

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const updatedNotification =
          await NotificationService.markAsRead(notificationId)

        // Invalidate cached queries to refresh data
        invalidateNotifications()
        invalidateUnreadCount()
        await refetchNotifications()

        return updatedNotification
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
        toast.error('Failed to mark notification as read')
        throw err
      }
    },
    [invalidateNotifications, invalidateUnreadCount, refetchNotifications]
  )

  // Mark notification as dismissed
  const markAsDismissed = useCallback(
    async (notificationId: string) => {
      try {
        const updatedNotification =
          await NotificationService.markAsDismissed(notificationId)

        // Invalidate cached queries
        invalidateNotifications()
        await refetchNotifications()

        return updatedNotification
      } catch (err) {
        console.error('Failed to dismiss notification:', err)
        toast.error('Failed to dismiss notification')
        throw err
      }
    },
    [invalidateNotifications, refetchNotifications]
  )

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const result = await NotificationService.markAllAsRead()

      // Invalidate cached queries
      invalidateNotifications()
      invalidateUnreadCount()
      await refetchNotifications()

      return result
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
      toast.error('Failed to mark all notifications as read')
      throw err
    }
  }, [invalidateNotifications, invalidateUnreadCount, refetchNotifications])

  // Create test notification
  const createTestNotification = useCallback(
    async (data = {}) => {
      try {
        const notification =
          await NotificationService.createTestNotification(data)

        // Invalidate cached queries
        invalidateNotifications()
        invalidateUnreadCount()

        return notification
      } catch (err) {
        console.error('Failed to create test notification:', err)
        toast.error('Failed to create test notification')
        throw err
      }
    },
    [invalidateNotifications, invalidateUnreadCount]
  )

  return {
    notifications,
    unreadCount,
    loading,
    error: notificationsError ? 'Failed to load notifications' : null,
    loadNotifications,
    loadUnreadCount,
    markAsRead,
    markAsDismissed,
    markAllAsRead,
    createTestNotification,
  }
}
