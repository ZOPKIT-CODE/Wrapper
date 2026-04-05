interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Distributed SSO Cache Service
 * In-memory cache for SSO-related data
 * Redis removed - using in-memory Map for caching
 */
class DistributedSSOCache {
  private userAuth: Map<string, CacheEntry<unknown>>;
  private userPermissions: Map<string, CacheEntry<unknown>>;
  private userRoles: Map<string, CacheEntry<unknown>>;

  constructor() {
    // In-memory storage (replaces Redis)
    this.userAuth = new Map(); // key -> auth data
    this.userPermissions = new Map(); // key -> permissions
    this.userRoles = new Map(); // key -> roles

    // Cleanup expired entries periodically
    setInterval(() => this._cleanupExpired(), 3600000); // Every hour
  }

  /**
   * Clean up expired entries
   */
  _cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.userAuth.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.userAuth.delete(key);
      }
    }
    for (const [key, entry] of this.userPermissions.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.userPermissions.delete(key);
      }
    }
    for (const [key, entry] of this.userRoles.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.userRoles.delete(key);
      }
    }
  }

  /**
   * Get cache key for user auth
   */
  _getAuthKey(kindeUserId: string, orgCode: string): string {
    return `auth:${kindeUserId}:${orgCode}`;
  }

  /**
   * Get cache key for user permissions
   */
  _getPermissionsKey(userId: string, tenantId: string, app: string): string {
    return `permissions:${userId}:${tenantId}:${app}`;
  }

  /**
   * Get cache key for user roles
   */
  _getRolesKey(userId: string, tenantId: string): string {
    return `roles:${userId}:${tenantId}`;
  }

  /**
   * Get user auth from cache
   */
  async getUserAuth(kindeUserId: string, orgCode: string): Promise<unknown> {
    const key = this._getAuthKey(kindeUserId, orgCode);
    const entry = this.userAuth.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.userAuth.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Cache user auth
   */
  async cacheUserAuth(kindeUserId: string, orgCode: string, authData: unknown, ttl = 3600): Promise<void> {
    const key = this._getAuthKey(kindeUserId, orgCode);
    const expiresAt = Date.now() + (ttl * 1000);
    this.userAuth.set(key, { value: authData, expiresAt });
  }

  /**
   * Get user permissions from cache
   */
  async getUserPermissions(userId: string, tenantId: string, app: string): Promise<unknown> {
    const key = this._getPermissionsKey(userId, tenantId, app);
    const entry = this.userPermissions.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.userPermissions.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Cache user permissions
   */
  async cacheUserPermissions(userId: string, tenantId: string, app: string, permissions: unknown, ttl = 3600): Promise<void> {
    const key = this._getPermissionsKey(userId, tenantId, app);
    const expiresAt = Date.now() + (ttl * 1000);
    this.userPermissions.set(key, { value: permissions, expiresAt });
  }

  /**
   * Cache user roles
   */
  async cacheUserRoles(userId: string, tenantId: string, roles: unknown, ttl = 3600): Promise<void> {
    const key = this._getRolesKey(userId, tenantId);
    const expiresAt = Date.now() + (ttl * 1000);
    this.userRoles.set(key, { value: roles, expiresAt });
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{ userAuth: number; userPermissions: number; userRoles: number; total: number }> {
    return {
      userAuth: this.userAuth.size,
      userPermissions: this.userPermissions.size,
      userRoles: this.userRoles.size,
      total: this.userAuth.size + this.userPermissions.size + this.userRoles.size
    };
  }

  /**
   * Invalidate user cache
   */
  async invalidateUserCache(identifier: string, _tenantId?: string): Promise<void> {
    // Remove all entries for this user
    for (const [key] of this.userAuth.entries()) {
      if (key.includes(identifier)) {
        this.userAuth.delete(key);
      }
    }
    for (const [key] of this.userPermissions.entries()) {
      if (key.includes(identifier)) {
        this.userPermissions.delete(key);
      }
    }
    for (const [key] of this.userRoles.entries()) {
      if (key.includes(identifier)) {
        this.userRoles.delete(key);
      }
    }
  }

  /**
   * Invalidate tenant cache
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    // Remove all entries for this tenant
    for (const [key] of this.userPermissions.entries()) {
      if (key.includes(tenantId)) {
        this.userPermissions.delete(key);
      }
    }
    for (const [key] of this.userRoles.entries()) {
      if (key.includes(tenantId)) {
        this.userRoles.delete(key);
      }
    }
  }

  /**
   * Invalidate app cache
   */
  async invalidateAppCache(app: string): Promise<void> {
    // Remove all entries for this app
    for (const [key] of this.userPermissions.entries()) {
      if (key.includes(`:${app}`)) {
        this.userPermissions.delete(key);
      }
    }
  }
}

// Cache TTL constants
export const CacheTTL = {
  USER_AUTH: 3600, // 1 hour
  USER_PERMISSIONS: 3600, // 1 hour
  USER_ROLES: 3600 // 1 hour
};

// Cache key constants
export const CacheKeys = {
  USER_AUTH: 'auth',
  USER_PERMISSIONS: 'permissions',
  USER_ROLES: 'roles'
};

// Export singleton instance
const distributedSSOCache = new DistributedSSOCache();
export default distributedSSOCache;
export { DistributedSSOCache };
