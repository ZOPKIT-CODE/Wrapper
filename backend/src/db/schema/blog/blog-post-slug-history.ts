import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { blogPosts } from './blog-posts.js';

/**
 * Remembers a post's previous slugs so old/bookmarked/inbound URLs 301-redirect
 * to the current slug after a rename. Consulted only when no LIVE post matches a
 * requested slug (a reused slug → the live post always wins; most-recent history
 * row wins otherwise).
 */
export const blogPostSlugHistory = pgTable('blog_post_slug_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => blogPosts.postId, { onDelete: 'cascade' }),
  oldSlug: varchar('old_slug', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  oldSlugIdx: index('idx_blog_post_slug_history_old_slug').on(table.oldSlug),
  postIdx: index('idx_blog_post_slug_history_post').on(table.postId),
}));

export type NewBlogPostSlugHistory = typeof blogPostSlugHistory.$inferInsert;
export type BlogPostSlugHistory = typeof blogPostSlugHistory.$inferSelect;
