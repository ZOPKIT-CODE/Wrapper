import { buildMediaUrl } from './blog-render.js';
import type { BlogPost } from '../../../db/schema/blog/blog-posts.js';
import type { BacklinkRef } from './blog-service.js';
import type { SeriesNav } from './series-service.js';

/**
 * Server-rendered, SEO-complete HTML documents for crawlers (and as a no-JS
 * fallback for humans). Reuses the already-sanitized, cached `body_html` — never
 * raw author HTML. The same fields feed sitemap/RSS so dates/URLs stay
 * consistent. `siteOrigin` = public marketing site (where /blog/:slug lives);
 * `mediaOrigin` = backend that serves /api/blog/media/*.
 */

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(d: Date | string | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

const BASE_CSS = `
:root{color-scheme:light}*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;line-height:1.75}
a{color:#1a8917;text-decoration:none}a:hover{text-decoration:underline}
.site-header{border-bottom:1px solid #eee;padding:18px 24px}.site-header a{font-weight:700;font-size:20px;color:#111}
.wrap{max-width:720px;margin:0 auto;padding:0 24px}
.post{padding:48px 0 96px}
.post h1{font-size:2.4rem;line-height:1.15;letter-spacing:-.02em;margin:.2em 0 .1em}
.post .subtitle{font-size:1.3rem;color:#6b6b6b;margin:.2em 0 1.2em;font-weight:400}
.byline{display:flex;gap:10px;align-items:center;color:#6b6b6b;font-size:.95rem;margin-bottom:32px;border-bottom:1px solid #f0f0f0;padding-bottom:24px}
.cover{width:100%;height:auto;border-radius:8px;margin:8px 0 32px}
.prose{font-size:1.18rem}.prose p{margin:0 0 1.4em}
.prose h2{font-size:1.7rem;margin:1.8em 0 .4em;letter-spacing:-.01em}.prose h3{font-size:1.35rem;margin:1.6em 0 .4em}
.prose img{max-width:100%;height:auto;border-radius:6px;margin:1.2em 0}
.prose blockquote{border-left:3px solid #1a1a1a;margin:1.4em 0;padding:.2em 0 .2em 1.2em;color:#444;font-style:italic}
.prose pre{background:#f6f8fa;border-radius:8px;padding:16px;overflow:auto;font-size:.95rem}
.prose code{background:#f0f0f0;border-radius:4px;padding:.1em .35em;font-size:.92em}.prose pre code{background:none;padding:0}
.prose ul,.prose ol{margin:0 0 1.4em;padding-left:1.4em}.prose li{margin:.4em 0}
.prose hr{border:none;margin:2.4em 0;text-align:center}.prose hr::after{content:"• • •";display:block;color:#9aa0a6;letter-spacing:.5em}
.prose table{width:100%;border-collapse:collapse;table-layout:fixed;margin:1.6em 0;font-size:1rem;line-height:1.5}
.prose th,.prose td{border:1px solid #e2e4e8;padding:.5em .75em;text-align:left;vertical-align:top}
.prose th{background:#f6f8fa;font-weight:600}.prose th>*,.prose td>*{margin:0}
.prose .callout{margin:1.6em 0;padding:.85em 1.1em;border-left:4px solid #94a3b8;border-radius:8px;background:#f1f5f9}
.prose .callout>*{margin:0}.prose .callout>*+*{margin-top:.5em}
.prose .callout-info{background:#eff6ff;border-color:#3b82f6}.prose .callout-success{background:#ecfdf3;border-color:#16a34a}
.prose .callout-warning{background:#fffbeb;border-color:#f59e0b}.prose .callout-danger{background:#fef2f2;border-color:#ef4444}
.prose a.blog-card{display:flex;align-items:stretch;overflow:hidden;border:1px solid #e5e7eb;border-radius:12px;margin:1.6em 0;text-decoration:none;color:inherit;background:#fff}
.prose .blog-card-body{display:flex;flex-direction:column;justify-content:center;gap:.35em;flex:1;min-width:0;padding:1rem 1.1rem}
.prose .blog-card-title{font-weight:700;font-size:1.05rem;line-height:1.3;color:#1a1a1a}.prose .blog-card-desc{font-size:.92rem;color:#6b7280}
.prose .blog-card-site{font-size:.78rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em}
.prose img.blog-card-image{width:38%;max-width:220px;object-fit:cover;border-radius:0;margin:0;flex-shrink:0;background:#f3f4f6}
.feed{padding:48px 0 96px}.feed h1{font-size:2rem;margin:0 0 32px}
.card{display:block;padding:24px 0;border-bottom:1px solid #f0f0f0}.card h2{font-size:1.4rem;margin:0 0 .25em;color:#111}
.card .excerpt{color:#555;margin:.2em 0 .6em}.card .meta{color:#9b9b9b;font-size:.9rem}.empty{color:#888;padding:48px 0}
.series-note{display:inline-block;background:#ecfdf3;color:#15803d;border-radius:999px;padding:4px 12px;font-size:.85rem;font-weight:600;margin-bottom:14px}
.refs{margin:48px 0 0;border-top:1px solid #f0f0f0;padding-top:24px}.refs h2{font-size:1.1rem;margin:0 0 12px}
.refs a{display:block;padding:10px 0;color:#111;font-weight:600}.refs .excerpt{display:block;color:#666;font-weight:400;font-size:.95rem;margin-top:2px}
.series-list ol{margin:24px 0 0;padding-left:1.3em}.series-list li{margin:.5em 0}.series-list .meta{color:#9b9b9b;font-size:.9rem}
`;

function layout({ title, head, body, siteOrigin }: { title: string; head: string; body: string; siteOrigin: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${head}
<style>${BASE_CSS}</style>
</head>
<body>
<header class="site-header"><div class="wrap"><a href="${esc(siteOrigin)}/blog">Blog</a></div></header>
${body}
</body>
</html>`;
}

function ldScript(obj: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

/** Full SEO HTML document for a single published post. */
export function renderPostDocument({ post, siteOrigin, mediaOrigin, backlinks = [], series = null }: {
  post: BlogPost; siteOrigin: string; mediaOrigin: string; backlinks?: BacklinkRef[]; series?: SeriesNav | null;
}): string {
  const url = `${siteOrigin}/blog/${esc(post.slug)}`;
  const metaTitle = post.metaTitle || post.title;
  const metaDesc = post.metaDescription || post.excerpt || post.subtitle || '';
  const coverUrl = buildMediaUrl(post.ogImageKey || post.coverImageKey, mediaOrigin);
  const published = post.publishedAt ? new Date(post.publishedAt).toISOString() : '';
  const modified = post.updatedAt ? new Date(post.updatedAt).toISOString() : '';
  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  // Series relationship (position is 1-based over the series' published posts).
  const seriesUrl = series ? `${siteOrigin}/blog/series/${esc(series.series.slug)}` : '';
  const partIdx = series ? series.items.findIndex((i) => i.current) : -1;
  const partNo = partIdx >= 0 ? partIdx + 1 : 0;
  const totalParts = series ? series.items.length : 0;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: 'en',
  };
  if (metaDesc) jsonLd.description = metaDesc;
  if (coverUrl) jsonLd.image = [coverUrl];
  if (published) jsonLd.datePublished = published;
  if (modified) jsonLd.dateModified = modified;
  if (post.wordCount) jsonLd.wordCount = post.wordCount;
  if (tags.length) jsonLd.keywords = tags.join(', ');
  if (series) {
    jsonLd.isPartOf = {
      '@type': 'CreativeWorkSeries',
      name: series.series.title,
      url: `${siteOrigin}/blog/series/${series.series.slug}`,
    };
    if (partNo) jsonLd.position = partNo;
  }

  // Breadcrumb: Blog › [Series] › Post
  const crumbs: { name: string; item: string }[] = [{ name: 'Blog', item: `${siteOrigin}/blog` }];
  if (series) crumbs.push({ name: series.series.title, item: `${siteOrigin}/blog/series/${series.series.slug}` });
  crumbs.push({ name: post.title, item: url });
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  };

  const head = [
    metaDesc ? `<meta name="description" content="${esc(metaDesc)}">` : '',
    `<meta name="robots" content="${post.seoNoindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(metaTitle)}">`,
    metaDesc ? `<meta property="og:description" content="${esc(metaDesc)}">` : '',
    `<meta property="og:url" content="${esc(url)}">`,
    coverUrl ? `<meta property="og:image" content="${esc(coverUrl)}">` : '',
    published ? `<meta property="article:published_time" content="${esc(published)}">` : '',
    modified ? `<meta property="article:modified_time" content="${esc(modified)}">` : '',
    ...tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`),
    `<meta name="twitter:card" content="${coverUrl ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(metaTitle)}">`,
    metaDesc ? `<meta name="twitter:description" content="${esc(metaDesc)}">` : '',
    coverUrl ? `<meta name="twitter:image" content="${esc(coverUrl)}">` : '',
    ldScript(jsonLd),
    ldScript(breadcrumbLd),
  ].filter(Boolean).join('\n');

  const byline = [formatDate(post.publishedAt), post.readingTimeMinutes ? `${post.readingTimeMinutes} min read` : '']
    .filter(Boolean).join(' · ');

  const seriesNote = series && partNo
    ? `<a class="series-note" href="${esc(seriesUrl)}">${esc(series.series.title)} · Part ${partNo} of ${totalParts}</a>`
    : '';

  const refsSection = backlinks.length
    ? `<section class="refs"><h2>Referenced by</h2>${backlinks.map((b) => `<a href="${esc(siteOrigin)}/blog/${esc(b.slug)}">${esc(b.title)}${b.excerpt ? `<span class="excerpt">${esc(b.excerpt)}</span>` : ''}</a>`).join('\n')}</section>`
    : '';

  const body = `<main class="wrap post">
<article>
${seriesNote}
<h1>${esc(post.title)}</h1>
${post.subtitle ? `<p class="subtitle">${esc(post.subtitle)}</p>` : ''}
${byline ? `<div class="byline">${esc(byline)}</div>` : ''}
${coverUrl ? `<img class="cover" src="${esc(coverUrl)}" alt="${esc(post.coverImageAlt || post.title)}">` : ''}
<div class="prose">${post.bodyHtml || ''}</div>
${refsSection}
</article>
</main>`;

  return layout({ title: metaTitle, head, body, siteOrigin });
}

/** Full SEO HTML document for a series landing page (/blog/series/:slug). */
export function renderSeriesDocument({ series, posts, siteOrigin }: {
  series: { title: string; slug: string; description: string | null };
  posts: BlogPost[]; siteOrigin: string;
}): string {
  const url = `${siteOrigin}/blog/series/${esc(series.slug)}`;
  const desc = series.description || `A ${posts.length}-part series.`;
  const totalMinutes = posts.reduce((sum, p) => sum + (p.readingTimeMinutes ?? 0), 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWorkSeries',
    name: series.title,
    url,
    ...(series.description ? { description: series.description } : {}),
    hasPart: posts.map((p, i) => ({
      '@type': 'BlogPosting',
      position: i + 1,
      headline: p.title,
      url: `${siteOrigin}/blog/${p.slug}`,
    })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `${siteOrigin}/blog` },
      { '@type': 'ListItem', position: 2, name: series.title, item: url },
    ],
  };

  const head = [
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(series.title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    ldScript(jsonLd),
    ldScript(breadcrumbLd),
  ].join('\n');

  const meta = [`${posts.length} part${posts.length === 1 ? '' : 's'}`, totalMinutes ? `~${totalMinutes} min total` : '']
    .filter(Boolean).join(' · ');

  const list = posts.length
    ? `<ol>${posts.map((p) => `<li><a href="${esc(siteOrigin)}/blog/${esc(p.slug)}">${esc(p.title)}</a>${p.readingTimeMinutes ? `<div class="meta">${p.readingTimeMinutes} min read</div>` : ''}</li>`).join('\n')}</ol>`
    : '<p class="empty">No posts in this series yet.</p>';

  const body = `<main class="wrap feed series-list">
<h1>${esc(series.title)}</h1>
${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
${series.description ? `<p class="excerpt">${esc(series.description)}</p>` : ''}
${list}
</main>`;

  return layout({ title: `${series.title} — Series`, head, body, siteOrigin });
}

/** Full HTML document for the post feed. */
export function renderListDocument({ posts, siteOrigin }: { posts: BlogPost[]; siteOrigin: string }): string {
  const items = posts.map((p) => {
    const meta = [formatDate(p.publishedAt), p.readingTimeMinutes ? `${p.readingTimeMinutes} min read` : '']
      .filter(Boolean).join(' · ');
    const summary = p.excerpt || p.subtitle || '';
    return `<a class="card" href="${esc(siteOrigin)}/blog/${esc(p.slug)}">
<h2>${esc(p.title)}</h2>
${summary ? `<p class="excerpt">${esc(summary)}</p>` : ''}
<div class="meta">${esc(meta)}</div>
</a>`;
  }).join('\n');

  const head = `<meta name="description" content="Latest posts">
<link rel="canonical" href="${esc(siteOrigin)}/blog">`;

  const body = `<main class="wrap feed">
<h1>Latest posts</h1>
${posts.length ? items : '<p class="empty">No posts published yet.</p>'}
</main>`;

  return layout({ title: 'Blog', head, body, siteOrigin });
}

export function renderNotFoundDocument(siteOrigin: string): string {
  const body = `<main class="wrap feed"><h1>Not found</h1><p class="empty">This post doesn’t exist or hasn’t been published. <a href="${esc(siteOrigin)}/blog">Back to the blog</a>.</p></main>`;
  return layout({ title: 'Not found', head: '<meta name="robots" content="noindex">', body, siteOrigin });
}
