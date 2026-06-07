import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ZodError } from 'zod';
import Logger from '../../../utils/logger.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import {
  createPostSchema,
  updatePostSchema,
  publishSchema,
} from '../schemas.js';
import {
  createPost,
  updatePost,
  getPost,
  listPosts,
  setPostStatus,
  softDeletePost,
  getPublicPostBySlug,
  listPublicPosts,
  getAuthor,
  getAdjacentPosts,
  getRelatedPosts,
  getBacklinks,
  searchPublicPosts,
  searchLinkablePosts,
  getSlugRedirectTarget,
} from '../services/blog-service.js';
import { uploadBlogImageBuffer, getBlogMediaObject } from '../services/blog-upload.js';
import { setPostSeries, getSeriesForPost } from '../services/series-service.js';

function paramId(request: FastifyRequest): string {
  return (request.params as { postId: string }).postId;
}

function originOf(request: FastifyRequest): string {
  if (process.env.BLOG_PUBLIC_BASE_URL) return process.env.BLOG_PUBLIC_BASE_URL;
  const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
  const host = request.headers.host ?? '';
  return `${proto}://${host}`;
}

function invalid(reply: FastifyReply, err: ZodError) {
  const flat = err.flatten();
  // Log the exact failing field(s) so validation 400s aren't opaque in the console.
  Logger.log('warn', 'general', 'blog.validation', 'Blog request failed validation', {
    fieldErrors: flat.fieldErrors,
    formErrors: flat.formErrors,
  });
  return reply.code(400).send({ success: false, error: 'Invalid input', details: flat });
}

/**
 * Blog API — mounted at /api/blog.
 *
 * PUBLIC (whitelisted in PUBLIC_ROUTES, no auth): GET /feed, GET /by-slug/:slug,
 * GET /media/* — these power the public marketing-site reader.
 *
 * COMPANY-ADMIN ONLY (authenticateToken + requirePermission): all management +
 * write routes (list, get-by-id, create, update, publish, unpublish, delete,
 * uploads). Authoring lives in the company admin dashboard. The server-side HTML
 * sanitizer (blog-render) remains the XSS boundary for author content.
 *
 * Bodies are validated with Zod's `safeParse` inside the handlers rather than via
 * the fastify-type-provider-zod schema option — the provider's validator is
 * unreliable with this repo's zod 3.25 line. Static sub-paths (/feed, /by-slug,
 * /media, /uploads) are declared before the /:postId param route.
 */
const viewGuard = { preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_BLOG_VIEW)] };
const manageGuard = { preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_BLOG_MANAGE)] };
export default async function blogRoutes(fastify: FastifyInstance, _opts?: Record<string, unknown>): Promise<void> {
  // ── Public read (published + due) ─────────────────────────────────────────
  fastify.get('/feed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as { limit?: string; offset?: string; tag?: string };
      const data = await listPublicPosts({
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
        tag: q.tag,
      });
      return { success: true, data };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/feed', 'Failed to load feed', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to load feed' });
    }
  });

  // Public search over title/excerpt/tags.
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = (request.query as { q?: string }).q ?? '';
      const data = await searchPublicPosts(q);
      return { success: true, data };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/search', 'Search failed', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Search failed' });
    }
  });

  fastify.get('/by-slug/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const slug = (request.params as { slug: string }).slug;
      const post = await getPublicPostBySlug(slug);
      if (!post) {
        // Old slug? Tell the SPA where the post moved (the crawler route 301s).
        const movedTo = await getSlugRedirectTarget(slug);
        if (movedTo) return reply.send({ success: false, movedTo });
        return reply.code(404).send({ success: false, error: 'Post not found' });
      }
      // Reading-experience extras: author byline, prev/next, related, series nav, backlinks.
      const [author, adjacent, related, series, backlinks] = await Promise.all([
        getAuthor(post.authorId),
        getAdjacentPosts(post),
        getRelatedPosts(post),
        getSeriesForPost(post),
        getBacklinks(post.postId),
      ]);
      return { success: true, data: post, author, prev: adjacent.prev, next: adjacent.next, related, series, backlinks };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/by-slug', 'Failed to load post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to load post' });
    }
  });

  // Media proxy: private bucket → public, allow-listed to the blog prefix.
  fastify.get('/media/*', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const key = (request.params as { '*': string })['*'];
      if (!key) return reply.code(404).send('Not found');
      const obj = await getBlogMediaObject(decodeURIComponent(key));
      if (!obj) return reply.code(404).send('Not found');
      reply
        .header('content-type', obj.contentType ?? 'application/octet-stream')
        .header('cache-control', obj.cacheControl ?? 'public, max-age=31536000, immutable')
        // Public media is embedded cross-origin (SPA on a different origin than
        // the API), so override Helmet's default CORP: same-origin which would
        // otherwise make the browser block the <img>.
        .header('cross-origin-resource-policy', 'cross-origin');
      if (obj.contentLength != null) reply.header('content-length', obj.contentLength);
      return reply.send(obj.body);
    } catch (err) {
      // Log the real reason (e.g. an S3 AccessDenied from a quarantined key)
      // but degrade to 404 so the public page shows a broken image, not a 500.
      Logger.log('error', 'general', 'GET /api/blog/media', 'Failed to serve media', { error: (err as Error).message });
      return reply.code(404).send('Not found');
    }
  });

  // Image upload (cover / inline) — multipart proxied through the backend to S3.
  // Avoids browser→S3 CORS and validates the real bytes server-side.
  fastify.post('/uploads', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const file = await request.file();
      if (!file) return reply.code(400).send({ success: false, error: 'No file uploaded' });
      const kind = (request.query as { kind?: string }).kind === 'cover' ? 'cover' : 'inline';
      const buffer = await file.toBuffer();
      const result = await uploadBlogImageBuffer({
        buffer,
        contentType: file.mimetype,
        filename: file.filename,
        kind,
        origin: originOf(request),
      });
      return { success: true, data: result };
    } catch (err) {
      Logger.log('error', 'general', 'POST /api/blog/uploads', 'Failed to upload image', { error: (err as Error).message });
      return reply.code(400).send({ success: false, error: (err as Error).message });
    }
  });

  // ── Management (all posts incl. drafts) ───────────────────────────────────
  fastify.get('/', viewGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = (request.query as { status?: string })?.status;
      const data = await listPosts({ status });
      return { success: true, data };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog', 'Failed to list posts', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to list posts' });
    }
  });

  // Admin: search posts to link to from the editor (the "Link to a post" picker).
  fastify.get('/posts/search', viewGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as { q?: string; exclude?: string };
      const data = await searchLinkablePosts(q.q ?? '', q.exclude);
      return { success: true, data };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/posts/search', 'Post search failed', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Search failed' });
    }
  });

  fastify.get('/:postId', viewGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const post = await getPost(paramId(request));
      if (!post) return reply.code(404).send({ success: false, error: 'Post not found' });
      return { success: true, data: post };
    } catch (err) {
      Logger.log('error', 'general', 'GET /api/blog/:id', 'Failed to get post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to get post' });
    }
  });

  fastify.post('/', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = createPostSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const post = await createPost(parsed.data, request.userContext?.internalUserId ?? null);
      if (parsed.data.seriesId !== undefined) await setPostSeries(post.postId, parsed.data.seriesId);
      return reply.code(201).send({ success: true, data: post });
    } catch (err) {
      Logger.log('error', 'general', 'POST /api/blog', 'Failed to create post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to create post' });
    }
  });

  fastify.patch('/:postId', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = updatePostSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const post = await updatePost(paramId(request), parsed.data);
      if (!post) return reply.code(404).send({ success: false, error: 'Post not found' });
      if (parsed.data.seriesId !== undefined) await setPostSeries(post.postId, parsed.data.seriesId);
      return { success: true, data: post };
    } catch (err) {
      Logger.log('error', 'general', 'PATCH /api/blog/:id', 'Failed to update post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to update post' });
    }
  });

  fastify.post('/:postId/publish', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = publishSchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);
      const status = (parsed.data?.status ?? 'published') as 'published' | 'draft' | 'archived';
      const post = await setPostStatus(paramId(request), status);
      if (!post) return reply.code(404).send({ success: false, error: 'Post not found' });
      return { success: true, data: post };
    } catch (err) {
      Logger.log('error', 'general', 'POST /api/blog/:id/publish', 'Failed to publish post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to publish post' });
    }
  });

  fastify.post('/:postId/unpublish', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const post = await setPostStatus(paramId(request), 'draft');
      if (!post) return reply.code(404).send({ success: false, error: 'Post not found' });
      return { success: true, data: post };
    } catch (err) {
      Logger.log('error', 'general', 'POST /api/blog/:id/unpublish', 'Failed to unpublish post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to unpublish post' });
    }
  });

  fastify.delete('/:postId', manageGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ok = await softDeletePost(paramId(request));
      if (!ok) return reply.code(404).send({ success: false, error: 'Post not found' });
      return { success: true };
    } catch (err) {
      Logger.log('error', 'general', 'DELETE /api/blog/:id', 'Failed to delete post', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to delete post' });
    }
  });
}
