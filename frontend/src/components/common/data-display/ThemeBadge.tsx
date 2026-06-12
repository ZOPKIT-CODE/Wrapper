import * as React from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const semanticBadge = (
  token: 'success' | 'warning' | 'info' | 'destructive' | 'muted'
) =>
  cn(
    'border-transparent shadow',
    token === 'success' &&
      'bg-success text-success-foreground hover:bg-success/90',
    token === 'warning' &&
      'bg-warning text-warning-foreground hover:bg-warning/90',
    token === 'info' && 'bg-info text-info-foreground hover:bg-info/90',
    token === 'destructive' &&
      'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    token === 'muted' && 'bg-muted text-muted-foreground hover:bg-muted/80'
  )

const variantClasses: Record<string, string> = {
  success: semanticBadge('success'),
  warning: semanticBadge('warning'),
  info: semanticBadge('info'),
  muted: semanticBadge('muted'),
  ghost: 'border-transparent hover:bg-accent hover:text-accent-foreground',
  dot: 'border-transparent bg-dot bg-center bg-no-repeat bg-[length:8px_8px] text-foreground',
  active: semanticBadge('success'),
  inactive: semanticBadge('muted'),
  pending: semanticBadge('warning'),
  high: semanticBadge('destructive'),
  medium: semanticBadge('warning'),
  low: semanticBadge('muted'),
  feature:
    'border-transparent bg-accent text-accent-foreground shadow hover:bg-accent/90',
  bug: semanticBadge('destructive'),
  enhancement: semanticBadge('info'),
  trial: semanticBadge('info'),
  premium:
    'border-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow hover:from-yellow-500 hover:to-yellow-700',
  enterprise:
    'border-transparent bg-gradient-to-r from-gray-700 to-gray-900 text-white shadow hover:from-gray-800 hover:to-black',
  beta: 'border-transparent bg-accent text-accent-foreground shadow hover:bg-accent/90',
  deprecated: cn(semanticBadge('muted'), 'line-through'),
  subscribed: semanticBadge('success'),
  expired: semanticBadge('destructive'),
  cancelled: semanticBadge('muted'),
  admin: semanticBadge('destructive'),
  moderator: semanticBadge('warning'),
  user: semanticBadge('info'),
  guest: semanticBadge('muted'),
  synced: semanticBadge('success'),
  syncing: cn(semanticBadge('warning'), 'animate-pulse'),
  failed: semanticBadge('destructive'),
  online: semanticBadge('success'),
  offline: semanticBadge('destructive'),
  maintenance: semanticBadge('warning'),
  connected: semanticBadge('success'),
  disconnected: semanticBadge('destructive'),
  critical: semanticBadge('destructive'),
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  default: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
  xl: 'px-4 py-1.5 text-base',
}

export interface ThemeBadgeProps extends Omit<BadgeProps, 'variant'> {
  variant?:
    | 'success'
    | 'warning'
    | 'info'
    | 'muted'
    | 'ghost'
    | 'dot'
    | 'active'
    | 'inactive'
    | 'pending'
    | 'high'
    | 'medium'
    | 'low'
    | 'feature'
    | 'bug'
    | 'enhancement'
    | 'trial'
    | 'premium'
    | 'enterprise'
    | 'beta'
    | 'deprecated'
    | 'subscribed'
    | 'expired'
    | 'cancelled'
    | 'admin'
    | 'moderator'
    | 'user'
    | 'guest'
    | 'synced'
    | 'syncing'
    | 'failed'
    | 'online'
    | 'offline'
    | 'maintenance'
    | 'connected'
    | 'disconnected'
    | 'critical'
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
  size?: 'sm' | 'default' | 'lg' | 'xl'
  children: React.ReactNode
}

/**
 * Extended Badge component with theme-specific variants.
 * Status colors use semantic tokens (--success, --warning, --info).
 */
export const ThemeBadge = ({
  className,
  variant = 'success',
  size = 'default',
  children,
  ...props
}: ThemeBadgeProps) => {
  const isBaseVariant = [
    'default',
    'secondary',
    'destructive',
    'outline',
  ].includes(variant)

  if (isBaseVariant) {
    return (
      <Badge
        variant={variant as 'default' | 'secondary' | 'destructive' | 'outline'}
        className={cn(
          sizeClasses[size] || sizeClasses.default,
          className,
          'rounded-full'
        )}
        {...props}
      >
        {children}
      </Badge>
    )
  }

  const themeClass = variantClasses[variant] || variantClasses.success
  const sizeClass = sizeClasses[size] || sizeClasses.default

  return (
    <Badge
      className={cn(themeClass, sizeClass, 'rounded-full', className)}
      {...props}
    >
      {children}
    </Badge>
  )
}
ThemeBadge.displayName = 'ThemeBadge'
