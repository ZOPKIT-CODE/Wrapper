import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ZodError } from 'zod';
import Logger from '../../../utils/logger.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { seriesSchema, reorderSeriesSchema } from '../schemas.js';
import {
  createSeries, updateSeries, softDeleteSeries, listSeries,
  getSeriesWithPosts, getPublicSeriesBySlug, reorderSeries, listPublicSeries,
} from '../services/series-service.js';

function invalid(reply: FastifyReply, err: ZodError) {
  return reply.code(400).send({ success: false, error: 'Invalid input', details: err.flatten() });
}
function seriesId(request: FastifyRequest): string {
  return (request.params as { seriesId: string }).seriesId;
}

const viewGuard = { preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_BLOG_VIEW)] };
const manageGuard = { preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_BLOG_MANAGE)] };

/**
 * Blog series — mounted at /api/blog/series.
 *  PUBLIC: GET /by-slug/:slug (series + its published posts).
 *  ADMIN:  GET / (list), GET /:id (with posts), POST /, PATCH /:id, DELETE /:id,
 *          POST /:id/reorder. Static /by-slug is declared before the /:id param.
 */
export default async function blogSeriesRoutes(fastify: FastifyInstance, _opts?: Record<string, unknown>): Promise<void> {
  // Public: a series and its published posts (the curriculum).
  fastify.get('/by-slug/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const slug = (request.params as { slug: string }).slug;
      const found = await getPublicSeriesBySlug(slug);
      if (!found) return reply.code(404).send({ success: false, error: 'Series not found' });
      return { success: true, data: found };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/series/by-slug', 'Failed to load series', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to load series' });
    }
  });

  // Public: series that have ≥1 published post (for the blog-index grouping).
  fastify.get('/list', async (_request: FastifyRequest, reply: FastifyReply) => {
    try { return { success: true, data: await listPublicSeries() }; }
    catch (err) { Logger.log('error', 'general', 'GET /api/blog/series/list', 'Failed', { error: (err as Error).message }); return reply.code(500).send({ success: false, error: 'Failed to list series' }); }
  });

  // Admin: list series.
  fastify.get('/', viewGuard, async (_request: FastifyRequest, reply: FastifyReply) => {
    try { return { success: true, data: await listSeries() }; }
    catch (err) { Logger.log('error', 'general', 'GET /api/blog/series', 'Failed', { error: (err as Error).message }); return reply.code(500).send({ success: false, error: 'Failed to list series' }); }
  });

  // Admin: a series with all its posts (any status), ordered.
  fastify.get('/:seriesId', viewGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const found = await getSeriesWithPosts(seriesId(request));
      if (!found) return reply.code(404).send({ success: false, error: 'Series not found' });
      return { success: true, data: found };
    } catch (err) { return reply.code(500).send({ success: false, error: 'Failed to load series' }); }
  });

  fastify.post('/', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = seriesSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const data = await createSeries(parsed.data, request.userContext?.internalUserId ?? null);
      return reply.code(201).send({ success: true, data });
    } catch (err) { Logger.log('error', 'general', 'POST /api/blog/series', 'Failed', { error: (err as Error).message }); return reply.code(500).send({ success: false, error: 'Failed to create series' }); }
  });

  fastify.patch('/:seriesId', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = seriesSchema.partial().safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const data = await updateSeries(seriesId(request), parsed.data, request.userContext?.internalUserId ?? null);
      if (!data) return reply.code(404).send({ success: false, error: 'Series not found' });
      return { success: true, data };
    } catch (err) { return reply.code(500).send({ success: false, error: 'Failed to update series' }); }
  });

  fastify.delete('/:seriesId', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ok = await softDeleteSeries(seriesId(request));
      if (!ok) return reply.code(404).send({ success: false, error: 'Series not found' });
      return { success: true };
    } catch (err) { return reply.code(500).send({ success: false, error: 'Failed to delete series' }); }
  });

  fastify.post('/:seriesId/reorder', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = reorderSeriesSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      await reorderSeries(seriesId(request), parsed.data.orderedPostIds);
      return { success: true };
    } catch (err) { return reply.code(500).send({ success: false, error: 'Failed to reorder' }); }
  });
}
