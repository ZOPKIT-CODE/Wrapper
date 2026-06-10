import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { blogApi, uploadBlogImage } from '../api/blog';
import type { BlogPostInput, UploadKind } from '../types/blog';

const blogKeys = {
  all: ['blog'] as const,
  list: (status?: string) => ['blog', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['blog', 'detail', id] as const,
};

/** Turn an API error into a specific message, naming the failing field(s) on a 400. */
function blogError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { error?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } } })?.response?.data;
  const fe = data?.details?.fieldErrors;
  if (fe) {
    const parts = Object.entries(fe).map(([k, v]) => `${k}: ${(v ?? []).join(', ')}`).filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  if (data?.details?.formErrors?.length) return data.details.formErrors.join(', ');
  return data?.error || (e as Error)?.message || fallback;
}

export function useBlogPosts(status?: string) {
  return useQuery({
    queryKey: blogKeys.list(status),
    queryFn: () => blogApi.list(status),
    staleTime: 60 * 1000,
  });
}

export function useBlogPost(postId?: string) {
  return useQuery({
    queryKey: blogKeys.detail(postId ?? ''),
    queryFn: () => blogApi.get(postId!),
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}

// ── Public reading (published only) ─────────────────────────────────────────

export function usePublicPosts(tag?: string) {
  return useQuery({
    queryKey: ['blog', 'public', 'list', tag ?? 'all'],
    queryFn: () => blogApi.publicList(tag),
    staleTime: 60 * 1000,
  });
}

export function usePublicPost(slug?: string) {
  return useQuery({
    queryKey: ['blog', 'public', 'detail', slug ?? ''],
    queryFn: () => blogApi.publicGetBySlug(slug!),
    enabled: !!slug,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function usePublicSearch(q: string) {
  return useQuery({
    queryKey: ['blog', 'public', 'search', q],
    queryFn: () => blogApi.publicSearch(q),
    enabled: q.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

/** Admin: search posts to link to from the editor (excludes the current post). */
export function useLinkablePosts(q: string, excludePostId?: string) {
  return useQuery({
    queryKey: ['blog', 'linkable', q, excludePostId ?? ''],
    queryFn: () => blogApi.searchLinkablePosts(q, excludePostId),
    staleTime: 30 * 1000,
  });
}

/** Public: series with published posts, for the blog-index grouping. */
export function usePublicSeriesList() {
  return useQuery({
    queryKey: ['blog', 'series', 'public', 'list'],
    queryFn: () => blogApi.publicSeriesList(),
    staleTime: 60 * 1000,
  });
}

// ── Comments ────────────────────────────────────────────────────────────────

export function usePublicComments(slug?: string) {
  return useQuery({
    queryKey: ['blog', 'comments', 'public', slug ?? ''],
    queryFn: () => blogApi.publicComments(slug!),
    enabled: !!slug,
    staleTime: 30 * 1000,
  });
}

export function useSubmitComment() {
  return useMutation({
    mutationFn: (input: import('../types/blog').SubmitCommentInput) => blogApi.submitComment(input),
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to submit comment'),
  });
}

export function usePendingComments() {
  return useQuery({
    queryKey: ['blog', 'comments', 'pending'],
    queryFn: () => blogApi.pendingComments(),
    staleTime: 15 * 1000,
  });
}

export function useModerateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, status }: { commentId: string; status: 'approved' | 'rejected' | 'spam' }) =>
      blogApi.moderateComment(commentId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog', 'comments'] }),
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to moderate'),
  });
}

// ── Series ──────────────────────────────────────────────────────────────────

export function useSeriesList() {
  return useQuery({ queryKey: ['blog', 'series', 'list'], queryFn: () => blogApi.listSeries(), staleTime: 30 * 1000 });
}

export function useSeries(seriesId?: string) {
  return useQuery({
    queryKey: ['blog', 'series', 'detail', seriesId ?? ''],
    queryFn: () => blogApi.getSeries(seriesId!),
    enabled: !!seriesId,
  });
}

export function usePublicSeries(slug?: string) {
  return useQuery({
    queryKey: ['blog', 'series', 'public', slug ?? ''],
    queryFn: () => blogApi.publicSeries(slug!),
    enabled: !!slug,
    retry: false,
  });
}

export function useCreateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('../types/blog').SeriesInput) => blogApi.createSeries(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog', 'series'] }),
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to create series'),
  });
}

export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, input }: { seriesId: string; input: Partial<import('../types/blog').SeriesInput> }) => blogApi.updateSeries(seriesId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog', 'series'] }),
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to update series'),
  });
}

export function useDeleteSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seriesId: string) => blogApi.deleteSeries(seriesId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog', 'series'] }),
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to delete series'),
  });
}

export function useReorderSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, orderedPostIds }: { seriesId: string; orderedPostIds: string[] }) => blogApi.reorderSeries(seriesId, orderedPostIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog', 'series'] }),
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to reorder'),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlogPostInput) => blogApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: blogKeys.all }),
    onError: (e: unknown) => toast.error(blogError(e, 'Failed to create post')),
  });
}

export function useUpdatePost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BlogPostInput>) => blogApi.update(postId, input),
    onSuccess: (data) => {
      qc.setQueryData(blogKeys.detail(postId), data);
      qc.invalidateQueries({ queryKey: blogKeys.list() });
    },
    onError: (e: unknown) => toast.error(blogError(e, 'Failed to save')),
  });
}

export function usePublishPost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status?: 'published' | 'draft' | 'archived') => blogApi.publish(postId, status),
    onSuccess: (data) => {
      qc.setQueryData(blogKeys.detail(postId), data);
      qc.invalidateQueries({ queryKey: blogKeys.all });
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to publish'),
  });
}

export function useUnpublishPost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => blogApi.unpublish(postId),
    onSuccess: (data) => {
      qc.setQueryData(blogKeys.detail(postId), data);
      qc.invalidateQueries({ queryKey: blogKeys.all });
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to unpublish'),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => blogApi.remove(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: blogKeys.all });
      toast.success('Post deleted');
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Failed to delete'),
  });
}

/** Returns an uploader that signs + PUTs a file to S3 and returns {key, publicUrl}. */
export function useUploadImage() {
  return useCallback(async (file: File, kind: UploadKind) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Unsupported image type (JPG, PNG, WebP, AVIF or GIF only)');
      throw new Error('unsupported type');
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image exceeds the 10 MB limit');
      throw new Error('too large');
    }
    try {
      return await uploadBlogImage(file, kind);
    } catch (e) {
      toast.error((e as Error).message || 'Upload failed');
      throw e;
    }
  }, []);
}
