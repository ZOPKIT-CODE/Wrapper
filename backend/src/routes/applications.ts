import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import tenantApplicationsService from '../services/tenant-applications-service.js';
import Logger from '../utils/logger.js';

export default async function applicationsRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>,
): Promise<void> {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).userContext?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      request.log.info({ tenantId }, 'Getting applications for tenant');
      Logger.log('info', 'routes', 'get-applications', `[APPS] tenantId="${tenantId}" idpOrgId="${(request as any).userContext?.idpOrgId}" internalUserId="${(request as any).userContext?.internalUserId}"`);
      const userApps = await tenantApplicationsService.getEnabledApplicationsForTenant(tenantId);
      Logger.log('info', 'routes', 'get-applications', `[APPS] returned ${userApps.length} apps for tenantId="${tenantId}"`);
      return { success: true, data: userApps };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Failed to get applications');
      return reply.code(500).send({
        error: 'Failed to get applications',
        message: error.message,
      });
    }
  });
}
