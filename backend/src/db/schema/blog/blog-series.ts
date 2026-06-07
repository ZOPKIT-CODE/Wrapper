import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Blog series / collections — an ordered reading path. A post belongs to at most
 * one series (blog_posts.series_id + series_position). Public series pages render
 * the published posts in order; posts in a series get within-series navigation.
 */
export const blogSeries = pgTable('blog_series', {
  seriesId: uuid('series_id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  coverImageKey: varchar('cover_image_key', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  pubSlugIdx: uniqueIndex('uq_blog_series_pub_slug').on(table.slug).where(sql`deleted_at IS NULL`),
}));

export type NewBlogSeries = typeof blogSeries.$inferInsert;
export type BlogSeries = typeof blogSeries.$inferSelect;
