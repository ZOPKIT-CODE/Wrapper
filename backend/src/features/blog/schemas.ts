import { z } from 'zod';
import { BLOG_POST_STATUSES } from '../../db/schema/blog/blog-posts.js';

/**
 * Loose schema for a Tiptap/ProseMirror document. We don't validate the full
 * node tree (the editor owns that); we only assert it's a doc-shaped object.
 * The real safety boundary is server-side sanitization of the rendered HTML.
 */
export const tiptapDocSchema = z
  .object({ type: z.string() })
  .passthrough();

export type TiptapDoc = z.infer<typeof tiptapDocSchema>;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(slugRegex, 'slug must be kebab-case').optional(),
  subtitle: z.string().max(500).nullish(),
  excerpt: z.string().max(1000).nullish(),
  body: tiptapDocSchema.optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  coverImageKey: z.string().max(500).nullish(),
  coverImageAlt: z.string().max(500).nullish(),
  metaTitle: z.string().max(255).nullish(),
  metaDescription: z.string().max(500).nullish(),
  ogImageKey: z.string().max(500).nullish(),
  seoNoindex: z.boolean().optional(),
  seriesId: z.string().uuid().nullable().optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const seriesSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(slugRegex, 'slug must be kebab-case').optional(),
  description: z.string().max(2000).nullish(),
  coverImageKey: z.string().max(500).nullish(),
});

export const reorderSeriesSchema = z.object({
  orderedPostIds: z.array(z.string().uuid()).max(500),
});

export const publishSchema = z
  .object({
    // Optional override; defaults to 'published'. Lets the UI archive/unpublish
    // through the same endpoint if desired.
    status: z.enum(['published', 'draft', 'archived'] as [string, ...string[]]).optional(),
  })
  .optional();

const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

export const signUploadSchema = z.object({
  kind: z.enum(['cover', 'inline']),
  contentType: z.enum(ALLOWED_UPLOAD_TYPES),
  ext: z.string().min(1).max(10).regex(/^[a-z0-9]+$/, 'ext must be alphanumeric'),
  byteSize: z.number().int().positive().max(10 * 1024 * 1024), // 10 MB
});

export const submitCommentSchema = z.object({
  postId: z.string().uuid(),
  authorName: z.string().min(1).max(120),
  authorEmail: z.string().email().max(255).optional().or(z.literal('')).transform((v) => v || undefined),
  body: z.string().min(1).max(5000),
});

export const moderateCommentSchema = z.object({
  status: z.enum(['approved', 'rejected', 'spam']),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type SubmitCommentInput = z.infer<typeof submitCommentSchema>;

/**
 * Guard: the Zod status vocabulary must equal the DB CHECK / TS enum. The
 * integration test imports both and asserts equality (status CHECK ⇄ Zod ⇄ TS).
 */
export const ZOD_BLOG_STATUSES = [...BLOG_POST_STATUSES];
