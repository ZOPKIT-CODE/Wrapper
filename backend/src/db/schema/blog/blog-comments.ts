import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { blogPosts } from './blog-posts.js';

/**
 * Comment moderation states. Keep in sync with the CHECK in the migration
 * (0005_add_blog_comments.sql) and the Zod enum in features/blog/schemas.ts.
 */
export const BLOG_COMMENT_STATUSES = ['pending', 'approved', 'rejected', 'spam'] as const;
export type BlogCommentStatus = (typeof BLOG_COMMENT_STATUSES)[number];

/**
 * Public blog comments. Anyone may submit (status starts 'pending'); a comment
 * is only shown publicly once a company admin sets it to 'approved'. Body is
 * stored as plain text and escaped on render (no HTML — not the editor).
 */
export const blogComments = pgTable('blog_comments', {
  commentId: uuid('comment_id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => blogPosts.postId).notNull(),

  authorName: varchar('author_name', { length: 120 }).notNull(),
  authorEmail: varchar('author_email', { length: 255 }), // never shown publicly
  body: text('body').notNull(),

  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdIp: varchar('created_ip', { length: 64 }), // abuse/audit context

  moderatedBy: uuid('moderated_by'),
  moderatedAt: timestamp('moderated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  postStatusIdx: index('idx_blog_comments_post_status').on(table.postId, table.status),
  statusIdx: index('idx_blog_comments_status').on(table.status),
}));

export type NewBlogComment = typeof blogComments.$inferInsert;
export type BlogComment = typeof blogComments.$inferSelect;
