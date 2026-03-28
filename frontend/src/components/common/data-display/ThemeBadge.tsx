import * as React from "react"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme/ThemeProvider"

// Extended badge variants for theme-specific styling
const getThemeVariantClasses = (variant: string, size: string, actualTheme: string) => {
  const isMonochrome = actualTheme === 'monochrome';

  const variantClasses: Record<string, string> = {
    // Status variants
    success: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    warning: isMonochrome
      ? "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600"
      : "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600",
    info: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-[#1B2E5A] text-white shadow hover:bg-[#162447]",
    muted: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
    ghost: "border-transparent hover:bg-accent hover:text-accent-foreground",
    dot: "border-transparent bg-dot bg-center bg-no-repeat bg-[length:8px_8px] text-foreground",
    // Business status variants
    active: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-emerald-500 text-white shadow hover:bg-emerald-600",
    inactive: isMonochrome
      ? "border-transparent bg-gray-400 text-white shadow hover:bg-gray-500"
      : "border-transparent bg-gray-400 text-white shadow hover:bg-gray-500",
    // Priority variants
    high: isMonochrome
      ? "border-transparent bg-gray-800 text-white shadow hover:bg-gray-900"
      : "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    medium: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-orange-500 text-white shadow hover:bg-orange-600",
    low: isMonochrome
      ? "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600"
      : "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600",
    // Category variants
    feature: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-purple-500 text-white shadow hover:bg-purple-600",
    bug: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    enhancement: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-[#1B2E5A] text-white shadow hover:bg-[#162447]",
    // SaaS-specific variants
    trial: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-[#1B2E5A] text-white shadow hover:bg-[#162447]",
    premium: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow hover:from-yellow-500 hover:to-yellow-700",
    enterprise: isMonochrome
      ? "border-transparent bg-gray-800 text-white shadow hover:bg-gray-900"
      : "border-transparent bg-gradient-to-r from-gray-700 to-gray-900 text-white shadow hover:from-gray-800 hover:to-black",
    beta: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-violet-500 text-white shadow hover:bg-violet-600",
    deprecated: isMonochrome
      ? "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600 line-through"
      : "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600 line-through",
    // Subscription status
    subscribed: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-green-600 text-white shadow hover:bg-green-700",
    expired: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    cancelled: isMonochrome
      ? "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600"
      : "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600",
    // User roles
    admin: isMonochrome
      ? "border-transparent bg-gray-800 text-white shadow hover:bg-gray-900"
      : "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    moderator: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-orange-500 text-white shadow hover:bg-orange-600",
    user: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-[#1B2E5A] text-white shadow hover:bg-[#162447]",
    guest: isMonochrome
      ? "border-transparent bg-gray-400 text-white shadow hover:bg-gray-500"
      : "border-transparent bg-gray-400 text-white shadow hover:bg-gray-500",
    // Data states
    synced: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    syncing: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700 animate-pulse"
      : "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600 animate-pulse",
    failed: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    // API status
    online: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    offline: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    maintenance: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600",
    // Integration status
    connected: isMonochrome
      ? "border-transparent bg-gray-700 text-white shadow hover:bg-gray-800"
      : "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
    disconnected: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    pending: isMonochrome
      ? "border-transparent bg-gray-600 text-white shadow hover:bg-gray-700"
      : "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600",
    critical: isMonochrome
      ? "border-transparent bg-gray-800 text-white shadow hover:bg-gray-900"
      : "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
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
  const { actualTheme } = useTheme();

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
  const themeClasses = getThemeVariantClasses(variant, size, actualTheme);

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
