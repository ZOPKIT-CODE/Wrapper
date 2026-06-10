import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FileSymlink, LayoutPanelTop, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLinkablePosts } from '../hooks/useBlog';
import { fetchLinkPreview, mediaUrl } from '../api/blog';
import type { PostSearchHit } from '../types/blog';

/**
 * "Link or embed" picker. Three inserts:
 *   • inline internal link (click a result title) — carries postId for slug-follow + backlinks.
 *   • internal preview card (the card button on a result) — a linkCard node snapshotting
 *     the post's title/excerpt/cover; href resolved server-side at render.
 *   • external preview card (paste a URL + Embed) — fetches OG metadata via the
 *     SSRF-guarded backend endpoint and inserts an external linkCard.
 */
export default function LinkPostDialog({ editor, currentPostId }: { editor: Editor; currentPostId?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('');
  const [embedding, setEmbedding] = useState(false);
  const [error, setError] = useState('');
  const { data: hits, isFetching } = useLinkablePosts(q, currentPostId);

  const close = () => { setOpen(false); setQ(''); setUrl(''); setError(''); };

  const insertInlineLink = (hit: PostSearchHit) => {
    const href = `/blog/${hit.slug}`;
    const { from, to } = editor.state.selection;
    if (from === to) {
      editor.chain().focus()
        .insertContent({ type: 'text', text: hit.title, marks: [{ type: 'link', attrs: { href, postId: hit.postId } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).updateAttributes('link', { postId: hit.postId }).run();
    }
    close();
  };

  const insertInternalCard = (hit: PostSearchHit) => {
    editor.chain().focus().insertContent({
      type: 'linkCard',
      attrs: {
        variant: 'internal',
        postId: hit.postId,
        href: `/blog/${hit.slug}`,
        title: hit.title,
        description: hit.excerpt ?? null,
        image: hit.coverImageKey ? mediaUrl(hit.coverImageKey) : null,
        siteName: 'Zopkit',
      },
    }).run();
    close();
  };

  const insertExternalCard = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { setError('Enter a full http(s) URL.'); return; }
    setEmbedding(true); setError('');
    try {
      const p = await fetchLinkPreview(u);
      editor.chain().focus().insertContent({
        type: 'linkCard',
        attrs: { variant: 'external', href: p.url, title: p.title, description: p.description, image: p.image, siteName: p.siteName },
      }).run();
      close();
    } catch {
      setError('Could not load a preview for that URL.');
    } finally {
      setEmbedding(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Link or embed"
        aria-label="Link or embed"
        onMouseDown={(e) => { e.preventDefault(); setOpen(true); }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100"
      >
        <FileSymlink size={16} />
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link or embed</DialogTitle>
            <DialogDescription>Reference another article, or embed any URL as a preview card.</DialogDescription>
          </DialogHeader>

          {/* External URL → preview card */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Paste a URL to embed…"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void insertExternalCard(); } }}
            />
            <button
              type="button"
              disabled={embedding || !url.trim()}
              onClick={() => void insertExternalCard()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {embedding ? <Loader2 size={14} className="animate-spin" /> : <LayoutPanelTop size={14} />} Embed
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="my-1 text-center text-xs uppercase tracking-wide text-gray-300">or link a post</div>

          {/* Internal post search */}
          <Input autoFocus placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-1 max-h-64 overflow-y-auto">
            {isFetching && <p className="px-1 py-3 text-sm text-gray-400">Searching…</p>}
            {!isFetching && hits && hits.length === 0 && <p className="px-1 py-3 text-sm text-gray-400">No posts found.</p>}
            {hits?.map((h) => (
              <div key={h.postId} className="flex items-center justify-between gap-2 rounded px-2 py-2 hover:bg-gray-100">
                <button type="button" onClick={() => insertInlineLink(h)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-gray-800">{h.title}</span>
                  <span className="block truncate text-xs text-gray-400">/blog/{h.slug}</span>
                </button>
                {h.status !== 'published' && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">{h.status}</span>
                )}
                <button
                  type="button"
                  onClick={() => insertInternalCard(h)}
                  title="Insert as preview card"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white"
                >
                  <LayoutPanelTop size={12} /> Card
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
