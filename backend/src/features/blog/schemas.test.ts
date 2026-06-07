import { describe, it, expect } from 'vitest';
import { ZOD_BLOG_STATUSES, createPostSchema, signUploadSchema } from './schemas.js';
import { BLOG_POST_STATUSES } from '../../db/schema/blog/blog-posts.js';

describe('blog schemas', () => {
  it('Zod status vocabulary matches the DB CHECK / TS enum', () => {
    // Guards the status CHECK ⇄ Zod ⇄ TS drift class that bit the baseline before.
    expect(ZOD_BLOG_STATUSES).toEqual([...BLOG_POST_STATUSES]);
  });

  it('createPostSchema requires a non-empty title', () => {
    expect(createPostSchema.safeParse({}).success).toBe(false);
    expect(createPostSchema.safeParse({ title: '' }).success).toBe(false);
    expect(createPostSchema.safeParse({ title: 'Hello' }).success).toBe(true);
  });

  it('createPostSchema rejects a non-kebab slug', () => {
    expect(createPostSchema.safeParse({ title: 'x', slug: 'Not A Slug' }).success).toBe(false);
    expect(createPostSchema.safeParse({ title: 'x', slug: 'a-good-slug' }).success).toBe(true);
  });

  it('signUploadSchema rejects SVG, bad types and oversized files', () => {
    expect(signUploadSchema.safeParse({ kind: 'cover', contentType: 'image/svg+xml', ext: 'svg', byteSize: 100 }).success).toBe(false);
    expect(signUploadSchema.safeParse({ kind: 'cover', contentType: 'image/png', ext: 'png', byteSize: 100 }).success).toBe(true);
    expect(signUploadSchema.safeParse({ kind: 'cover', contentType: 'image/png', ext: 'png', byteSize: 99 * 1024 * 1024 }).success).toBe(false);
  });
});
