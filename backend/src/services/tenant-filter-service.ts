import { db } from '../db/index.js';
import { tenants, credits } from '../db/schema/index.js';
import { eq, and, sql, gte, lte, like, inArray } from 'drizzle-orm';
import { notificationCacheService } from '../features/notifications/services/notification-cache-service.js';
import Logger from '../utils/logger.js';

export interface TenantFilters {
  status?: string;
  industry?: string;
  subscriptionTier?: string;
  minCredits?: number;
  maxCredits?: number;
  createdAfter?: string | Date;
  createdBefore?: string | Date;
  lastActivityAfter?: string | Date;
  lastActivityBefore?: string | Date;
  companySize?: string;
  isActive?: boolean;
  isVerified?: boolean;
  tenantIds?: string[];
}

class TenantFilterService {
  /**
   * Filter tenants based on criteria
   */
  async filterTenants(filters: TenantFilters = {}): Promise<string[]> {
    try {
      const cached = await notificationCacheService.getFilteredTenants(filters as Record<string, unknown>);
      if (cached) {
        return cached as string[];
      }

      const {
        status,
        industry,
        minCredits,
        maxCredits,
        createdAfter,
        createdBefore,
        lastActivityAfter,
        lastActivityBefore,
        companySize,
        isActive,
        isVerified,
        tenantIds
      } = filters;

      const whereConditions = [];

      // Status filter
      if (status && status !== 'all') {
        if (status === 'active') {
          whereConditions.push(eq(tenants.isActive, true));
        } else if (status === 'inactive') {
          whereConditions.push(eq(tenants.isActive, false));
        } else if (status === 'trial') {
          whereConditions.push(sql`EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = ${tenants.tenantId} AND s.trial_ends_at > now())`);
        } else if (status === 'paid') {
          whereConditions.push(sql`NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = ${tenants.tenantId} AND s.trial_ends_at > now())`);
        }
      }

      // Industry filter
      if (industry) {
        whereConditions.push(like(tenants.industry, `%${industry}%`));
      }

      // Company size filter
      if (companySize) {
        whereConditions.push(eq(tenants.organizationSize, companySize));
      }

      // Active status filter
      if (isActive !== undefined) {
        whereConditions.push(eq(tenants.isActive, isActive));
      }

      // Verified status filter
      if (isVerified !== undefined) {
        whereConditions.push(eq(tenants.isVerified, isVerified));
      }

      // Created date filters
      if (createdAfter) {
        whereConditions.push(gte(tenants.createdAt, new Date(createdAfter)));
      }

      if (createdBefore) {
        whereConditions.push(lte(tenants.createdAt, new Date(createdBefore)));
      }

      // Last activity filters
      if (lastActivityAfter) {
        whereConditions.push(gte(tenants.lastActivityAt, new Date(lastActivityAfter)));
      }

      if (lastActivityBefore) {
        whereConditions.push(lte(tenants.lastActivityAt, new Date(lastActivityBefore)));
      }

      // Tenant IDs filter (if specific tenants are requested)
      if (tenantIds && Array.isArray(tenantIds) && tenantIds.length > 0) {
        whereConditions.push(inArray(tenants.tenantId, tenantIds));
      }

      const tenantQuery =
        whereConditions.length > 0
          ? db.select({ tenantId: tenants.tenantId }).from(tenants).where(and(...whereConditions))
          : db.select({ tenantId: tenants.tenantId }).from(tenants);
      let filteredTenants = await tenantQuery;

      // Apply credit filters if specified
      if (minCredits !== undefined || maxCredits !== undefined) {
        const havingParts: ReturnType<typeof sql>[] = [];
        if (minCredits !== undefined) havingParts.push(sql`sum(${credits.availableCredits}::numeric) >= ${minCredits}`);
        if (maxCredits !== undefined) havingParts.push(sql`sum(${credits.availableCredits}::numeric) <= ${maxCredits}`);
        const creditQuery = havingParts.length > 0
          ? db
              .select({ tenantId: credits.tenantId, totalCredits: sql`sum(${credits.availableCredits}::numeric)` })
              .from(credits)
              .where(and(eq(credits.isActive, true), inArray(credits.tenantId, filteredTenants.map(t => t.tenantId))))
              .groupBy(credits.tenantId)
              .having(and(...havingParts))
          : db
              .select({ tenantId: credits.tenantId, totalCredits: sql`sum(${credits.availableCredits}::numeric)` })
              .from(credits)
              .where(and(eq(credits.isActive, true), inArray(credits.tenantId, filteredTenants.map(t => t.tenantId))))
              .groupBy(credits.tenantId);
        const tenantsWithCredits = await creditQuery;
        const creditTenantIds = new Set(tenantsWithCredits.map(t => t.tenantId));
        filteredTenants = filteredTenants.filter(t => creditTenantIds.has(t.tenantId));
      }

      const result = filteredTenants.map(t => t.tenantId);
      await notificationCacheService.cacheFilteredTenants(filters as Record<string, unknown>, result);
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'tenant', 'filter-tenants', 'Error filtering tenants', { error: error.message, stack: error.stack });
      throw err;
    }
  }

  /**
   * Get tenant count matching filters
   */
  async getTenantCount(filters: TenantFilters = {}): Promise<number> {
    try {
      const tenantIds = await this.filterTenants(filters);
      return tenantIds.length;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'tenant', 'get-tenant-count', 'Error getting tenant count', { error: error.message, stack: error.stack });
      throw err;
    }
  }

  /**
   * Get tenant details matching filters
   */
  async getFilteredTenantDetails(filters: TenantFilters = {}, options: { limit?: number; offset?: number } = {}): Promise<Array<Record<string, unknown>>> {
    try {
      const { limit = 1000, offset = 0 } = options;
      const tenantIds = await this.filterTenants(filters);
      if (tenantIds.length === 0) return [];
      const tenantDetails = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          adminEmail: tenants.adminEmail,
          industry: tenants.industry,
          organizationSize: tenants.organizationSize,
          isActive: tenants.isActive,
          isVerified: tenants.isVerified,
          createdAt: tenants.createdAt,
          lastActivityAt: tenants.lastActivityAt
        })
        .from(tenants)
        .where(inArray(tenants.tenantId, tenantIds))
        .limit(limit)
        .offset(offset);
      return tenantDetails as unknown as Array<Record<string, unknown>>;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'tenant', 'get-filtered-tenant-details', 'Error getting filtered tenant details', { error: error.message, stack: error.stack });
      throw err;
    }
  }
}

export { TenantFilterService };
export default TenantFilterService;
