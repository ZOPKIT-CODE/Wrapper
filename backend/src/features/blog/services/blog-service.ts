import { and, desc, asc, eq, gt, lt, isNull, lte, ne, or, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { blogPosts, type BlogPost } from '../../../db/schema/blog/blog-posts.js';
import { blogPostLinks } from '../../../db/schema/blog/blog-post-links.js';
import { blogPostSlugHistory } from '../../../db/schema/blog/blog-post-slug-history.js';
import { tenantUsers } from '../../../db/schema/core/users.js';
import {
  renderBodyHtml,
  computeWordCount,
  computeReadingTimeMinutes,
  collectLinkPostIds,
  type RefResolver,
} from './blog-render.js';
import type { CreatePostInput, UpdatePostInput } from '../schemas.js';

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Article-to-article references ────────────────────────────────────────────

/** Resolve internal-reference postIds → current slug + whether publicly live. */
const resolveRefSlugs: RefResolver = async (ids) => {
  const map = new Map<string, { slug: string; live: boolean }>();
  const valid = ids.filter((id) => UUID_RE.test(id));
  if (!valid.length) return map;
  const rows = await db
    .select({ id: blogPosts.postId, slug: blogPosts.slug, status: blogPosts.status, deletedAt: blogPosts.deletedAt, publishedAt: blogPosts.publishedAt })
    .from(blogPosts)
    .where(inArray(blogPosts.postId, valid));
  const now = Date.now();
  for (const r of rows) {
    const live = r.status === 'published' && !r.deletedAt && r.publishedAt != null && r.publishedAt.getTime() <= now;
    map.set(r.id, { slug: r.slug, live });
  }
  return map;
};

/** Rebuild blog_post_links for a post from the (valid, existing) posts its body links to. */
async function reindexPostLinks(postId: string, body: unknown): Promise<void> {
  const targets = collectLinkPostIds(body).filter((id) => UUID_RE.test(id) && id !== postId);
  await db.transaction(async (tx) => {
    await tx.delete(blogPostLinks).where(eq(blogPostLinks.fromPostId, postId));
    if (!targets.length) return;
    // FK safety: only insert references to posts that actually exist.
    const existing = await tx.select({ id: blogPosts.postId }).from(blogPosts).where(inArray(blogPosts.postId, targets));
    const valid = existing.map((e) => e.id);
    if (valid.length) {
      await tx.insert(blogPostLinks)
        .values(valid.map((toPostId) => ({ fromPostId: postId, toPostId })))
        .onConflictDoNothing();
    }
  });
}

/**
 * Re-render the cached body_html of published posts that reference `toPostId` —
 * called when the target's slug or public status changes so in-body internal
 * links never go stale or dead. Bounded; the reverse index is indexed on to_post_id.
 */
async function rerenderInboundReferrers(toPostId: string, limit = 100): Promise<void> {
  const referrers = await db
    .select({ id: blogPosts.postId, body: blogPosts.body })
    .from(blogPostLinks)
    .innerJoin(blogPosts, eq(blogPostLinks.fromPostId, blogPosts.postId))
    .where(and(eq(blogPostLinks.toPostId, toPostId), eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt)))
    .limit(limit);
  for (const r of referrers) {
    const html = await renderBodyHtml(r.body, resolveRefSlugs);
    await db.update(blogPosts).set({ bodyHtml: html }).where(eq(blogPosts.postId, r.id));
  }
}

/** kebab-case slug, transliteration-light, trimmed to a sane length. */
export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .split('-')
    .slice(0, 12)
    .join('-');
  return base || 'post';
}

async function slugTaken(slug: string, excludePostId?: string): Promise<boolean> {
  const conds = [eq(blogPosts.slug, slug), isNull(blogPosts.deletedAt)];
  if (excludePostId) conds.push(ne(blogPosts.postId, excludePostId));
  const rows = await db
    .select({ id: blogPosts.postId })
    .from(blogPosts)
    .where(and(...conds))
    .limit(1);
  return rows.length > 0;
}

/** Ensure a globally-unique live slug, appending -2, -3 … on collision. */
async function generateUniqueSlug(source: string, excludePostId?: string): Promise<string> {
  const base = slugify(source);
  let candidate = base;
  let i = 2;
  while (await slugTaken(candidate, excludePostId)) {
    candidate = `${base}-${i++}`;
    if (i > 1000) throw new Error('Unable to generate a unique slug');
  }
  return candidate;
}

export async function createPost(input: CreatePostInput, authorId?: string | null): Promise<BlogPost> {
  const body = input.body ?? EMPTY_DOC;
  const wordCount = computeWordCount(body);
  const slug = await generateUniqueSlug(input.slug || input.title);

  const [row] = await db
    .insert(blogPosts)
    .values({
      authorId: authorId ?? null,
      createdBy: authorId ?? null,
      updatedBy: authorId ?? null,
      title: input.title,
      slug,
      subtitle: input.subtitle ?? null,
      excerpt: input.excerpt ?? null,
      body,
      tags: input.tags ?? [],
      coverImageKey: input.coverImageKey ?? null,
      coverImageAlt: input.coverImageAlt ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      ogImageKey: input.ogImageKey ?? null,
      seoNoindex: input.seoNoindex ?? false,
      status: 'draft',
      wordCount,
      readingTimeMinutes: computeReadingTimeMinutes(wordCount),
    })
    .returning();
  if (collectLinkPostIds(body).length) await reindexPostLinks(row.postId, body);
  return row;
}

async function loadLive(postId: string): Promise<BlogPost | null> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.postId, postId), isNull(blogPosts.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getPost(postId: string): Promise<BlogPost | null> {
  return loadLive(postId);
}

export async function listPosts(opts: { status?: string } = {}): Promise<BlogPost[]> {
  const conds = [isNull(blogPosts.deletedAt)];
  if (opts.status) conds.push(eq(blogPosts.status, opts.status));
  return db
    .select()
    .from(blogPosts)
    .where(and(...conds))
    .orderBy(desc(blogPosts.updatedAt));
}

export async function updatePost(postId: string, input: UpdatePostInput): Promise<BlogPost | null> {
  const existing = await loadLive(postId);
  if (!existing) return null;

  const patch: Partial<typeof blogPosts.$inferInsert> = { updatedAt: new Date() };

  if (input.title !== undefined) patch.title = input.title;
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle ?? null;
  if (input.excerpt !== undefined) patch.excerpt = input.excerpt ?? null;
  if (input.tags !== undefined) patch.tags = input.tags ?? [];
  if (input.coverImageKey !== undefined) patch.coverImageKey = input.coverImageKey ?? null;
  if (input.coverImageAlt !== undefined) patch.coverImageAlt = input.coverImageAlt ?? null;
  if (input.metaTitle !== undefined) patch.metaTitle = input.metaTitle ?? null;
  if (input.metaDescription !== undefined) patch.metaDescription = input.metaDescription ?? null;
  if (input.ogImageKey !== undefined) patch.ogImageKey = input.ogImageKey ?? null;
  if (input.seoNoindex !== undefined) patch.seoNoindex = input.seoNoindex;

  let slugChanged = false;
  if (input.slug !== undefined && input.slug && input.slug !== existing.slug) {
    patch.slug = await generateUniqueSlug(input.slug, postId);
    slugChanged = patch.slug !== existing.slug;
  }

  if (input.body !== undefined) {
    patch.body = input.body;
    const wc = computeWordCount(input.body);
    patch.wordCount = wc;
    patch.readingTimeMinutes = computeReadingTimeMinutes(wc);
    if (existing.status === 'published') {
      patch.bodyHtml = await renderBodyHtml(input.body, resolveRefSlugs);
    }
  }

  // Remember the old slug so old/inbound URLs 301-redirect after a rename.
  if (slugChanged) await db.insert(blogPostSlugHistory).values({ postId, oldSlug: existing.slug });

  const [row] = await db
    .update(blogPosts)
    .set(patch)
    .where(eq(blogPosts.postId, postId))
    .returning();
  if (!row) return null;

  // Rebuild this post's outbound reference index when its body changed.
  if (input.body !== undefined) await reindexPostLinks(postId, input.body);
  // A published post's slug change invalidates inbound referrers' cached links.
  if (slugChanged && existing.status === 'published') await rerenderInboundReferrers(postId);
  return row;
}

export type PublishAction = 'published' | 'draft' | 'archived';

export async function setPostStatus(postId: string, status: PublishAction): Promise<BlogPost | null> {
  const existing = await loadLive(postId);
  if (!existing) return null;

  const patch: Partial<typeof blogPosts.$inferInsert> = { status, updatedAt: new Date() };

  if (status === 'published') {
    patch.bodyHtml = await renderBodyHtml(existing.body, resolveRefSlugs);
    if (!existing.publishedAt) patch.publishedAt = new Date(); // set once, preserve on re-publish
  }

  const [row] = await db
    .update(blogPosts)
    .set(patch)
    .where(eq(blogPosts.postId, postId))
    .returning();
  if (!row) return null;

  // A status flip changes this post's public liveness, so inbound internal links
  // to it must appear/disappear in referrers' cached HTML.
  if (existing.status !== status) await rerenderInboundReferrers(postId);
  return row;
}

export async function softDeletePost(postId: string): Promise<boolean> {
  const [row] = await db
    .update(blogPosts)
    .set({ deletedAt: new Date() })
    .where(and(eq(blogPosts.postId, postId), isNull(blogPosts.deletedAt)))
    .returning({ id: blogPosts.postId });
  if (!row) return false;
  // Drop now-dead inbound links from referrers' cached HTML, then purge this
  // post's own outbound rows (soft-delete doesn't fire the FK cascade).
  await rerenderInboundReferrers(postId);
  await db.delete(blogPostLinks).where(eq(blogPostLinks.fromPostId, postId));
  return true;
}

// ── Public read (published + due only) ──────────────────────────────────────

export async function getPublicPostBySlug(slug: string): Promise<BlogPost | null> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(
      eq(blogPosts.slug, slug),
      eq(blogPosts.status, 'published'),
      isNull(blogPosts.deletedAt),
      lte(blogPosts.publishedAt, sql`now()`),
    ))
    .limit(1);
  return row ?? null;
}

export async function listPublicPosts(opts: { limit?: number; offset?: number; tag?: string } = {}): Promise<BlogPost[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const conds = [
    eq(blogPosts.status, 'published'),
    isNull(blogPosts.deletedAt),
    lte(blogPosts.publishedAt, sql`now()`),
  ];
  // tags is a jsonb string array; jsonb_exists(tags, 'foo') == (tags ? 'foo').
  if (opts.tag) conds.push(sql`jsonb_exists(${blogPosts.tags}, ${opts.tag})`);
  return db
    .select()
    .from(blogPosts)
    .where(and(...conds))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit)
    .offset(offset);
}

export interface PublicAuthor { name: string; initials: string }

/** Display name + initials for a post's author (null if anonymous/unknown). */
export async function getAuthor(authorId: string | null): Promise<PublicAuthor | null> {
  if (!authorId) return null;
  const [u] = await db
    .select({ firstName: tenantUsers.firstName, lastName: tenantUsers.lastName, email: tenantUsers.email })
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, authorId))
    .limit(1);
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || (u.email?.split('@')[0] ?? 'Author');
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return { name, initials };
}

export interface AdjacentRef { slug: string; title: string }

/** Older ("previous") and newer ("next") published posts around a given post. */
export async function getAdjacentPosts(post: BlogPost): Promise<{ prev: AdjacentRef | null; next: AdjacentRef | null }> {
  if (!post.publishedAt) return { prev: null, next: null };
  const base = [eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt)];
  const [older] = await db
    .select({ slug: blogPosts.slug, title: blogPosts.title })
    .from(blogPosts)
    .where(and(...base, lt(blogPosts.publishedAt, post.publishedAt)))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(1);
  const [newer] = await db
    .select({ slug: blogPosts.slug, title: blogPosts.title })
    .from(blogPosts)
    .where(and(...base, gt(blogPosts.publishedAt, post.publishedAt), lte(blogPosts.publishedAt, sql`now()`)))
    .orderBy(asc(blogPosts.publishedAt))
    .limit(1);
  return { prev: older ?? null, next: newer ?? null };
}

/** Up to `limit` published posts that share at least one tag with `post`. */
export async function getRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];
  if (!tags.length) return [];
  const candidates = await listPublicPosts({ limit: 50 });
  return candidates
    .filter((p) => p.postId !== post.postId && Array.isArray(p.tags) && (p.tags as string[]).some((t) => tags.includes(t)))
    .slice(0, limit);
}

export interface BacklinkRef { slug: string; title: string; excerpt: string | null }

/** Published posts that reference `postId` — drives the public "Referenced by" panel. */
export async function getBacklinks(postId: string, limit = 10): Promise<BacklinkRef[]> {
  return db
    .select({ slug: blogPosts.slug, title: blogPosts.title, excerpt: blogPosts.excerpt })
    .from(blogPostLinks)
    .innerJoin(blogPosts, eq(blogPostLinks.fromPostId, blogPosts.postId))
    .where(and(
      eq(blogPostLinks.toPostId, postId),
      eq(blogPosts.status, 'published'),
      isNull(blogPosts.deletedAt),
      lte(blogPosts.publishedAt, sql`now()`),
    ))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit);
}

export interface PostSearchHit { postId: string; title: string; slug: string; status: string }

/** Admin: posts that can be linked to from the editor (excludes the current post + soft-deleted). */
export async function searchLinkablePosts(q: string, excludePostId?: string, limit = 20): Promise<PostSearchHit[]> {
  const term = q.trim();
  const conds = [isNull(blogPosts.deletedAt)];
  if (excludePostId && UUID_RE.test(excludePostId)) conds.push(ne(blogPosts.postId, excludePostId));
  if (term) {
    const like = `%${term}%`;
    conds.push(or(ilike(blogPosts.title, like), ilike(blogPosts.slug, like))!);
  }
  return db
    .select({ postId: blogPosts.postId, title: blogPosts.title, slug: blogPosts.slug, status: blogPosts.status })
    .from(blogPosts)
    .where(and(...conds))
    .orderBy(desc(blogPosts.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

/** If `slug` is a historical slug, return the post's CURRENT live slug (else null). */
export async function getSlugRedirectTarget(slug: string): Promise<string | null> {
  const [hist] = await db
    .select({ postId: blogPostSlugHistory.postId })
    .from(blogPostSlugHistory)
    .where(eq(blogPostSlugHistory.oldSlug, slug))
    .orderBy(desc(blogPostSlugHistory.createdAt))
    .limit(1);
  if (!hist) return null;
  const [post] = await db
    .select({ slug: blogPosts.slug })
    .from(blogPosts)
    .where(and(
      eq(blogPosts.postId, hist.postId),
      eq(blogPosts.status, 'published'),
      isNull(blogPosts.deletedAt),
      lte(blogPosts.publishedAt, sql`now()`),
    ))
    .limit(1);
  return post ? post.slug : null;
}

/** Public full-text-ish search over title/excerpt/tags (published only). */
export async function searchPublicPosts(q: string, limit = 20): Promise<BlogPost[]> {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;
  return db
    .select()
    .from(blogPosts)
    .where(and(
      eq(blogPosts.status, 'published'),
      isNull(blogPosts.deletedAt),
      lte(blogPosts.publishedAt, sql`now()`),
      or(
        ilike(blogPosts.title, like),
        ilike(blogPosts.excerpt, like),
        ilike(blogPosts.subtitle, like),
        sql`exists (select 1 from jsonb_array_elements_text(${blogPosts.tags}) t where t ilike ${like})`,
      ),
    ))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

/** All published+due posts for SEO artifacts (sitemap/RSS). Uncapped feed limit. */
export async function listPublishedForSeo(): Promise<BlogPost[]> {
  return db
    .select()
    .from(blogPosts)
    .where(and(
      eq(blogPosts.status, 'published'),
      isNull(blogPosts.deletedAt),
      lte(blogPosts.publishedAt, sql`now()`),
    ))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(5000);
}
