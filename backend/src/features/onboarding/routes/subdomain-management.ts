import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../../utils/logger.js';
import { TenantService } from '../../../services/tenant-service.js';

/**
 * Subdomain Management Routes
 * Handles subdomain availability checking and validation
 */

export default async function subdomainManagementRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // Check subdomain availability (POST version)
  fastify.post('/check-subdomain', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { subdomain } = body;

      // Check if subdomain is available
      const available = await TenantService.checkSubdomainAvailability(subdomain as string);

      return {
        success: true,
        available,
        subdomain
      };
    } catch (err: unknown) {
      request.log.error(err, 'Error checking subdomain availability:');
      return reply.code(500).send({ error: 'Failed to check subdomain availability' });
    }
  });

  // Check subdomain availability (GET version for frontend)
  fastify.get('/check-subdomain', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { subdomain } = query;

      Logger.log('info', 'general', 'check-subdomain', 'Checking subdomain availability', { subdomain });

      // Check if subdomain is available
      const available = await TenantService.checkSubdomainAvailability(subdomain);

      Logger.log('info', 'general', 'check-subdomain', 'Subdomain availability result', { subdomain, available });

      return {
        success: true,
        available,
        subdomain
      };
    } catch (err: unknown) {
      Logger.log('error', 'general', 'check-subdomain', 'Error checking subdomain availability', { error: (err as Error).message });
      request.log.error(err, 'Error checking subdomain availability:');
      return reply.code(500).send({ error: 'Failed to check subdomain availability' });
    }
  });
}
