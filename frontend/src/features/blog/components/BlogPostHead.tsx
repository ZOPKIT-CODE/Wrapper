import { mediaUrl } from '../api/blog';
import type { BlogPost, SeriesNav } from '../types/blog';

/**
 * SEO head tags + JSON-LD for a public post, using React 19 native document
 * metadata (React hoists <title>/<meta>/<link> into <head> and de-dupes them) —
 * no react-helmet needed. JSON-LD is rendered inline (Google reads it anywhere
 * in the DOM).
 *
 * NOTE: this is client-rendered, so it reaches Googlebot + humans but NOT
 * social/AI scrapers that don't run JS (see SEO plan B4 — a server-rendered
 * crawler-HTML path is the deferred follow-up for full coverage).
 */
export function BlogPostHead({ post, series = null }: { post: BlogPost; series?: SeriesNav | null }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/blog/${post.slug}`;
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || post.subtitle || '';
  const imageKey = post.ogImageKey || post.coverImageKey;
  const image = imageKey ? mediaUrl(imageKey) : '';
  const published = post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined;
  const modified = post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined;
  const tags = Array.isArray(post.tags) ? post.tags : [];

  const seriesUrl = series ? `${origin}/blog/series/${series.series.slug}` : '';
  const partNo = series ? series.items.findIndex((i) => i.current) + 1 : 0;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: 'en',
  };
  if (description) jsonLd.description = description;
  if (image) jsonLd.image = [image];
  if (published) jsonLd.datePublished = published;
  if (modified) jsonLd.dateModified = modified;
  if (post.wordCount) jsonLd.wordCount = post.wordCount;
  if (tags.length) jsonLd.keywords = tags.join(', ');
  if (series) {
    jsonLd.isPartOf = { '@type': 'CreativeWorkSeries', name: series.series.title, url: seriesUrl };
    if (partNo) jsonLd.position = partNo;
  }

  // Breadcrumb: Blog › [Series] › Post
  const crumbs: { name: string; item: string }[] = [{ name: 'Blog', item: `${origin}/blog` }];
  if (series) crumbs.push({ name: series.series.title, item: seriesUrl });
  crumbs.push({ name: post.title, item: url });
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  };

  return (
    <>
      <title>{`${title} — Blog`}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={post.seoNoindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'} />

      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}
      {published && <meta property="article:published_time" content={published} />}
      {modified && <meta property="article:modified_time" content={modified} />}
      {tags.map((t) => <meta key={t} property="article:tag" content={t} />)}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
  );
}
