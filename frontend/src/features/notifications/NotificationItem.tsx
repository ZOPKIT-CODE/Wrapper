import React from 'react';
import { X, Check, ExternalLink, Clock, AlertTriangle, Info, CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Notification, NotificationDisplayProps, NotificationType, NotificationPriority } from './types';

const getNotificationIndicator = (type: NotificationType) => {
  switch (type) {
    case 'seasonal_credits':
      return { color: 'bg-green-500', label: 'CREDITS' };
    case 'credit_expiry_warning':
      return { color: 'bg-orange-500', label: 'EXPIRY' };
    case 'purchase_success':
      return { color: 'bg-blue-500', label: 'PURCHASE' };
    case 'plan_upgrade':
      return { color: 'bg-purple-500', label: 'UPGRADE' };
    case 'system_update':
      return { color: 'bg-indigo-500', label: 'UPDATE' };
    case 'feature_announcement':
      return { color: 'bg-pink-500', label: 'FEATURE' };
    case 'maintenance_scheduled':
      return { color: 'bg-yellow-500', label: 'MAINTENANCE' };
    case 'security_alert':
      return { color: 'bg-red-500', label: 'SECURITY' };
    case 'billing_reminder':
      return { color: 'bg-red-600', label: 'BILLING' };
    default:
      return { color: 'bg-gray-500', label: 'NOTICE' };
  }
};

const getPriorityIcon = (priority: NotificationPriority) => {
  switch (priority) {
    case 'urgent':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'high':
      return <Zap className="w-4 h-4 text-orange-500" />;
    case 'medium':
      return <Info className="w-4 h-4 text-blue-500" />;
    case 'low':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    default:
      return <Info className="w-4 h-4 text-gray-500" />;
  }
};

const getPriorityColor = (priority: NotificationPriority) => {
  switch (priority) {
    case 'urgent':
      return 'border-red-300 bg-red-50/50';
    case 'high':
      return 'border-orange-300 bg-orange-50/50';
    case 'medium':
      return 'border-blue-300 bg-blue-50/50';
    case 'low':
      return 'border-green-300 bg-green-50/50';
    default:
      return 'border-gray-300 bg-gray-50/50';
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const renderMetadataContent = (notification: Notification) => {
  const { type, metadata } = notification;

  switch (type) {
    case 'seasonal_credits':
      return metadata ? (
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <div>Credits: <span className="font-semibold text-green-600">+{metadata.allocatedCredits?.toLocaleString()}</span></div>
          {metadata.daysUntilExpiry && (
            <div>Expires: <span className="font-medium">{metadata.daysUntilExpiry === 1 ? 'Tomorrow' : `In ${metadata.daysUntilExpiry} days`}</span></div>
          )}
        </div>
      ) : null;

    case 'credit_expiry_warning':
      return metadata ? (
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <div>Credits expiring: <span className="font-semibold text-orange-600">{metadata.totalCredits?.toLocaleString()}</span></div>
          {metadata.daysUntilExpiry && (
            <div>Expires in: <span className="font-medium">{metadata.daysUntilExpiry} days</span></div>
          )}
        </div>
      ) : null;

    case 'purchase_success':
      return metadata ? (
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <div>Amount: <span className="font-semibold text-green-600">{metadata.currency} {metadata.amount}</span></div>
          {metadata.purchaseId && (
            <div>Purchase ID: <span className="font-mono text-xs">{metadata.purchaseId}</span></div>
          )}
        </div>
      ) : null;

    case 'billing_reminder':
      return metadata ? (
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <div>Amount due: <span className="font-semibold text-red-600">{metadata.currency} {metadata.amount}</span></div>
          <div>Due in: <span className="font-medium">{metadata.daysUntilDue} days</span></div>
        </div>
      ) : null;

    case 'system_update':
      return metadata ? (
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <div>Version: <span className="font-semibold">{metadata.version}</span></div>
          {metadata.features && metadata.features.length > 0 && (
            <div>New features: <span className="font-medium">{metadata.features.length}</span></div>
          )}
        </div>
      ) : null;

    default:
      return null;
  }
};

export const NotificationItem: React.FC<NotificationDisplayProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onAction
}) => {
  const handleActionClick = () => {
    if (onAction) {
      onAction(notification);
    } else if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md border-l-4",
      getPriorityColor(notification.priority)
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Notification Type Indicator */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              getNotificationIndicator(notification.type).color
            )} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getNotificationIndicator(notification.type).label}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityIcon(notification.priority)}
                  <h4 className={cn(
                    "font-semibold text-base leading-tight truncate",
                    !notification.isRead ? "text-[#1B2E5A]" : "text-gray-700"
                  )}>
                    {notification.title}
                  </h4>
                </div>

                <p className={cn(
                  "text-sm leading-relaxed mb-3",
                  !notification.isRead ? "text-gray-800" : "text-gray-600"
                )}>
                  {notification.message}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 ml-2">
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkAsRead(notification.notificationId)}
                    className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-600"
                    title="Mark as read"
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(notification.notificationId)}
                  className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Metadata content */}
            {renderMetadataContent(notification)}

            {/* Action button and timestamp */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">
                  {formatTimeAgo(notification.createdAt)}
                </span>
              </div>

              {notification.actionUrl && notification.actionLabel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleActionClick}
                  className="h-8 text-xs px-3 font-medium hover:bg-gray-50"
                >
                  {notification.actionLabel}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
