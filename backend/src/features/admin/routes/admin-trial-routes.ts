import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { tenants, subscriptions } from '../../../db/schema/index.js';
import { eq, and, or, lt, sql } from 'drizzle-orm';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import Logger from '../../../utils/logger.js';
import trialManager from '../../../utils/trial-manager.js';
import ErrorResponses from '../../../utils/error-responses.js';

type ReqWithUser = FastifyRequest & { userContext?: Record<string, unknown> };

export default async function adminTrialRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Manually trigger trial expiry check (FOR TESTING)
  fastify.post('/trials/check-expired', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const startTime = Date.now();
    const requestId = Logger.generateRequestId('manual-trial-check');

    try {
      console.log('\n🔧 ================ MANUAL TRIAL EXPIRY CHECK ================');
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`👤 Requested by: ${(request as ReqWithUser).userContext?.email}`);
      console.log(`⏰ Timestamp: ${Logger.getTimestamp()}`);

      await trialManager.checkExpiredTrials();

      console.log(`✅ [${requestId}] Manual trial expiry check completed`);
      console.log(`⏱️ [${requestId}] Duration: ${Logger.getDuration(startTime)}`);
      console.log('🔧 ================ MANUAL TRIAL CHECK ENDED ================\n');

      return {
        success: true,
        message: 'Trial expiry check completed successfully',
        requestId,
        duration: Logger.getDuration(startTime)
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Manual trial expiry check failed:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to check expired trials',
        message: error.message,
        requestId
      });
    }
  });

  // Manually trigger trial reminders (FOR TESTING)
  fastify.post('/trials/reminders', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const startTime = Date.now();
    const requestId = Logger.generateRequestId('manual-trial-reminders');

    try {
      console.log('\n📧 ================ MANUAL TRIAL REMINDERS ================');
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`👤 Requested by: ${(request as ReqWithUser).userContext?.email}`);
      console.log(`⏰ Timestamp: ${Logger.getTimestamp()}`);

      await trialManager.sendTrialReminders();

      console.log(`✅ [${requestId}] Manual trial reminders completed`);
      console.log(`⏱️ [${requestId}] Duration: ${Logger.getDuration(startTime)}`);
      console.log('📧 ================ MANUAL REMINDERS ENDED ================\n');

      return {
        success: true,
        message: 'Trial reminders sent successfully',
        requestId,
        duration: Logger.getDuration(startTime)
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Manual trial reminders failed:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send trial reminders',
        message: error.message,
        requestId
      });
    }
  });

  // Manually expire a specific trial (FOR TESTING)
  fastify.post('/trials/:tenantId/expire', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const startTime = Date.now();
    const requestId = Logger.generateRequestId('manual-trial-expire');
    const tenantId = params.tenantId ?? '';

    try {
      console.log('\n⏰ ================ MANUAL TRIAL EXPIRY ================');
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`🏢 Target Tenant: ${tenantId}`);
      console.log(`👤 Requested by: ${(request as ReqWithUser).userContext?.email}`);
      console.log(`⏰ Timestamp: ${Logger.getTimestamp()}`);

      // Additional safety - only allow in development/test environment
      if (process.env.NODE_ENV === 'production') {
        return reply.code(403).send({
          success: false,
          error: 'Operation not allowed in production',
          message: 'Manual trial expiry is only allowed in development/test environments'
        });
      }

      await (trialManager as any).manuallyExpireTrial(tenantId);

      console.log(`✅ [${requestId}] Manual trial expiry completed for tenant: ${tenantId}`);
      console.log(`⏱️ [${requestId}] Duration: ${Logger.getDuration(startTime)}`);
      console.log('⏰ ================ MANUAL EXPIRY ENDED ================\n');

      return {
        success: true,
        message: `Trial expired successfully for tenant: ${tenantId}`,
        tenantId,
        requestId,
        duration: Logger.getDuration(startTime)
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Manual trial expiry failed for tenant ${tenantId}:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to expire trial',
        message: error.message,
        tenantId,
        requestId
      });
    }
  });

  // Get trial status for a specific tenant
  fastify.get('/trials/:tenantId/status', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('trial-status');
    const tenantId = params.tenantId ?? '';

    try {
      console.log(`🔍 [${requestId}] Getting trial status for tenant: ${tenantId}`);

      const trialStatus = await (trialManager as any).getTrialStatus(tenantId);

      console.log(`✅ [${requestId}] Trial status retrieved for tenant: ${tenantId}`);
      console.log(`📊 [${requestId}] Status:`, trialStatus);

      return {
        success: true,
        data: trialStatus,
        tenantId,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get trial status for tenant ${tenantId}:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get trial status',
        message: error.message,
        tenantId,
        requestId
      });
    }
  });

  // Get current tenant's trial status
  fastify.get('/trials/current/status', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('current-trial-status');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'No tenant context',
          message: 'Unable to determine current tenant'
        });
      }

      console.log(`🔍 [${requestId}] Getting current trial status for tenant: ${tenantId}`);

      const trialStatus = await (trialManager as any).getTrialStatus(tenantId);
      const expiryCheck = await trialManager.isTrialExpired(tenantId);

      console.log(`✅ [${requestId}] Current trial status retrieved`);
      console.log(`📊 [${requestId}] Status:`, trialStatus);
      console.log(`🔒 [${requestId}] Expiry Check:`, expiryCheck);

      return {
        success: true,
        data: {
          ...trialStatus,
          expiryCheck,
          restrictionsActive: expiryCheck.expired
        },
        tenantId,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get current trial status:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get current trial status',
        message: error.message,
        requestId
      });
    }
  });

  // Frontend initialization endpoint - check trial status before loading app data
  fastify.get('/trials/check-before-load', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('trial-init-check');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'No tenant context',
          message: 'Unable to determine current tenant'
        });
      }

      console.log(`🔍 [${requestId}] Frontend initialization - checking trial status for tenant: ${tenantId}`);

      const expiryCheck = await trialManager.isTrialExpired(tenantId);
      const trialStatus = await (trialManager as any).getTrialStatus(tenantId);

      console.log(`📊 [${requestId}] Trial check results:`, expiryCheck);

      if (expiryCheck.expired) {
        const now = new Date();
        const trialEndDate = new Date((expiryCheck as any).trialEnd as Date | string);
        const nowMs = now.getTime();
        const endMs = trialEndDate.getTime();
        const daysExpired = Math.floor((nowMs - endMs) / (1000 * 60 * 60 * 24));
        const hoursExpired = Math.floor((nowMs - endMs) / (1000 * 60 * 60));
        const minutesExpired = Math.floor((nowMs - endMs) / (1000 * 60));

        let expiredDuration = '';
        if (daysExpired > 0) {
          expiredDuration = `${daysExpired} day${daysExpired > 1 ? 's' : ''} ago`;
        } else if (hoursExpired > 0) {
          expiredDuration = `${hoursExpired} hour${hoursExpired > 1 ? 's' : ''} ago`;
        } else if (minutesExpired > 0) {
          expiredDuration = `${minutesExpired} minute${minutesExpired > 1 ? 's' : ''} ago`;
        } else {
          expiredDuration = 'just now';
        }

        console.log(`🚫 [${requestId}] TRIAL EXPIRED during initialization - expired ${expiredDuration}`);

        return reply.code(200).send({
          success: false,
          error: 'Trial Expired',
          message: 'Your trial period has ended. Please upgrade your subscription to access your dashboard and data.',
          code: 'TRIAL_EXPIRED',
          operationType: 'app_initialization',
          data: {
            trialEnd: expiryCheck.trialEnd,
            trialEndFormatted: trialEndDate.toLocaleDateString() + ' at ' + trialEndDate.toLocaleTimeString(),
            expiredDuration,
            reason: expiryCheck.reason,
            plan: expiryCheck.plan,
            allowedOperations: ['payments', 'subscriptions'],
            upgradeUrl: '/api/subscriptions/checkout',
            trialInfo: trialStatus
          },
          requestId,
          isTrialExpired: true,
          showUpgradePrompt: true,
          blockAppLoading: true,
          subscriptionExpired: true
        });
      }

      console.log(`✅ [${requestId}] Trial active - frontend can proceed with loading`);
      console.log(`📅 [${requestId}] Trial ends: ${expiryCheck.trialEnd}`);

      return {
        success: true,
        message: 'Trial is active - proceed with app loading',
        data: {
          trialActive: true,
          trialEnd: (expiryCheck as any).trialEnd,
          trialEndFormatted: new Date((expiryCheck as any).trialEnd as Date).toLocaleDateString() + ' at ' + new Date((expiryCheck as any).trialEnd as Date).toLocaleTimeString(),
          timeRemaining: trialStatus.timeRemainingHuman,
          plan: expiryCheck.plan,
          trialInfo: trialStatus
        },
        requestId,
        isTrialExpired: false,
        showUpgradePrompt: false,
        blockAppLoading: false
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Error during trial initialization check:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to check trial status',
        message: error.message,
        requestId
      });
    }
  });

  // Check trial system health and status
  fastify.get('/trials/system-status', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('trial-system-status');

    try {
      console.log(`🔍 [${requestId}] Checking trial system status...`);

      // Get monitoring status
      const monitoringStatus = trialManager.getMonitoringStatus();

      // Get database stats
      const subscriptionStats = await db
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          count: sql`count(*)`.as('count')
        })
        .from(subscriptions)
        .groupBy(subscriptions.plan, subscriptions.status);

      // Check for expired trials
      const expiredTrials = await db
        .select({
          tenantId: subscriptions.tenantId,
          plan: subscriptions.plan,
          status: subscriptions.status,
          trialEnd: (subscriptions as any).trialEnd,
          companyName: tenants.companyName
        })
        .from(subscriptions)
        .leftJoin(tenants, eq(subscriptions.tenantId, tenants.tenantId))
        .where(
          and(
            eq(subscriptions.status, 'past_due'),
            or(
              eq(subscriptions.plan, 'trial'),
              lt((subscriptions as any).trialEnd, new Date())
            )
          )
        )
        .limit(5);

      // Check system health
      const issues: string[] = [];
      if (!monitoringStatus.isRunning) {
        issues.push('Trial monitoring system is not running');
      }
      if (monitoringStatus.activeJobs < 3) {
        issues.push(`Only ${monitoringStatus.activeJobs} cron jobs active (expected 4)`);
      }
      if (monitoringStatus.errorCount > 0) {
        issues.push(`${monitoringStatus.errorCount} recent errors detected`);
      }
      const timeSinceLastHealthCheck = monitoringStatus.lastHealthCheck
        ? Date.now() - new Date(monitoringStatus.lastHealthCheck as unknown as string).getTime()
        : null;
      if (timeSinceLastHealthCheck && timeSinceLastHealthCheck > 10 * 60 * 1000) {
        issues.push('Health check is stale (>10 minutes)');
      }
      const systemHealth = {
        isHealthy: monitoringStatus.isRunning && monitoringStatus.activeJobs >= 3,
        issues
      };

      console.log(`✅ [${requestId}] Trial system status retrieved`);

      return {
        success: true,
        data: {
          monitoringStatus,
          subscriptionStats,
          expiredTrials: expiredTrials.map(trial => ({
            tenantId: trial.tenantId,
            companyName: trial.companyName,
            plan: trial.plan,
            status: trial.status,
            trialEnd: trial.trialEnd,
            daysExpired: trial.trialEnd ? Math.floor((Date.now() - new Date(trial.trialEnd).getTime()) / (1000 * 60 * 60 * 24)) : null
          })),
          systemHealth,
          timestamp: new Date().toISOString()
        },
        requestId
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get trial system status:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get trial system status',
        message: error.message,
        requestId
      });
    }
  });

  // Force restart trial monitoring system
  fastify.post('/trials/restart-monitoring', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const requestId = Logger.generateRequestId('restart-trial-monitoring');

    try {
      console.log(`🔄 [${requestId}] Restarting trial monitoring system...`);

      // Stop existing monitoring
      trialManager.stopTrialMonitoring();

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start monitoring again
      trialManager.startTrialMonitoring();

      // Verify it's running
      const status = trialManager.getMonitoringStatus();

      if (status.isRunning) {
        console.log(`✅ [${requestId}] Trial monitoring restarted successfully`);
        return {
          success: true,
          message: 'Trial monitoring system restarted successfully',
          data: status,
          requestId
        };
      } else {
        console.error(`❌ [${requestId}] Failed to restart trial monitoring`);
        return reply.code(500).send({
          success: false,
          error: 'Failed to restart trial monitoring',
          message: 'System did not start properly after restart',
          requestId
        });
      }

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Error restarting trial monitoring:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to restart trial monitoring',
        message: error.message,
        requestId
      });
    }
  });
}
