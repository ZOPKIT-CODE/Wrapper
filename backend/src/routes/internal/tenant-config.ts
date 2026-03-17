/**
 * Internal Tenant Config Routes
 * Audience: suite apps that need to read tenant configuration and feature flags.
 * All routes require X-Internal-API-Key.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateInternalApiKey } from '../../middleware/auth/internal.js';
import { TenantService } from '../../services/tenant-service.js';
import ErrorResponses from '../../utils/error-responses.js';

export default async function internalTenantConfigRoutes(fastify: FastifyInstance): Promise<void> {

  // Internal health check — no key required (used by load balancers / monitoring)
  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'wrapper-backend',
  }));

  // Tenant configuration: settings, branding, active subscription
  fastify.get('/tenant/:tenantId/config', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    try {
      const { SubscriptionService } = await import('../../features/subscriptions/services/subscription-service.js');
      const tenant = await TenantService.getTenantDetails(tenantId);
      if (!tenant) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      const subscription = await SubscriptionService.getCurrentSubscription(tenantId);
      return {
        success: true,
        data: {
          tenant: {
            id: tenant.tenantId,
            name: tenant.companyName,
            subdomain: tenant.subdomain,
            isActive: tenant.isActive,
            settings: tenant.settings,
            branding: {
              logoUrl: tenant.logoUrl,
              primaryColor: tenant.primaryColor,
            },
          },
          subscription: {
            plan: subscription?.plan,
            status: subscription?.status,
            subscribedTools: subscription?.subscribedTools || [],
            usageLimits: subscription?.usageLimits || {},
          },
        },
      };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error fetching tenant config:');
      return reply.code(500).send({ error: 'Failed to fetch tenant config' });
    }
  });

  // Feature flags derived from the tenant's subscription plan
  fastify.get('/tenant/:tenantId/features', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    try {
      const { SubscriptionService } = await import('../../features/subscriptions/services/subscription-service.js');
      const subscription = await SubscriptionService.getCurrentSubscription(tenantId);
      if (!subscription) return ErrorResponses.notFound(reply, 'Subscription', 'Subscription not found');

      const featureFlags = {
        crm_advanced_reports:        subscription.plan !== 'trial' && subscription.plan !== 'starter',
        hr_payroll:                  subscription.plan === 'professional' || subscription.plan === 'enterprise',
        affiliate_custom_commissions: subscription.plan === 'enterprise',
        white_label:                 subscription.plan === 'enterprise',
        api_access:                  subscription.plan !== 'trial',
        webhook_support:             subscription.plan === 'professional' || subscription.plan === 'enterprise',
        custom_integrations:         subscription.plan === 'enterprise',
        priority_support:            subscription.plan === 'professional' || subscription.plan === 'enterprise',
      };

      return { success: true, data: { tenantId, plan: subscription.plan, featureFlags } };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error fetching feature flags:');
      return reply.code(500).send({ error: 'Failed to fetch feature flags' });
    }
  });
}
