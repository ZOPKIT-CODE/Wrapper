import { Check, X, Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingComments, useModerateComment } from '../hooks/useBlog';

function fmt(s: string) {
  try { return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

/** Company-admin moderation queue (pending comments → approve / reject / spam). */
export default function BlogCommentModeration() {
  const { data: pending, isLoading } = usePendingComments();
  const moderate = useModerateComment();

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Comment moderation</h2>
        <p className="text-sm text-gray-500">Pending comments — approve to publish them on the post.</p>
      </div>

      <div className="space-y-3">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        {!isLoading && pending && pending.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
            <p className="font-medium">Nothing to review</p>
            <p className="mt-1 text-sm">New comments will appear here for approval.</p>
          </div>
        )}
        {!isLoading && pending?.map((c) => (
          <Card key={c.commentId} className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold text-gray-900">{c.authorName}</span>
              {c.authorEmail && <span className="text-gray-400">&lt;{c.authorEmail}&gt;</span>}
              <span className="text-gray-400">· {fmt(c.createdAt)}</span>
              {c.postTitle && <span className="text-gray-400">· on “{c.postTitle}”</span>}
            </div>
            <p className="whitespace-pre-wrap text-gray-700">{c.body}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => moderate.mutate({ commentId: c.commentId, status: 'approved' })} disabled={moderate.isPending}>
                <Check size={15} className="mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => moderate.mutate({ commentId: c.commentId, status: 'rejected' })} disabled={moderate.isPending}>
                <X size={15} className="mr-1" /> Reject
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => moderate.mutate({ commentId: c.commentId, status: 'spam' })} disabled={moderate.isPending}>
                <Ban size={15} className="mr-1" /> Spam
              </Button>
              {moderate.isPending && <Loader2 size={14} className="animate-spin text-gray-400" />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
