import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePublicComments, useSubmitComment } from '../hooks/useBlog';

function fmt(s: string) {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

/** Public comment thread (approved only) + a moderated submission form. */
export function BlogComments({ slug, postId }: { slug: string; postId: string }) {
  const { data: comments = [], isLoading } = usePublicComments(slug);
  const submit = useSubmitComment();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) { toast.error('Name and comment are required'); return; }
    submit.mutate(
      { postId, authorName: name.trim(), authorEmail: email.trim() || undefined, body: body.trim() },
      {
        onSuccess: (r) => {
          toast.success(r.message || 'Comment submitted — it will appear once approved.');
          setBody('');
        },
      },
    );
  };

  return (
    <section className="mt-16 border-t border-slate-100 pt-10">
      <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900">
        <MessageSquare size={18} /> Comments{comments.length ? ` (${comments.length})` : ''}
      </h3>

      <div className="space-y-6">
        {isLoading && <p className="text-sm text-slate-400">Loading comments…</p>}
        {!isLoading && comments.length === 0 && <p className="text-sm text-slate-400">No comments yet. Be the first.</p>}
        {comments.map((c) => (
          <div key={c.commentId} className="rounded-lg bg-slate-50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-800">{c.authorName}</span>
              <span className="text-slate-400">· {fmt(c.createdAt)}</span>
            </div>
            {/* plain text — React escapes; preserve line breaks */}
            <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-8 rounded-lg border border-slate-200 p-5">
        <p className="mb-4 text-sm font-medium text-slate-700">Leave a comment</p>
        <p className="mb-4 text-xs text-slate-400">Comments are reviewed before they appear.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="c-email">Email (optional, not shown)</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="c-body">Comment</Label>
          <Textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your thoughts…" rows={4} maxLength={5000} />
        </div>
        <div className="mt-4">
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending && <Loader2 size={15} className="mr-1 animate-spin" />} Post comment
          </Button>
        </div>
      </form>
    </section>
  );
}
