/**
 * 🔐 **USER APPLICATION ACCESS ROUTES**
 * API endpoints for managing user application access and external sync
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserClassificationService, UserSyncService } from '../index.js';

export default async function userApplicationRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  
  /**
   * GET /api/user-applications/users
   * Get all users with their application access
   */
  fastify.get('/users', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId } = request.userContext as { tenantId: string };
      const _queryOptions = request.query;

      // Use the working classification service instead
      const classification = await UserClassificationService.classifyUsersByApplication(tenantId);
      const byUser = classification.byUser as Record<string, Record<string, unknown>>;
      
      // Transform to match expected format
      const users = Object.entries(byUser).map(([userId, userData]) => {
        const allowedApps = (userData.allowedApplications as string[]) ?? [];
        return {
          userId,
          kindeUserId: userData.kindeUserId,
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          title: userData.title,
          department: userData.department,
          isActive: userData.isActive,
          isTenantAdmin: userData.isTenantAdmin,
          lastActiveAt: userData.lastActiveAt,
          lastLoginAt: userData.lastLoginAt,
          onboardingCompleted: userData.onboardingCompleted,
          applicationAccess: allowedApps.map((appCode: string) => ({
            appId: appCode,
            appCode,
            appName: UserClassificationService.getAppName(appCode),
            description: UserClassificationService.getAppDescription(appCode),
            icon: UserClassificationService.getAppIcon(appCode),
            baseUrl: UserClassificationService.getAppUrl(appCode),
            status: 'active',
            isCore: true,
            modules: [],
            permissions: []
          })),
          totalApplications: allowedApps.length,
          hasAnyAccess: allowedApps.length > 0
        };
      });

      const queryParams = request.query as { page?: string; limit?: string; [key: string]: unknown };
      const page = Math.max(1, parseInt(queryParams.page || '1', 10));
      const limit = Math.min(Math.max(1, parseInt(queryParams.limit || '20', 10)), 100);
      const offset = (page - 1) * limit;

      const sliced = users.slice(offset, offset + limit + 1);
      const hasMore = sliced.length > limit;
      const items = hasMore ? sliced.slice(0, limit) : sliced;

      return reply.send({
        success: true,
        data: items,
        meta: {
          page,
          limit,
          hasMore,
          total: users.length,
          usersWithAccess: users.filter(u => u.hasAnyAccess).length,
          usersWithoutAccess: users.filter(u => !u.hasAnyAccess).length
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching users with application access:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch users with application access'
      });
    }
  });

  /**
   * GET /api/user-applications/users/:userId
   * Get specific user's application access
   */
  fastify.get('/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId } = request.userContext as { tenantId: string };
      const params = request.params as Record<string, string>;
      const userId = params.userId;
      const _query = request.query;

      // Use the working classification service
      const userAccess = await UserClassificationService.getUserApplicationAccess(userId, tenantId);
      
      if (!userAccess) {
        return reply.code(404).send({
          success: false,
          error: 'User not found or has no application access'
        });
      }

      const allowedApps = (userAccess.allowedApplications as string[]) ?? [];
      const applicationAccess = allowedApps.map((appCode: string) => ({
        appId: appCode,
        appCode,
        appName: UserClassificationService.getAppName(appCode),
        description: UserClassificationService.getAppDescription(appCode),
        icon: UserClassificationService.getAppIcon(appCode),
        baseUrl: UserClassificationService.getAppUrl(appCode),
        status: 'active',
        isCore: true,
        modules: [],
        permissions: []
      }));

      return reply.send({
        success: true,
        data: {
          userId,
          applicationAccess,
          totalApplications: applicationAccess.length
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching user application access:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user application access'
      });
    }
  });

  /**
   * GET /api/user-applications/summary
   * Get application access summary statistics
   */
  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId } = request.userContext as { tenantId: string };

      // Use the working classification service
      const classification = await UserClassificationService.classifyUsersByApplication(tenantId);
      const summaryData = classification.summary as Record<string, unknown>;
      const byUser = classification.byUser as Record<string, { allowedApplications: unknown[] }>;
      const byApplication = classification.byApplication as Record<string, { totalUsers: number }>;
      
      const summary = {
        totalUsers: summaryData.totalUsers as number,
        enabledApplications: Object.keys(byApplication).length,
        usersWithAccess: Object.values(byUser).filter(user => (user.allowedApplications?.length ?? 0) > 0).length,
        usersWithoutAccess: Object.values(byUser).filter(user => (user.allowedApplications?.length ?? 0) === 0).length,
        applicationUsage: Object.entries(byApplication).map(([appCode, appData]) => ({
          appId: appCode,
          appCode,
          appName: UserClassificationService.getAppName(appCode),
          userCount: appData.totalUsers
        }))
      };

      return reply.send({
        success: true,
        data: summary
      });
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching application access summary:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch application access summary'
      });
    }
  });

  /**
   * POST /api/user-applications/sync/:appCode
   * Sync users to specific external application
   */
  fastify.post('/sync/:appCode', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId } = request.userContext as { tenantId: string };
      const params = request.params as Record<string, string>;
      const appCode = params.appCode;
      const options = (request.body as Record<string, unknown>) || {};

      // Use the working sync service directly
      const syncResults = await UserSyncService.syncUsersForApplication(
        tenantId, 
        appCode, 
        { 
          syncType: (options.forceSync as boolean) ? 'full' : 'incremental',
          dryRun: options.dryRun as boolean
        }
      );

      return reply.send({
        success: true,
        data: syncResults
      });
    } catch (err: unknown) {
      const error = err as Error;
      const params = request.params as Record<string, string>;
      fastify.log.error(error, `Error syncing users to ${params.appCode}:`);
      return reply.code(500).send({
        success: false,
        error: `Failed to sync users to ${params.appCode}`
      });
    }
  });

  /**
   * POST /api/user-applications/sync/bulk
   * Bulk sync all users to all their accessible applications
   */
  fastify.post('/sync/bulk', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId } = request.userContext as { tenantId: string };
      const body = (request.body as Record<string, unknown>) || {};
      const dryRun = (body.dryRun as boolean) ?? false;

      // Use the working sync service directly
      const bulkResults = await UserSyncService.syncAllUsersForTenant(tenantId, { 
        syncType: 'full',
        dryRun 
      });

      return reply.send({
        success: true,
        data: bulkResults
      });
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, 'Error in bulk sync:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to perform bulk sync'
      });
    }
  });

  /**
   * POST /api/user-applications/sync/user/:userId
   * Sync specific user to all their accessible applications
   */
  fastify.post('/sync/user/:userId', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId } = request.userContext as { tenantId: string };
      const params = request.params as Record<string, string>;
      const userId = params.userId;
      const _body = request.body || {};

      // Use the working sync service directly
      const syncResults = await UserSyncService.syncUserToApplications(
        userId, 
        tenantId, 
        { 
          syncType: 'update',
          dryRun: false
        }
      );

      return reply.send({
        success: true,
        data: syncResults
      });
    } catch (err: unknown) {
      const error = err as Error;
      const params = request.params as Record<string, string>;
      fastify.log.error(error, `Error syncing user ${params.userId}:`);
      return reply.code(500).send({
        success: false,
        error: `Failed to sync user ${params.userId}`
      });
    }
  });
}