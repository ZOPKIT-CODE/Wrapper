import type { FastifyRequest, FastifyReply } from 'fastify';
import ActivityLogger, { ACTIVITY_TYPES, RESOURCE_TYPES } from '../services/activityLogger.js';

export interface TrackActivityOptions {
  skipPatterns?: RegExp[];
}

/**
 * Activity Tracking Middleware
 * Automatically logs user activities based on request patterns
 */

/**
 * Main activity tracking middleware
 */
export const trackActivity = (options: TrackActivityOptions = {}) => {
  return (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    // Skip tracking for certain routes or methods
    const skipPatterns = options.skipPatterns ?? [
      /\/health/,
      /\/metrics/,
      /\/favicon/,
      /\/static/,
      /\/api\/auth\/token/,
      /\/api\/activity/, // Skip activity logging for activity endpoints to avoid recursion
      /\/api\/onboarding\// // Pre-onboarding users have no tenantId; skip to avoid noisy logs
    ];

    const shouldSkip = skipPatterns.some((pattern: RegExp) => 
      pattern.test(request.url) || 
      (request.method === 'OPTIONS')
    );

    if (shouldSkip) {
      return done();
    }

    // Store original request info
    const ua = request.headers['user-agent'];
    const sessionId = request.headers['x-session-id'];
    request.activityContext = {
      startTime: Date.now(),
      method: request.method,
      url: request.url,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
      ipAddress: (request as { ip?: string }).ip || (request.headers['x-forwarded-for'] as string | undefined) || (request as { connection?: { remoteAddress?: string } }).connection?.remoteAddress,
      sessionId: Array.isArray(sessionId) ? sessionId[0] : sessionId ?? request.user?.sessionId
    };

    // Store original reply.send method to track after response
    const originalSend = reply.send.bind(reply);
    reply.send = function(payload: unknown) {
      // Call original send method
      const result = originalSend(payload);
      
      // Track activity after response (non-blocking)
      // Also capture errors if status code indicates an error
      setImmediate(() => {
        logRequestActivity(request, reply, options);
        
        // If response indicates an error, log it separately
        if (reply.statusCode >= 400 && request.user?.tenantId) {
          logErrorActivity(request, reply, payload, options);
        }
      });
      
      return result;
    };

    done();
  };
};

/**
 * Log activity based on request details
 */
async function logRequestActivity(request: FastifyRequest, reply: FastifyReply, _options: TrackActivityOptions = {}) {
  try {
    if (!request.user) {
      return; // Skip if no authenticated user
    }

    const { method, url, activityContext } = request;
    const { tenantId } = request.user;
    
    if (!tenantId) {
      // Skip logging for onboarding and other expected no-tenant paths
      if (!/\/api\/onboarding\//.test(url) && !/\/api\/admin\/auth-status/.test(url)) {
        console.log('⚠️ Activity tracking skipped: No tenantId for', url);
      }
      return;
    }
    
    // Use internal user ID, not Kinde user ID
    const userId = request.user.internalUserId || request.user.userId;
    if (!userId) {
      if (!/\/api\/onboarding\//.test(url)) {
        console.log('⚠️ Activity tracking skipped: No userId for', url);
      }
      return;
    }
    
    // Determine activity type and details based on URL patterns
    const activityInfo = determineActivityType(method, url, (request.body ?? {}) as Record<string, unknown>);
    
    if (!activityInfo) {
      return; // Skip if not a trackable activity
    }

    const requestContext = ActivityLogger.createRequestContext(request as never, undefined);
    
    console.log(`📝 Logging activity: ${activityInfo.action} for user ${userId}, tenant ${tenantId}, URL: ${url}`);
    
    // Log the activity
    const result = await ActivityLogger.logActivity(
      userId,
      tenantId,
      activityInfo.appId,
      activityInfo.action,
      {
        method,
        url,
        responseStatus: reply.statusCode,
        duration: Date.now() - (activityContext?.startTime || Date.now()),
        ...activityInfo.metadata
      },
      requestContext
    );

    if (!result.success) {
      console.error(`❌ Failed to log activity: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ Failed to track request activity:', error);
    // Don't throw - logging failures shouldn't affect the main request
  }
}

/**
 * Determine activity type based on request patterns
 * Logs meaningful operations including API calls
 */
function determineActivityType(method: string, url: string, body: Record<string, unknown> = {}) {
  const bodyObj = body as { email?: string; name?: string; appCode?: string; roleName?: string };
  const patterns: Array<{ pattern: RegExp; action: string; appId: string | null; method?: string; metadata?: Record<string, unknown> }> = [
    // Authentication activities
    {
      pattern: /\/api\/auth\/login/,
      action: ACTIVITY_TYPES.AUTH_LOGIN,
      appId: null
    },
    {
      pattern: /\/api\/auth\/logout/,
      action: ACTIVITY_TYPES.AUTH_LOGOUT,
      appId: null
    },
    {
      pattern: /\/api\/auth\/me/,
      method: 'GET',
      action: ACTIVITY_TYPES.AUTH_TOKEN_REFRESH,
      appId: null
    },

    // User management activities
    {
      pattern: /\/api\/tenants\/current\/users$/,
      method: 'POST',
      action: ACTIVITY_TYPES.USER_INVITED,
      appId: null,
      metadata: { invitedEmail: bodyObj?.email }
    },
    {
      pattern: /\/api\/tenants\/current\/users\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.USER_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/tenants\/current\/users\/(.+)\/promote/,
      method: 'POST',
      action: ACTIVITY_TYPES.USER_PROMOTED,
      appId: null
    },
    {
      pattern: /\/api\/tenants\/current\/users\/(.+)\/deactivate/,
      method: 'POST',
      action: ACTIVITY_TYPES.USER_DEACTIVATED,
      appId: null
    },

    // Role management activities
    {
      pattern: /\/api\/roles\/?$/,
      method: 'POST',
      action: ACTIVITY_TYPES.ROLE_CREATED,
      appId: null,
      metadata: { roleName: bodyObj?.name }
    },
    {
      pattern: /\/api\/roles\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.ROLE_UPDATED,
      appId: null,
      metadata: { roleId: extractIdFromUrl(url) }
    },
    {
      pattern: /\/api\/roles\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.ROLE_DELETED,
      appId: null,
      metadata: { roleId: extractIdFromUrl(url) }
    },

    // Permission-based role activities
    {
      pattern: /\/api\/permissions\/roles\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.ROLE_UPDATED,
      appId: null,
      metadata: { roleId: extractIdFromUrl(url) }
    },
    {
      pattern: /\/api\/permissions\/roles\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.ROLE_DELETED,
      appId: null,
      metadata: { roleId: extractIdFromUrl(url) }
    },

    // Application access
    {
      pattern: /\/api\/suite\/sso\/redirect/,
      method: 'POST',
      action: ACTIVITY_TYPES.APP_SSO_LOGIN,
      appId: null,
      metadata: { appCode: bodyObj?.appCode }
    },
    {
      pattern: /\/api\/suite\/applications/,
      method: 'GET',
      action: ACTIVITY_TYPES.APP_ACCESSED,
      appId: null
    },

    // Permission activities
    {
      pattern: /\/api\/permissions/,
      method: 'POST',
      action: ACTIVITY_TYPES.PERMISSION_GRANTED,
      appId: null
    },
    {
      pattern: /\/api\/permissions\/(.+)/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.PERMISSION_REVOKED,
      appId: null
    },

    // Data export/import
    {
      pattern: /\/api\/.*\/export/,
      method: 'POST',
      action: ACTIVITY_TYPES.DATA_EXPORT,
      appId: null
    },
    {
      pattern: /\/api\/.*\/import/,
      method: 'POST',
      action: ACTIVITY_TYPES.DATA_IMPORT,
      appId: null
    },

    // Bulk operations
    {
      pattern: /\/api\/.*\/bulk/,
      method: 'POST',
      action: ACTIVITY_TYPES.DATA_BULK_UPDATE,
      appId: null
    },

    // Tenant management activities (only meaningful operations)
    {
      pattern: /\/api\/tenants\/current\/settings$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.TENANT_SETTINGS_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/tenants\/current\/users$/,
      method: 'POST',
      action: ACTIVITY_TYPES.TENANT_USER_INVITED,
      appId: null
    },
    {
      pattern: /\/api\/tenants\/current\/users\/(.+)\/activate$/,
      method: 'POST',
      action: ACTIVITY_TYPES.TENANT_USER_ACTIVATED,
      appId: null
    },
    {
      pattern: /\/api\/tenants\/current\/users\/(.+)\/deactivate$/,
      method: 'POST',
      action: ACTIVITY_TYPES.TENANT_USER_DEACTIVATED,
      appId: null
    },

    // User profile activities (only updates)
    {
      pattern: /\/api\/users\/me$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.USER_PROFILE_UPDATED,
      appId: null
    },

    // Subscription activities (only meaningful operations)
    {
      pattern: /\/api\/subscriptions$/,
      method: 'POST',
      action: ACTIVITY_TYPES.SUBSCRIPTION_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/subscriptions\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.SUBSCRIPTION_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/subscriptions\/(.+)\/cancel$/,
      method: 'POST',
      action: ACTIVITY_TYPES.SUBSCRIPTION_CANCELLED,
      appId: null
    },

    // Payment activities (only meaningful operations)
    {
      pattern: /\/api\/payments$/,
      method: 'POST',
      action: ACTIVITY_TYPES.PAYMENT_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/payment-upgrade$/,
      method: 'POST',
      action: ACTIVITY_TYPES.PAYMENT_UPGRADED,
      appId: null
    },

    // Organization activities (only meaningful operations)
    {
      pattern: /\/api\/organizations$/,
      method: 'POST',
      action: ACTIVITY_TYPES.ENTITY_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/organizations\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.ENTITY_UPDATED,
      appId: null
    },

    // Entity activities (only meaningful operations)
    {
      pattern: /\/api\/entities$/,
      method: 'POST',
      action: ACTIVITY_TYPES.ENTITY_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/entities\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.ENTITY_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/entities\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.ENTITY_DELETED,
      appId: null
    },

    // Invitation activities (only meaningful operations)
    {
      pattern: /\/api\/invitations$/,
      method: 'POST',
      action: ACTIVITY_TYPES.INVITATION_SENT,
      appId: null
    },
    {
      pattern: /\/api\/invitations\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.INVITATION_CANCELLED,
      appId: null
    },

    // Location activities (only meaningful operations)
    {
      pattern: /\/api\/locations$/,
      method: 'POST',
      action: ACTIVITY_TYPES.LOCATION_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/locations\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.LOCATION_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/locations\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.LOCATION_DELETED,
      appId: null
    },

    // Credit activities (only meaningful operations)
    {
      pattern: /\/api\/credits$/,
      method: 'POST',
      action: ACTIVITY_TYPES.CREDIT_ALLOCATED,
      appId: null
    },

    // Demo activities (only meaningful operations)
    {
      pattern: /\/api\/demo/,
      method: 'POST',
      action: ACTIVITY_TYPES.DEMO_REQUESTED,
      appId: null
    },

    // DNS Management activities (only meaningful operations)
    {
      pattern: /\/api\/dns/,
      method: 'POST',
      action: ACTIVITY_TYPES.DNS_UPDATED,
      appId: null
    },

    // Trial activities (only meaningful operations)
    {
      pattern: /\/api\/trial/,
      method: 'POST',
      action: ACTIVITY_TYPES.TRIAL_EXTENDED,
      appId: null
    },

    // Admin activities (only meaningful operations)
    {
      pattern: /\/api\/admin\/tenants/,
      method: 'POST',
      action: ACTIVITY_TYPES.ADMIN_TENANT_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/admin\/tenants\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.ADMIN_TENANT_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/admin\/tenants\/(.+)\/activate$/,
      method: 'POST',
      action: ACTIVITY_TYPES.ADMIN_TENANT_ACTIVATED,
      appId: null
    },
    {
      pattern: /\/api\/admin\/tenants\/(.+)\/deactivate$/,
      method: 'POST',
      action: ACTIVITY_TYPES.ADMIN_TENANT_DEACTIVATED,
      appId: null
    },

    // Webhook activities (only meaningful operations)
    {
      pattern: /\/api\/webhooks/,
      method: 'POST',
      action: ACTIVITY_TYPES.WEBHOOK_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/webhooks\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.WEBHOOK_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/webhooks\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.WEBHOOK_DELETED,
      appId: null
    },

    // Custom role activities (only meaningful operations)
    {
      pattern: /\/api\/custom-roles$/,
      method: 'POST',
      action: ACTIVITY_TYPES.CUSTOM_ROLE_CREATED,
      appId: null
    },
    {
      pattern: /\/api\/custom-roles\/create-from-builder$/,
      method: 'POST',
      action: ACTIVITY_TYPES.CUSTOM_ROLE_CREATED,
      appId: null,
      metadata: { roleName: bodyObj?.roleName }
    },
    {
      pattern: /\/api\/custom-roles\/(.+)$/,
      method: 'PUT',
      action: ACTIVITY_TYPES.CUSTOM_ROLE_UPDATED,
      appId: null
    },
    {
      pattern: /\/api\/custom-roles\/(.+)$/,
      method: 'DELETE',
      action: ACTIVITY_TYPES.CUSTOM_ROLE_DELETED,
      appId: null
    },

    // Permission matrix activities (only meaningful operations)
    {
      pattern: /\/api\/permission-matrix/,
      method: 'POST',
      action: ACTIVITY_TYPES.PERMISSION_MATRIX_UPDATED,
      appId: null
    },

    // User sync activities (only meaningful operations)
    {
      pattern: /\/api\/user-sync/,
      method: 'POST',
      action: ACTIVITY_TYPES.USER_SYNC_TRIGGERED,
      appId: null
    },

    // User application activities (only meaningful operations)
    {
      pattern: /\/api\/user-applications/,
      method: 'POST',
      action: ACTIVITY_TYPES.USER_APPLICATION_UPDATED,
      appId: null
    }
  ];

  for (const pattern of patterns) {
    if (pattern.pattern.test(url)) {
      // Check method if specified
      if (pattern.method && pattern.method !== method) {
        continue;
      }

      return {
        action: pattern.action,
        appId: pattern.appId,
        metadata: pattern.metadata || {}
      };
    }
  }

  // Log general API activity for POST, PUT, DELETE, PATCH operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // Extract app/module from URL
    const urlParts = url.split('/').filter(Boolean);
    let appCode = 'system';
    
    if (urlParts.length >= 2 && urlParts[0] === 'api') {
      appCode = urlParts[1]; // e.g., 'users', 'roles', 'permissions'
    }

    return {
      action: `api.${method.toLowerCase()}.${appCode}`,
      appId: appCode,
      metadata: {
        endpoint: url,
        method: method
      }
    };
  }

  return null; // No matching pattern found for GET requests
}

/**
 * Extract ID from URL path
 */
function extractIdFromUrl(url: string) {
  const matches = url.match(/\/([a-f0-9-]{36})\/?$/);
  return matches ? matches[1] : null;
}

/**
 * Middleware for tracking specific user actions (manual)
 */
export const trackUserAction = (action: string, options: { appId?: string | null; metadata?: Record<string, unknown> } = {}) => {
  return async (request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) => {
    try {
      if (!request.user) {
        return done();
      }

      const { tenantId } = request.user;
      const userId = request.user.internalUserId || request.user.userId;
      
      if (!userId || !tenantId) {
        return done();
      }
      
      const requestContext = ActivityLogger.createRequestContext(request as never as Record<string, unknown>);

      request.pendingActivity = {
        userId,
        tenantId,
        action,
        appId: (options.appId ?? null) as string | null,
        metadata: {
          ...(options.metadata ?? {}),
          url: request.url,
          method: request.method
        },
        requestContext
      };

      done();
    } catch (error) {
      console.error('❌ Failed to prepare activity tracking:', error);
      done(); // Continue even if tracking fails
    }
  };
};

/**
 * Middleware to complete tracked action (after successful operation)
 */
export const completeTrackedAction = () => {
  return async (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    try {
      if (request.pendingActivity && reply.statusCode < 400) {
        const activity = request.pendingActivity;
        
        // Log the activity asynchronously
        setImmediate(async () => {
          await ActivityLogger.logActivity(
            activity.userId,
            activity.tenantId,
            activity.appId ?? null,
            activity.action,
            {
              ...activity.metadata,
              responseStatus: reply.statusCode,
              completedAt: new Date().toISOString()
            },
            activity.requestContext as Record<string, unknown>
          );
        });
      }
      done();
    } catch (error) {
      console.error('❌ Failed to complete activity tracking:', error);
      done();
    }
  };
};

/**
 * Middleware for tracking audit events (for data changes)
 */
export const trackAuditEvent = (resourceType: string, options: { captureChanges?: boolean } = {}) => {
  return async (request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) => {
    try {
      if (!request.user) {
        return done();
      }

      const { tenantId } = request.user;
      const userId = request.user.internalUserId || request.user.userId;
      
      if (!userId || !tenantId) {
        return done();
      }
      
      const requestContext = ActivityLogger.createRequestContext(request as never as Record<string, unknown>);

      const params = request.params as { id?: string } | undefined;
      if (options.captureChanges && params?.id) {
        request.auditContext = {
          resourceType,
          resourceId: params.id,
          tenantId,
          userId,
          requestContext,
          captureChanges: true
        };
      }

      done();
    } catch (error) {
      console.error('❌ Failed to prepare audit tracking:', error);
      done();
    }
  };
};

/**
 * Helper function to manually log audit events from route handlers
 */
export const logAuditEvent = async (request: FastifyRequest, action: string, resourceId: string, changes: Record<string, unknown> = {}) => {
  try {
    if (!request.user || !request.auditContext) return;

    const ac = request.auditContext;
    if (!ac) return;
    const { tenantId, userId, resourceType, requestContext } = ac;

    await ActivityLogger.logAuditEvent(
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      changes,
      requestContext as Record<string, unknown>
    );
  } catch (error) {
    console.error('❌ Failed to log audit event:', error);
  }
};

/**
 * Track login activity specifically
 */
export const trackLogin = async (user: { internalUserId?: string | null; userId?: string; tenantId: string | null; email?: string }, request: FastifyRequest, success = true) => {
  try {
    const requestContext = ActivityLogger.createRequestContext(request as never);
    
    // Use internal user ID if available, otherwise fall back to userId
    const userId = user.internalUserId || user.userId;
    if (!userId) {
      console.error('❌ trackLogin: No valid user ID found');
      return;
    }
    
    const action = success 
      ? ACTIVITY_TYPES.AUTH_LOGIN 
      : ACTIVITY_TYPES.AUTH_FAILED_LOGIN;

    await ActivityLogger.logActivity(
      userId,
      user.tenantId ?? '',
      null, // No specific app for login
      action,
      {
        email: user.email,
        success,
        loginMethod: 'kinde',
        timestamp: new Date().toISOString()
      },
      requestContext
    );

    // Also log as audit event for security tracking
    await ActivityLogger.logAuditEvent(
      user.tenantId ?? '',
      userId,
      success ? 'login' : 'login_failed',
      RESOURCE_TYPES.SESSION,
      String(request.headers['x-session-id'] || 'unknown'),
      {
        details: {
          email: user.email,
          success,
          loginMethod: 'kinde'
        }
      },
      requestContext
    );

  } catch (error) {
    console.error('❌ Failed to track login activity:', error);
  }
};

/**
 * Track logout activity specifically
 */
export const trackLogout = async (user: { internalUserId?: string | null; userId?: string; tenantId: string | null; email?: string }, request: FastifyRequest) => {
  try {
    const requestContext = ActivityLogger.createRequestContext(request as never);

    // Use internal user ID if available, otherwise fall back to userId
    const userId = user.internalUserId || user.userId;
    if (!userId) {
      console.error('❌ trackLogout: No valid user ID found');
      return;
    }

    await ActivityLogger.logActivity(
      userId,
      user.tenantId ?? '',
      null,
      ACTIVITY_TYPES.AUTH_LOGOUT,
      {
        email: user.email,
        logoutMethod: 'manual',
        timestamp: new Date().toISOString()
      },
      requestContext
    );

  } catch (error) {
    console.error('❌ Failed to track logout activity:', error);
  }
};

/**
 * Log error activity for API responses with error status codes
 */
async function logErrorActivity(request: FastifyRequest, reply: FastifyReply, payload: unknown, _options: TrackActivityOptions = {}) {
  try {
    if (!request.user) {
      return; // Skip if no authenticated user
    }

    const { tenantId } = request.user;
    const userId = request.user.internalUserId || request.user.userId;
    
    if (!tenantId || !userId) {
      return;
    }

    const { method, url } = request;
    const statusCode = reply.statusCode;
    
    // Only log significant errors (400+)
    if (statusCode < 400) {
      return;
    }

    const requestContext = ActivityLogger.createRequestContext(request as never, undefined);
    
    // Create error object from response
    const p = payload as Record<string, unknown> | null | undefined;
    const errorInfo = {
      statusCode,
      message: (p?.error ?? p?.message ?? `HTTP ${statusCode}`) as string,
      code: p?.code,
      details: p?.details,
      validation: p?.validation
    };

    // Determine error action based on status code
    let action = ACTIVITY_TYPES.ERROR_API_ERROR;
    if (statusCode === 400) {
      action = ACTIVITY_TYPES.ERROR_VALIDATION_ERROR;
    } else if (statusCode === 401 || statusCode === 403) {
      action = ACTIVITY_TYPES.ERROR_AUTH_ERROR;
    } else if (statusCode === 404) {
      action = ACTIVITY_TYPES.ERROR_NOT_FOUND;
    } else if (statusCode === 429) {
      action = ACTIVITY_TYPES.ERROR_RATE_LIMIT;
    } else if (statusCode >= 500) {
      action = ACTIVITY_TYPES.ERROR_INTERNAL_ERROR;
    }

    // Log as activity with error context
    await ActivityLogger.logActivity(
      userId,
      tenantId,
      null,
      action,
      {
        method,
        url,
        statusCode,
        errorMessage: errorInfo.message,
        errorCode: errorInfo.code,
        hasDetails: !!errorInfo.details,
        duration: Date.now() - (request.activityContext?.startTime || Date.now())
      },
      requestContext
    );

  } catch (error) {
    console.error('❌ Failed to log error activity:', error);
    // Don't throw - error logging failures shouldn't affect the main request
  }
} 