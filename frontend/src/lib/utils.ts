import { User } from '@/types/user-management'
import { logger } from '@/lib/logger'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return 'N/A'

  const dateObj = typeof date === 'string' ? new Date(date) : date

  // Check if the date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid date'

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Date and time for ledgers, receipts, and audit-style UI. */
export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return 'N/A'

  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isNaN(dateObj.getTime())) return 'Invalid date'

  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatCurrency(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-US').format(amount)
}

export function formatPercentage(percentage: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(percentage)
}

export const getUserStatus = (user: User): string => {
  if (!user.isActive) return 'Pending'
  if (!user.onboardingCompleted) return 'Setup Required'
  return 'Active'
}

export const getStatusColor = (user: User): string => {
  const status = getUserStatus(user)
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-800'
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'Setup Required':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map()

  static startMeasure(name: string): void {
    this.measurements.set(name, performance.now())
  }

  static endMeasure(name: string): number {
    const startTime = this.measurements.get(name)
    if (!startTime) {
      logger.warn(`No start time found for measurement: ${name}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.measurements.delete(name)

    // Log slow operations
    if (duration > 100) {
      logger.warn(
        `Slow operation detected: ${name} took ${duration.toFixed(2)}ms`
      )
    }

    return duration
  }

  static measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasure(name)
    return fn().finally(() => {
      this.endMeasure(name)
    })
  }
}

// Error tracking utilities
export class ErrorTracker {
  static captureException(error: Error, context?: unknown): void {
    console.error('Error captured:', error, context)

    // In production, send to error tracking service
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error, { extra: context })
    }
  }

  static captureMessage(
    _message: string,
    _level: 'info' | 'warning' | 'error' = 'info'
  ): void {
    // In production, send to monitoring service
    if (import.meta.env.PROD) {
      // Example: Sentry.captureMessage(message, level)
    }
  }
}

// Bundle size monitoring (no-op; enable in dev as needed)
export function getBundleSize(): void {
  // placeholder
}

// Debounce utility
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** UUID v4 regex - matches standard UUID format */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Check if a string is a valid UUID */
export function isValidUUID(str: string | null | undefined): boolean {
  return (
    typeof str === 'string' && str.trim() !== '' && UUID_REGEX.test(str.trim())
  )
}

/** Filter an array of role IDs to only include valid UUIDs (excludes display strings like "No role assigned") */
export function filterValidRoleIds(
  roleIds: (string | null | undefined)[]
): string[] {
  return roleIds.filter((id): id is string => isValidUUID(id))
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Compare two semantic version strings
 * Returns true if serverVersion > clientVersion
 * Handles non-semver strings by falling back to string comparison or returning false
 */
export function isVersionNewer(
  serverVersion: string,
  clientVersion: string
): boolean {
  if (!serverVersion || !clientVersion) {
    return false
  }

  // Parse semver strings (x.y.z format)
  const parseVersion = (version: string): number[] => {
    // Remove any leading 'v' and split by '.'
    const cleaned = version.replace(/^v/i, '').trim()
    const parts = cleaned.split('.')

    // Extract numeric parts, defaulting to 0 for missing parts
    return [
      parseInt(parts[0] || '0', 10) || 0,
      parseInt(parts[1] || '0', 10) || 0,
      parseInt(parts[2] || '0', 10) || 0,
    ]
  }

  try {
    const serverParts = parseVersion(serverVersion)
    const clientParts = parseVersion(clientVersion)

    // Compare major, minor, patch
    for (let i = 0; i < 3; i++) {
      if (serverParts[i] > clientParts[i]) {
        return true
      }
      if (serverParts[i] < clientParts[i]) {
        return false
      }
    }

    // Versions are equal
    return false
  } catch (error) {
    // If parsing fails, fall back to string comparison
    // Only return true if strings are different and server > client lexicographically
    // This is conservative - we don't want to show banner incorrectly
    return serverVersion !== clientVersion && serverVersion > clientVersion
  }
}
