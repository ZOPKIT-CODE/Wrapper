/**
 * Internal Cache Management Routes
 * Audience: ops / SRE tooling — inspecting, invalidating, and warming the distributed SSO cache.
 * All routes require X-Internal-API-Key.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateInternalApiKey } from '../../middleware/auth/internal.js';
import DistributedSSOCache from '../../utils/distributed-sso-cache.js';

export default async function internalCacheRoutes(fastify: FastifyInstance): Promise<void> {

  // Inspect cache hit rates and memory usage
  fastify.get('/cache/stats', {
    preHandler: [validateInternalApiKey],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await DistributedSSOCache.getCacheStats();
      return { success: true, data: stats };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error getting cache stats:');
      return reply.code(500).send({ error: 'Failed to get cache stats' });
    }
  });

  // Invalidate cache by type: 'user' | 'tenant' | 'app'
  fastify.post('/cache/invalidate', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body       = request.body as Record<string, unknown>;
    const type       = (body.type       as string) ?? '';
    const identifier = (body.identifier as string) ?? '';
    const tenant_id  = body.tenant_id as string | undefined;

    try {
      switch (type) {
        case 'user':
          await DistributedSSOCache.invalidateUserCache(identifier, tenant_id);
          break;
        case 'tenant':
          await DistributedSSOCache.invalidateTenantCache(identifier);
          break;
        case 'app':
          await DistributedSSOCache.invalidateAppCache(identifier);
          break;
        default:
          return reply.code(400).send({ error: 'Invalid cache type. Valid types: user | tenant | app' });
      }
      return { success: true, message: `Cache invalidated for ${type}: ${identifier}` };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error invalidating cache:');
      return reply.code(500).send({ error: 'Failed to invalidate cache' });
    }
  });

  // Pre-warm the permission cache for a user across multiple apps
  fastify.post('/cache/warmup', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body          = request.body as Record<string, unknown>;
    const kinde_user_id  = (body.kinde_user_id  as string) ?? '';
    const kinde_org_code = (body.kinde_org_code as string) ?? '';
    const apps           = body.apps as string[] | undefined;
    const appsToWarm     = apps || ['crm', 'hr', 'affiliate'];

    try {
      const warmupPromises = appsToWarm.map((app: string) =>
        fastify.inject({
          method: 'POST',
          url: '/api/internal/user-permissions',
          headers: request.headers,
          body: { kinde_user_id, kinde_org_code, requesting_app: app, force_refresh: true },
        }),
      );
      await Promise.all(warmupPromises);
      return { success: true, message: `Cache warmed up for user ${kinde_user_id} across ${appsToWarm.length} apps` };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error warming up cache:');
      return reply.code(500).send({ error: 'Failed to warm up cache' });
    }
  });
}
