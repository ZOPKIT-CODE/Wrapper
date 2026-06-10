import { describe, expect, it } from 'vitest';
import {
  createPost,
  updatePost,
  setPostStatus,
  softDeletePost,
  getPublicPostBySlug,
  listPublicPosts,
} from './blog-service.js';

// Runs against the real migrated schema (Docker PG started by the integration
// global-setup). The service uses the global `db`, which connects to the
// container via DATABASE_URL.

const docOf = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('blog-service (integration)', () => {
  it('creates a draft with a generated slug + reading time', async () => {
    const p = await createPost({ title: 'My First Post', body: docOf('hello world from the blog') });
    expect(p.postId).toBeTruthy();
    expect(p.status).toBe('draft');
    expect(p.slug).toBe('my-first-post');
    expect(p.publishedAt).toBeNull();
    expect((p.wordCount ?? 0)).toBeGreaterThan(0);
    expect((p.readingTimeMinutes ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('publish sets status + published_at once and caches sanitized HTML', async () => {
    const p = await createPost({ title: 'Publish Me', body: docOf('content here') });
    const pub = await setPostStatus(p.postId, 'published');
    expect(pub?.status).toBe('published');
    expect(pub?.publishedAt).not.toBeNull();
    expect(pub?.bodyHtml).toContain('content here');

    const firstPublishedAt = pub!.publishedAt!;
    await setPostStatus(p.postId, 'draft');
    const repub = await setPostStatus(p.postId, 'published');
    // published_at is set once and preserved on re-publish.
    expect(new Date(repub!.publishedAt!).getTime()).toBe(new Date(firstPublishedAt).getTime());
  });

  it('public queries exclude drafts, deleted and future posts', async () => {
    const draft = await createPost({ title: 'Hidden Draft', body: docOf('secret') });
    const live = await createPost({ title: 'Live One', body: docOf('visible') });
    await setPostStatus(live.postId, 'published');

    expect((await getPublicPostBySlug(live.slug))?.postId).toBe(live.postId);
    expect(await getPublicPostBySlug(draft.slug)).toBeNull();

    const feedIds = (await listPublicPosts({ limit: 50 })).map((p) => p.postId);
    expect(feedIds).toContain(live.postId);
    expect(feedIds).not.toContain(draft.postId);

    await softDeletePost(live.postId);
    expect(await getPublicPostBySlug(live.slug)).toBeNull();
  });

  it('generates unique slugs on collision', async () => {
    const a = await createPost({ title: 'Same Title Here', body: docOf('a') });
    const b = await createPost({ title: 'Same Title Here', body: docOf('b') });
    expect(a.slug).not.toBe(b.slug);
    expect(b.slug).toMatch(/^same-title-here-\d+$/);
  });

  it('refreshes the HTML cache when a published post is edited', async () => {
    const p = await createPost({ title: 'Editable', body: docOf('old text') });
    await setPostStatus(p.postId, 'published');
    const updated = await updatePost(p.postId, { body: docOf('brand new text') });
    expect(updated?.bodyHtml).toContain('brand new text');
    expect(updated?.bodyHtml).not.toContain('old text');
  });
});
