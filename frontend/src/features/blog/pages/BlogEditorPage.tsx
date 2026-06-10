import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Globe, Loader2, Check, Settings2, ExternalLink, Undo, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { TiptapEditor } from '../components/TiptapEditor';
import CoverImageUploader from '../components/CoverImageUploader';
import {
  useBlogPost, useCreatePost, useUpdatePost, usePublishPost, useUnpublishPost, useUploadImage, useSeriesList,
} from '../hooks/useBlog';
import { publicPostUrl } from '../api/blog';
import type { BlogPost, BlogPostInput, TiptapDoc } from '../types/blog';

interface FormState {
  title: string; subtitle: string; excerpt: string; slug: string; tagsText: string;
  coverImageKey: string | null; body: TiptapDoc;
  metaTitle: string; metaDescription: string; seoNoindex: boolean; seriesId: string | null;
}

const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

const initialForm: FormState = {
  title: '', subtitle: '', excerpt: '', slug: '', tagsText: '',
  coverImageKey: null, body: EMPTY_DOC, metaTitle: '', metaDescription: '', seoNoindex: false, seriesId: null,
};

function fromPost(p: BlogPost): FormState {
  return {
    title: p.title ?? '', subtitle: p.subtitle ?? '', excerpt: p.excerpt ?? '', slug: p.slug ?? '',
    tagsText: Array.isArray(p.tags) ? p.tags.join(', ') : '',
    coverImageKey: p.coverImageKey, body: p.body ?? EMPTY_DOC,
    metaTitle: p.metaTitle ?? '', metaDescription: p.metaDescription ?? '', seoNoindex: p.seoNoindex ?? false,
    seriesId: p.seriesId ?? null,
  };
}

/** Normalize a typed slug to kebab-case so it always passes the backend regex. */
function toSlug(s: string): string {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toInput(f: FormState): BlogPostInput {
  const tags = f.tagsText.split(',').map((t) => t.trim()).filter(Boolean);
  const input: BlogPostInput = {
    title: f.title.trim() || 'Untitled',
    subtitle: f.subtitle || null, excerpt: f.excerpt || null, body: f.body, tags,
    coverImageKey: f.coverImageKey,
    metaTitle: f.metaTitle || null, metaDescription: f.metaDescription || null, seoNoindex: f.seoNoindex,
    seriesId: f.seriesId,
  };
  // Slugify a custom slug (don't send raw text — the backend requires kebab-case);
  // omit it entirely when empty so the server auto-generates from the title.
  const slug = toSlug(f.slug);
  if (slug) input.slug = slug;
  return input;
}

/** Auto-growing, wrapping text field (so long titles wrap instead of clipping). */
function GrowTextarea({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder: string; className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={`w-full resize-none overflow-hidden border-0 bg-transparent outline-none ${className}`}
    />
  );
}

export default function BlogEditorPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { postId?: string };
  const postId = params.postId;
  const isNew = !postId;

  const { data: post, isLoading } = useBlogPost(postId);
  const uploadImage = useUploadImage();
  const createMut = useCreatePost();
  const updateMut = useUpdatePost(postId ?? '');
  const publishMut = usePublishPost(postId ?? '');
  const unpublishMut = useUnpublishPost(postId ?? '');
  const { data: seriesList = [] } = useSeriesList();

  const [form, setForm] = useState<FormState>(initialForm);
  const [loaded, setLoaded] = useState(isNew);
  const [showSeo, setShowSeo] = useState(false);
  const [stats, setStats] = useState<{ words: number; minutes: number }>({ words: 0, minutes: 0 });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const savedRef = useRef<string>('');

  // Re-render periodically so the "saved Xs ago" label stays fresh.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(i);
  }, []);

  // Hydrate the form once the post loads (edit mode).
  useEffect(() => {
    if (post && !loaded) {
      const f = fromPost(post);
      setForm(f);
      savedRef.current = JSON.stringify(toInput(f));
      setLastSavedAt(post.updatedAt ? new Date(post.updatedAt) : null);
      setLoaded(true);
    }
  }, [post, loaded]);

  // Debounced autosave for existing posts.
  useEffect(() => {
    if (isNew || !loaded) return;
    const serialized = JSON.stringify(toInput(form));
    if (serialized === savedRef.current) return;
    const t = setTimeout(() => {
      updateMut.mutate(toInput(form), {
        onSuccess: () => { savedRef.current = serialized; setLastSavedAt(new Date()); },
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [form, isNew, loaded, updateMut]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = () => {
    if (!form.title.trim()) { toast.error('Add a title first'); return; }
    createMut.mutate(toInput(form), {
      onSuccess: (p) => navigate({ to: '/company-admin/blog/$postId/edit', params: { postId: p.postId } }),
    });
  };

  const handlePublish = () => {
    publishMut.mutate('published', {
      onSuccess: (p) => {
        setLastSavedAt(new Date());
        toast.success('Post published', {
          description: 'It’s now live on your public blog.',
          action: { label: 'View', onClick: () => window.open(publicPostUrl(p.slug), '_blank') },
        });
      },
    });
  };

  const goBack = () => navigate({ to: '/company-admin', search: { tab: 'blog' } as never });

  // SEO completeness hints.
  const seoMissing: string[] = [];
  if (!form.metaDescription.trim() && !form.excerpt.trim()) seoMissing.push('an excerpt');
  if (!form.coverImageKey) seoMissing.push('a cover image');
  if (!form.tagsText.trim()) seoMissing.push('tags');

  function savedAgo(): string {
    if (!lastSavedAt) return '';
    const s = Math.max(0, Math.round((Date.now() - lastSavedAt.getTime()) / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (!isNew && isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
        <Skeleton className="h-8 w-40" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const status = post?.status ?? 'draft';
  const saving = updateMut.isPending;

  const SaveStatus = () => {
    if (saving) return <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
    if (lastSavedAt) return <span className="flex items-center gap-1 text-xs text-gray-400"><Check size={13} /> {status === 'published' ? 'Saved' : 'Draft saved'} {savedAgo()}</span>;
    return <span className="text-xs text-gray-400">{isNew ? 'Not saved yet' : ''}</span>;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky action header — always visible */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft size={16} className="mr-1" /> Blog
          </Button>
          <SaveStatus />
        </div>
        <div className="flex items-center gap-2">
          {stats.words > 0 && (
            <span className="hidden text-xs text-gray-400 md:inline">{stats.words} words · {stats.minutes} min read</span>
          )}
          {isNew ? (
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 size={15} className="mr-1 animate-spin" />} Save draft
            </Button>
          ) : (
            <>
              {status === 'published' && (
                <Button asChild variant="outline" size="sm">
                  <a href={publicPostUrl(post!.slug)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} className="mr-1" /> View
                  </a>
                </Button>
              )}
              {status === 'published' ? (
                <Button variant="outline" size="sm" onClick={() => { unpublishMut.mutate(undefined, { onSuccess: () => setLastSavedAt(new Date()) }); }} disabled={unpublishMut.isPending}>
                  <Undo size={15} className="mr-1" /> Unpublish
                </Button>
              ) : (
                <Button onClick={handlePublish} disabled={publishMut.isPending}>
                  {publishMut.isPending ? <Loader2 size={15} className="mr-1 animate-spin" /> : <Globe size={15} className="mr-1" />} Publish
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Cover */}
        <div className="mb-5">
          <CoverImageUploader coverImageKey={form.coverImageKey} uploadImage={uploadImage} onChange={(key) => set('coverImageKey', key)} />
        </div>

        {/* Title + subtitle (wrap, no clipping) */}
        <GrowTextarea
          value={form.title}
          onChange={(v) => set('title', v)}
          placeholder="Title"
          className="mb-2 text-[2.6rem] font-extrabold leading-[1.15] tracking-[-0.022em] text-gray-900 placeholder-gray-300"
        />
        <GrowTextarea
          value={form.subtitle}
          onChange={(v) => set('subtitle', v)}
          placeholder="Add a subtitle"
          className="mb-6 text-2xl font-normal leading-snug tracking-[-0.01em] text-gray-500 placeholder-gray-300"
        />

        {/* Body editor */}
        {loaded && (
          <TiptapEditor key={postId ?? 'new'} value={form.body} onChange={(doc) => set('body', doc)} uploadImage={uploadImage} onStats={setStats} currentPostId={postId} />
        )}

        {/* SEO & meta (collapsible, with completeness hint) */}
        <div className="mt-8 rounded-lg border border-gray-200">
          <button type="button" onClick={() => setShowSeo((s) => !s)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-gray-700">
            <span className="flex items-center gap-2"><Settings2 size={16} /> SEO &amp; metadata</span>
            {seoMissing.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-normal text-amber-600">
                <AlertCircle size={13} /> Add {seoMissing[0]}{seoMissing.length > 1 ? ` +${seoMissing.length - 1} more` : ''}
              </span>
            )}
          </button>
          {showSeo && (
            <div className="space-y-4 border-t border-gray-100 p-4">
              <div>
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea id="excerpt" value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} placeholder="Short summary shown in the feed and search results" rows={2} />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  onBlur={(e) => set('slug', toSlug(e.target.value))}
                  placeholder="auto-generated-from-title"
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" value={form.tagsText} onChange={(e) => set('tagsText', e.target.value)} placeholder="product, engineering" />
              </div>
              <div>
                <Label htmlFor="series">Series</Label>
                <select
                  id="series"
                  value={form.seriesId ?? ''}
                  onChange={(e) => set('seriesId', e.target.value || null)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None</option>
                  {seriesList.map((s) => <option key={s.seriesId} value={s.seriesId}>{s.title}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">Manage order in the Blog tab → Series.</p>
              </div>
              <div>
                <Label htmlFor="metaTitle">Meta title</Label>
                <Input id="metaTitle" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Defaults to the title" />
              </div>
              <div>
                <Label htmlFor="metaDescription">Meta description</Label>
                <Textarea id="metaDescription" value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="Defaults to the excerpt" rows={2} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="noindex">Hide from search engines (noindex)</Label>
                <Switch id="noindex" checked={form.seoNoindex} onCheckedChange={(v) => set('seoNoindex', v)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
