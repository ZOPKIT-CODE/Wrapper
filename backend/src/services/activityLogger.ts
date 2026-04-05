import { db } from '../db/index.js';
import { auditLogs, tenantUsers } from '../db/schema/core/users.js';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import Logger from '../utils/logger.js';

/** Request context from HTTP request (ip, userAgent, sessionId, etc.) */
export interface RequestContext extends Record<string, unknown> {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string | null;
  source?: string;
  url?: string;
  method?: string;
  userId?: string | null;
}

export interface UserActivityOptions extends Record<string, unknown> {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  actionFilter?: string;
  appFilter?: string;
  includeMetadata?: boolean;
}

export interface TenantAuditOptions extends Record<string, unknown> {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  actionFilter?: string;
  resourceTypeFilter?: string;
  userFilter?: string;
  includeDetails?: boolean;
}

export interface ErrorLogOptions extends Record<string, unknown> {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  severity?: string;
  errorType?: string;
  statusCode?: number | string;
  logId?: string;
}

/** Changes payload for audit events (oldValues, newValues, details) */
export interface AuditChanges extends Record<string, unknown> {
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  details?: Record<string, unknown>;
}

/**
 * Comprehensive Activity Logger Service
 * Tracks all user activities, system changes, and audit events
 */
class ActivityLogger {
  
  /**
   * Activity Types Constants
   */
  static ACTIVITY_TYPES = {
    // Authentication Activities
    AUTH_LOGIN: 'auth.login',
    AUTH_LOGOUT: 'auth.logout',
    AUTH_TOKEN_REFRESH: 'auth.token_refresh',
    AUTH_PASSWORD_CHANGE: 'auth.password_change',
    AUTH_FAILED_LOGIN: 'auth.failed_login',
    
    // User Management Activities
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    USER_INVITED: 'user.invited',
    USER_INVITATION_ACCEPTED: 'user.invitation_accepted',
    USER_ACTIVATED: 'user.activated',
    USER_DEACTIVATED: 'user.deactivated',
    USER_PROMOTED: 'user.promoted',
    USER_DEMOTED: 'user.demoted',
    USER_PROFILE_UPDATED: 'user.profile_updated',
    
    // Role Management Activities
    ROLE_CREATED: 'role.created',
    ROLE_UPDATED: 'role.updated',
    ROLE_DELETED: 'role.deleted',
    ROLE_ASSIGNED: 'role.assigned',
    ROLE_REMOVED: 'role.removed',
    ROLE_PERMISSIONS_CHANGED: 'role.permissions_changed',
    ROLE_CLONED: 'role.cloned',
    
    // Permission Activities
    PERMISSION_GRANTED: 'permission.granted',
    PERMISSION_REVOKED: 'permission.revoked',
    PERMISSION_MODIFIED: 'permission.modified',
    
    // Application Activities
    APP_ACCESSED: 'app.accessed',
    APP_SSO_LOGIN: 'app.sso_login',
    APP_ENABLED: 'app.enabled',
    APP_DISABLED: 'app.disabled',
    APP_SETTINGS_CHANGED: 'app.settings_changed',
    
    // System Activities
    SYSTEM_SETTINGS_CHANGED: 'system.settings_changed',
    SYSTEM_BACKUP_CREATED: 'system.backup_created',
    SYSTEM_MAINTENANCE: 'system.maintenance',
    
    // Billing Activities
    BILLING_SUBSCRIPTION_CREATED: 'billing.subscription_created',
    BILLING_SUBSCRIPTION_UPDATED: 'billing.subscription_updated',
    BILLING_SUBSCRIPTION_CANCELLED: 'billing.subscription_cancelled',
    BILLING_PAYMENT_SUCCESS: 'billing.payment_success',
    BILLING_PAYMENT_FAILED: 'billing.payment_failed',
    
    // Data Activities
    DATA_EXPORT: 'data.export',
    DATA_IMPORT: 'data.import',
    DATA_BULK_UPDATE: 'data.bulk_update',
    DATA_BULK_DELETE: 'data.bulk_delete',
    
    // Security Activities
    SECURITY_BREACH_ATTEMPT: 'security.breach_attempt',
    SECURITY_ACCESS_DENIED: 'security.access_denied',
    SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',

    // Error Activities
    ERROR_API_ERROR: 'error.api_error',
    ERROR_VALIDATION_ERROR: 'error.validation_error',
    ERROR_DATABASE_ERROR: 'error.database_error',
    ERROR_AUTH_ERROR: 'error.auth_error',
    ERROR_NOT_FOUND: 'error.not_found',
    ERROR_RATE_LIMIT: 'error.rate_limit',
    ERROR_SERVICE_UNAVAILABLE: 'error.service_unavailable',
    ERROR_INTERNAL_ERROR: 'error.internal_error',

    // Tenant Activities
    TENANT_VIEWED: 'tenant.viewed',
    TENANT_SETTINGS_UPDATED: 'tenant.settings_updated',
    TENANT_USERS_VIEWED: 'tenant.users_viewed',
    TENANT_USER_INVITED: 'tenant.user_invited',
    TENANT_USER_ACTIVATED: 'tenant.user_activated',
    TENANT_USER_DEACTIVATED: 'tenant.user_deactivated',

    // Organization Assignment Activities
    USER_ORGANIZATION_ASSIGNED: 'user.organization_assigned',
    USER_ORGANIZATION_UPDATED: 'user.organization_updated',
    USER_ORGANIZATION_REMOVED: 'user.organization_removed',
    BULK_USER_ORGANIZATION_ASSIGNED: 'bulk.user.organization_assigned',

    // User Profile Activities
    USER_PROFILE_VIEWED: 'user.profile_viewed',

    // Subscription Activities
    SUBSCRIPTION_VIEWED: 'subscription.viewed',
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_CANCELLED: 'subscription.cancelled',

    // Payment Activities
    PAYMENT_VIEWED: 'payment.viewed',
    PAYMENT_CREATED: 'payment.created',
    PAYMENT_UPGRADED: 'payment.upgraded',
    PAYMENT_UPGRADE_SUCCESS: 'payment.upgrade_success',
    PAYMENT_UPGRADE_FAILED: 'payment.upgrade_failed',
    PAYMENT_TOPUP_SUCCESS: 'payment.topup_success',
    PAYMENT_TOPUP_FAILED: 'payment.topup_failed',
    CREDIT_PURCHASE_SUCCESS: 'credit.purchase_success',
    CREDIT_PURCHASE_FAILED: 'credit.purchase_failed',

    // Entity Activities
    ENTITY_VIEWED: 'entity.viewed',
    ENTITY_CREATED: 'entity.created',
    ENTITY_UPDATED: 'entity.updated',
    ENTITY_DELETED: 'entity.deleted',

    // Invitation Activities
    INVITATION_VIEWED: 'invitation.viewed',
    INVITATION_SENT: 'invitation.sent',
    INVITATION_CANCELLED: 'invitation.cancelled',

    // Location Activities
    LOCATION_VIEWED: 'location.viewed',
    LOCATION_CREATED: 'location.created',
    LOCATION_UPDATED: 'location.updated',
    LOCATION_DELETED: 'location.deleted',

    // Credit Activities
    CREDIT_VIEWED: 'credit.viewed',
    CREDIT_ALLOCATED: 'credit.allocated',

    // Analytics Activities
    ANALYTICS_VIEWED: 'analytics.viewed',

    // Demo Activities
    DEMO_VIEWED: 'demo.viewed',
    DEMO_REQUESTED: 'demo.requested',

    // DNS Management Activities
    DNS_VIEWED: 'dns.viewed',
    DNS_UPDATED: 'dns.updated',

    // Trial Activities
    TRIAL_VIEWED: 'trial.viewed',
    TRIAL_EXTENDED: 'trial.extended',

    // Admin Activities
    ADMIN_PANEL_VIEWED: 'admin.panel_viewed',
    ADMIN_TENANT_VIEWED: 'admin.tenant_viewed',
    ADMIN_TENANT_CREATED: 'admin.tenant_created',
    ADMIN_TENANT_UPDATED: 'admin.tenant_updated',
    ADMIN_TENANT_ACTIVATED: 'admin.tenant_activated',
    ADMIN_TENANT_DEACTIVATED: 'admin.tenant_deactivated',

    // Webhook Activities
    WEBHOOK_VIEWED: 'webhook.viewed',
    WEBHOOK_CREATED: 'webhook.created',
    WEBHOOK_UPDATED: 'webhook.updated',
    WEBHOOK_DELETED: 'webhook.deleted',

    // Custom Role Activities
    CUSTOM_ROLE_VIEWED: 'custom_role.viewed',
    CUSTOM_ROLE_CREATED: 'custom_role.created',
    CUSTOM_ROLE_UPDATED: 'custom_role.updated',
    CUSTOM_ROLE_DELETED: 'custom_role.deleted',

    // Permission Matrix Activities
    PERMISSION_MATRIX_VIEWED: 'permission_matrix.viewed',
    PERMISSION_MATRIX_UPDATED: 'permission_matrix.updated',

    // User Sync Activities
    USER_SYNC_VIEWED: 'user_sync.viewed',
    USER_SYNC_TRIGGERED: 'user_sync.triggered',

    // User Application Activities
    USER_APPLICATION_VIEWED: 'user_application.viewed',
    USER_APPLICATION_UPDATED: 'user_application.updated',

    // Activity Log Activities
    ACTIVITY_LOG_VIEWED: 'activity_log.viewed',

    // CRM Integration Activities
    CRM_INTEGRATION_VIEWED: 'crm_integration.viewed',
    CRM_INTEGRATION_UPDATED: 'crm_integration.updated',
  };

  /**
   * Resource Types Constants
   */
  static RESOURCE_TYPES = {
    USER: 'user',
    ROLE: 'role',
    PERMISSION: 'permission',
    APPLICATION: 'application',
    TENANT: 'tenant',
    SUBSCRIPTION: 'subscription',
    PAYMENT: 'payment',
    SYSTEM: 'system',
    SESSION: 'session',
    INVITATION: 'invitation',
  };

  /**
   * Log user activity (for general activities like app access, login, etc.)
   * MANDATORY: tenantId is required for all activity logs to ensure tenant isolation
   */
  async logActivity(
    userId: string,
    tenantId: string,
    appId: string | null,
    action: string,
    metadata: Record<string, unknown> = {},
    requestContext: RequestContext = {}
  ): Promise<{ success: boolean; error?: string; requestId?: string }> {
    const requestId = Logger.generateRequestId('activity-log');
    
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      const error = new Error('Tenant ID is mandatory for activity logging');
      console.error(`❌ [${requestId}] ${error.message}`);
      return { success: false, error: error.message, requestId };
    }
    
    try {
      Logger.activity.log(requestId, action, 'activity', `${userId}:${appId ?? ''}`, {
        userId,
        tenantId,
        appId,
        action,
        metadata,
        requestContext: {
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
          sessionId: requestContext.sessionId
        }
      });
      
      const activityData = {
        userId,
        tenantId, // MANDATORY: Tenant isolation enforced at database level
        appId: appId || null,
        action,
        resourceType: 'activity', // General activities don't have a specific resource type
        resourceId: null, // Not used for activity logs
        details: {
          ...metadata,
          timestamp: new Date().toISOString(),
          sessionId: requestContext.sessionId,
          requestId: requestId
        },
        oldValues: null, // Not used for activity logs
        newValues: null, // Not used for activity logs
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      };

      await db.insert(auditLogs).values(activityData);

      console.log(`✅ [${requestId}] Activity logged successfully: ${action} for user ${userId}`);
      return { success: true, requestId };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to log activity:`, {
        error: error.message,
        userId,
        tenantId,
        action,
        stack: error.stack
      });
      // Don't throw - logging failures shouldn't break main operations
      return { success: false, error: error.message, requestId };
    }
  }

  /**
   * Log audit event (for system changes, data modifications, security events)
   * MANDATORY: tenantId is required for all audit events to ensure tenant isolation
   */
  async logAuditEvent(
    tenantId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changes: AuditChanges = {},
    requestContext: RequestContext = {}
  ): Promise<{ success: boolean; error?: string; requestId?: string }> {
    const requestId = Logger.generateRequestId('audit-log');
    
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      const error = new Error('Tenant ID is mandatory for audit event logging');
      console.error(`❌ [${requestId}] ${error.message}`);
      return { success: false, error: error.message, requestId };
    }
    
    try {
      Logger.activity.log(requestId, action, resourceType, resourceId, {
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        changes: {
          hasOldValues: !!changes.oldValues,
          hasNewValues: !!changes.newValues,
          detailsCount: Object.keys((changes.details as Record<string, unknown>) || {}).length
        },
        requestContext: {
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
          sessionId: requestContext.sessionId,
          source: requestContext.source || 'web'
        }
      });
      
      const auditData = {
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        oldValues: changes.oldValues || null,
        newValues: changes.newValues || null,
        details: {
          ...(changes.details as Record<string, unknown>),
          timestamp: new Date().toISOString(),
          sessionId: requestContext.sessionId,
          source: requestContext.source || 'web',
          requestId: requestId
        },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      };

      await db.insert(auditLogs).values(auditData);

      console.log(`✅ [${requestId}] Audit event logged successfully: ${action} on ${resourceType}:${resourceId} by user ${userId}`);
      return { success: true, requestId };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to log audit event:`, {
        error: error.message,
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        stack: error.stack
      });
      return { success: false, error: error.message, requestId };
    }
  }

  /**
   * Get user activity logs with filtering and pagination
   * MANDATORY: tenantId is required to ensure tenant isolation
   */
  async getUserActivity(
    userId: string,
    tenantId: string,
    options: UserActivityOptions = {}
  ): Promise<{
    activities: unknown[];
    pagination: { limit: number; offset: number; total: number };
  }> {
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      throw new Error('Tenant ID is mandatory for retrieving user activity logs');
    }
    
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        actionFilter,
        appFilter,
        includeMetadata = true
      } = options as UserActivityOptions;

      // Build where conditions - filter by userId and tenantId for tenant isolation
      const whereConditions = [
        eq(auditLogs.userId, userId),
        eq(auditLogs.tenantId, tenantId), // MANDATORY: Tenant isolation enforced
        eq(auditLogs.resourceType, 'activity') // Only get activity logs, not audit events
      ];

      // Apply additional filters
      if (startDate) {
        whereConditions.push(gte(auditLogs.createdAt, startDate));
      }

      if (endDate) {
        whereConditions.push(lte(auditLogs.createdAt, endDate));
      }

      if (actionFilter) {
        whereConditions.push(eq(auditLogs.action, actionFilter));
      }

      // MANDATORY: Enforce tenant isolation - filter by both userId and tenantId
      const query = db
        .select({
          logId: auditLogs.logId,
          action: auditLogs.action,
          userId: auditLogs.userId,
          tenantId: auditLogs.tenantId, // Include tenantId in response for verification
          userName: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
          userEmail: tenantUsers.email,
          metadata: includeMetadata ? auditLogs.details : sql`NULL`,
          ipAddress: auditLogs.ipAddress,
          createdAt: auditLogs.createdAt
        })
        .from(auditLogs)
        .leftJoin(tenantUsers, and(
          eq(auditLogs.userId, tenantUsers.userId),
          eq(auditLogs.tenantId, tenantUsers.tenantId)
        ))
        .where(and(...whereConditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      const activities = await query;

      // Map actions to applications and add user info
      const enrichedActivities = activities.map(activity => {
        // Map action to application
        let appCode = 'system';
        let appName = 'System';

        // Map action to application
        if (activity.action.startsWith('api.')) {
          // Extract app code from action like "api.post.users"
          const parts = activity.action.split('.');
          if (parts.length >= 3) {
            appCode = parts[2];
            appName = parts[2].charAt(0).toUpperCase() + parts[2].slice(1);
          }
        } else if (activity.action.includes('tenant.') || activity.action.includes('admin.tenant')) {
          appCode = 'admin';
          appName = 'Admin Panel';
        } else if (activity.action.includes('user.') || activity.action.includes('auth.')) {
          appCode = 'users';
          appName = activity.action.includes('auth.') ? 'Authentication' : 'User Management';
        } else if (activity.action.includes('role.') || activity.action.includes('custom_role.') || activity.action.includes('permission.')) {
          appCode = 'permissions';
          appName = 'Permissions';
        } else if (activity.action.includes('subscription.') || activity.action.includes('payment.')) {
          appCode = 'billing';
          appName = 'Billing';
        } else if (activity.action.includes('organization.') || activity.action.includes('entity.') || activity.action.includes('location.')) {
          appCode = 'organization';
          appName = 'Organization';
        } else if (activity.action.includes('invitation.')) {
          appCode = 'invitations';
          appName = 'Invitations';
        } else if (activity.action.includes('webhook.')) {
          appCode = 'webhooks';
          appName = 'Webhooks';
        } else if (activity.action.includes('credit.')) {
          appCode = 'credits';
          appName = 'Credits';
        } else if (activity.action.includes('demo.')) {
          appCode = 'demo';
          appName = 'Demo';
        } else if (activity.action.includes('dns.')) {
          appCode = 'dns';
          appName = 'DNS Management';
        } else if (activity.action.includes('trial.')) {
          appCode = 'trial';
          appName = 'Trial Management';
        } else if (activity.action.includes('user_sync.')) {
          appCode = 'sync';
          appName = 'User Sync';
        } else if (activity.action.includes('crm_integration.')) {
          appCode = 'crm';
          appName = 'CRM Integration';
        }

        return {
          ...activity,
          appCode,
          appName,
          userInfo: {
            id: activity.userId,
            name: activity.userName || 'Unknown User',
            email: activity.userEmail || 'unknown@example.com'
          }
        };
      });

      const totalCountResult = await db
        .select({ count: sql`count(*)` })
        .from(auditLogs)
        .where(and(...whereConditions));

      const total = Number((totalCountResult[0] as { count: unknown })?.count ?? 0);

      return {
        activities: enrichedActivities,
        pagination: {
          limit,
          offset,
          total
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get user activity:', error);
      throw error;
    }
  }

  /**
   * Get tenant audit logs with filtering and pagination
   * MANDATORY: tenantId is required to ensure tenant isolation
   */
  async getTenantAuditLogs(
    tenantId: string,
    options: TenantAuditOptions = {}
  ): Promise<{
    logs: unknown[];
    pagination: { limit: number; offset: number; total: number; pages: number };
  }> {
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      throw new Error('Tenant ID is mandatory for retrieving tenant audit logs');
    }
    
    try {
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        actionFilter,
        resourceTypeFilter,
        userFilter,
        includeDetails = true
      } = options as TenantAuditOptions;

      // Define meaningful actions (no view activities)
      const meaningfulActions = [
        // Only create, update, delete operations for audit logs
        'user.created', 'user.updated', 'user.deleted',
        'role.created', 'role.updated', 'role.deleted',
        'custom_role.created', 'custom_role.updated', 'custom_role.deleted',
        'tenant.created', 'tenant.updated', 'tenant.settings_updated',
        'subscription.created', 'subscription.updated', 'subscription.cancelled'
      ];

      // MANDATORY: Tenant isolation enforced - all queries must filter by tenantId
      const conditions = [
        eq(auditLogs.tenantId, tenantId), // MANDATORY: Tenant isolation enforced
        inArray(auditLogs.action, meaningfulActions)
      ];

      if (startDate) {
        conditions.push(gte(auditLogs.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(auditLogs.createdAt, endDate));
      }

      if (actionFilter) {
        conditions.push(eq(auditLogs.action, actionFilter));
      }

      if (resourceTypeFilter) {
        conditions.push(eq(auditLogs.resourceType, resourceTypeFilter));
      }

      if (userFilter) {
        conditions.push(eq(auditLogs.userId, userFilter));
      }

      const logs = await db
        .select({
          logId: auditLogs.logId,
          userId: auditLogs.userId,
          userName: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
          userEmail: tenantUsers.email,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          oldValues: includeDetails ? auditLogs.oldValues : sql`NULL`,
          newValues: includeDetails ? auditLogs.newValues : sql`NULL`,
          details: includeDetails ? auditLogs.details : sql`NULL`,
          ipAddress: auditLogs.ipAddress,
          createdAt: auditLogs.createdAt
        })
        .from(auditLogs)
        .leftJoin(tenantUsers, eq(auditLogs.userId, tenantUsers.userId))
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: sql`count(*)` })
        .from(auditLogs)
        .where(and(...conditions));

      const total = Number((totalCountResult[0] as { count: unknown })?.count ?? 0);

      return {
        logs,
        pagination: {
          limit,
          offset,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get tenant audit logs:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for dashboard
   * MANDATORY: tenantId is required to ensure tenant isolation
   */
  async getActivityStats(tenantId: string, period: string = '24h'): Promise<{
    period: string;
    startDate: Date;
    endDate: Date;
    uniqueActiveUsers: number;
    activityBreakdown: { action: string; count: number }[];
    auditBreakdown: { resourceType: string; action: string; count: number }[];
  }> {
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      throw new Error('Tenant ID is mandatory for retrieving activity statistics');
    }
    
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // MANDATORY: Tenant isolation enforced - all queries must filter by tenantId
      // Get activity counts by type
      const activityStats = await db
        .select({
          action: auditLogs.action,
          count: sql`count(*)`.as('count')
        })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId), // MANDATORY: Tenant isolation enforced
          gte(auditLogs.createdAt, startDate)
        ))
        .groupBy(auditLogs.action);

      // MANDATORY: Tenant isolation enforced
      // Get audit event counts
      const auditStats = await db
        .select({
          resourceType: auditLogs.resourceType,
          action: auditLogs.action,
          count: sql`count(*)`.as('count')
        })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId), // MANDATORY: Tenant isolation enforced
          gte(auditLogs.createdAt, startDate)
        ))
        .groupBy(auditLogs.resourceType, auditLogs.action);

      // MANDATORY: Tenant isolation enforced
      // Get unique active users
      const activeUsersResult = await db
        .select({
          uniqueUsers: sql`count(distinct user_id)`.as('uniqueUsers')
        })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId), // MANDATORY: Tenant isolation enforced
          gte(auditLogs.createdAt, startDate)
        ));

      const uniqueActiveUsers = Number((activeUsersResult[0] as { uniqueUsers: unknown })?.uniqueUsers ?? 0);

      return {
        period,
        startDate,
        endDate: now,
        uniqueActiveUsers,
        activityBreakdown: activityStats.map((stat: { action: string; count: unknown }) => ({
          action: stat.action,
          count: Number(stat.count ?? 0)
        })),
        auditBreakdown: auditStats.map((stat: { resourceType: string; action: string; count: unknown }) => ({
          resourceType: stat.resourceType,
          action: stat.action,
          count: Number(stat.count ?? 0)
        }))
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get activity stats:', error);
      throw error;
    }
  }

  /**
   * Helper method to create request context from request object
   */
  createRequestContext(
    request: Record<string, unknown> & {
      ip?: string;
      headers?: Record<string, string | undefined>;
      connection?: { remoteAddress?: string };
    },
    sessionId: string | null = null
  ): RequestContext {
    const headers = (request.headers ?? {}) as Record<string, string | undefined>;
    return {
      ipAddress: (request.ip as string) || headers['x-forwarded-for'] || (request.connection?.remoteAddress as string),
      userAgent: headers['user-agent'],
      sessionId: sessionId ?? headers['x-session-id'] ?? null,
      source: headers['x-source'] || 'web'
    };
  }

  /**
   * Batch log multiple activities (for bulk operations)
   */
  async logBatchActivities(
    activities: Record<string, unknown>[]
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      if (!activities || activities.length === 0) {
        return { success: true, count: 0 };
      }

      const activityData = activities.map((activity: Record<string, unknown>) => ({
        ...activity,
        metadata: {
          ...(activity.metadata as Record<string, unknown>),
          timestamp: new Date().toISOString(),
          batch: true,
        }
      }));

      await db.insert(auditLogs).values(activityData as unknown as typeof auditLogs.$inferInsert[]);

      console.log(`📊 Batch activities logged: ${activities.length} entries`);
      return { success: true, count: activities.length };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to log batch activities:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch log multiple audit events (for bulk operations)
   */
  async logBatchAuditEvents(
    auditEvents: Record<string, unknown>[]
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      if (!auditEvents || auditEvents.length === 0) {
        return { success: true, count: 0 };
      }

      const auditData = auditEvents.map((event: Record<string, unknown>) => ({
        ...event,
        details: {
          ...(event.details as Record<string, unknown>),
          timestamp: new Date().toISOString(),
          batch: true,
        }
      }));

      await db.insert(auditLogs).values(auditData as unknown as typeof auditLogs.$inferInsert[]);

      console.log(`🔍 Batch audit events logged: ${auditEvents.length} entries`);
      return { success: true, count: auditEvents.length };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to log batch audit events:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log error event with full context for debugging
   * MANDATORY: tenantId is required for error logging to ensure tenant isolation
   */
  async logError(
    tenantId: string,
    userId: string | null,
    error: unknown,
    requestContext: RequestContext = {},
    additionalContext: Record<string, unknown> = {}
  ): Promise<{ success: boolean; error?: string; requestId?: string; logId?: string }> {
    const requestId = Logger.generateRequestId('error-log');
    const err = error as Error & { statusCode?: number; code?: string };
    
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      console.error(`❌ [${requestId}] Error logging skipped: No tenantId provided`);
      return { success: false, error: 'Tenant ID is mandatory for error logging', requestId };
    }

    try {
      // Determine error type and severity
      const errorInfo = this.categorizeError(error);
      
      // Extract user ID if available
      const errorUserId = userId ?? requestContext.userId ?? null;

      Logger.activity.log(requestId, errorInfo.action, 'error', errorInfo.resourceType || 'system', {
        tenantId,
        userId: errorUserId,
        errorType: errorInfo.type,
        severity: errorInfo.severity,
        statusCode: errorInfo.statusCode,
        message: err.message,
        stack: err.stack,
        requestContext: {
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
          sessionId: requestContext.sessionId,
          url: requestContext.url,
          method: requestContext.method
        },
        additionalContext
      });

      const errorData = {
        tenantId, // MANDATORY: Tenant isolation enforced
        userId: errorUserId,
        action: errorInfo.action,
        resourceType: 'error',
        resourceId: requestId, // Use requestId as resourceId for error correlation
        details: {
          errorType: errorInfo.type,
          severity: errorInfo.severity,
          statusCode: errorInfo.statusCode,
          message: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
          code: err.code,
          name: err.name,
          url: requestContext.url,
          method: requestContext.method,
          requestId: requestId,
          timestamp: new Date().toISOString(),
          ...additionalContext
        },
        oldValues: null,
        newValues: null,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      };

      await db.insert(auditLogs).values(errorData);

      console.log(`✅ [${requestId}] Error logged successfully: ${errorInfo.action} (${errorInfo.severity})`);
      return { success: true, requestId, logId: requestId };
    } catch (logErr: unknown) {
      const logError = logErr as Error;
      console.error(`❌ [${requestId}] Failed to log error:`, {
        error: logError.message,
        originalError: err.message,
        tenantId,
        userId,
        stack: logError.stack
      });
      return { success: false, error: logError.message, requestId };
    }
  }

  /**
   * Categorize error and determine appropriate action type and severity
   */
  categorizeError(error: unknown): {
    action: string;
    type: string;
    severity: string;
    statusCode: number;
    resourceType: string;
  } {
    const err = error as Error & { statusCode?: number; code?: string; validation?: unknown; name?: string };
    let action = ActivityLogger.ACTIVITY_TYPES.ERROR_INTERNAL_ERROR;
    let severity = 'high';
    let statusCode = 500;
    let type = 'unknown';

    // HTTP status code errors
    if (err.statusCode) {
      statusCode = err.statusCode;
      
      if (statusCode >= 400 && statusCode < 500) {
        severity = statusCode === 401 || statusCode === 403 ? 'high' : 'medium';
        
        if (statusCode === 400) {
          action = ActivityLogger.ACTIVITY_TYPES.ERROR_VALIDATION_ERROR;
          type = 'validation';
        } else if (statusCode === 401) {
          action = ActivityLogger.ACTIVITY_TYPES.ERROR_AUTH_ERROR;
          type = 'authentication';
        } else if (statusCode === 403) {
          action = ActivityLogger.ACTIVITY_TYPES.ERROR_AUTH_ERROR;
          type = 'authorization';
        } else if (statusCode === 404) {
          action = ActivityLogger.ACTIVITY_TYPES.ERROR_NOT_FOUND;
          type = 'not_found';
          severity = 'low';
        } else if (statusCode === 409) {
          action = ActivityLogger.ACTIVITY_TYPES.ERROR_VALIDATION_ERROR;
          type = 'conflict';
        } else if (statusCode === 429) {
          action = ActivityLogger.ACTIVITY_TYPES.ERROR_RATE_LIMIT;
          type = 'rate_limit';
        }
      } else if (statusCode >= 500) {
        severity = 'critical';
        action = ActivityLogger.ACTIVITY_TYPES.ERROR_INTERNAL_ERROR;
        type = 'server_error';
      }
    }

    // Error code based categorization
    if (err.code) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || 
          err.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
        action = ActivityLogger.ACTIVITY_TYPES.ERROR_AUTH_ERROR;
        type = 'authentication';
        severity = 'high';
        statusCode = 401;
      } else if (err.code === 'FST_RATE_LIMIT_REACHED') {
        action = ActivityLogger.ACTIVITY_TYPES.ERROR_RATE_LIMIT;
        type = 'rate_limit';
        severity = 'medium';
        statusCode = 429;
      } else if (err.code === 'ECONNREFUSED') {
        action = ActivityLogger.ACTIVITY_TYPES.ERROR_SERVICE_UNAVAILABLE;
        type = 'service_unavailable';
        severity = 'high';
        statusCode = 503;
      }
    }

    // Database errors
    if (err.name === 'DrizzleError' || (typeof err.code === 'string' && err.code.startsWith('23'))) {
      action = ActivityLogger.ACTIVITY_TYPES.ERROR_DATABASE_ERROR;
      type = 'database';
      severity = 'critical';
      statusCode = 500;
    }

    // Validation errors
    if (err.validation || err.name === 'ValidationError') {
      action = ActivityLogger.ACTIVITY_TYPES.ERROR_VALIDATION_ERROR;
      type = 'validation';
      severity = 'low';
      statusCode = 400;
    }

    return {
      action,
      type,
      severity,
      statusCode,
      resourceType: type === 'database' ? 'database' : 'api'
    };
  }

  /**
   * Get error logs with filtering and pagination
   * MANDATORY: tenantId is required to ensure tenant isolation
   */
  async getErrorLogs(
    tenantId: string,
    options: ErrorLogOptions = {}
  ): Promise<{
    errors: unknown[];
    pagination: { limit: number; offset: number; total: number; pages: number };
  }> {
    // MANDATORY: Validate tenantId is provided
    if (!tenantId) {
      throw new Error('Tenant ID is mandatory for retrieving error logs');
    }

    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        severity,
        errorType,
        statusCode,
        logId
      } = options as ErrorLogOptions;

      const whereConditions = [
        eq(auditLogs.tenantId, tenantId), // MANDATORY: Tenant isolation enforced
        eq(auditLogs.resourceType, 'error') // Only get error logs
      ];

      if (startDate) {
        whereConditions.push(gte(auditLogs.createdAt, startDate));
      }

      if (endDate) {
        whereConditions.push(lte(auditLogs.createdAt, endDate));
      }

      if (severity) {
        whereConditions.push(sql`${auditLogs.details}->>'severity' = ${String(severity)}`);
      }

      if (errorType) {
        whereConditions.push(sql`${auditLogs.details}->>'errorType' = ${String(errorType)}`);
      }

      if (statusCode !== undefined && statusCode !== null) {
        whereConditions.push(sql`${auditLogs.details}->>'statusCode' = ${String(statusCode)}`);
      }

      if (logId) {
        whereConditions.push(eq(auditLogs.resourceId, logId));
      }

      const errors = await db
        .select({
          logId: auditLogs.logId,
          action: auditLogs.action,
          userId: auditLogs.userId,
          tenantId: auditLogs.tenantId,
          userName: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
          userEmail: tenantUsers.email,
          details: auditLogs.details,
          ipAddress: auditLogs.ipAddress,
          createdAt: auditLogs.createdAt
        })
        .from(auditLogs)
        .leftJoin(tenantUsers, and(
          eq(auditLogs.userId, tenantUsers.userId),
          eq(auditLogs.tenantId, tenantUsers.tenantId)
        ))
        .where(and(...whereConditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: sql`count(*)` })
        .from(auditLogs)
        .where(and(...whereConditions));

      const total = Number((totalCountResult[0] as { count: unknown })?.count ?? 0);

      const detailsRecord = (row: { details?: unknown; logId?: string }) =>
        (row.details as Record<string, unknown> | null) ?? {};

      return {
        errors: errors.map((row: { details?: unknown; logId?: string; [k: string]: unknown }) => {
          const details = detailsRecord(row);
          return {
            ...row,
            errorType: details.errorType,
            severity: details.severity,
            statusCode: details.statusCode,
            message: details.message,
            requestId: details.requestId ?? row.logId
          };
        }),
        pagination: {
          limit,
          offset,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get error logs:', error);
      throw error;
    }
  }
}

// Create instance
const activityLogger = new ActivityLogger();

// Export the instance as default and also export the static constants
export default activityLogger;
export const ACTIVITY_TYPES = ActivityLogger.ACTIVITY_TYPES;
export const RESOURCE_TYPES = ActivityLogger.RESOURCE_TYPES; 