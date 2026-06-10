import { pgTable, uuid, timestamp, index, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { blogPosts } from './blog-posts.js';

/**
 * Reverse-link index for article-to-article references. One row per (from → to)
 * pair, derived by parsing a post's body on every save (internal links carry a
 * data-post-id). It is the source for the public "Referenced by" panel and the
 * re-render fan-out when a referenced post's slug/status changes. Never edited by
 * hand. Soft-deleting a post does NOT cascade (posts are never hard-deleted), so
 * the from-side rows are purged explicitly in softDeletePost and queries filter
 * dangling/unpublished targets.
 */
export const blogPostLinks = pgTable('blog_post_links', {
  fromPostId: uuid('from_post_id').notNull().references(() => blogPosts.postId, { onDelete: 'cascade' }),
  toPostId: uuid('to_post_id').notNull().references(() => blogPosts.postId, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.fromPostId, table.toPostId] }),
  toIdx: index('idx_blog_post_links_to').on(table.toPostId),
  noSelf: check('blog_post_links_no_self', sql`from_post_id <> to_post_id`),
}));

export type NewBlogPostLink = typeof blogPostLinks.$inferInsert;
export type BlogPostLink = typeof blogPostLinks.$inferSelect;
