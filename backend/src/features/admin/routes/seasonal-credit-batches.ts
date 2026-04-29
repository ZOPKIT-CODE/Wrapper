import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SeasonalCreditService } from '../services/SeasonalCreditService.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import {
  activeBatchesQuerySchema,
  expiredBatchHistoryQuerySchema,
  bulkExpireSchema,
  grantCreditsSchema,
  cronStatusQuerySchema,
} from '../schemas/seasonal-credit-schemas.js';
import { CreditExpiryService } from '../../credits/services/credit-expiry-service.js';

/**
 * Seasonal Credit Batch Routes
 * Cross-tenant batch monitoring, expired history, bulk ops, per-tenant grant, and cron status.
 * Prefix: /api/admin/seasonal-credit-batches
 */
export default async function seasonalCreditBatchesRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * GET /api/admin/seasonal-credit-batches/active
   * List active credit batches across all tenants (paginated, filterable).
   */
  fastify.get('/active', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = activeBatchesQuerySchema.parse(request.query);
      const result = await SeasonalCreditService.getAllActiveBatches(parsed);
      return reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching active batches');
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/seasonal-credit-batches/expired
   * Paginated expired batch history (optional date range, tenant, campaign filters).
   */
  fastify.get('/expired', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = expiredBatchHistoryQuerySchema.parse(request.query);
      const result = await SeasonalCreditService.getExpiredBatchHistory(parsed);
      return reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching expired batch history');
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/seasonal-credit-batches/bulk-expire
   * Immediately expire a list of allocation IDs (admin override).
   */
  fastify.post('/bulk-expire', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { allocationIds } = bulkExpireSchema.parse(request.body);
      const userId = (request as any).userContext?.userId as string;
      const result = await SeasonalCreditService.bulkExpireBatches(allocationIds, userId);
      return reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error bulk-expiring batches');
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/seasonal-credit-batches/tenants/:tenantId
   * Full credit summary for a specific tenant (all credit types + active batches).
   */
  fastify.get('/tenants/:tenantId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    try {
      const result = await SeasonalCreditService.getTenantCreditSummary(tenantId);
      return reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching tenant credit summary');
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/seasonal-credit-batches/tenants/:tenantId/grant
   * Manually grant seasonal credits to a specific tenant.
   */
  fastify.post('/tenants/:tenantId/grant', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    try {
      const body = grantCreditsSchema.parse(request.body);
      const initiatedBy = (request as any).userContext?.userId as string;
      const result = await SeasonalCreditService.grantSeasonalCreditsToTenant({
        tenantId,
        creditAmount: body.creditAmount,
        expiresAt: new Date(body.expiresAt),
        initiatedBy,
        reason: body.reason,
      });
      return reply.code(201).send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error granting credits to tenant');
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/seasonal-credit-batches/cron-status
   * Returns last N cron run records + aggregate stats (success rate, avg duration).
   */
  fastify.get('/cron-status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit } = cronStatusQuerySchema.parse(request.query);
      const result = await SeasonalCreditService.getCronStatus(limit);
      return reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching cron status');
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/seasonal-credit-batches/cron-status/trigger
   * Manually trigger the expiry cron (runs processExpiredCredits immediately).
   */
  fastify.post('/cron-status/trigger', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userContext?.userId as string;
      const result = await CreditExpiryService.processExpiredCredits({
        triggerSource: 'manual_admin',
        triggeredBy: userId,
      });
      return reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error triggering cron manually');
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
