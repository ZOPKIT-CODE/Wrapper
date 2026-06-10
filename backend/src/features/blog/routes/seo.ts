import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../../utils/logger.js';
import { listPublishedForSeo } from '../services/blog-service.js';
import { listPublicSeries } from '../services/series-service.js';
import type { BlogPost } from '../../../db/schema/blog/blog-posts.js';

/**
 * Public SEO artifacts served at the ROOT (crawlers expect /robots.txt and
 * /sitemap.xml at the origin root, not under /api). Registered with no prefix
 * and whitelisted in PUBLIC_ROUTES. Returns raw XML/text — no Zod response
 * schema, so the global JSON serializer is bypassed (same pattern as the
 * email-preview HTML route).
 *
 * The marketing-site origin (where /blog/:slug lives) is config, not
 * request-derived, so absolute URLs stay stable across hosts. In dev set
 * BLOG_SITE_URL=http://localhost:3001.
 */
function siteOrigin(request: FastifyRequest): string {
  if (process.env.BLOG_SITE_URL) return process.env.BLOG_SITE_URL.replace(/\/+$/, '');
  const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
  return `${proto}://${request.headers.host ?? ''}`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function postUrl(origin: string, p: BlogPost): string {
  return `${origin}/blog/${encodeURIComponent(p.slug)}`;
}

export default async function seoRoutes(fastify: FastifyInstance, _opts?: Record<string, unknown>): Promise<void> {
  fastify.get('/sitemap.xml', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const origin = siteOrigin(request);
      const posts = (await listPublishedForSeo()).filter((p) => !p.seoNoindex);
      const urls = posts.map((p) => {
        const lastmod = (p.updatedAt ? new Date(p.updatedAt) : new Date(p.publishedAt ?? Date.now())).toISOString();
        return `  <url>\n    <loc>${esc(postUrl(origin, p))}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      }).join('\n');
      // Series landing pages (only those with ≥1 published post).
      const series = await listPublicSeries();
      const seriesUrls = series.map((s) => {
        const lastmod = new Date(s.updatedAt).toISOString();
        return `  <url>\n    <loc>${esc(origin)}/blog/series/${encodeURIComponent(s.slug)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${esc(origin)}/blog</loc>\n  </url>\n${urls}${seriesUrls ? `\n${seriesUrls}` : ''}\n</urlset>\n`;
      return reply.type('application/xml').header('cache-control', 'public, max-age=600').send(xml);
    } catch (err) {
      Logger.log('error', 'general', 'GET /sitemap.xml', 'Failed to build sitemap', { error: (err as Error).message });
      return reply.code(500).type('application/xml').send('<?xml version="1.0"?><urlset/>');
    }
  });

  fastify.get('/rss.xml', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const origin = siteOrigin(request);
      const posts = (await listPublishedForSeo()).filter((p) => !p.seoNoindex);
      const items = posts.map((p) => {
        const link = postUrl(origin, p);
        const pubDate = new Date(p.publishedAt ?? p.createdAt).toUTCString();
        const desc = p.excerpt || p.subtitle || '';
        const content = p.bodyHtml ? `\n      <content:encoded><![CDATA[${p.bodyHtml}]]></content:encoded>` : '';
        return `    <item>\n      <title>${esc(p.title)}</title>\n      <link>${esc(link)}</link>\n      <guid isPermaLink="true">${esc(link)}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${esc(desc)}</description>${content}\n    </item>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n  <channel>\n    <title>Blog</title>\n    <link>${esc(origin)}/blog</link>\n    <description>Latest posts</description>\n${items}\n  </channel>\n</rss>\n`;
      return reply.type('application/rss+xml').header('cache-control', 'public, max-age=600').send(xml);
    } catch (err) {
      Logger.log('error', 'general', 'GET /rss.xml', 'Failed to build RSS', { error: (err as Error).message });
      return reply.code(500).type('application/rss+xml').send('<?xml version="1.0"?><rss/>');
    }
  });

  fastify.get('/robots.txt', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = siteOrigin(request);
    const body = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
    return reply.type('text/plain').header('cache-control', 'public, max-age=3600').send(body);
  });
}
