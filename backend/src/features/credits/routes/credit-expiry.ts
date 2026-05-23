import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreditExpiryService } from '../services/credit-expiry-service.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import Logger from '../../../utils/logger.js';

/**
 * Credit Expiry Routes
 * Handles credit expiry processing and queries
 */
export default async function creditExpiryRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  Logger.log('info', 'general', 'boot', 'Registering credit expiry routes');

  // Process expired credits (admin only, can be called via cron)
  fastify.post('/process-expired', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.CREDITS_BALANCE_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await CreditExpiryService.processExpiredCredits();
      return {
        success: true,
        message: 'Expired credits processed successfully',
        data: result
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'process-expired-credits', 'Error processing expired credits', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to process expired credits',
        error: error.message
      });
    }
  });

  // Get expiring credits
  fastify.get('/expiring', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      const { daysAhead = 7 } = query;
      const tenantId = (request.userContext as { tenantId?: string | null })?.tenantId;
      const entityId = query?.entityId || null;

      const expiringCredits = await CreditExpiryService.getExpiringCredits(
        parseInt(String(daysAhead)),
        tenantId ?? undefined,
        entityId ?? undefined
      );

      return {
        success: true,
        data: expiringCredits
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-expiring-credits', 'Error fetching expiring credits', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch expiring credits',
        error: error.message
      });
    }
  });

  // Get expiry statistics
  fastify.get('/expiry-stats', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request.userContext as { tenantId?: string | null })?.tenantId;
      const query = request.query as Record<string, string | undefined>;
      const entityId = query?.entityId;

      if (!tenantId || !entityId) {
        return reply.code(400).send({
          success: false,
          message: 'Tenant ID and Entity ID are required'
        });
      }

      const stats = await CreditExpiryService.getExpiryStats(tenantId as string, entityId as string);

      return {
        success: true,
        data: stats
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-expiry-stats', 'Error fetching expiry stats', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch expiry statistics',
        error: error.message
      });
    }
  });

  // Send expiry warnings
  fastify.post('/send-warnings', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.CREDITS_BALANCE_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as Record<string, unknown>) || {};
      const { daysAhead = 7 } = body;
      const result = await CreditExpiryService.sendExpiryWarnings(parseInt(String(daysAhead)));

      return {
        success: true,
        message: 'Expiry warnings sent successfully',
        data: result
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'send-expiry-warnings', 'Error sending expiry warnings', { error: error.message });
      return reply.code(500).send({
        success: false,
        message: 'Failed to send expiry warnings',
        error: error.message
      });
    }
  });
}

















