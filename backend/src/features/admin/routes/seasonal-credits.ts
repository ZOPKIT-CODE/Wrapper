import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SeasonalCreditService } from '../services/seasonal-credit-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';

/**
 * Seasonal Credits Routes
 * Handles distribution of free credits to tenants through campaigns
 */
export default async function seasonalCreditsRoutes(fastify: FastifyInstance, _options?: object): Promise<void> {

  fastify.get('/campaigns', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    try {
      const isActive = query.isActive;
      const distributionStatus = query.distributionStatus;
      
      const campaigns = await SeasonalCreditService.getCampaigns({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        distributionStatus
      } as any);
      
      reply.send({
        success: true,
        data: campaigns
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching campaigns:');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch campaigns',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * POST /admin/seasonal-credits/campaigns
   * Create a new seasonal credit campaign
   */
  fastify.post('/campaigns', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {
      description: 'Create a new seasonal credit campaign'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      // Extract top-level fields that need special handling
      const { modalConfig, minutesUntilExpiry, expiresAt: bodyExpiresAt, notifyTenants, ...rest } = body;

      // If minutesUntilExpiry is provided (dev mode), compute expiresAt server-side
      // so the server's clock is used — avoids client timezone / clock-skew issues.
      let expiresAt: unknown = bodyExpiresAt;
      if (minutesUntilExpiry != null && Number(minutesUntilExpiry) > 0) {
        expiresAt = new Date(Date.now() + Number(minutesUntilExpiry) * 60_000).toISOString();
      }

      const existingMeta = (typeof rest.metadata === 'object' && rest.metadata !== null
        ? rest.metadata
        : {}) as Record<string, unknown>;

      const campaignData = {
        ...rest,
        expiresAt,
        // Map frontend `notifyTenants` → DB column `sendNotifications`
        sendNotifications: notifyTenants !== undefined ? Boolean(notifyTenants) : true,
        createdBy: (request as any).userContext?.internalUserId ?? null,
        tenantId: (request as any).userContext?.tenantId,
        metadata: {
          ...existingMeta,
          ...(modalConfig ? { modalConfig } : {}),
        },
      };
      
      const campaign = await SeasonalCreditService.createDistributionCampaign(campaignData);
      
      reply.send({
        success: true,
        data: campaign,
        message: 'Campaign created successfully. Ready for distribution.'
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error creating campaign:');
      reply.code(400).send({
        success: false,
        error: 'Failed to create campaign',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * GET /admin/seasonal-credits/campaigns/:campaignId
   * Get detailed information about a specific campaign
   */
  fastify.get('/campaigns/:campaignId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const campaign = await SeasonalCreditService.getCampaign(params.campaignId ?? '');
      
      reply.send({
        success: true,
        data: campaign
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching campaign:');
      reply.code(404).send({
        success: false,
        error: 'Campaign not found',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * POST /admin/seasonal-credits/campaigns/:campaignId/distribute
   * Distribute credits to tenants
   */
  fastify.post('/campaigns/:campaignId/distribute', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const result = await SeasonalCreditService.distributeCreditsToTenants(
        params.campaignId ?? ''
      );
      
      reply.send({
        success: true,
        data: result,
        message: `Credit distribution ${result.status}. ${result.distributedCount} successful, ${result.failedCount} failed.`
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error distributing credits:');
      reply.code(400).send({
        success: false,
        error: 'Failed to distribute credits',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * GET /admin/seasonal-credits/campaigns/:campaignId/status
   * Get campaign distribution status
   */
  fastify.get('/campaigns/:campaignId/status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const status = await SeasonalCreditService.getCampaignDistributionStatus(
        params.campaignId ?? ''
      );
      
      reply.send({
        success: true,
        data: status
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error getting campaign status:');
      reply.code(400).send({
        success: false,
        error: 'Failed to get campaign status',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * PUT /admin/seasonal-credits/campaigns/:campaignId/extend
   * Extend expiry for a campaign
   */
  fastify.put('/campaigns/:campaignId/extend', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {
      description: 'Extend expiry for a campaign'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const result = await SeasonalCreditService.extendCampaignExpiry(
        params.campaignId ?? '',
        (body.additionalDays as number) ?? 0
      );
      
      reply.send({
        success: true,
        data: result,
        message: `Extended campaign expiry by ${body.additionalDays ?? 0} days`
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error extending campaign expiry:');
      reply.code(400).send({
        success: false,
        error: 'Failed to extend campaign expiry',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * POST /admin/seasonal-credits/send-warnings
   * Send expiry warnings
   */
  fastify.post('/send-warnings', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {
      description: 'Send expiry warnings'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const result = await SeasonalCreditService.sendExpiryWarnings(
        (body.daysAhead as number) ?? 7
      );
      
      reply.send({
        success: true,
        data: result,
        message: `Sent expiry warnings to ${result.emailsSent} tenants`
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error sending expiry warnings:');
      reply.code(500).send({
        success: false,
        error: 'Failed to send expiry warnings',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * GET /admin/seasonal-credits/expiring-soon
   * Get credits expiring soon
   */
  fastify.get('/expiring-soon', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {
      description: 'Get credits expiring soon'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    try {
      const daysAhead = parseInt(String(query.daysAhead ?? 30), 10) || 30;
      const expiringCredits = await SeasonalCreditService.getExpiringAllocations(daysAhead);
      
      reply.send({
        success: true,
        data: expiringCredits
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching expiring credits:');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch expiring credits',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * GET /admin/seasonal-credits/tenant-allocations
   * Get tenant's seasonal credit allocations (for authenticated tenant users)
   */
  fastify.get('/tenant-allocations', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).userContext?.tenantId;
      
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }
      
      const allocations = await SeasonalCreditService.getTenantAllocations(tenantId);
      
      reply.send({
        success: true,
        data: allocations
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error getting tenant allocations:');
      reply.code(400).send({
        success: false,
        error: 'Failed to get tenant allocations',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * POST /admin/seasonal-credits/process-expiries
   * Process credit expiries (typically called by a cron job)
   */
  fastify.post('/process-expiries', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await SeasonalCreditService.processExpiries();
      
      reply.send({
        success: true,
        data: result,
        message: `Processed ${result.processedCount} expired allocations`
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error processing expiries:');
      reply.code(500).send({
        success: false,
        error: 'Failed to process expiries',
        message: error?.message ?? ''
      });
    }
  });
  
  /**
   * GET /admin/seasonal-credits/campaigns/:campaignId/tenant-breakdown
   * Per-tenant distribution status: who got credits, how many, expiry health, and who failed.
   */
  fastify.get('/campaigns/:campaignId/tenant-breakdown', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const breakdown = await SeasonalCreditService.getCampaignTenantBreakdown(params.campaignId ?? '');
      reply.send({ success: true, data: breakdown });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching campaign tenant breakdown:');
      reply.code(404).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /admin/seasonal-credits/campaigns/:campaignId/cancel
   * Cancel a campaign (marks pending batches inactive).
   */
  fastify.post('/campaigns/:campaignId/cancel', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const result = await SeasonalCreditService.cancelCampaign(params.campaignId ?? '');
      reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error cancelling campaign');
      reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /admin/seasonal-credits/campaigns/:campaignId/rerun-failed
   * Rerun failed distributions for a campaign.
   */
  fastify.post('/campaigns/:campaignId/rerun-failed', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const result = await SeasonalCreditService.rerunFailedDistributions(params.campaignId ?? '');
      reply.send({ success: true, data: result });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error rerunning failed distributions');
      reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /admin/seasonal-credits/types
   * Get available credit types
   */
  fastify.get('/types', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      success: true,
      data: [
        {
          value: 'free_distribution',
          label: 'Free Distribution',
          description: 'Free credits distributed to tenants',
          defaultExpiryDays: 30
        },
        {
          value: 'promotional',
          label: 'Promotional',
          description: 'Marketing campaign credits',
          defaultExpiryDays: 14
        },
        {
          value: 'holiday',
          label: 'Holiday',
          description: 'Holiday and seasonal promotional credits',
          defaultExpiryDays: 30
        },
        {
          value: 'bonus',
          label: 'Bonus',
          description: 'Loyalty and referral bonus credits',
          defaultExpiryDays: 90
        },
        {
          value: 'event',
          label: 'Event',
          description: 'Special event and product launch credits',
          defaultExpiryDays: 7
        }
      ]
    });
  });
}
