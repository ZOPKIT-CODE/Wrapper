export interface Notification {
  notificationId: string
  tenantId: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
  isRead: boolean
  isDismissed: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  expiresAt?: string
  scheduledAt?: string
  targetUserId?: string
}

export type NotificationType =
  | 'seasonal_credits'
  | 'credit_expiry_warning'
  | 'purchase_success'
  | 'plan_upgrade'
  | 'system_update'
  | 'feature_announcement'
  | 'maintenance_scheduled'
  | 'security_alert'
  | 'billing_reminder'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface NotificationDisplayProps {
  notification: Notification
  onMarkAsRead: (notificationId: string) => void
  onDismiss: (notificationId: string) => void
  onAction?: (notification: Notification) => void
}

export interface NotificationBellProps {
  unreadCount: number
  onClick: () => void
  className?: string
}

export interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAsRead: (notificationId: string) => void
  onDismiss: (notificationId: string) => void
  onMarkAllAsRead: () => void
  loading?: boolean
}
