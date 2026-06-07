import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../../utils/logger.js';
import { isCrawler } from '../crawler.js';
import { getPublicPostBySlug, listPublicPosts, getBacklinks, getSlugRedirectTarget } from '../services/blog-service.js';
import { getSeriesForPost, getPublicSeriesBySlug } from '../services/series-service.js';
import {
  renderPostDocument,
  renderListDocument,
  renderSeriesDocument,
  renderNotFoundDocument,
} from '../services/blog-prerender.js';

/**
 * Crawler-HTML (dynamic rendering) for the public blog. Mounted at the ROOT
 * (/blog, /blog/:slug) and whitelisted in PUBLIC_ROUTES.
 *
 * - Crawlers (no-JS bots) get a full server-rendered, SEO-complete HTML page
 *   (meta/OG/Twitter/JSON-LD + the sanitized body) so unfurls + indexing work.
 * - Humans are sent to the SPA. The redirect is LOOP-SAFE: it only fires when the
 *   marketing-site host differs from the host that served this request; if they
 *   are the same (or BLOG_SITE_URL is unset), the human is served the same static
 *   HTML as a no-JS fallback rather than redirected into a loop.
 *
 * Prod wiring: route /blog + /blog/* to the backend origin (a CloudFront cache
 * behavior). For zero-redirect humans, do UA routing at the edge (Lambda@Edge)
 * and send only bots here. Returns raw HTML (no Zod response schema → JSON
 * serializer bypassed). Set BLOG_SITE_URL (marketing origin) and
 * BLOG_PUBLIC_BASE_URL (media origin).
 */
function siteOrigin(request: FastifyRequest): string {
  if (process.env.BLOG_SITE_URL) return process.env.BLOG_SITE_URL.replace(/\/+$/, '');
  const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
  return `${proto}://${request.headers.host ?? ''}`;
}

function mediaOrigin(request: FastifyRequest): string {
  if (process.env.BLOG_PUBLIC_BASE_URL) return process.env.BLOG_PUBLIC_BASE_URL.replace(/\/+$/, '');
  const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
  return `${proto}://${request.headers.host ?? ''}`;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ''; }
}

function sendHtml(reply: FastifyReply, html: string, code = 200): void {
  reply
    .code(code)
    .header('content-type', 'text/html; charset=utf-8')
    .header('cache-control', code === 200 ? 'public, max-age=300, s-maxage=600' : 'no-store')
    .send(html);
}

export default async function blogPrerenderRoutes(fastify: FastifyInstance, _opts?: Record<string, unknown>): Promise<void> {
  fastify.get('/blog', async (request: FastifyRequest, reply: FastifyReply) => {
    const site = siteOrigin(request);
    const ua = request.headers['user-agent'];
    if (!isCrawler(ua)) {
      if (process.env.BLOG_SITE_URL && hostOf(site) !== request.headers.host) {
        return reply.redirect(`${site}/blog`, 302);
      }
      // fall through: serve static HTML as a no-JS / same-host fallback
    }
    try {
      const posts = await listPublicPosts({ limit: 50 });
      sendHtml(reply, renderListDocument({ posts, siteOrigin: site }));
    } catch (err) {
      Logger.log('error', 'general', 'GET /blog', 'Failed to render blog list', { error: (err as Error).message });
      sendHtml(reply, renderNotFoundDocument(site), 500);
    }
  });

  fastify.get('/blog/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const site = siteOrigin(request);
    const slug = (request.params as { slug: string }).slug;
    const ua = request.headers['user-agent'];
    if (!isCrawler(ua)) {
      if (process.env.BLOG_SITE_URL && hostOf(site) !== request.headers.host) {
        return reply.redirect(`${site}/blog/${encodeURIComponent(slug)}`, 302);
      }
      // fall through: serve static HTML as a no-JS / same-host fallback
    }
    try {
      const post = await getPublicPostBySlug(slug);
      if (!post) {
        // Old slug → permanent redirect to the current canonical (SEO-safe).
        const movedTo = await getSlugRedirectTarget(slug);
        if (movedTo) { reply.redirect(`${site}/blog/${encodeURIComponent(movedTo)}`, 301); return; }
        sendHtml(reply, renderNotFoundDocument(site), 404); return;
      }
      const [backlinks, series] = await Promise.all([getBacklinks(post.postId), getSeriesForPost(post)]);
      sendHtml(reply, renderPostDocument({ post, siteOrigin: site, mediaOrigin: mediaOrigin(request), backlinks, series }));
    } catch (err) {
      Logger.log('error', 'general', 'GET /blog/:slug', 'Failed to render post', { error: (err as Error).message });
      sendHtml(reply, renderNotFoundDocument(site), 500);
    }
  });

  // Series landing page (crawler HTML / no-JS fallback). 3-segment path, so it
  // never collides with /blog/:slug. PUBLIC_ROUTES already covers the /blog prefix.
  fastify.get('/blog/series/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const site = siteOrigin(request);
    const slug = (request.params as { slug: string }).slug;
    const ua = request.headers['user-agent'];
    if (!isCrawler(ua)) {
      if (process.env.BLOG_SITE_URL && hostOf(site) !== request.headers.host) {
        return reply.redirect(`${site}/blog/series/${encodeURIComponent(slug)}`, 302);
      }
    }
    try {
      const found = await getPublicSeriesBySlug(slug);
      if (!found) { sendHtml(reply, renderNotFoundDocument(site), 404); return; }
      sendHtml(reply, renderSeriesDocument({ series: found.series, posts: found.posts, siteOrigin: site }));
    } catch (err) {
      Logger.log('error', 'general', 'GET /blog/series/:slug', 'Failed to render series', { error: (err as Error).message });
      sendHtml(reply, renderNotFoundDocument(site), 500);
    }
  });
}
