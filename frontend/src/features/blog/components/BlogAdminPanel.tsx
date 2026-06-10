import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useBlogPosts, useDeletePost, usePendingComments } from '../hooks/useBlog';
import { publicPostUrl } from '../api/blog';
import BlogCommentModeration from './BlogCommentModeration';
import BlogSeriesManager from './BlogSeriesManager';
import { cn } from '@/lib/utils';
import type { BlogPost, BlogStatus } from '../types/blog';

const TABS: { label: string; value: '' | BlogStatus }[] = [
  { label: 'All', value: '' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Published', value: 'published' },
];

function StatusBadge({ status }: { status: BlogStatus }) {
  const map: Record<BlogStatus, string> = {
    draft: 'bg-amber-100 text-amber-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
  };
  return <Badge className={`${map[status]} border-0 capitalize`}>{status}</Badge>;
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

function PostRow({ post, onEdit }: { post: BlogPost; onEdit: () => void }) {
  const del = useDeletePost();
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-gray-900">{post.title || 'Untitled'}</span>
          <StatusBadge status={post.status} />
        </div>
        <div className="mt-1 truncate text-sm text-gray-500">
          {post.status === 'published' && post.publishedAt
            ? `Published ${fmtDate(post.publishedAt)}`
            : `Updated ${fmtDate(post.updatedAt)}`}
          {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ''}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {post.status === 'published' && (
          <Button asChild variant="ghost" size="icon" title="View live">
            <a href={publicPostUrl(post.slug)} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>
          </Button>
        )}
        <Button variant="ghost" size="icon" title="Edit" onClick={onEdit}><Pencil size={16} /></Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" title="Delete"><Trash2 size={16} /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this post?</AlertDialogTitle>
              <AlertDialogDescription>
                “{post.title || 'Untitled'}” will be removed. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(post.postId)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}

/** Company-admin "Blog" tab: list + manage posts. Authoring opens the full-page editor. */
export default function BlogAdminPanel() {
  const navigate = useNavigate();
  const [view, setView] = useState<'posts' | 'comments' | 'series'>('posts');
  const [tab, setTab] = useState<'' | BlogStatus>('');
  const { data: posts, isLoading } = useBlogPosts(tab || undefined);
  const { data: pending } = usePendingComments();
  const pendingCount = pending?.length ?? 0;

  return (
    <div>
      {/* Posts vs Comments view toggle */}
      <div className="mb-5 flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button type="button" onClick={() => setView('posts')}
          className={cn('rounded-md px-3 py-1.5 text-sm font-medium', view === 'posts' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
          Posts
        </button>
        <button type="button" onClick={() => setView('comments')}
          className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', view === 'comments' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
          Comments
          {pendingCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{pendingCount}</span>}
        </button>
        <button type="button" onClick={() => setView('series')}
          className={cn('rounded-md px-3 py-1.5 text-sm font-medium', view === 'series' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
          Series
        </button>
      </div>

      {view === 'comments' ? <BlogCommentModeration /> : view === 'series' ? <BlogSeriesManager /> : (
      <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Blog posts</h2>
          <p className="text-sm text-gray-500">Write and publish posts to the public blog.</p>
        </div>
        <Button onClick={() => navigate({ to: '/company-admin/blog/new' })}>
          <Plus size={16} className="mr-1" /> New post
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as '' | BlogStatus)} className="mb-4">
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        {!isLoading && posts && posts.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-500">
            <p className="font-medium">No posts yet</p>
            <p className="mt-1 text-sm">Write your first post to see it here.</p>
          </div>
        )}
        {!isLoading && posts?.map((p) => (
          <PostRow key={p.postId} post={p} onEdit={() => navigate({ to: '/company-admin/blog/$postId/edit', params: { postId: p.postId } })} />
        ))}
      </div>
      </>
      )}
    </div>
  );
}
