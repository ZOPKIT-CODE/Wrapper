/**
 * Admin Credit Overview Routes - Independent credit administration
 * Provides comprehensive credit monitoring without modifying existing routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { credits, creditTransactions, tenants, entities, subscriptions } from '../../../db/schema/index.js';
import { eq, and, desc, sql, count, sum, gte, lte, between, isNotNull, inArray } from 'drizzle-orm';
import { SeasonalCreditService } from '../../../features/credits/index.js';

export default async function adminCreditOverviewRoutes(fastify: FastifyInstance, _options?: object): Promise<void> {

  fastify.get('/overview', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get comprehensive credit overview across all tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const totalStats = await db
        .select({
          totalCredits: sql`coalesce(sum(${credits.availableCredits}), 0)`,
          totalReserved: sql`0`,
          totalEntities: sql`count(distinct ${credits.entityId})`,
          totalTenants: sql`count(distinct ${credits.tenantId})`
        })
        .from(credits);

      // Credit distribution by tenant (top 10)
      const tenantDistribution = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          totalCredits: sql`coalesce(sum(${credits.availableCredits}), 0)`,
          reservedCredits: sql`0`,
          entityCount: sql`count(distinct ${credits.entityId})`
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .groupBy(tenants.tenantId, tenants.companyName)
        .orderBy(desc(sql`sum(${credits.availableCredits})`))
        .limit(10);

      // Low balance alerts
      const lowBalanceAlerts = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} < 100`
        ))
        .orderBy(credits.availableCredits)
        .limit(20);

      // Recent credit transactions with enhanced details
      const recentTransactions = await db
        .select({
          transactionId: creditTransactions.transactionId,
          tenantId: creditTransactions.tenantId,
          companyName: tenants.companyName,
          entityId: creditTransactions.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          transactionType: creditTransactions.transactionType,
          amount: creditTransactions.amount,
          previousBalance: creditTransactions.previousBalance,
          newBalance: creditTransactions.newBalance,
          operationCode: creditTransactions.operationCode,
          createdAt: creditTransactions.createdAt,
          initiatedBy: creditTransactions.initiatedBy
        })
        .from(creditTransactions)
        .innerJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .leftJoin(entities, eq(creditTransactions.entityId, entities.entityId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(15);

      return {
        success: true,
        data: {
          totalStats: totalStats[0],
          tenantDistribution,
          lowBalanceAlerts,
          recentTransactions,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching credit overview:', error);
      return reply.code(500).send({ error: 'Failed to fetch credit overview' });
    }
  });

  fastify.get('/analytics', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get credit usage analytics'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const period = query.period ?? '30d';
      const groupBy = query.groupBy ?? 'day';

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Usage by operation type
      const usageByOperation = await db
        .select({
          operationCode: creditTransactions.operationCode,
          totalUsed: sql`sum(${creditTransactions.amount})`,
          transactionCount: count(),
          avgPerTransaction: sql`avg(${creditTransactions.amount})`
        })
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.transactionType, 'consumption'),
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate)
        ))
        .groupBy(creditTransactions.operationCode)
        .orderBy(desc(sql`sum(${creditTransactions.amount})`))
        .limit(10);

      // Usage by tenant
      const usageByTenant = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          totalUsed: sql`sum(${creditTransactions.amount})`,
          transactionCount: count()
        })
        .from(creditTransactions)
        .innerJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .where(and(
          eq(creditTransactions.transactionType, 'consumption'),
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate)
        ))
        .groupBy(tenants.tenantId, tenants.companyName)
        .orderBy(desc(sql`sum(${creditTransactions.amount})`))
        .limit(10);

      // Daily usage trend
      const dateFormat = groupBy === 'month' ? "DATE_TRUNC('month', created_at)" :
                        groupBy === 'week' ? "DATE_TRUNC('week', created_at)" :
                        "DATE_TRUNC('day', created_at)";

      const usageTrend = await db
        .select({
          period: sql`to_char(DATE_TRUNC('day', ${creditTransactions.createdAt}), 'YYYY-MM-DD')`,
          totalUsed: sql`sum(${creditTransactions.amount})`,
          transactionCount: count()
        })
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.transactionType, 'consumption'),
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate)
        ))
        .groupBy(sql`DATE_TRUNC('day', ${creditTransactions.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${creditTransactions.createdAt})`);

      return {
        success: true,
        data: {
          usageByOperation,
          usageByTenant,
          usageTrend,
          period,
          groupBy,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching credit analytics:', error);
      return reply.code(500).send({ error: 'Failed to fetch credit analytics' });
    }
  });

  fastify.get('/alerts', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get credit alerts and warnings'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      // Critical alerts (very low balance)
      const criticalAlerts = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          alertLevel: sql<string>`'critical'`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.availableCredits} < 10`
        ))
        .orderBy(credits.availableCredits);

      // Warning alerts (low balance)
      const warningAlerts = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          alertLevel: sql<string>`'warning'`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          between(credits.availableCredits, '10', '99')
        ))
        .orderBy(credits.availableCredits);

      // Inactive credits (no recent activity)
      const inactiveCredits = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          availableCredits: credits.availableCredits,
          daysSinceUpdate: sql`extract(day from now() - ${credits.lastUpdatedAt})`,
          alertLevel: sql`'inactive'`,
          lastUpdatedAt: credits.lastUpdatedAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .innerJoin(entities, eq(credits.entityId, entities.entityId))
        .where(and(
          eq(credits.isActive, true),
          sql`${credits.lastUpdatedAt} < now() - interval '90 days'`,
          sql`${credits.availableCredits} > 0`
        ))
        .orderBy(desc(sql`extract(day from now() - ${credits.lastUpdatedAt})`));

      return {
        success: true,
        data: {
          critical: criticalAlerts,
          warning: warningAlerts,
          inactive: inactiveCredits,
          summary: {
            criticalCount: criticalAlerts.length,
            warningCount: warningAlerts.length,
            inactiveCount: inactiveCredits.length,
            totalAlerts: criticalAlerts.length + warningAlerts.length + inactiveCredits.length
          },
          generatedAt: new Date().toISOString()
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching credit alerts:', error);
      return reply.code(500).send({ error: 'Failed to fetch credit alerts' });
    }
  });

  fastify.post('/bulk-allocate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {
      description: 'Bulk allocate credits to multiple entities'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const allocations = (body.allocations as any[]) ?? [];
      const reason = body.reason;

      const results = [];
      for (const allocation of allocations) {
        const { entityId, amount, operationCode = 'admin.bulk_allocation' } = allocation;

        // Check if entity exists and has credit record
        const entityCheck = await db
          .select()
          .from(entities)
          .where(eq(entities.entityId, entityId))
          .limit(1);

        if (!entityCheck.length) {
          results.push({
            entityId,
            success: false,
            error: 'Entity not found'
          });
          continue;
        }

        const tenantId = entityCheck[0].tenantId;

        // Check if credit record exists, if not create it, if yes update it
        const existingCredit = await db
          .select()
          .from(credits)
          .where(and(
            eq(credits.tenantId, tenantId),
            eq(credits.entityId, entityId),
            eq(credits.isActive, true)
          ))
          .limit(1);

        if (existingCredit.length === 0) {
          // Create new credit record
          await db
            .insert(credits)
            .values({
              tenantId,
              entityId,
              availableCredits: amount.toString(),
              reservedCredits: '0',
              isActive: true,
              lastUpdatedAt: new Date(),
              createdAt: new Date()
            } as any);
        } else {
          // Update existing credit record
          await db
            .update(credits)
            .set({
              availableCredits: sql`${credits.availableCredits} + ${amount}`,
              lastUpdatedAt: new Date()
            })
            .where(and(
              eq(credits.tenantId, tenantId),
              eq(credits.entityId, entityId),
              eq(credits.isActive, true)
            ));
        }

        // Record transaction
        await db
          .insert(creditTransactions)
          .values({
            tenantId,
            entityId,
            transactionType: 'purchase',
            amount: amount.toString(),
            previousBalance: '0', // Would need to calculate actual previous balance
            newBalance: amount.toString(),
            operationCode,
            initiatedBy: (request as any).userContext?.internalUserId ?? (request as any).userContext?.userId ?? '',
            createdAt: new Date()
          });

        results.push({
          entityId,
          success: true,
          amount,
          newBalance: amount
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Admin ${(request as any).userContext?.userId ?? ''} bulk allocated credits to ${successCount} entities${reason ? `: ${reason}` : ''}`);

      return reply.code(201).send({
        success: true,
        data: {
          results,
          summary: {
            total: allocations.length,
            successful: successCount,
            failed: failureCount
          }
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error bulk allocating credits:', error);
      return reply.code(500).send({ error: 'Failed to bulk allocate credits' });
    }
  });

  fastify.get('/entity-balances', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get all entities with their current credit balances'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const tenantId = query.tenantId;
      const entityType = query.entityType;
      const minBalance = query.minBalance;
      const maxBalance = query.maxBalance;
      const hasCredits = query.hasCredits !== 'false';
      const sortBy = query.sortBy ?? 'availableCredits';
      const sortOrder = query.sortOrder ?? 'desc';

      const balanceConditions = [];
      if (tenantId) balanceConditions.push(eq(entities.tenantId, tenantId));
      if (entityType) balanceConditions.push(eq(entities.entityType, entityType));
      if (hasCredits) balanceConditions.push(sql`${credits.availableCredits} IS NOT NULL`);
      else balanceConditions.push(sql`${credits.availableCredits} IS NULL`);
      if (minBalance !== undefined) balanceConditions.push(sql`${credits.availableCredits} >= ${minBalance}`);
      if (maxBalance !== undefined) balanceConditions.push(sql`${credits.availableCredits} <= ${maxBalance}`);

      let entityBalancesQuery = db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
          entityType: entities.entityType,
          entityName: entities.entityName,
          entityCode: entities.entityCode,
          companyName: tenants.companyName,
          availableCredits: sql`coalesce(${credits.availableCredits}, 0)`,
          totalCredits: sql`coalesce(${credits.availableCredits}, 0)`,
          isActive: entities.isActive,
          lastUpdatedAt: credits.lastUpdatedAt,
          createdAt: entities.createdAt
        })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .leftJoin(credits, and(
          eq(credits.entityId, entities.entityId),
          eq(credits.isActive, true)
        ));

      if (balanceConditions.length > 0) {
        entityBalancesQuery = entityBalancesQuery.where(and(...balanceConditions)) as any;
      }

      const sortColumn = sortBy === 'availableCredits' ? sql`${credits.availableCredits}` :
                         sortBy === 'entityName' ? sql`${entities.entityName}` :
                         sortBy === 'companyName' ? sql`${tenants.companyName}` :
                         sortBy === 'lastUpdatedAt' ? sql`${credits.lastUpdatedAt}` :
                         sql`${credits.availableCredits}`;
      entityBalancesQuery = (sortOrder === 'desc' ? entityBalancesQuery.orderBy(desc(sortColumn)) : entityBalancesQuery.orderBy(sortColumn)) as any;

      // Get total count
      const totalCount = await db
        .select({ count: count() })
        .from(entities)
        .innerJoin(tenants, eq(entities.tenantId, tenants.tenantId))
        .leftJoin(credits, and(
          eq(credits.entityId, entities.entityId),
          eq(credits.isActive, true)
        ))
        .then((result: any) => Number(result[0]?.count ?? 0));

      const offset = (page - 1) * limit;
      const entityBalances = await entityBalancesQuery.limit(limit).offset(offset);

      return {
        success: true,
        data: {
          entityBalances,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching entity credit balances:', error);
      return reply.code(500).send({ error: 'Failed to fetch entity credit balances' });
    }
  });

  fastify.get('/transactions', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get credit transaction history'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const queryParams = request.query as Record<string, string>;
    try {
      const page = Number(queryParams.page) || 1;
      const limit = Number(queryParams.limit) || 50;
      const tenantId = queryParams.tenantId;
      const entityId = queryParams.entityId;
      const transactionType = queryParams.transactionType;
      const startDate = queryParams.startDate;
      const endDate = queryParams.endDate;
      const minAmount = queryParams.minAmount;
      const maxAmount = queryParams.maxAmount;

      const conditions = [];
      if (tenantId) conditions.push(eq(creditTransactions.tenantId, tenantId));
      if (entityId) conditions.push(eq(creditTransactions.entityId, entityId));
      if (transactionType) conditions.push(eq(creditTransactions.transactionType, transactionType));
      if (startDate) conditions.push(gte(creditTransactions.createdAt, new Date(startDate)));
      if (endDate) conditions.push(lte(creditTransactions.createdAt, new Date(endDate)));
      if (minAmount !== undefined) conditions.push(gte(sql`abs(${creditTransactions.amount})`, Number(minAmount)));
      if (maxAmount !== undefined) conditions.push(lte(sql`abs(${creditTransactions.amount})`, Number(maxAmount)));

      let txQuery = db
        .select({
          transactionId: creditTransactions.transactionId,
          tenantId: creditTransactions.tenantId,
          companyName: tenants.companyName,
          entityId: creditTransactions.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          transactionType: creditTransactions.transactionType,
          amount: creditTransactions.amount,
          previousBalance: creditTransactions.previousBalance,
          newBalance: creditTransactions.newBalance,
          operationCode: creditTransactions.operationCode,
          createdAt: creditTransactions.createdAt
        })
        .from(creditTransactions)
        .leftJoin(tenants, eq(creditTransactions.tenantId, tenants.tenantId))
        .leftJoin(entities, eq(creditTransactions.entityId, entities.entityId))
        .orderBy(desc(creditTransactions.createdAt));

      if (conditions.length > 0) {
        txQuery = txQuery.where(and(...conditions)) as any;
      }

      const totalCount = await db
        .select({ count: count() })
        .from(creditTransactions)
        .then((result: any) => Number(result[0]?.count ?? 0));

      // Apply pagination
      const offset = (page - 1) * limit;
      const transactions = await txQuery.limit(limit).offset(offset);

      return {
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching credit transactions:', error);
      return reply.code(500).send({ error: 'Failed to fetch credit transactions' });
    }
  });

  fastify.get('/application-allocations', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get all application credit allocations across all tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      console.log('🔍 Getting all application allocations (admin view)');

      // REMOVED: creditAllocations table queries
      // Applications now manage their own credit consumption
      // Use credits table for organization-level credits instead
      const allocations = await db
        .select({
          tenantId: credits.tenantId,
          companyName: tenants.companyName,
          entityId: credits.entityId,
          entityName: entities.entityName,
          availableCredits: credits.availableCredits,
          createdAt: credits.createdAt
        })
        .from(credits)
        .innerJoin(tenants, eq(credits.tenantId, tenants.tenantId))
        .leftJoin(entities, eq(credits.entityId, entities.entityId))
        .where(eq(credits.isActive, true))
        .orderBy(desc(credits.createdAt));

      // Calculate summary statistics
      const summary: {
        totalAllocations: number;
        totalAllocatedCredits: number;
        totalUsedCredits: number;
        totalAvailableCredits: number;
        allocationsByApplication: Record<string, any>;
      } = {
        totalAllocations: allocations.length,
        totalAllocatedCredits: 0,
        totalUsedCredits: 0,
        totalAvailableCredits: 0,
        allocationsByApplication: {}
      };

      allocations.forEach((allocation: any) => {
        const allocated = parseFloat(String((allocation as any).allocatedCredits ?? '0'));
        const used = parseFloat(String((allocation as any).usedCredits ?? '0'));
        const available = parseFloat(String(allocation.availableCredits ?? '0'));

        summary.totalAllocatedCredits += allocated;
        summary.totalUsedCredits += used;
        summary.totalAvailableCredits += available;

        const app = (allocation as any).targetApplication ?? 'default';
        if (!summary.allocationsByApplication[app]) {
          summary.allocationsByApplication[app] = {
            application: app,
            allocationCount: 0,
            totalAllocated: 0,
            totalUsed: 0,
            totalAvailable: 0
          };
        }

        summary.allocationsByApplication[app].allocationCount++;
        summary.allocationsByApplication[app].totalAllocated += allocated;
        summary.allocationsByApplication[app].totalUsed += used;
        summary.allocationsByApplication[app].totalAvailable += available;
      });

      // Convert allocationsByApplication object to array
      const allocationsByApplicationArray = Object.values(summary.allocationsByApplication);

      return {
        success: true,
        data: {
          allocations: allocations.map((allocation: any) => ({
            ...allocation,
            allocatedCredits: parseFloat((allocation as any).allocatedCredits || '0'),
            usedCredits: parseFloat((allocation as any).usedCredits || '0'),
            availableCredits: parseFloat(String(allocation.availableCredits ?? '0'))
          })),
          summary: {
            ...summary,
            allocationsByApplication: allocationsByApplicationArray
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get application allocations:', err);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get application allocations',
        message: error?.message ?? ''
      });
    }
  });

  fastify.get('/entity/:entityId/application-allocations', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const entityId = params.entityId ?? '';
      const tenantId = (request as any).userContext?.tenantId ?? '';

      console.log('🔍 Getting application allocations for entity:', { entityId, tenantId });

      // CreditAllocationService removed - applications manage their own credits; return empty
      const allocations: any[] = [];

      return reply.send({
        success: true,
        data: {
          allocations
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get application allocations:', err);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get application allocations',
        message: error?.message ?? ''
      });
    }
  });

  fastify.post('/process-expiries', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {
      description: 'Manually trigger credit expiry processing for all expired allocations'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const creditTypes = body.creditTypes as string[] | undefined;
      const processSubscriptionCredits = body.processSubscriptionCredits !== false;
      
      console.log(`🔧 Admin ${(request as any).userContext?.userId ?? ''} triggered credit expiry processing`, {
        creditTypes,
        processSubscriptionCredits
      });

      const results: Record<string, any> = {
        freeCredits: null,
        seasonalCredits: null,
        subscriptionCredits: null
      };

      if (!creditTypes || creditTypes.includes('free')) {
        try {
          // CreditAllocationService removed - stub
          results.freeCredits = { processed: 0, message: 'CreditAllocationService removed' };
        } catch (err: unknown) {
          const error = err as Error;
          results.freeCredits = { error: error?.message ?? '' };
        }
      }

      if (!creditTypes || creditTypes.some((type: string) => ['seasonal', 'bonus', 'promotional', 'event', 'partnership', 'trial_extension'].includes(type))) {
        try {
          const seasonalService = new SeasonalCreditService();
          results.seasonalCredits = await seasonalService.processSeasonalCreditExpiries() as any;
        } catch (err: unknown) {
          const error = err as Error;
          results.seasonalCredits = { error: error?.message ?? '' };
        }
      }

      if (processSubscriptionCredits) {
        try {
          const now = new Date();
          const expiredSubscriptions = await db
            .select()
            .from(subscriptions)
            .where(and(
              eq(subscriptions.status, 'active'),
              sql`${subscriptions.currentPeriodEnd} IS NOT NULL`,
              sql`${subscriptions.currentPeriodEnd} <= ${now}`
            ));

          console.log(`📅 Found ${expiredSubscriptions.length} expired subscriptions`);

          let subscriptionCreditsExpired = 0;
          for (const subscription of expiredSubscriptions) {
            try {
              await db
                .update(subscriptions)
                .set({
                  status: 'expired',
                  updatedAt: new Date()
                })
                .where(eq(subscriptions.subscriptionId, subscription.subscriptionId));
              subscriptionCreditsExpired++;
            } catch (subErr: unknown) {
              const subError = subErr as Error;
              console.error(`Failed to expire credits for subscription ${subscription.subscriptionId}:`, subError?.message ?? '');
            }
          }

          results.subscriptionCredits = {
            expiredSubscriptions: expiredSubscriptions.length,
            creditsExpired: subscriptionCreditsExpired
          };
        } catch (err: unknown) {
          const error = err as Error;
          results.subscriptionCredits = { error: error?.message ?? '' };
        }
      }

      return reply.send({
        success: true,
        message: 'Credit expiry processing completed',
        data: results
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error processing credit expiries:', err);
      return reply.code(500).send({
        success: false,
        error: 'Failed to process credit expiries',
        message: error?.message ?? ''
      });
    }
  });

  fastify.get('/expiring-summary', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_VIEW)],
    schema: {
      description: 'Get summary of all expiring credits across all types'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const daysAhead = query.daysAhead ?? '30';
      const creditType = query.creditType;
      const now = new Date();
      const futureDate = new Date(now.getTime() + (parseInt(daysAhead) * 24 * 60 * 60 * 1000));

      // REMOVED: creditAllocations table queries
      // Applications now manage their own credit consumption
      // Return empty array - applications handle their own expiry tracking
      const expiringByType: any[] = [];

      // Get expiring subscriptions
      const expiringSubscriptions = await db
        .select({
          subscriptionId: subscriptions.subscriptionId,
          tenantId: subscriptions.tenantId,
          plan: subscriptions.plan,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          daysUntilExpiry: sql`EXTRACT(EPOCH FROM (${subscriptions.currentPeriodEnd} - ${now})) / 86400`
        })
        .from(subscriptions)
        .where(and(
          eq(subscriptions.status, 'active'),
          isNotNull(subscriptions.currentPeriodEnd),
          sql`${subscriptions.currentPeriodEnd} > ${now}`,
          sql`${subscriptions.currentPeriodEnd} <= ${futureDate}`
        ));

      return reply.send({
        success: true,
        data: {
          allocations: expiringByType.map((item: any) => ({
            creditType: item.creditType,
            count: parseInt(String(item.count ?? 0), 10),
            totalAllocated: parseFloat(String(item.totalAllocated ?? '0')),
            totalAvailable: parseFloat(String(item.totalAvailable ?? '0')),
            earliestExpiry: item.earliestExpiry,
            latestExpiry: item.latestExpiry
          })),
          subscriptions: expiringSubscriptions.map((sub: any) => ({
            subscriptionId: sub.subscriptionId,
            tenantId: sub.tenantId,
            plan: sub.plan,
            currentPeriodEnd: sub.currentPeriodEnd,
            daysUntilExpiry: Math.floor(parseFloat(String(sub.daysUntilExpiry ?? 0)))
          })),
          summary: {
            totalAllocations: expiringByType.reduce((sum: number, item: any) => sum + parseInt(String(item.count ?? 0), 10), 0),
            totalSubscriptionExpiries: expiringSubscriptions.length,
            daysAhead: parseInt(String(daysAhead), 10)
          }
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error getting expiring summary:', err);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve expiring summary',
        message: error?.message ?? ''
      });
    }
  });
}
