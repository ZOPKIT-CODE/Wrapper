import React from 'react';
import {
  X, Check, ExternalLink, Clock, AlertTriangle, ShieldAlert,
  Zap, CreditCard, RefreshCw, Megaphone, Wrench, Coins, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Notification, NotificationDisplayProps, NotificationType } from './types';

// ─── Type config ──────────────────────────────────────────────────────────────

interface TypeConfig {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent: string;      // left border + subtle bg tint
  badge: string;       // pill label color
  label: string;
}

const TYPE_CONFIG: Record<NotificationType | 'default', TypeConfig> = {
  seasonal_credits: {
    icon: Coins,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accent: 'border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Credits',
  },
  credit_expiry_warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accent: 'border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Expiry',
  },
  purchase_success: {
    icon: CreditCard,
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accent: 'border-l-blue-400 bg-blue-50/40 dark:bg-blue-900/10',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    label: 'Purchase',
  },
  plan_upgrade: {
    icon: Zap,
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    accent: 'border-l-purple-400 bg-purple-50/40 dark:bg-purple-900/10',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    label: 'Upgrade',
  },
  system_update: {
    icon: RefreshCw,
    iconBg: 'bg-sky-100 dark:bg-sky-900/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
    accent: 'border-l-sky-400 bg-sky-50/40 dark:bg-sky-900/10',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    label: 'Update',
  },
  feature_announcement: {
    icon: Megaphone,
    iconBg: 'bg-pink-100 dark:bg-pink-900/40',
    iconColor: 'text-pink-600 dark:text-pink-400',
    accent: 'border-l-pink-400 bg-pink-50/40 dark:bg-pink-900/10',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    label: 'Feature',
  },
  maintenance_scheduled: {
    icon: Wrench,
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    accent: 'border-l-yellow-400 bg-yellow-50/40 dark:bg-yellow-900/10',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    label: 'Maintenance',
  },
  security_alert: {
    icon: ShieldAlert,
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    accent: 'border-l-red-400 bg-red-50/40 dark:bg-red-900/10',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Security',
  },
  billing_reminder: {
    icon: CreditCard,
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    accent: 'border-l-rose-400 bg-rose-50/40 dark:bg-rose-900/10',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    label: 'Billing',
  },
  default: {
    icon: Bell,
    iconBg: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-500 dark:text-gray-400',
    accent: 'border-l-gray-300 bg-gray-50/40 dark:bg-gray-800/20',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    label: 'Notice',
  },
};

function getConfig(type: NotificationType): TypeConfig {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.default;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimeAgo = (dateString: string) => {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const daysUntil = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
};

// ─── Metadata chips ───────────────────────────────────────────────────────────

function MetadataChips({ notification }: { notification: Notification }) {
  const { type, metadata } = notification;
  if (!metadata) return null;

  if (type === 'seasonal_credits') {
    const amount = (metadata as any).creditAmount ?? (metadata as any).allocatedCredits;
    const expiresAt = (metadata as any).expiresAt;
    const days = expiresAt ? daysUntil(String(expiresAt)) : null;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {amount != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Coins className="w-3.5 h-3.5" />
            +{Number(amount).toLocaleString()} credits
          </span>
        )}
        {days !== null && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
            days <= 3
              ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
              : days <= 7
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          )}>
            <Clock className="w-3 h-3" />
            Expires in {days}d
          </span>
        )}
        {days === null && expiresAt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Expired
          </span>
        )}
      </div>
    );
  }

  if (type === 'credit_expiry_warning') {
    const total = (metadata as any).totalCredits ?? (metadata as any).creditAmount;
    const days = (metadata as any).daysUntilExpiry;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {total != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Coins className="w-3.5 h-3.5" />
            {Number(total).toLocaleString()} credits expiring
          </span>
        )}
        {days != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-900/40 dark:text-red-300">
            <Clock className="w-3 h-3" />
            In {days} day{days !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  if (type === 'purchase_success') {
    const { currency, amount, purchaseId } = metadata as any;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {amount != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {currency} {amount}
          </span>
        )}
        {purchaseId && (
          <span className="font-mono text-xs text-gray-400">{String(purchaseId).slice(0, 12)}…</span>
        )}
      </div>
    );
  }

  if (type === 'billing_reminder') {
    const { currency, amount, daysUntilDue } = metadata as any;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {amount != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            {currency} {amount} due
          </span>
        )}
        {daysUntilDue != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-900/40 dark:text-red-300">
            <Clock className="w-3 h-3" />
            In {daysUntilDue} days
          </span>
        )}
      </div>
    );
  }

  if (type === 'system_update') {
    const { version, features } = metadata as any;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {version && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            v{version}
          </span>
        )}
        {features?.length > 0 && (
          <span className="text-xs text-gray-500">{features.length} new feature{features.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const NotificationItem: React.FC<NotificationDisplayProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onAction,
}) => {
  const cfg = getConfig(notification.type);
  const Icon = cfg.icon;

  const handleAction = () => {
    if (onAction) onAction(notification);
    else if (notification.actionUrl) window.location.href = notification.actionUrl;
  };

  return (
    <div className={cn(
      'group relative rounded-xl border border-l-4 p-4 transition-all duration-200',
      'hover:shadow-sm',
      cfg.accent,
      !notification.isRead ? 'shadow-sm' : 'opacity-90',
    )}>
      <div className="flex items-start gap-3">

        {/* Icon */}
        <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cfg.iconBg)}>
          <Icon className={cn('h-4 w-4', cfg.iconColor)} />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">

          {/* Top row: type badge + title + unread dot + actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cfg.badge)}>
                  {cfg.label}
                </span>
                {!notification.isRead && (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </div>
              <h4 className={cn(
                'text-sm font-semibold leading-snug',
                !notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300',
              )}>
                {notification.title}
              </h4>
            </div>

            {/* Mark read / dismiss */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {!notification.isRead && (
                <button
                  onClick={() => onMarkAsRead(notification.notificationId)}
                  title="Mark as read"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/40"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onDismiss(notification.notificationId)}
                title="Dismiss"
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Message */}
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {notification.message}
          </p>

          {/* Metadata chips */}
          <MetadataChips notification={notification} />

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(notification.createdAt)}
            </span>
            {notification.actionUrl && notification.actionLabel && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAction}
                className={cn(
                  'h-7 gap-1 rounded-lg px-3 text-xs font-medium',
                  'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
                  'border border-transparent hover:border-gray-200 dark:hover:border-gray-700',
                )}
              >
                {notification.actionLabel}
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
