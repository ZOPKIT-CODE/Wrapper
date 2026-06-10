import * as React from "react"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
// Extended badge variants — Tailwind utility classes only
const getThemeVariantClasses = (variant: string, size: string) => {
  const variantClasses: Record<string, string> = {
    success: "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    warning: "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600",
    info: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary-hover",
    muted: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
    ghost: "border-transparent hover:bg-accent hover:text-accent-foreground",
    dot: "border-transparent bg-dot bg-center bg-no-repeat bg-[length:8px_8px] text-foreground",
    active: "border-transparent bg-emerald-500 text-white shadow hover:bg-emerald-600",
    inactive: "border-transparent bg-gray-400 text-white shadow hover:bg-gray-500",
    high: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    medium: "border-transparent bg-orange-500 text-white shadow hover:bg-orange-600",
    low: "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600",
    feature: "border-transparent bg-purple-500 text-white shadow hover:bg-purple-600",
    bug: "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    enhancement: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary-hover",
    trial: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary-hover",
    premium: "border-transparent bg-amber-500 text-black shadow hover:bg-amber-600",
    enterprise: "border-transparent bg-slate-800 text-white shadow hover:bg-slate-900",
    beta: "border-transparent bg-violet-500 text-white shadow hover:bg-violet-600",
    deprecated: "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600 line-through",
    subscribed: "border-transparent bg-green-600 text-white shadow hover:bg-green-700",
    expired: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    cancelled: "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600",
    admin: "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    moderator: "border-transparent bg-orange-500 text-white shadow hover:bg-orange-600",
    user: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary-hover",
    guest: "border-transparent bg-gray-400 text-white shadow hover:bg-gray-500",
    synced: "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    syncing: "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600 animate-pulse",
    failed: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    online: "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    offline: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    maintenance: "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600",
    connected: "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    disconnected: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    pending: "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600",
    critical: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
  }

  const sizeClasses: Record<string, string> = {
    sm: "px-2 py-0.5 text-xs",
    default: "px-2.5 py-0.5 text-xs",
    lg: "px-3 py-1 text-sm",
    xl: "px-4 py-1.5 text-base",
  }

  // Get variant classes, fallback to empty string if not found
  const variantClass = variantClasses[variant] || ""
  const sizeClass = sizeClasses[size] || sizeClasses.default

  return cn(variantClass, sizeClass)
}

export interface ThemeBadgeProps extends Omit<BadgeProps, 'variant'> {
  variant?: 
    | 'success' | 'warning' | 'info' | 'muted' | 'ghost' | 'dot'
    | 'active' | 'inactive' | 'pending'
    | 'high' | 'medium' | 'low'
    | 'feature' | 'bug' | 'enhancement'
    | 'trial' | 'premium' | 'enterprise' | 'beta' | 'deprecated'
    | 'subscribed' | 'expired' | 'cancelled'
    | 'admin' | 'moderator' | 'user' | 'guest'
    | 'synced' | 'syncing' | 'failed'
    | 'online' | 'offline' | 'maintenance'
    | 'connected' | 'disconnected' | 'critical'
    | 'default' | 'secondary' | 'destructive' | 'outline'
  size?: 'sm' | 'default' | 'lg' | 'xl'
  children: React.ReactNode
}

/**
 * Extended Badge component with theme-specific variants.
 * Extends the base Badge component with additional color and size variants.
 * 
 * Usage:
 * <ThemeBadge variant="success" size="lg">Completed</ThemeBadge>
 * <ThemeBadge variant="warning">Pending</ThemeBadge>
 * <ThemeBadge variant="high" size="sm">High Priority</ThemeBadge>
 */
export const ThemeBadge = ({
  className,
  variant = "success",
  size = "default",
  children,
  ...props
}: ThemeBadgeProps) => {
  // Check if it's a base Badge variant or theme variant
  const isBaseVariant = ['default', 'secondary', 'destructive', 'outline'].includes(variant)

  if (isBaseVariant) {
    // Use base Badge with size classes
    const sizeClasses: Record<string, string> = {
      sm: "px-2 py-0.5 text-xs",
      default: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
      xl: "px-4 py-1.5 text-base",
    }

    return (
      <Badge
        variant={variant as any}
        className={cn(sizeClasses[size] || sizeClasses.default, className, 'rounded-full')}
        {...props}
      >
        {children}
      </Badge>
    )
  }

  // Use theme variants
  const themeClasses = getThemeVariantClasses(variant, size);

  return (
    <Badge
      className={cn(themeClasses, className)}
      {...props}
    >
      {children}
    </Badge>
  )
}
ThemeBadge.displayName = "ThemeBadge"
