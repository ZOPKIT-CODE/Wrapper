import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenantUsers } from '../core/users.js';
import { blogSeries } from './blog-series.js';

/**
 * Blog post statuses. Keep this in sync with:
 *   - the CHECK constraint in the migration (0004_add_blog_posts_table.sql)
 *   - the Zod enum in features/blog/schemas.ts
 * (Status CHECK ⇄ Zod ⇄ TS drift previously bit the baseline — the drift gate
 * and an integration test guard it.)
 */
export const BLOG_POST_STATUSES = ['draft', 'published', 'archived'] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

/**
 * Blog posts (single-platform blog).
 *
 * The system of record for content is `body` — Tiptap/ProseMirror JSON. On
 * publish the backend renders it to sanitized HTML and caches it in `body_html`
 * so the public reader serves crawlable HTML without re-rendering per request.
 *
 * Fully public single-platform blog: there is no auth/tenant context, so
 * `tenant_id` and `author_id` are nullable. Posts are resolved by `slug`
 * (globally unique among live rows).
 */
export const blogPosts = pgTable('blog_posts', {
  postId: uuid('post_id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').references(() => tenantUsers.userId),

  // Core content
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  subtitle: text('subtitle'),
  excerpt: text('excerpt'),
  body: jsonb('body').notNull(), // Tiptap/ProseMirror JSON (source of truth)
  bodyHtml: text('body_html'),   // sanitized derived HTML cache (rendered on publish)
  schemaVersion: integer('schema_version').default(1).notNull(),

  // Media (S3 keys — public URL is built at render time)
  coverImageKey: varchar('cover_image_key', { length: 500 }),
  coverImageAlt: text('cover_image_alt'),

  // Taxonomy (v1: simple string array; tag tables deferred to v2)
  tags: jsonb('tags').default(sql`'[]'::jsonb`).notNull(),

  // Series / collection membership (a post belongs to at most one series).
  seriesId: uuid('series_id').references(() => blogSeries.seriesId),
  seriesPosition: integer('series_position'),

  // Lifecycle
  status: varchar('status', { length: 20 }).notNull().default('draft'),

  // SEO
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  ogImageKey: varchar('og_image_key', { length: 500 }),
  seoNoindex: boolean('seo_noindex').default(false).notNull(),

  // Derived stats (computed on save)
  readingTimeMinutes: integer('reading_time_minutes'),
  wordCount: integer('word_count'),

  // Timestamps
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),

  // Audit
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  statusIdx: index('idx_blog_posts_status').on(table.status),
  // Feed query: published posts ordered by publish date.
  feedIdx: index('idx_blog_posts_feed').on(table.status, table.publishedAt),
  // Public namespace: a live slug resolves to exactly one post.
  pubSlugIdx: uniqueIndex('uq_blog_posts_pub_slug')
    .on(table.slug)
    .where(sql`deleted_at IS NULL`),
}));

export type NewBlogPost = typeof blogPosts.$inferInsert;
export type BlogPost = typeof blogPosts.$inferSelect;
