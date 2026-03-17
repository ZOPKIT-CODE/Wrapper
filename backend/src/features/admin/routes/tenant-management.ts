/**
 * Admin Tenant Management Routes
 * Audience: platform staff (ops / SRE / super-admins) managing ANY tenant.
 * Mounted at: /api/admin/tenants
 *
 * Every route accepts a `:tenantId` path parameter so staff can operate on
 * any tenant in the system.  Requires ADMIN_TENANTS_VIEW / ADMIN_TENANTS_MANAGE
 * permissions (not available to ordinary company users).
 *
 * Routes:
 *   GET  /:tenantId/credit-debug          — raw credit ledger inspection
 *   POST /:tenantId/clean-orphaned-credits — remove credits with no valid owner
 *   GET  /:tenantId/details               — full tenant record
 *   PATCH /:tenantId/status               — update active/trial/subscription status
 *   POST /bulk/status                     — multi-tenant status snapshot
 *   GET  /:tenantId/activity              — recent audit-log events
 *   GET  /:tenantId/export                — full tenant data export
 *   GET  /:tenantId/stats                 — usage statistics
 *   GET  /:tenantId/comprehensive         — combined details + stats + activity
 *
 * ⚠️  For company-user self-service on their OWN tenant see
 *     company-tenant-settings-routes.ts (mounted at /api/admin via admin.ts).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, entities, credits, auditLogs, subscriptions, tenantInvitations } from '../../../db/schema/index.js';
import { eq, and, desc, sql, count, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import ActivityLogger from '../../../services/activityLogger.js';

type ReqWithUser = FastifyRequest & { userContext?: { userId?: string }; params?: Record<string, string>; query?: Record<string, string | undefined>; body?: Record<string, unknown> };

export default async function adminTenantManagementRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Debug endpoint to check credit consistency
  fastify.get('/:tenantId/credit-debug', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)],
    schema: {
      description: 'Debug credit calculation for a tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';

      // Get all credits for this tenant
      const allCredits = await db
        .select({
          creditId: credits.creditId,
          entityId: credits.entityId,
          availableCredits: credits.availableCredits,

          isActive: credits.isActive
        })
        .from(credits)
        .where(eq(credits.tenantId, tenantId as string));

      // Get credits that have valid entities (summed by entity)
      const validEntityCredits = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          totalAvailableCredits: sql`sum(${credits.availableCredits}::numeric)`,
          creditRecordCount: sql`count(${credits.creditId})`
        })
        .from(entities)
        .innerJoin(credits, and(
          eq(credits.entityId, entities.entityId),
          eq(credits.tenantId, tenantId),
          eq(credits.isActive, true)
        ))
        .groupBy(entities.entityId, entities.entityName);

      // Get credits without valid entities
      const orphanedCredits = await db
        .select({
          creditId: credits.creditId,
          entityId: credits.entityId,
          availableCredits: credits.availableCredits,
        })
        .from(credits)
        .leftJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.tenantId, tenantId),
          sql`${entities.entityId} is null`
        ));

      const totalAllCredits = allCredits.reduce((sum, c) => sum + parseFloat(c.availableCredits || '0'), 0);
      const totalValidCredits = validEntityCredits.reduce((sum, c) => sum + parseFloat(String((c as any).totalAvailableCredits ?? 0)), 0);
      const totalOrphanedCredits = orphanedCredits.reduce((sum, c) => sum + parseFloat(c.availableCredits || '0'), 0);

      return {
        success: true,
        data: {
          tenantId,
          summary: {
            totalCreditsFromAll: totalAllCredits.toFixed(2),
            totalCreditsFromValidEntities: totalValidCredits.toFixed(2),
            totalCreditsFromOrphaned: totalOrphanedCredits.toFixed(2),
            discrepancy: (totalAllCredits - totalValidCredits).toFixed(2)
          },
          allCredits: allCredits.slice(0, 10), // Limit for debugging
          validEntityCredits: validEntityCredits.slice(0, 10),
          orphanedCredits: orphanedCredits.slice(0, 10),
          counts: {
            totalCreditRecords: allCredits.length,
            validEntityCredits: validEntityCredits.length,
            orphanedCredits: orphanedCredits.length
          }
        }
      };
    } catch (error) {
      console.error('Error debugging tenant credits:', error);
      return reply.code(500).send({ error: 'Failed to debug tenant credits' });
    }
  });

  // Clean up orphaned credit records for a tenant
  fastify.post('/:tenantId/clean-orphaned-credits', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)],
    schema: {
      description: 'Clean up credit records that don\'t have corresponding entities'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
      const tenantId = params.tenantId ?? '';
    try {

      const orphanedCredits = await db
        .select({
          creditId: credits.creditId,
          entityId: credits.entityId,
          availableCredits: credits.availableCredits,
        })
        .from(credits)
        .leftJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.tenantId, tenantId),
          sql`${entities.entityId} is null`
        ));

      if (orphanedCredits.length === 0) {
        return {
          success: true,
          message: 'No orphaned credit records found',
          data: { orphanedCredits: 0 }
        };
      }

      // Delete orphaned credits
      const deletedCount = await db
        .delete(credits)
        .where(and(
          eq(credits.tenantId, tenantId),
          sql`${credits.entityId} not in (
            select ${entities.entityId} from ${entities}
            where ${entities.tenantId} = ${tenantId}
          )`
        ));

      console.log(`Admin ${(request as any).userContext?.userId} cleaned up ${deletedCount} orphaned credit records for tenant ${tenantId}`);

      return {
        success: true,
        message: `Cleaned up ${deletedCount} orphaned credit records`,
        data: {
          orphanedCredits: orphanedCredits.length,
          deletedRecords: deletedCount,
          totalCreditsCleaned: orphanedCredits.reduce((sum, c) => sum + parseFloat(c.availableCredits || '0'), 0).toFixed(2)
        }
      };
    } catch (error) {
      console.error('Error cleaning orphaned credits:', error);
      return reply.code(500).send({ error: 'Failed to clean orphaned credits' });
    }
  });

  // Get detailed tenant information including relationships
  fastify.get('/:tenantId/details', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)],
    schema: {
      description: 'Get comprehensive tenant details'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';

      // Get tenant basic info
      const tenantInfo = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenantInfo.length) {
        return reply.code(404).send({ error: 'Tenant not found' });
      }

      // Run all queries in parallel for performance
      const [
        tenantUsersList,
        entitySummary,
        creditSummary,
        subscriptionData,
        pendingInvitationsResult,
        recentActivityLogs
      ] = await Promise.all([
        // Tenant users with admin flag
        db.select({
          userId: tenantUsers.userId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isActive: tenantUsers.isActive,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          lastLoginAt: tenantUsers.lastLoginAt,
          createdAt: tenantUsers.createdAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId)),

        // Entity hierarchy summary
        db.select({
          total: count(),
          organizations: sql<number>`count(case when ${entities.entityType} = 'organization' then 1 end)`,
          locations: sql<number>`count(case when ${entities.entityType} = 'location' then 1 end)`,
          departments: sql<number>`count(case when ${entities.entityType} = 'department' then 1 end)`,
          teams: sql<number>`count(case when ${entities.entityType} = 'team' then 1 end)`,
          active: sql<number>`count(case when ${entities.isActive} = true then 1 end)`
        })
        .from(entities)
        .where(eq(entities.tenantId, tenantId)),

        // Credit summary with reserved
        db.select({
          totalCredits: sql<string>`coalesce(sum(${credits.availableCredits}::numeric), 0)`,
          reservedCredits: sql<string>`coalesce(sum(case when ${credits.isActive} = false then ${credits.availableCredits}::numeric else 0 end), 0)`,
          activeEntities: sql<number>`count(case when ${credits.isActive} = true then 1 end)`,
          averageCredits: sql<string>`coalesce(avg(case when ${credits.isActive} = true then ${credits.availableCredits}::numeric end), 0)`
        })
        .from(credits)
        .where(eq(credits.tenantId, tenantId)),

        // Current subscription
        db.select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          billingCycle: subscriptions.billingCycle,
          yearlyPrice: subscriptions.yearlyPrice,
          isTrialUser: subscriptions.isTrialUser,
          hasEverUpgraded: subscriptions.hasEverUpgraded,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
          stripeCustomerId: subscriptions.stripeCustomerId,
          currentPeriodStart: subscriptions.currentPeriodStart,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          cancelAt: subscriptions.cancelAt,
          canceledAt: subscriptions.canceledAt,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1),

        // Pending invitations count
        db.select({ count: count() })
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.status, 'pending')
          )),

        // Recent activity (last 10 events)
        db.select({
          logId: auditLogs.logId,
          action: auditLogs.action,
          userId: auditLogs.userId,
          userName: tenantUsers.name,
          userEmail: tenantUsers.email,
          resourceType: auditLogs.resourceType,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(tenantUsers, and(
          eq(auditLogs.userId, tenantUsers.userId),
          eq(auditLogs.tenantId, tenantUsers.tenantId)
        ))
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10),
      ]);

      // Compute activity stats: unique active users in last 24h, 7d, 30d
      const now = new Date();
      const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const activityStatsResult = await db
        .select({
          active24h: sql<number>`count(distinct case when ${auditLogs.createdAt} >= ${day1} then ${auditLogs.userId} end)`,
          active7d: sql<number>`count(distinct case when ${auditLogs.createdAt} >= ${day7} then ${auditLogs.userId} end)`,
          active30d: sql<number>`count(distinct case when ${auditLogs.createdAt} >= ${day30} then ${auditLogs.userId} end)`,
        })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          gte(auditLogs.createdAt, day30)
        ));

      return {
        success: true,
        data: {
          tenant: tenantInfo[0],
          users: tenantUsersList,
          entitySummary: entitySummary[0] || { total: 0, organizations: 0, locations: 0, departments: 0, teams: 0, active: 0 },
          creditSummary: creditSummary[0] || { totalCredits: '0', reservedCredits: '0', activeEntities: 0, averageCredits: '0' },
          subscription: subscriptionData[0] || null,
          pendingInvitations: Number(pendingInvitationsResult[0]?.count ?? 0),
          activityStats: {
            uniqueActiveUsers24h: Number(activityStatsResult[0]?.active24h ?? 0),
            uniqueActiveUsers7d: Number(activityStatsResult[0]?.active7d ?? 0),
            uniqueActiveUsers30d: Number(activityStatsResult[0]?.active30d ?? 0),
          },
          recentActivity: recentActivityLogs.map(log => ({
            logId: log.logId,
            action: log.action,
            userName: log.userName,
            userEmail: log.userEmail,
            resourceType: log.resourceType,
            timestamp: log.createdAt,
          })),
        }
      };
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      return reply.code(500).send({ error: 'Failed to fetch tenant details' });
    }
  });

  // Update tenant status (activate/deactivate)
  fastify.patch('/:tenantId/status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)],
    schema: {
      description: 'Update tenant status'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';
      const isActive = body?.isActive;
      const reason = body?.reason;

      await db
        .update(tenants)
        .set({
          isActive: isActive as boolean,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId));

      // Log the admin action
      console.log(`Admin ${(request as any).userContext?.userId} ${isActive ? 'activated' : 'deactivated'} tenant ${tenantId}${reason ? `: ${reason}` : ''}`);

      return {
        success: true,
        message: `Tenant ${isActive ? 'activated' : 'deactivated'} successfully`
      };
    } catch (error) {
      console.error('Error updating tenant status:', error);
      return reply.code(500).send({ error: 'Failed to update tenant status' });
    }
  });

  // Bulk tenant operations
  fastify.post('/bulk/status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)],
    schema: {
      description: 'Bulk update tenant status'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const tenantIds = (body?.tenantIds as string[]) ?? [];
      const isActive = body?.isActive;
      const reason = body?.reason;

      await db
        .update(tenants)
        .set({
          isActive: isActive as boolean,
          updatedAt: new Date()
        })
        .where(sql`${tenants.tenantId} = any(${tenantIds})`);

      // Log the bulk operation
      console.log(`Admin ${(request as any).userContext?.userId} bulk ${isActive ? 'activated' : 'deactivated'} ${tenantIds.length} tenants${reason ? `: ${reason}` : ''}`);

      return {
        success: true,
        message: `${tenantIds.length} tenants ${isActive ? 'activated' : 'deactivated'} successfully`
      };
    } catch (error) {
      console.error('Error bulk updating tenant status:', error);
      return reply.code(500).send({ error: 'Failed to bulk update tenant status' });
    }
  });

  // Get tenant activity log - Comprehensive activity logs for admin
  fastify.get('/:tenantId/activity', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)],
    schema: {
      description: 'Get comprehensive tenant activity logs (admin only)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const q = request.query as Record<string, string | undefined>;
    try {
      const tenantId = params.tenantId ?? '';
      const limit = q?.limit ?? '100';
      const offset = q?.offset ?? '0';
      const startDate = q?.startDate;
      const endDate = q?.endDate;
      const action = q?.action;
      const resourceType = q?.resourceType;
      const userId = q?.userId;
      const includeDetails = q?.includeDetails ?? 'true';

      const options: { limit: number; offset: number; actionFilter?: string; resourceTypeFilter?: string; userFilter?: string; includeDetails: boolean; startDate?: Date; endDate?: Date } = {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        actionFilter: action,
        resourceTypeFilter: resourceType,
        userFilter: userId,
        includeDetails: includeDetails === 'true'
      };

      if (startDate) {
        options.startDate = new Date(startDate);
      }
      if (endDate) {
        options.endDate = new Date(endDate);
      }

      // Query all activity logs directly from database (not filtered by meaningful actions)
      const whereConditions = [
        eq(auditLogs.tenantId, tenantId)
      ];

      if (options.startDate) {
        whereConditions.push(gte(auditLogs.createdAt, options.startDate));
      }
      if (options.endDate) {
        whereConditions.push(lte(auditLogs.createdAt, options.endDate));
      }
      if (options.actionFilter) {
        whereConditions.push(sql`${auditLogs.action} ILIKE ${'%' + options.actionFilter + '%'}`);
      }
      if (options.resourceTypeFilter) {
        whereConditions.push(eq(auditLogs.resourceType, options.resourceTypeFilter));
      }
      if (options.userFilter) {
        whereConditions.push(eq(auditLogs.userId, options.userFilter));
      }

      const logs = await db
        .select({
          logId: auditLogs.logId,
          userId: auditLogs.userId,
          userName: tenantUsers.name,
          userEmail: tenantUsers.email,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          oldValues: options.includeDetails ? auditLogs.oldValues : sql`NULL`,
          newValues: options.includeDetails ? auditLogs.newValues : sql`NULL`,
          details: options.includeDetails ? auditLogs.details : sql`NULL`,
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
        .limit(options.limit)
        .offset(options.offset);

      // Get total count
      const totalCountResult = await db
        .select({ count: sql`count(*)` })
        .from(auditLogs)
        .where(and(...whereConditions));
      const total = parseInt(String((totalCountResult[0] as any)?.count ?? 0), 10);

      // Format activities from logs
      const activities = logs.map(log => ({
        logId: log.logId,
        action: log.action,
        appCode: (log.details as Record<string, unknown>)?.appCode || (log.details as Record<string, unknown>)?.app_code,
        appName: (log.details as Record<string, unknown>)?.appName || (log.details as Record<string, unknown>)?.app_name || log.resourceType,
        metadata: log.details || log.oldValues || log.newValues || {},
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        userId: log.userId,
        tenantId: tenantId,
        userName: log.userName,
        userEmail: log.userEmail,
        userInfo: log.userName ? {
          id: log.userId,
          name: log.userName,
          email: log.userEmail
        } : undefined,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        errorType: (log.details as Record<string, unknown>)?.errorType || (log.details as Record<string, unknown>)?.error_type,
        severity: (log.details as Record<string, unknown>)?.severity,
        statusCode: (log.details as Record<string, unknown>)?.statusCode || (log.details as Record<string, unknown>)?.status_code,
        message: (log.details as Record<string, unknown>)?.message,
        requestId: (log.details as Record<string, unknown>)?.requestId || (log.details as Record<string, unknown>)?.request_id || log.logId,
        correlationId: (log.details as Record<string, unknown>)?.correlationId || (log.details as Record<string, unknown>)?.correlation_id
      }));

      return {
        success: true,
        data: {
          activities: activities,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: total,
            hasMore: activities.length >= parseInt(limit)
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching tenant activity:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      return reply.code(500).send({ 
        success: false,
        error: 'Failed to fetch tenant activity',
        message: error.message 
      });
    }
  });

  // Export tenant data
  fastify.get('/:tenantId/export', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)],
    schema: {
      description: 'Export comprehensive tenant data'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';

      // Get comprehensive tenant data
      const tenantData = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenantData.length) {
        return reply.code(404).send({ error: 'Tenant not found' });
      }

      const tenant = tenantData[0];

      // Get all related data
      const [users, entityList, creditList] = await Promise.all([
        db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId)),
        db.select().from(entities).where(eq(entities.tenantId, tenantId)),
        db.select().from(credits).where(eq(credits.tenantId, tenantId))
      ]);

      const exportData = {
        tenant,
        users,
        entities: entityList,
        credits: creditList,
        exportedAt: new Date().toISOString(),
        exportedBy: (request as any).userContext?.userId
      };

      // Set headers for file download
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="tenant-${tenantId}-export.json"`);

      return exportData;
    } catch (error) {
      console.error('Error exporting tenant data:', error);
      return reply.code(500).send({ error: 'Failed to export tenant data' });
    }
  });

  // Get tenant statistics for monitoring
  fastify.get('/:tenantId/stats', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)],
    schema: {
      description: 'Get tenant statistics'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';

      // User statistics
      const userStats = await db
        .select({
          total: count(),
          active: sql`count(case when ${tenantUsers.isActive} = true then 1 end)`,
          recentlyActive: sql`count(case when ${tenantUsers.lastLoginAt} > now() - interval '30 days' then 1 end)`
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));

      // Entity statistics
      const entityStats = await db
        .select({
          total: count(),
          byType: sql`json_object_agg(${entities.entityType}, count(*))`
        })
        .from(entities)
        .where(eq(entities.tenantId, tenantId));

      // Credit statistics
      const creditStats = await db
        .select({
          totalAvailable: sql`coalesce(sum(${credits.availableCredits}::numeric), 0)`,
          averagePerEntity: sql`avg(${credits.availableCredits}::numeric)`
        })
        .from(credits)
        .where(eq(credits.tenantId, tenantId));

      return {
        success: true,
        data: {
          userStats: userStats[0],
          entityStats: entityStats[0],
          creditStats: creditStats[0],
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
      return reply.code(500).send({ error: 'Failed to fetch tenant statistics' });
    }
  });

  // Comprehensive tenant list with relationships and credit summaries
  fastify.get('/comprehensive', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)],
    schema: {
      description: 'Get comprehensive tenant list with relationships and credit data'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const queryParams = request.query as Record<string, string | undefined>;
    try {
      const page = Number(queryParams?.page) || 1;
      const limit = Number(queryParams?.limit) || 20;
      const search = queryParams?.search;
      const status = queryParams?.status;
      const sortBy = queryParams?.sortBy ?? 'createdAt';
      const sortOrder = queryParams?.sortOrder ?? 'desc';

      let query: any = db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          adminEmail: tenants.adminEmail,
          isActive: tenants.isActive,
          isVerified: tenants.isVerified,
          trialEndsAt: tenants.trialEndsAt,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          entityCount: sql`count(distinct ${entities.entityId})`,
          totalCredits: sql`coalesce(sum(${credits.availableCredits}::numeric), 0)`
        })
        .from(tenants)
        .leftJoin(entities, eq(tenants.tenantId, entities.tenantId))
        .leftJoin(credits, and(
          eq(credits.tenantId, tenants.tenantId),
          eq(credits.entityId, entities.entityId),
          eq(credits.isActive, true)
        ))
        .groupBy(tenants.tenantId);

      // Apply filters
      if (search) {
        query = query.where(sql`${tenants.companyName} ilike ${`%${search}%`} or ${tenants.subdomain} ilike ${`%${search}%`}`);
      }

      if (status) {
        switch (status) {
          case 'active':
            query = query.where(eq(tenants.isActive, true));
            break;
          case 'inactive':
            query = query.where(eq(tenants.isActive, false));
            break;
          case 'trial':
            query = query.where(sql`${tenants.trialEndsAt} > now()`);
            break;
          case 'paid':
            query = query.where(sql`${tenants.trialEndsAt} is null or ${tenants.trialEndsAt} < now()`);
            break;
        }
      }

      // Apply sorting
      const sortColumn = sortBy === 'companyName' ? tenants.companyName :
                        sortBy === 'createdAt' ? tenants.createdAt :
                        sortBy === 'totalCredits' ? sql`sum(${credits.availableCredits}::numeric)` :
                        tenants.createdAt;

      query = sortOrder === 'desc' ? query.orderBy(desc(sortColumn)) : query.orderBy(sortColumn);

      // Get total count for pagination
      const totalCountResult = await db.select({ count: count() }).from(tenants);
      const totalCount = Number((totalCountResult[0] as any)?.count ?? 0);

      // Apply pagination
      const offset = (page - 1) * limit;
      const tenantsList = await query.limit(limit).offset(offset);

      return {
        success: true,
        data: {
          tenants: tenantsList,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
        }
      };
    } catch (error) {
      console.error('Error fetching comprehensive tenant list:', error);
      return reply.code(500).send({ error: 'Failed to fetch tenant list' });
    }
  });
}
