/**
 * Admin Dashboard Routes - Comprehensive company admin interface
 * Independent implementation that doesn't modify existing routes
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { tenants, entities, credits, creditTransactions, contactSubmissions, subscriptions } from '../../../db/schema/index.js';
import { eq, desc, sql, count, sum } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

export default async function adminDashboardRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Overview dashboard data - aggregates key metrics across all tenants
  fastify.get('/overview', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW)],
    schema: {
      description: 'Get comprehensive admin dashboard overview'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get tenant statistics
      const tenantStats = await db
        .select({
          total: count(),
          active: sql`count(case when ${tenants.isActive} = true then 1 end)`,
          trial: sql`count(case when ${subscriptions.trialEndsAt} > now() then 1 end)`,
          paid: sql`count(case when ${subscriptions.trialEndsAt} is null or ${subscriptions.trialEndsAt} < now() then 1 end)`
        })
        .from(tenants)
        .leftJoin(subscriptions, eq(tenants.tenantId, subscriptions.tenantId));

      // Get entity statistics
      const entityStats = await db
        .select({
          total: count(),
          organizations: sql`count(case when ${entities.entityType} = 'organization' then 1 end)`,
          locations: sql`count(case when ${entities.entityType} = 'location' then 1 end)`,
          departments: sql`count(case when ${entities.entityType} = 'department' then 1 end)`
        })
        .from(entities);

      // Get credit statistics - will be fixed after cleaning duplicates
      const creditStats = await db
        .select({
          totalCredits: sum(credits.availableCredits),

          lowBalanceAlerts: sql`count(case when ${credits.availableCredits} < 100 then 1 end)`
        })
        .from(credits);

      // Get recent activity (last 10 tenant/entity creations)
      const recentTenants = await db
        .select({
          tenantName: tenants.companyName,
          createdAt: tenants.createdAt,
          type: sql`'tenant_created'`
        })
        .from(tenants)
        .orderBy(desc(tenants.createdAt))
        .limit(5);

      const recentEntities = await db
        .select({
          tenantName: tenants.companyName,
          entityName: entities.entityName,
          createdAt: entities.createdAt,
          type: sql`'entity_created'`
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .orderBy(desc(entities.createdAt))
        .limit(5);

      const recentActivity = [
        ...(recentTenants as any[]).map((t: any) => ({
          type: 'tenant_created',
          tenantName: t.tenantName,
          description: `New tenant "${t.tenantName}" was created`,
          timestamp: t.createdAt
        })),
        ...(recentEntities as any[]).map((e: any) => ({
          type: 'entity_created',
          tenantName: e.tenantName,
          description: `New ${e.entityName} was created`,
          timestamp: e.createdAt
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

      return {
        success: true,
        data: {
          tenantStats: tenantStats[0] || { total: 0, active: 0, trial: 0, paid: 0 },
          entityStats: entityStats[0] || { total: 0, organizations: 0, locations: 0, departments: 0 },
          creditStats: {
            totalCredits: parseFloat(String(creditStats[0]?.totalCredits ?? 0)),
            totalReserved: 0,
            lowBalanceAlerts: Number(creditStats[0]?.lowBalanceAlerts ?? 0)
          },
          recentActivity
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-dashboard-overview', 'Error fetching admin dashboard overview', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch dashboard overview' });
    }
  });

  // Get recent activity across the platform
  fastify.get('/recent-activity', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW)],
    schema: {
      description: 'Get recent activity across all tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const limitNum = Number(q?.limit ?? 20);

      // Get recent tenant creations
      const recentTenants = await db
        .select({
          id: tenants.tenantId,
          type: sql`'tenant_created'`,
          title: sql`'New Tenant Created'`,
          description: sql`concat('Tenant "', ${tenants.companyName}, '" was created')`,
          tenantName: tenants.companyName,
          timestamp: tenants.createdAt
        })
        .from(tenants)
        .orderBy(desc(tenants.createdAt))
        .limit(5);

      // Get recent entity creations
      const recentEntities = await db
        .select({
          id: entities.entityId,
          type: sql`'entity_created'`,
          title: sql`'New Entity Created'`,
          description: sql`concat(${entities.entityType}, ' "', ${entities.entityName}, '" was created')`,
          tenantName: tenants.companyName,
          timestamp: entities.createdAt
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .orderBy(desc(entities.createdAt))
        .limit(5);

      // Get recent credit transactions
      const recentTransactions = await db
        .select({
          id: creditTransactions.transactionId,
          type: sql`'credit_transaction'`,
          title: sql`concat(upper(${creditTransactions.transactionType}), ' Transaction')`,
          description: sql`concat('Credit ', ${creditTransactions.transactionType}, ' of ', ${creditTransactions.amount}, ' for operation ', ${creditTransactions.operationCode})`,
          amount: creditTransactions.amount,
          tenantName: tenants.companyName,
          timestamp: creditTransactions.createdAt
        })
        .from(creditTransactions)
        .innerJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(10);

      // Combine and sort all activities
      const activities = ([
        ...(recentTenants as any[]),
        ...(recentEntities as any[]),
        ...(recentTransactions as any[])
      ] as any[]).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        success: true,
        data: {
          activities: activities.slice(0, limitNum)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-recent-activity', 'Error fetching recent activity', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch recent activity' });
    }
  });

  // Get contact submissions (clients/leads)
  fastify.get('/contact-submissions', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW)],
    schema: {
      description: 'Get all contact form and demo submissions'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const limit = Number(q?.limit ?? 100);
      const offset = Number(q?.offset ?? 0);
      const source = q?.source ?? 'all';

      const submissions = source === 'all'
        ? await db.select().from(contactSubmissions)
            .orderBy(desc(contactSubmissions.createdAt))
            .limit(limit)
            .offset(offset)
        : await db.select().from(contactSubmissions)
            .where(eq(contactSubmissions.source, source))
            .orderBy(desc(contactSubmissions.createdAt))
            .limit(limit)
            .offset(offset);

      const totalResult = source === 'all'
        ? await db.select({ count: count(contactSubmissions.id) }).from(contactSubmissions)
        : await db.select({ count: count(contactSubmissions.id) }).from(contactSubmissions)
            .where(eq(contactSubmissions.source, source));
      const total = Number((totalResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: {
          submissions: submissions.map((sub: Record<string, unknown>) => ({
            id: sub.id,
            name: sub.name,
            email: sub.email,
            company: sub.company,
            phone: sub.phone,
            jobTitle: sub.jobTitle,
            companySize: sub.companySize,
            preferredTime: sub.preferredTime,
            comments: sub.comments,
            source: sub.source,
            createdAt: sub.createdAt
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'admin-contact-submissions', 'Error fetching contact submissions', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch contact submissions' });
    }
  });
}
