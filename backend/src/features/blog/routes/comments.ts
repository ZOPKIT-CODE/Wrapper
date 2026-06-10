import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ZodError } from 'zod';
import Logger from '../../../utils/logger.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { submitCommentSchema, moderateCommentSchema, type SubmitCommentInput } from '../schemas.js';
import { getPublicPostBySlug } from '../services/blog-service.js';
import {
  submitComment, listApprovedComments, listCommentsForModeration, moderateComment, pendingCommentCount,
} from '../services/comment-service.js';

function invalid(reply: FastifyReply, err: ZodError) {
  return reply.code(400).send({ success: false, error: 'Invalid input', details: err.flatten() });
}

const manageGuard = { preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_BLOG_MANAGE)] };

/**
 * Blog comments — mounted at /api/blog/comments.
 *  PUBLIC:  POST /submit (anyone, lands as 'pending'),  GET /by-slug/:slug (approved only).
 *  ADMIN:   GET /pending (queue), GET /pending/count, POST /:commentId/moderate.
 * Public paths are whitelisted in PUBLIC_ROUTES; admin paths fall through to auth.
 * Comment bodies are plain text, escaped on render — never HTML.
 */
export default async function blogCommentRoutes(fastify: FastifyInstance, _opts?: Record<string, unknown>): Promise<void> {
  // Public: submit a comment (moderated — not shown until approved).
  fastify.post('/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = submitCommentSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const input = parsed.data as SubmitCommentInput;
      const result = await submitComment({
        postId: input.postId,
        authorName: input.authorName,
        authorEmail: input.authorEmail,
        body: input.body,
        ip: request.ip,
      });
      if (!result.ok) return reply.code(404).send({ success: false, error: 'Post not found' });
      return { success: true, message: 'Comment submitted — it will appear once approved.' };
    } catch (err) {
      Logger.log('error', 'general', 'POST /api/blog/comments/submit', 'Failed to submit comment', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to submit comment' });
    }
  });

  // Public: approved comments for a post.
  fastify.get('/by-slug/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const slug = (request.params as { slug: string }).slug;
      const post = await getPublicPostBySlug(slug);
      if (!post) return { success: true, data: [] };
      const data = await listApprovedComments(post.postId);
      return { success: true, data };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/comments/by-slug', 'Failed to load comments', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to load comments' });
    }
  });

  // Admin: moderation queue + count.
  fastify.get('/pending', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await listCommentsForModeration('pending');
      return { success: true, data };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/comments/pending', 'Failed to load queue', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to load queue' });
    }
  });

  fastify.get('/pending/count', manageGuard, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return { success: true, data: { count: await pendingCommentCount() } };
    } catch (err) {
      return reply.code(500).send({ success: false, error: 'Failed' });
    }
  });

  // Admin: approve / reject / mark spam.
  fastify.post('/:commentId/moderate', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = moderateCommentSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const commentId = (request.params as { commentId: string }).commentId;
      const ok = await moderateComment(commentId, parsed.data.status, request.userContext?.internalUserId ?? null);
      if (!ok) return reply.code(404).send({ success: false, error: 'Comment not found' });
      return { success: true };
    } catch (err) {
      Logger.log('error', 'general', 'POST /api/blog/comments/:id/moderate', 'Failed to moderate', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to moderate' });
    }
  });
}
