import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import ActivityLogger, { ACTIVITY_TYPES, RESOURCE_TYPES } from '../services/activityLogger.js';
import { authenticateToken } from '../middleware/auth/auth.js';
import { trackActivity } from '../middleware/activityTracker.js';
import Logger from '../utils/logger.js';

/**
 * Activity Logs API Routes
 * Provides endpoints for accessing user activities and audit logs
 */
export default async function activityRoutes(fastify: FastifyInstance, _opts?: Record<string, unknown>): Promise<void> {
  // Apply authentication and activity tracking to all routes
  fastify.addHook('preHandler', authenticateToken);
  fastify.addHook('preHandler', trackActivity());

  /**
   * Get current user's activity logs
   * GET /api/activity/user
   */
  fastify.get('/user', {
    schema: {
      description: 'Get current user activity logs',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // MANDATORY: Extract tenantId from authenticated user for tenant isolation
      const { tenantId } = request.user;
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'Tenant ID not found. Tenant isolation is mandatory.'
        });
      }
      
      // Use the internal user ID, not the Kinde user ID
      const userId = request.user.internalUserId || request.user.userId;
      Logger.log('info', 'routes', 'get-user-activity', 'Activity API - User context:', { userId, tenantId, internalUserId: request.user.internalUserId });

      if (!userId) {
        return reply.code(400).send({
          success: false,
          error: 'User ID not found'
        });
      }

      const q = request.query as Record<string, string | undefined>;
      const limit = q.limit ?? '50';
      const offset = q.offset ?? '0';
      const startDate = q.startDate;
      const endDate = q.endDate;
      const action = q.action;
      const app = q.app;

      const options: Record<string, unknown> = {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        actionFilter: action,
        appFilter: app,
        includeMetadata: true
      };

      if (startDate) {
        (options as Record<string, unknown>).startDate = new Date(startDate);
      }
      if (endDate) {
        (options as Record<string, unknown>).endDate = new Date(endDate);
      }

      // MANDATORY: Pass tenantId to ensure tenant isolation
      const result = await ActivityLogger.getUserActivity(userId, tenantId, options as Parameters<typeof ActivityLogger.getUserActivity>[2]);
      Logger.log('info', 'routes', 'get-user-activity', `Activity API - Result for user ${userId} tenant ${tenantId} : ${result.activities.length} activities found`);

      return reply.send({
        success: true,
        data: result
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'get-user-activity', '❌ Failed to get user activity', { error: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user activity'
      });
    }
  });

  /**
   * Get tenant audit logs (admin only)
   * GET /api/activity/audit
   */
  fastify.get('/audit', {
    schema: {
      description: 'Get tenant audit logs (admin only)',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if user is admin (simplified check - in production use proper permission system)
      const { tenantId, email, isTenantAdmin } = request.user;
      
      if (!isTenantAdmin && !email?.includes('admin')) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied. Admin privileges required.'
        });
      }

      const q = request.query as Record<string, string | undefined>;
      const limit = q.limit ?? '100';
      const offset = q.offset ?? '0';
      const startDate = q.startDate;
      const endDate = q.endDate;
      const action = q.action;
      const resourceType = q.resourceType;
      const userId = q.userId;
      const includeDetails = q.includeDetails ?? 'true';

      const options: Record<string, unknown> = {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        actionFilter: action,
        resourceTypeFilter: resourceType,
        userFilter: userId,
        includeDetails: includeDetails === 'true'
      };

      if (startDate) {
        (options as Record<string, unknown>).startDate = new Date(startDate);
      }
      if (endDate) {
        (options as Record<string, unknown>).endDate = new Date(endDate);
      }

      const result = await ActivityLogger.getTenantAuditLogs(tenantId ?? '', options as Parameters<typeof ActivityLogger.getTenantAuditLogs>[1]);
      Logger.log('info', 'routes', 'get-audit-logs', `Audit API - Result for tenant ${tenantId} : ${result.logs.length} logs found`);

      return reply.send({
        success: true,
        data: result
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'get-audit-logs', '❌ Failed to get audit logs', { error: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch audit logs'
      });
    }
  });

  /**
   * Get activity statistics
   * GET /api/activity/stats
   */
  fastify.get('/stats', {
    schema: {
      description: 'Get activity statistics for dashboard',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // MANDATORY: Extract tenantId from authenticated user for tenant isolation
      const { tenantId, isTenantAdmin, email } = request.user;
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'Tenant ID not found. Tenant isolation is mandatory.'
        });
      }
      
      // Check if user has permission to view stats
      if (!isTenantAdmin && !email?.includes('admin')) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied. Admin privileges required.'
        });
      }

      const qStats = request.query as Record<string, string | undefined>;
      const period = qStats.period ?? '24h';
      const stats = await ActivityLogger.getActivityStats(tenantId, period);

      return reply.send({
        success: true,
        data: stats
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'get-activity-stats', '❌ Failed to get activity stats', { error: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch activity statistics'
      });
    }
  });

  /**
   * Get user activity summary
   * GET /api/activity/user/:userId/summary
   */
  fastify.get('/user/:userId/summary', {
    schema: {
      description: 'Get user activity summary (admin only)',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // MANDATORY: Extract tenantId from authenticated user for tenant isolation
      const { tenantId, isTenantAdmin, email } = request.user;
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'Tenant ID not found. Tenant isolation is mandatory.'
        });
      }
      
      const params = request.params as Record<string, string>;
      const userId = params.userId;
      const q = request.query as Record<string, string | undefined>;
      const days = Number(q.days) || 30;

      // Check admin permissions
      if (!isTenantAdmin && !email?.includes('admin')) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied. Admin privileges required.'
        });
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // MANDATORY: Pass tenantId to ensure tenant isolation
      // Use the userId parameter directly as it should be the internal UUID
      const result = await ActivityLogger.getUserActivity(userId, tenantId, {
        limit: 1000, // Get more data for summary
        startDate,
        endDate,
        includeMetadata: false
      });

      // Process activities to create summary
      const activities = result.activities as Array<Record<string, unknown>>;
      const activityBreakdown: Record<string, number> = {};
      const appUsage: Record<string, number> = {};
      const dailyActivity: Array<{ date: string; count: number }> = [];

      // Group by activity type
      activities.forEach((activity: Record<string, unknown>) => {
        const action = String(activity.action ?? '');
        const appName = String(activity.appName ?? 'System');
        const date = new Date((activity.createdAt as string | Date) ?? 0).toDateString();

        activityBreakdown[action] = (activityBreakdown[action] || 0) + 1;
        appUsage[appName] = (appUsage[appName] || 0) + 1;

        const existingDay = dailyActivity.find(d => d.date === date);
        if (existingDay) {
          existingDay.count++;
        } else {
          dailyActivity.push({ date, count: 1 });
        }
      });

      dailyActivity.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const mostActiveDay = dailyActivity.reduce<{ date: string; count: number } | null>(
        (max, day) => (day.count > (max?.count ?? 0) ? day : max),
        null
      );

      const summary = {
        totalActivities: activities.length,
        period: { days, startDate, endDate },
        activityBreakdown,
        appUsage,
        dailyActivity,
        mostActiveDay,
        lastActivity: activities.length > 0 ? (activities[0].createdAt as string | Date) : null
      };

      return reply.send({
        success: true,
        data: summary
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'get-user-activity-summary', '❌ Failed to get user activity summary', { error: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user activity summary'
      });
    }
  });

  /**
   * Export activity logs
   * POST /api/activity/export
   */
  fastify.post('/export', {
    schema: {
      description: 'Export activity logs (admin only)',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // MANDATORY: Extract tenantId from authenticated user for tenant isolation
      const { tenantId, isTenantAdmin, email } = request.user;
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'Tenant ID not found. Tenant isolation is mandatory.'
        });
      }
      
      // Check admin permissions
      if (!isTenantAdmin && !email?.includes('admin')) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied. Admin privileges required.'
        });
      }

      const body = request.body as Record<string, unknown>;
      const type = (body.type as string) ?? 'audit';
      const format = (body.format as string) ?? 'json';
      const filters = (body.filters as Record<string, unknown>) ?? {};

      let data: unknown[];
      let filename: string;

      if (type === 'audit') {
        const result = await ActivityLogger.getTenantAuditLogs(tenantId, {
          limit: 10000,
          ...(filters as Record<string, unknown>),
          userFilter: filters.userId
        } as Parameters<typeof ActivityLogger.getTenantAuditLogs>[1]);
        data = result.logs as unknown[];
        filename = `audit-logs-${new Date().toISOString().split('T')[0]}`;
      } else {
        const userId = filters.userId as string;
        const result = await ActivityLogger.getUserActivity(userId, tenantId, {
          limit: 10000,
          ...(filters as Record<string, unknown>)
        } as Parameters<typeof ActivityLogger.getUserActivity>[2]);
        data = result.activities as unknown[];
        filename = `user-activities-${new Date().toISOString().split('T')[0]}`;
      }

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = convertToCSV(data, type);
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
        
        return reply.send(csvData);
      } else {
        // JSON format
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${filename}.json"`);
        
        return reply.send({
          exportedAt: new Date().toISOString(),
          type,
          count: data.length,
          data
        });
      }

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'export-activity-logs', '❌ Failed to export activity logs', { error: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        error: 'Failed to export activity logs'
      });
    }
  });

  /**
   * Get error logs
   * GET /api/activity/errors
   */
  fastify.get('/errors', {
    schema: {
      description: 'Get error logs for debugging',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // MANDATORY: Extract tenantId from authenticated user for tenant isolation
      const { tenantId } = request.user;
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'Tenant ID not found. Tenant isolation is mandatory.'
        });
      }

      const q = request.query as Record<string, string | undefined>;
      const limit = q.limit ?? '50';
      const offset = q.offset ?? '0';
      const startDate = q.startDate;
      const endDate = q.endDate;
      const severity = q.severity;
      const errorType = q.errorType;
      const statusCode = q.statusCode;
      const logId = q.logId;

      const options: Record<string, unknown> = {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        severity,
        errorType,
        statusCode: statusCode ? parseInt(statusCode, 10) : undefined,
        logId
      };

      if (startDate) {
        (options as Record<string, unknown>).startDate = new Date(startDate);
      }
      if (endDate) {
        (options as Record<string, unknown>).endDate = new Date(endDate);
      }

      const result = await ActivityLogger.getErrorLogs(tenantId, options as Parameters<typeof ActivityLogger.getErrorLogs>[1]);

      return reply.send({
        success: true,
        data: result
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'get-error-logs', '❌ Failed to get error logs', { error: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch error logs'
      });
    }
  });

  /**
   * Get available activity types and resource types
   * GET /api/activity/types
   */
  fastify.get('/types', {
    schema: {
      description: 'Get available activity and resource types',
      tags: ['Activity']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: {
        activityTypes: ACTIVITY_TYPES,
        resourceTypes: RESOURCE_TYPES
      }
    });
  });
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: unknown[], type: string): string {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  const headers = type === 'audit'
    ? ['Date', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address']
    : ['Date', 'Action', 'Application', 'IP Address'];

  const rows = data.map((item: unknown) => {
    const row = item as Record<string, unknown>;
    if (type === 'audit') {
      return [
        new Date((row.createdAt as string | Date) ?? 0).toISOString(),
        `${(row.userName as string) || 'Unknown'} (${(row.userEmail as string) || 'unknown'})`,
        row.action,
        row.resourceType,
        (row.resourceId as string) || '',
        (row.ipAddress as string) || ''
      ];
    } else {
      return [
        new Date((row.createdAt as string | Date) ?? 0).toISOString(),
        row.action,
        (row.appName as string) || 'System',
        (row.ipAddress as string) || ''
      ];
    }
  });

  return [
    headers.join(','),
    ...rows.map((row: unknown[]) => row.map((cell: unknown) => `"${String(cell)}"`).join(','))
  ].join('\n');
} 