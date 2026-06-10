import { and, asc, desc, eq, isNull, lte, ne, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { blogSeries, type BlogSeries } from '../../../db/schema/blog/blog-series.js';
import { blogPosts, type BlogPost } from '../../../db/schema/blog/blog-posts.js';
import { slugify } from './blog-service.js';

export interface SeriesInput {
  title: string;
  slug?: string;
  description?: string | null;
  coverImageKey?: string | null;
}

async function seriesSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const conds = [eq(blogSeries.slug, slug), isNull(blogSeries.deletedAt)];
  if (excludeId) conds.push(ne(blogSeries.seriesId, excludeId));
  const rows = await db.select({ id: blogSeries.seriesId }).from(blogSeries).where(and(...conds)).limit(1);
  return rows.length > 0;
}

async function uniqueSeriesSlug(source: string, excludeId?: string): Promise<string> {
  const base = slugify(source);
  let candidate = base; let i = 2;
  while (await seriesSlugTaken(candidate, excludeId)) { candidate = `${base}-${i++}`; if (i > 1000) break; }
  return candidate;
}

export async function createSeries(input: SeriesInput, userId?: string | null): Promise<BlogSeries> {
  const slug = await uniqueSeriesSlug(input.slug || input.title);
  const [row] = await db.insert(blogSeries).values({
    title: input.title,
    slug,
    description: input.description ?? null,
    coverImageKey: input.coverImageKey ?? null,
    createdBy: userId ?? null,
    updatedBy: userId ?? null,
  }).returning();
  return row;
}

export async function updateSeries(seriesId: string, input: Partial<SeriesInput>, userId?: string | null): Promise<BlogSeries | null> {
  const patch: Partial<typeof blogSeries.$inferInsert> = { updatedAt: new Date(), updatedBy: userId ?? null };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.coverImageKey !== undefined) patch.coverImageKey = input.coverImageKey ?? null;
  if (input.slug !== undefined && input.slug) patch.slug = await uniqueSeriesSlug(input.slug, seriesId);
  const [row] = await db.update(blogSeries).set(patch)
    .where(and(eq(blogSeries.seriesId, seriesId), isNull(blogSeries.deletedAt))).returning();
  return row ?? null;
}

export async function softDeleteSeries(seriesId: string): Promise<boolean> {
  // Detach posts so none reference a deleted series.
  await db.update(blogPosts).set({ seriesId: null, seriesPosition: null }).where(eq(blogPosts.seriesId, seriesId));
  const [row] = await db.update(blogSeries).set({ deletedAt: new Date() })
    .where(and(eq(blogSeries.seriesId, seriesId), isNull(blogSeries.deletedAt)))
    .returning({ id: blogSeries.seriesId });
  return !!row;
}

export interface SeriesWithCount extends BlogSeries { postCount: number }

export async function listSeries(): Promise<SeriesWithCount[]> {
  const series = await db.select().from(blogSeries).where(isNull(blogSeries.deletedAt)).orderBy(desc(blogSeries.updatedAt));
  const out: SeriesWithCount[] = [];
  for (const s of series) {
    const rows = await db.select({ id: blogPosts.postId }).from(blogPosts)
      .where(and(eq(blogPosts.seriesId, s.seriesId), isNull(blogPosts.deletedAt)));
    out.push({ ...s, postCount: rows.length });
  }
  return out;
}

export interface PublicSeriesSummary {
  seriesId: string; title: string; slug: string; description: string | null;
  coverImageKey: string | null; postCount: number; updatedAt: Date;
}

/** Public: series that have at least one published post (for the index + sitemap). */
export async function listPublicSeries(): Promise<PublicSeriesSummary[]> {
  const series = await db.select().from(blogSeries).where(isNull(blogSeries.deletedAt)).orderBy(desc(blogSeries.updatedAt));
  const out: PublicSeriesSummary[] = [];
  for (const s of series) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(and(
        eq(blogPosts.seriesId, s.seriesId),
        eq(blogPosts.status, 'published'),
        isNull(blogPosts.deletedAt),
        lte(blogPosts.publishedAt, sql`now()`),
      ));
    const count = row?.count ?? 0;
    if (count > 0) {
      out.push({ seriesId: s.seriesId, title: s.title, slug: s.slug, description: s.description, coverImageKey: s.coverImageKey, postCount: count, updatedAt: s.updatedAt });
    }
  }
  return out;
}

/** Admin: series + ALL its (non-deleted) posts ordered by position. */
export async function getSeriesWithPosts(seriesId: string): Promise<{ series: BlogSeries; posts: BlogPost[] } | null> {
  const [series] = await db.select().from(blogSeries)
    .where(and(eq(blogSeries.seriesId, seriesId), isNull(blogSeries.deletedAt))).limit(1);
  if (!series) return null;
  const posts = await db.select().from(blogPosts)
    .where(and(eq(blogPosts.seriesId, seriesId), isNull(blogPosts.deletedAt)))
    .orderBy(asc(blogPosts.seriesPosition));
  return { series, posts };
}

/** Public: series + its PUBLISHED posts in order. */
export async function getPublicSeriesBySlug(slug: string): Promise<{ series: BlogSeries; posts: BlogPost[] } | null> {
  const [series] = await db.select().from(blogSeries)
    .where(and(eq(blogSeries.slug, slug), isNull(blogSeries.deletedAt))).limit(1);
  if (!series) return null;
  const posts = await db.select().from(blogPosts)
    .where(and(eq(blogPosts.seriesId, series.seriesId), eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt), lte(blogPosts.publishedAt, sql`now()`)))
    .orderBy(asc(blogPosts.seriesPosition));
  return { series, posts };
}

export interface SeriesNav {
  series: { title: string; slug: string };
  items: { slug: string; title: string; current: boolean }[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

/** For the public post page: the series curriculum + within-series prev/next. */
export async function getSeriesForPost(post: BlogPost): Promise<SeriesNav | null> {
  if (!post.seriesId) return null;
  const found = await getPublicSeriesBySlug(
    (await db.select({ slug: blogSeries.slug }).from(blogSeries).where(eq(blogSeries.seriesId, post.seriesId)).limit(1))[0]?.slug ?? '',
  );
  if (!found || found.series.deletedAt) return null;
  const items = found.posts.map((p) => ({ slug: p.slug, title: p.title, current: p.postId === post.postId }));
  const idx = found.posts.findIndex((p) => p.postId === post.postId);
  const prev = idx > 0 ? { slug: found.posts[idx - 1].slug, title: found.posts[idx - 1].title } : null;
  const next = idx >= 0 && idx < found.posts.length - 1 ? { slug: found.posts[idx + 1].slug, title: found.posts[idx + 1].title } : null;
  return { series: { title: found.series.title, slug: found.series.slug }, items, prev, next };
}

/**
 * Append a post to a series (end position), or detach it when seriesId is null.
 * Idempotent: a no-op if the post is already in the target series — so it's safe
 * to call on every autosave without re-appending/renumbering.
 */
export async function setPostSeries(postId: string, seriesId: string | null): Promise<void> {
  const [cur] = await db.select({ seriesId: blogPosts.seriesId }).from(blogPosts).where(eq(blogPosts.postId, postId)).limit(1);
  if (!cur) return;
  const current = cur.seriesId ?? null;
  if (current === (seriesId ?? null)) return; // unchanged → keep position
  if (!seriesId) {
    await db.update(blogPosts).set({ seriesId: null, seriesPosition: null }).where(eq(blogPosts.postId, postId));
    return;
  }
  const [maxRow] = await db.select({ max: sql<number>`coalesce(max(${blogPosts.seriesPosition}), 0)` })
    .from(blogPosts).where(eq(blogPosts.seriesId, seriesId));
  await db.update(blogPosts).set({ seriesId, seriesPosition: (maxRow?.max ?? 0) + 1 }).where(eq(blogPosts.postId, postId));
}

/** Reorder a series' posts to match the given postId order. */
export async function reorderSeries(seriesId: string, orderedPostIds: string[]): Promise<void> {
  for (let i = 0; i < orderedPostIds.length; i++) {
    await db.update(blogPosts).set({ seriesPosition: i + 1 })
      .where(and(eq(blogPosts.postId, orderedPostIds[i]), eq(blogPosts.seriesId, seriesId)));
  }
}
