import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FileSymlink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLinkablePosts } from '../hooks/useBlog';
import type { PostSearchHit } from '../types/blog';

/**
 * "Link to a post" picker — inserts an internal article reference. The link
 * carries the target's postId (data-post-id) so the reference survives slug
 * renames and feeds the backlinks index; the href is the current /blog/<slug>.
 * If text is selected the mark wraps it; otherwise the post title is inserted.
 */
export default function LinkPostDialog({ editor, currentPostId }: { editor: Editor; currentPostId?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const { data: hits, isFetching } = useLinkablePosts(q, currentPostId);

  const apply = (hit: PostSearchHit) => {
    const href = `/blog/${hit.slug}`;
    const { from, to } = editor.state.selection;
    if (from === to) {
      editor.chain().focus()
        .insertContent({ type: 'text', text: hit.title, marks: [{ type: 'link', attrs: { href, postId: hit.postId } }] })
        .run();
    } else {
      // setLink's typed options don't include our custom postId attr → set it after.
      editor.chain().focus().extendMarkRange('link').setLink({ href }).updateAttributes('link', { postId: hit.postId }).run();
    }
    setOpen(false);
    setQ('');
  };

  return (
    <>
      <button
        type="button"
        title="Link to a post"
        aria-label="Link to a post"
        onMouseDown={(e) => { e.preventDefault(); setOpen(true); }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100"
      >
        <FileSymlink size={16} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link to a post</DialogTitle>
            <DialogDescription>Reference another article. The link follows the post if its URL changes.</DialogDescription>
          </DialogHeader>
          <Input autoFocus placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-1 max-h-72 overflow-y-auto">
            {isFetching && <p className="px-1 py-3 text-sm text-gray-400">Searching…</p>}
            {!isFetching && hits && hits.length === 0 && <p className="px-1 py-3 text-sm text-gray-400">No posts found.</p>}
            {hits?.map((h) => (
              <button
                key={h.postId}
                type="button"
                onClick={() => apply(h)}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left hover:bg-gray-100"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-800">{h.title}</span>
                  <span className="block truncate text-xs text-gray-400">/blog/{h.slug}</span>
                </span>
                {h.status !== 'published' && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">{h.status}</span>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
