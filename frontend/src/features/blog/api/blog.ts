import { api } from '@/lib/api/client';
import { API_URL, API_BASE_URL } from '@/lib/config';
import type {
  BlogPost, BlogPostInput, UploadedMedia, UploadKind, PostView, PublicComment, PendingComment, SubmitCommentInput,
  BlogSeries, SeriesWithCount, SeriesInput, PostSearchHit, PublicSeriesSummary,
} from '../types/blog';

interface Envelope<T> { success: boolean; data: T; error?: string }
interface PostViewEnvelope extends Envelope<BlogPost> {
  author: PostView['author']; prev: PostView['prev']; next: PostView['next'];
  related: BlogPost[]; series: PostView['series']; backlinks?: PostView['backlinks'];
  movedTo?: string;
}

/** Thrown by publicGetBySlug when a slug has moved (old slug → new). */
export class PostMovedError extends Error {
  constructor(public movedTo: string) { super('moved'); this.name = 'PostMovedError'; }
}

export const blogApi = {
  list: (status?: string) =>
    api.get<Envelope<BlogPost[]>>('/blog', { params: status ? { status } : undefined })
      .then((r) => r.data.data),

  get: (postId: string) =>
    api.get<Envelope<BlogPost>>(`/blog/${postId}`).then((r) => r.data.data),

  create: (input: BlogPostInput) =>
    api.post<Envelope<BlogPost>>('/blog', input).then((r) => r.data.data),

  update: (postId: string, input: Partial<BlogPostInput>) =>
    api.patch<Envelope<BlogPost>>(`/blog/${postId}`, input).then((r) => r.data.data),

  publish: (postId: string, status?: 'published' | 'draft' | 'archived') =>
    api.post<Envelope<BlogPost>>(`/blog/${postId}/publish`, status ? { status } : {})
      .then((r) => r.data.data),

  unpublish: (postId: string) =>
    api.post<Envelope<BlogPost>>(`/blog/${postId}/unpublish`, {}).then((r) => r.data.data),

  remove: (postId: string) =>
    api.delete<Envelope<null>>(`/blog/${postId}`).then((r) => r.data),

  // Public read (published only) — used by the public marketing-site pages.
  publicList: (tag?: string) =>
    api.get<Envelope<BlogPost[]>>('/blog/feed', { params: tag ? { tag } : undefined }).then((r) => r.data.data),

  publicGetBySlug: (slug: string): Promise<PostView> =>
    api.get<PostViewEnvelope>(`/blog/by-slug/${encodeURIComponent(slug)}`).then((r) => {
      if (r.data.movedTo) throw new PostMovedError(r.data.movedTo); // old slug → redirect
      return {
        post: r.data.data,
        author: r.data.author ?? null,
        prev: r.data.prev ?? null,
        next: r.data.next ?? null,
        related: r.data.related ?? [],
        series: r.data.series ?? null,
        backlinks: r.data.backlinks ?? [],
      };
    }),

  publicSearch: (q: string) =>
    api.get<Envelope<BlogPost[]>>('/blog/search', { params: { q } }).then((r) => r.data.data),

  // Admin: posts that can be linked to from the editor.
  searchLinkablePosts: (q: string, excludePostId?: string) =>
    api.get<Envelope<PostSearchHit[]>>('/blog/posts/search', { params: { q, exclude: excludePostId } })
      .then((r) => r.data.data),

  // Public: series with ≥1 published post (blog-index grouping).
  publicSeriesList: () =>
    api.get<Envelope<PublicSeriesSummary[]>>('/blog/series/list').then((r) => r.data.data),

  // ── Comments ──────────────────────────────────────────────────────────────
  publicComments: (slug: string) =>
    api.get<Envelope<PublicComment[]>>(`/blog/comments/by-slug/${encodeURIComponent(slug)}`).then((r) => r.data.data),

  submitComment: (input: SubmitCommentInput) =>
    api.post<{ success: boolean; message?: string }>('/blog/comments/submit', input).then((r) => r.data),

  pendingComments: () =>
    api.get<Envelope<PendingComment[]>>('/blog/comments/pending').then((r) => r.data.data),

  pendingCommentCount: () =>
    api.get<Envelope<{ count: number }>>('/blog/comments/pending/count').then((r) => r.data.data.count),

  moderateComment: (commentId: string, status: 'approved' | 'rejected' | 'spam') =>
    api.post<Envelope<null>>(`/blog/comments/${commentId}/moderate`, { status }).then((r) => r.data),

  // ── Series ──────────────────────────────────────────────────────────────
  listSeries: () =>
    api.get<Envelope<SeriesWithCount[]>>('/blog/series').then((r) => r.data.data),

  getSeries: (seriesId: string) =>
    api.get<Envelope<{ series: BlogSeries; posts: BlogPost[] }>>(`/blog/series/${seriesId}`).then((r) => r.data.data),

  createSeries: (input: SeriesInput) =>
    api.post<Envelope<BlogSeries>>('/blog/series', input).then((r) => r.data.data),

  updateSeries: (seriesId: string, input: Partial<SeriesInput>) =>
    api.patch<Envelope<BlogSeries>>(`/blog/series/${seriesId}`, input).then((r) => r.data.data),

  deleteSeries: (seriesId: string) =>
    api.delete<Envelope<null>>(`/blog/series/${seriesId}`).then((r) => r.data),

  reorderSeries: (seriesId: string, orderedPostIds: string[]) =>
    api.post<Envelope<null>>(`/blog/series/${seriesId}/reorder`, { orderedPostIds }).then((r) => r.data),

  publicSeries: (slug: string) =>
    api.get<Envelope<{ series: BlogSeries; posts: BlogPost[] }>>(`/blog/series/by-slug/${encodeURIComponent(slug)}`).then((r) => r.data.data),
};

/** Public reader URL for a published post (a route on the marketing SPA). */
export function publicPostUrl(slug: string): string {
  return `/blog/${slug}`;
}

/** Public URL for a stored media key (served by the backend media proxy). */
export function mediaUrl(key: string): string {
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${API_BASE_URL.replace(/\/+$/, '')}/api/blog/media/${path}`;
}

export interface LinkPreview { url: string; title: string; description: string; image: string; siteName: string }

/** Fetch OpenGraph metadata for an external URL (authoring only; SSRF-guarded server-side). */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const res = await api.get('/blog/link-preview', { params: { url } });
  return res.data.data as LinkPreview;
}

/**
 * Upload an image through the backend (multipart → S3), returning the stored key
 * + its public URL. Uses raw fetch with FormData so the browser sets the
 * multipart boundary; the route is public so no auth header is needed.
 */
export async function uploadBlogImage(file: File, kind: UploadKind): Promise<UploadedMedia> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL.replace(/\/+$/, '')}/blog/uploads?kind=${kind}`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const json = await res.json();
  return json.data as UploadedMedia;
}
