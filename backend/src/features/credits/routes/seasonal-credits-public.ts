import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function seasonalCreditsPublicRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  /**
   * GET /api/seasonal-credits/recent-allocations
   * Get recent seasonal credit allocations for the current tenant
   */
  fastify.get('/recent-allocations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;

      // Get current tenant from auth (simplified - would use proper tenant context)
      const tenantId = (request as any).userContext?.tenantId ?? (request as any).user?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ success: false, error: 'Unauthorized' });
      }

      // REMOVED: creditAllocations table queries
      // Applications now manage their own credit consumption
      // Return empty array - seasonal credits are managed by applications
      const recentAllocations: any[] = [];

      // Format the response
      const formattedAllocations = recentAllocations.map((allocation: any) => ({
        campaignId: allocation.campaignId,
        campaignName: allocation.campaignName,
        creditType: allocation.creditType,
        allocatedCredits: parseFloat(allocation.allocatedCredits),
        expiresAt: allocation.expiresAt,
        allocatedAt: allocation.allocatedAt,
        applications: allocation.applications || []
      }));

      reply.send({
        success: true,
        data: formattedAllocations
      });

    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error getting recent credit allocations:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve recent credit allocations'
      });
    }
  });
}
