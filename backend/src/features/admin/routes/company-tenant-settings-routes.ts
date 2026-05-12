/**
 * Company Tenant Settings Routes
 * Audience: authenticated company users managing THEIR OWN tenant.
 *
 * Every route here resolves the tenant from `userContext.tenantId` (the
 * caller's session) — there is NO `:tenantId` path param.  These routes are
 * intentionally scoped so a company user can never read or mutate another
 * tenant's data.
 *
 * Mounted via admin.ts → /api/admin
 *
 * Routes:
 *   GET  /tenant                          — read own tenant details
 *   GET  /tenant/onboarding-status        — rich onboarding + trial progress
 *   PUT  /tenant                          — update own tenant settings
 *   DELETE /tenant/complete-deletion/:id  — full data wipe (dev/test only)
 *   GET  /tenant/:tenantId/data-summary   — record counts per table
 *
 * ⚠️  For platform-staff cross-tenant operations see tenant-management.ts
 *     (mounted at /api/admin/tenants).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, subscriptions } from '../../../db/schema/index.js';
import { eq, count as dbCount } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import Logger from '../../../utils/logger.js';
import ErrorResponses from '../../../utils/error-responses.js';
import { deleteTenantData, getTenantDataSummary } from '../../../utils/tenant-cleanup.js';
import { InterAppEventService } from '../../messaging/index.js';

type ReqWithUser = FastifyRequest & { userContext?: Record<string, unknown> };

export default async function companyTenantSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  // Get tenant information
  fastify.get('/tenant', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = Logger.generateRequestId('tenant-info');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found', {
          requestId
        });
      }

      console.log(`🔍 [${requestId}] Getting tenant info for: ${tenantId}`);

      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found', {
          requestId
        });
      }

      console.log(`✅ [${requestId}] Tenant info retrieved`);

      return {
        success: true,
        data: tenant[0],
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get tenant info:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get tenant information',
        message: error.message,
        requestId
      });
    }
  });

  // Get comprehensive tenant onboarding status and tracking
  fastify.get('/tenant/onboarding-status', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = Logger.generateRequestId('tenant-onboarding-status');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`📊 [${requestId}] Getting comprehensive onboarding status for tenant: ${tenantId}`);

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenant) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found', {
          requestId
        });
      }

      // Get subscription info
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      // Get user count
      const [userCount] = await db
        .select({ count: dbCount() })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));

      // Calculate trial status
      const now = new Date();
      const trialEnd = subscription?.trialEndsAt ?? subscription?.currentPeriodEnd;
      const trialActive = trialEnd && new Date(trialEnd as Date) > now;
      const trialExpired = trialEnd && new Date(trialEnd as Date) <= now;

      let trialTimeRemaining: string | null = null;
      if (trialEnd && trialActive) {
        const timeLeft = new Date(trialEnd as Date).getTime() - now.getTime();
        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        trialTimeRemaining = `${daysLeft} days, ${hoursLeft} hours`;
      }

      const onboardingStatus = {
        // Basic tenant info
        tenantId: tenant.tenantId,
        companyName: tenant.companyName,
        subdomain: tenant.subdomain,
        adminEmail: tenant.adminEmail,
        industry: tenant.industry,

        // Onboarding tracking
        onboardingCompleted: tenant.onboardingCompleted,
        onboardedAt: tenant.onboardedAt,
        onboardingStartedAt: tenant.onboardingStartedAt,

        // Trial & subscription tracking (derived from dedicated columns/tables)
        trialStartedAt: subscription?.trialStartedAt ?? subscription?.createdAt ?? null,
        trialEndsAt: trialEnd,
        trialActive,
        trialExpired,
        trialTimeRemaining,
        subscriptionStatus: subscription?.status ?? 'none',

        // Activity
        firstLoginAt: tenant.firstLoginAt,
        lastActivityAt: tenant.lastActivityAt,

        // Current status
        userCount: userCount.count,
        currentPlan: subscription?.plan || 'trial',
        subscriptionId: subscription?.subscriptionId,

        // Metadata
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      };

      console.log(`✅ [${requestId}] Comprehensive onboarding status retrieved`);
      console.log(`📊 [${requestId}] Onboarding completed: ${onboardingStatus.onboardingCompleted}`);
      console.log(`⏰ [${requestId}] Subscription status: ${onboardingStatus.subscriptionStatus} (Trial active: ${trialActive})`);

      return {
        success: true,
        data: onboardingStatus,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get onboarding status:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get onboarding status',
        message: error.message,
        requestId
      });
    }
  });

  // Update tenant settings
  fastify.put('/tenant', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.TENANT_SETTINGS_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const requestId = Logger.generateRequestId('tenant-update');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;
    const updateData = body as Record<string, unknown>;

    try {
      console.log(`✏️ [${requestId}] Updating tenant:`, { tenantId, updateData });

      const result = await (db.update(tenants) as any)
        .set({
          ...(updateData && typeof updateData === 'object' ? updateData : {}),
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId))
        .returning();

      if (result.length === 0) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found', {
          requestId
        });
      }

      console.log(`✅ [${requestId}] Tenant updated successfully`);

      return {
        success: true,
        message: 'Tenant updated successfully',
        data: result[0],
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to update tenant:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update tenant',
        message: error.message,
        requestId
      });
    }
  });

  // Delete tenant and all associated data (DANGER!)
  fastify.delete('/tenant/complete-deletion/:tenantId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.TENANT_SETTINGS_DELETE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('tenant-deletion');
    const tenantId = params.tenantId ?? '';
    const confirmDeletion = body.confirmDeletion;

    try {
      console.log(`🚨 [${requestId}] DANGER: Complete tenant deletion requested:`, { tenantId });

      if (!confirmDeletion || confirmDeletion !== 'DELETE_ALL_DATA') {
        return reply.code(400).send({
          success: false,
          error: 'Confirmation required',
          message: 'You must confirm deletion by setting confirmDeletion to "DELETE_ALL_DATA"',
          requestId
        });
      }

      // Only allow in development/test environment
      if (process.env.NODE_ENV === 'production') {
        return reply.code(403).send({
          success: false,
          error: 'Operation not allowed in production',
          message: 'Complete tenant deletion is only allowed in development/test environments',
          requestId
        });
      }

      console.log(`🗑️ [${requestId}] Proceeding with tenant deletion...`);

      const summary = await deleteTenantData(tenantId as string);

      global.logToES('info', '[admin] tenant.deleted', {
        tenantId,
        kindeOrgId: summary.kindeOrgId,
        requestId,
        requestedBy: (request as ReqWithUser).userContext?.userId,
      });

      // Publish tenant.deleted event so downstream apps can clean up orphan data.
      // Fire-and-forget — local deletion is already committed; MQ failure must not
      // block the response or surface a misleading error to the caller.
      void InterAppEventService.publishEvent({
        eventType: 'tenant.deleted',
        sourceApplication: 'wrapper',
        targetApplication: 'broadcast',
        tenantId: tenantId as string,
        entityId: tenantId as string,
        publishedBy: String((request as ReqWithUser).userContext?.userId ?? 'system'),
        eventData: {
          tenantId,
          kindeOrgId: summary.kindeOrgId,
          deletedAt: new Date().toISOString(),
        },
      }).catch((err: unknown) => {
        global.logToES('error', '[admin] tenant.deleted.publish_failed', {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      console.log(`✅ [${requestId}] Tenant deletion completed:`, summary);

      return {
        success: true,
        message: 'Tenant and all associated data deleted successfully',
        data: summary,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to delete tenant:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete tenant',
        message: error.message,
        requestId
      });
    }
  });

  // Get tenant data summary
  fastify.get('/tenant/:tenantId/data-summary', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.TENANT_SETTINGS_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('tenant-summary');
    const tenantId = params.tenantId ?? '';

    try {
      console.log(`📊 [${requestId}] Getting data summary for tenant: ${tenantId}`);

      const summary = await getTenantDataSummary(tenantId as string);

      console.log(`✅ [${requestId}] Data summary retrieved`);

      return {
        success: true,
        data: summary,
        tenantId,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get tenant data summary:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get tenant data summary',
        message: error.message,
        requestId
      });
    }
  });
}
