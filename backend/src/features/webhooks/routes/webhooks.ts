import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function webhookRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  // Generic webhook handler for external services
  fastify.post('/external/:service', async (request: FastifyRequest<{ Params: { service: string } }>, reply: FastifyReply) => {
    const { service } = request.params;
    
    try {
      // Log webhook receipt
      fastify.log.info({
        headers: request.headers,
        body: request.body,
      }, `Received webhook from ${service}`);

      // Basic webhook verification would go here
      // For demo purposes, just acknowledge receipt
      
      return {
        success: true,
        service,
        received: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error, `Error processing ${service} webhook:`);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  // Health check webhook
  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: 'ok',
      service: 'webhook-handler',
      timestamp: new Date().toISOString(),
    };
  });
} 