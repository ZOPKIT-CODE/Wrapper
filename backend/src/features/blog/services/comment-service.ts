import { and, desc, asc, eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { blogComments, type BlogComment } from '../../../db/schema/blog/blog-comments.js';
import { blogPosts } from '../../../db/schema/blog/blog-posts.js';

export interface PublicComment {
  commentId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

export async function submitComment(input: {
  postId: string; authorName: string; authorEmail?: string | null; body: string; ip?: string | null;
}): Promise<{ ok: boolean }> {
  // Only allow comments on a real, published, live post.
  const [post] = await db
    .select({ id: blogPosts.postId, status: blogPosts.status })
    .from(blogPosts)
    .where(eq(blogPosts.postId, input.postId))
    .limit(1);
  if (!post || post.status !== 'published') return { ok: false };

  await db.insert(blogComments).values({
    postId: input.postId,
    authorName: input.authorName.trim().slice(0, 120),
    authorEmail: input.authorEmail?.trim().slice(0, 255) ?? null,
    body: input.body.trim().slice(0, 5000),
    status: 'pending',
    createdIp: input.ip?.slice(0, 64) ?? null,
  });
  return { ok: true };
}

/** Approved comments for a post, oldest first (the public thread). */
export async function listApprovedComments(postId: string): Promise<PublicComment[]> {
  const rows = await db
    .select({ commentId: blogComments.commentId, authorName: blogComments.authorName, body: blogComments.body, createdAt: blogComments.createdAt })
    .from(blogComments)
    .where(and(eq(blogComments.postId, postId), eq(blogComments.status, 'approved')))
    .orderBy(asc(blogComments.createdAt));
  return rows;
}

export interface PendingComment extends BlogComment { postTitle: string | null; postSlug: string | null }

/** Moderation queue (admin) — pending comments newest first, with post context. */
export async function listCommentsForModeration(status = 'pending'): Promise<PendingComment[]> {
  const rows = await db
    .select({
      c: blogComments,
      postTitle: blogPosts.title,
      postSlug: blogPosts.slug,
    })
    .from(blogComments)
    .leftJoin(blogPosts, eq(blogPosts.postId, blogComments.postId))
    .where(eq(blogComments.status, status))
    .orderBy(desc(blogComments.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r.c, postTitle: r.postTitle ?? null, postSlug: r.postSlug ?? null }));
}

export async function moderateComment(
  commentId: string,
  status: 'approved' | 'rejected' | 'spam',
  moderatorId: string | null,
): Promise<boolean> {
  const [row] = await db
    .update(blogComments)
    .set({ status, moderatedBy: moderatorId, moderatedAt: new Date(), updatedAt: new Date() })
    .where(eq(blogComments.commentId, commentId))
    .returning({ id: blogComments.commentId });
  return !!row;
}

export async function pendingCommentCount(): Promise<number> {
  const rows = await db.select({ id: blogComments.commentId }).from(blogComments).where(eq(blogComments.status, 'pending'));
  return rows.length;
}
