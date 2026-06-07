import { describe, it, expect } from 'vitest';
import { isCrawler } from '../crawler.js';
import { renderPostDocument, renderListDocument, renderNotFoundDocument } from './blog-prerender.js';
import type { BlogPost } from '../../../db/schema/blog/blog-posts.js';

const post = {
  postId: 'p1',
  authorId: null,
  title: 'Hello World',
  slug: 'hello-world',
  subtitle: 'A subtitle',
  excerpt: 'An excerpt for meta.',
  body: { type: 'doc', content: [] },
  bodyHtml: '<p>Body content here</p>',
  schemaVersion: 1,
  coverImageKey: 'blog/cover/2026-06-06/x.png',
  coverImageAlt: 'cover',
  tags: ['eng', 'product'],
  status: 'published',
  metaTitle: null,
  metaDescription: null,
  ogImageKey: null,
  seoNoindex: false,
  readingTimeMinutes: 3,
  wordCount: 600,
  publishedAt: new Date('2026-06-01T00:00:00Z'),
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-02T00:00:00Z'),
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
} as unknown as BlogPost;

describe('crawler detection', () => {
  it('matches search/social/AI bots', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'facebookexternalhit/1.1',
      'Twitterbot/1.0',
      'Slackbot-LinkExpanding 1.0',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0)',
      'GPTBot/1.1',
    ]) expect(isCrawler(ua)).toBe(true);
  });

  it('does not match real browsers or empty UA', () => {
    expect(isCrawler('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36')).toBe(false);
    expect(isCrawler(undefined)).toBe(false);
    expect(isCrawler('')).toBe(false);
  });
});

describe('blog-prerender documents', () => {
  it('renders a full SEO HTML document for a post', () => {
    const html = renderPostDocument({ post, siteOrigin: 'https://site.test', mediaOrigin: 'https://api.test' });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Hello World</title>');
    expect(html).toContain('<link rel="canonical" href="https://site.test/blog/hello-world">');
    expect(html).toContain('property="og:title" content="Hello World"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('https://api.test/api/blog/media/blog/cover/2026-06-06/x.png'); // og:image
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('<p>Body content here</p>'); // the sanitized body
    expect(html).toContain('article:tag" content="eng"');
  });

  it('honors seoNoindex', () => {
    const html = renderPostDocument({ post: { ...post, seoNoindex: true } as BlogPost, siteOrigin: 'https://site.test', mediaOrigin: 'https://api.test' });
    expect(html).toContain('name="robots" content="noindex,nofollow"');
  });

  it('renders the list + not-found documents', () => {
    expect(renderListDocument({ posts: [post], siteOrigin: 'https://site.test' })).toContain('href="https://site.test/blog/hello-world"');
    expect(renderListDocument({ posts: [], siteOrigin: 'https://site.test' })).toContain('No posts published yet');
    expect(renderNotFoundDocument('https://site.test')).toContain('noindex');
  });
});
