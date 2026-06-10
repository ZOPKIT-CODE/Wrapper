// Enhanced cache system with timestamps and pattern-based invalidation
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class EnhancedCache {
  private storage: Map<string, CacheEntry<any>> = new Map()
  private maxSize = 100 // Maximum number of cache entries

  // Set data with TTL
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // If cache is full, remove oldest entry
    if (this.storage.size >= this.maxSize) {
      const oldestKey = Array.from(this.storage.keys())[0]
      this.storage.delete(oldestKey)
    }

    this.storage.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  // Get data if not expired
  get<T>(key: string): T | null {
    const entry = this.storage.get(key)

    if (!entry) {
      return null
    }

    const now = Date.now()
    const isExpired = now - entry.timestamp > entry.ttl

    if (isExpired) {
      this.storage.delete(key)
      return null
    }

    return entry.data
  }

  // Get timestamp of cached entry
  getTimestamp(key: string): number | null {
    const entry = this.storage.get(key)
    return entry ? entry.timestamp : null
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null
  }

  // Invalidate specific key
  invalidate(key: string): void {
    this.storage.delete(key)
  }

  // Invalidate all keys matching pattern
  invalidatePattern(pattern: string): void {
    const keysToDelete: string[] = []

    for (const key of this.storage.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => {
      this.storage.delete(key)
    })
  }

  // Clear all cache
  clear(): void {
    this.storage.clear()
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.storage.values()) {
      const isExpired = now - entry.timestamp > entry.ttl
      if (isExpired) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      total: this.storage.size,
      valid: validEntries,
      expired: expiredEntries,
      maxSize: this.maxSize,
    }
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.storage.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl
      if (isExpired) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => {
      this.storage.delete(key)
    })
  }
}

// Create singleton instance
export const cache = new EnhancedCache()

// Cache keys
export const CACHE_KEYS = {
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  USER_PERMISSIONS: 'user_permissions',
  ROLE_TEMPLATES: 'role_templates',
  USERS: 'users',
  APPLICATIONS: 'applications',
  MODULES: 'modules',
  DASHBOARD_METRICS: 'dashboard_metrics',
} as const

// Helper functions for common cache operations
export const cacheHelpers = {
  // Invalidate all role-related cache
  invalidateRoles: () => {
    cache.invalidatePattern('roles')
    cache.invalidate(CACHE_KEYS.USER_PERMISSIONS)
  },

  // Invalidate all permission-related cache
  invalidatePermissions: () => {
    cache.invalidate(CACHE_KEYS.PERMISSIONS)
    cache.invalidate(CACHE_KEYS.USER_PERMISSIONS)
    cache.invalidatePattern('permissions')
  },

  // Invalidate user-related cache
  invalidateUsers: () => {
    cache.invalidatePattern('users')
    cache.invalidate(CACHE_KEYS.USERS)
  },

  // Invalidate dashboard-related cache
  invalidateDashboard: () => {
    cache.invalidate(CACHE_KEYS.DASHBOARD_METRICS)
    cache.invalidatePattern('dashboard')
  },

  // Clear all cache
  clearAll: () => {
    cache.clear()
  },

  // Get cache stats
  getStats: () => {
    return cache.getStats()
  },

  // Cleanup expired entries
  cleanup: () => {
    cache.cleanup()
  },
}

// Auto-cleanup expired entries every 5 minutes
setInterval(
  () => {
    cacheHelpers.cleanup()
  },
  1 * 60 * 1000
)
