import Logger from '../../../utils/logger.js';

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

/**
 * Notification Cache Service
 * Provides in-memory caching for notification-related data
 * Redis removed - using in-memory Map for caching
 */
class NotificationCacheService {
  private cache = new Map<string, CacheEntry>();
  private prefix = 'notif:cache:';
  private ttls: Record<string, number>;

  constructor() {
    // TTLs in seconds
    this.ttls = {
      template: 3600,        // 1 hour
      tenant: 900,            // 15 minutes
      filteredTenants: 300,   // 5 minutes
      stats: 600,             // 10 minutes
      notification: 300       // 5 minutes
    };
    
    // Cleanup expired entries periodically
    setInterval(() => this._cleanupExpired(), 60000); // Every minute
  }

  /**
   * Clean up expired cache entries
   */
  _cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry?.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache key
   */
  _getKey(type: string, identifier: string): string {
    return `${this.prefix}${type}:${identifier}`;
  }

  /**
   * Cache template (in-memory)
   */
  async cacheTemplate(templateId: string, template: unknown): Promise<boolean> {
    try {
      const key = this._getKey('template', templateId);
      const expiresAt = Date.now() + (this.ttls.template * 1000);
      this.cache.set(key, { value: template, expiresAt });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'cacheTemplate', 'Failed to cache template', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get cached template (in-memory)
   */
  async getTemplate(templateId: string): Promise<unknown> {
    try {
      const key = this._getKey('template', templateId);
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return entry.value;
    } catch (error) {
      Logger.log('error', 'general', 'getTemplate', 'Failed to get cached template', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Invalidate template cache (in-memory)
   */
  async invalidateTemplate(templateId: string): Promise<boolean> {
    try {
      const key = this._getKey('template', templateId);
      this.cache.delete(key);
      
      // Also invalidate template list cache
      this.cache.delete(this._getKey('templates', 'list'));
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'invalidateTemplate', 'Failed to invalidate template cache', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Cache template list (in-memory)
   */
  async cacheTemplateList(filters: Record<string, unknown>, templates: unknown[]): Promise<boolean> {
    try {
      const filterKey = JSON.stringify(filters || {});
      const key = `${this.prefix}templates:list:${Buffer.from(filterKey).toString('base64')}`;
      const expiresAt = Date.now() + (this.ttls.template * 1000);
      this.cache.set(key, { value: templates, expiresAt });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'cacheTemplateList', 'Failed to cache template list', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get cached template list (in-memory)
   */
  async getTemplateList(filters: Record<string, unknown>): Promise<unknown> {
    try {
      const filterKey = JSON.stringify(filters || {});
      const key = `${this.prefix}templates:list:${Buffer.from(filterKey).toString('base64')}`;
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return entry.value;
    } catch (error) {
      Logger.log('error', 'general', 'getTemplateList', 'Failed to get cached template list', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Cache tenant metadata (in-memory)
   */
  async cacheTenantMetadata(tenantId: string, metadata: Record<string, unknown>): Promise<boolean> {
    try {
      const key = this._getKey('tenant', tenantId);
      const expiresAt = Date.now() + (this.ttls.tenant * 1000);
      this.cache.set(key, { value: metadata, expiresAt });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'cacheTenantMetadata', 'Failed to cache tenant metadata', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get cached tenant metadata (in-memory)
   */
  async getTenantMetadata(tenantId: string): Promise<unknown> {
    try {
      const key = this._getKey('tenant', tenantId);
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return entry.value;
    } catch (error) {
      Logger.log('error', 'general', 'getTenantMetadata', 'Failed to get cached tenant metadata', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Invalidate tenant cache (in-memory)
   */
  async invalidateTenant(tenantId: string): Promise<boolean> {
    try {
      const key = this._getKey('tenant', tenantId);
      this.cache.delete(key);
      
      // Also invalidate filtered tenant lists
      for (const [cacheKey] of this.cache.entries()) {
        if (cacheKey.startsWith(`${this.prefix}filtered:`)) {
          this.cache.delete(cacheKey);
        }
      }
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'invalidateTenant', 'Failed to invalidate tenant cache', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Cache filtered tenant list (in-memory)
   */
  async cacheFilteredTenants(filters: Record<string, unknown>, tenantIds: string[]): Promise<boolean> {
    try {
      const filterKey = JSON.stringify(filters || {});
      const key = `${this.prefix}filtered:${Buffer.from(filterKey).toString('base64')}`;
      const expiresAt = Date.now() + (this.ttls.filteredTenants * 1000);
      this.cache.set(key, { value: tenantIds, expiresAt });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'cacheFilteredTenants', 'Failed to cache filtered tenants', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get cached filtered tenant list (in-memory)
   */
  async getFilteredTenants(filters: Record<string, unknown>): Promise<unknown> {
    try {
      const filterKey = JSON.stringify(filters || {});
      const key = `${this.prefix}filtered:${Buffer.from(filterKey).toString('base64')}`;
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return entry.value;
    } catch (error) {
      Logger.log('error', 'general', 'getFilteredTenants', 'Failed to get cached filtered tenants', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Cache notification statistics (in-memory)
   */
  async cacheStats(filters: Record<string, unknown>, stats: Record<string, unknown>): Promise<boolean> {
    try {
      const filterKey = JSON.stringify(filters || {});
      const key = `${this.prefix}stats:${Buffer.from(filterKey).toString('base64')}`;
      const expiresAt = Date.now() + (this.ttls.stats * 1000);
      this.cache.set(key, { value: stats, expiresAt });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'cacheStats', 'Failed to cache stats', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get cached notification statistics (in-memory)
   */
  async getStats(filters: Record<string, unknown>): Promise<unknown> {
    try {
      const filterKey = JSON.stringify(filters || {});
      const key = `${this.prefix}stats:${Buffer.from(filterKey).toString('base64')}`;
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return entry.value;
    } catch (error) {
      Logger.log('error', 'general', 'getStats', 'Failed to get cached stats', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Invalidate stats cache (in-memory)
   */
  async invalidateStats(filters: Record<string, unknown> | null = null): Promise<boolean> {
    try {
      if (filters) {
        const filterKey = JSON.stringify(filters);
        const key = `${this.prefix}stats:${Buffer.from(filterKey).toString('base64')}`;
        this.cache.delete(key);
      } else {
        // Invalidate all stats
        for (const [cacheKey] of this.cache.entries()) {
          if (cacheKey.startsWith(`${this.prefix}stats:`)) {
            this.cache.delete(cacheKey);
          }
        }
      }
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'invalidateStats', 'Failed to invalidate stats cache', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Warm cache for frequently accessed templates (in-memory)
   */
  async warmTemplateCache(templateIds: string[]): Promise<boolean> {
    try {
      // This would be called with template IDs that are frequently accessed
      // Implementation would fetch templates and cache them
      Logger.log('info', 'general', 'warmTemplateCache', 'Warming cache for templates', { count: templateIds.length });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'warmTemplateCache', 'Failed to warm template cache', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Clear all notification caches (in-memory)
   */
  async clearAll() {
    try {
      let count = 0;
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(this.prefix)) {
          this.cache.delete(key);
          count++;
        }
      }
      Logger.log('info', 'general', 'clearAll', 'Cleared cache entries', { count });
      return true;
    } catch (error) {
      Logger.log('error', 'general', 'clearAll', 'Failed to clear cache', { error: (error as Error).message });
      return false;
    }
  }
}

export const notificationCacheService = new NotificationCacheService();
export default notificationCacheService;

