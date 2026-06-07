import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import hljs from 'highlight.js';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicBlogLayout } from '../components/PublicBlogLayout';
import { BlogPostHead } from '../components/BlogPostHead';
import { BlogComments } from '../components/BlogComments';
import { usePublicPost } from '../hooks/useBlog';
import { mediaUrl, PostMovedError } from '../api/blog';
import '../components/blog-editor.css';

function fmtDate(s: string | null) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

interface TocItem { id: string; text: string; level: number; index: number }

/** Readable kebab-case anchor from a heading's text. */
function headingSlug(text: string, fallbackIndex: number): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `section-${fallbackIndex + 1}`;
}

export default function PublicBlogPostPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = usePublicPost(slug);
  const post = data?.post;
  const proseRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [progress, setProgress] = useState(0);

  // After the body renders: highlight code + assign heading ids + build the TOC.
  useEffect(() => {
    const root = proseRef.current;
    if (!post || !root) return;
    root.querySelectorAll<HTMLElement>('pre code').forEach((el) => { try { hljs.highlightElement(el); } catch { /* unknown lang */ } });
    const heads = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'));
    const seen = new Map<string, number>();
    const items = heads.map((h, i) => {
      const base = headingSlug(h.textContent || '', i);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const id = n > 1 ? `${base}-${n}` : base; // de-dupe repeated headings
      h.id = id;
      return { id, text: h.textContent || '', level: h.tagName === 'H3' ? 3 : 2, index: i };
    });
    setToc(items);
  }, [post]);

  // Reading-progress bar + scroll-spy for the TOC.
  useEffect(() => {
    if (!post) return;
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    let observer: IntersectionObserver | undefined;
    const root = proseRef.current;
    if (root && toc.length) {
      observer = new IntersectionObserver(
        (entries) => {
          const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (vis[0]) setActiveId((vis[0].target as HTMLElement).id);
        },
        { rootMargin: '0px 0px -70% 0px', threshold: 0 },
      );
      root.querySelectorAll('h2, h3').forEach((h) => observer!.observe(h));
    }
    return () => { window.removeEventListener('scroll', onScroll); observer?.disconnect(); };
  }, [post, toc.length]);

  useEffect(() => { if (post) document.title = `${post.metaTitle || post.title} — Blog`; }, [post]);

  // Navigating post→post reuses this component (only the slug param changes), so
  // jump back to the top on each new article — unless the URL targets an anchor.
  useEffect(() => { if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'auto' }); }, [slug]);

  // Deep link: once headings exist, honour a #anchor in the URL on load.
  useEffect(() => {
    if (!toc.length) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [toc]);

  // Old slug → redirect to the post's current canonical URL.
  const moved = error instanceof PostMovedError;
  useEffect(() => {
    if (error instanceof PostMovedError) {
      navigate({ to: '/blog/$slug', params: { slug: error.movedTo }, replace: true });
    }
  }, [error, navigate]);

  // Scroll a TOC entry into view. Resolve the heading by its POSITION in the live
  // prose (robust to effect-assigned ids being wiped on re-render), falling back
  // to id lookup. scroll-margin-top: 90px (blog-editor.css) clears the fixed nav.
  const scrollToHeading = (e: React.MouseEvent, item: TocItem) => {
    e.preventDefault();
    const root = proseRef.current;
    const el = root?.querySelectorAll<HTMLElement>('h2, h3')[item.index] || document.getElementById(item.id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(item.id);
    window.history.replaceState(null, '', `#${item.id}`);
  };

  return (
    <PublicBlogLayout>
      {post && <BlogPostHead post={post} series={data?.series ?? null} />}
      <div className="fixed left-0 top-0 z-50 h-1 bg-emerald-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />

      <div className="mx-auto max-w-6xl px-5 pb-28 pt-6">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-slate-500">
          <Link to="/blog"><ArrowLeft size={16} className="mr-1" /> All posts</Link>
        </Button>

        {(isLoading || moved) && (
          <div className="max-w-3xl space-y-4">
            <Skeleton className="h-10 w-3/4" /><Skeleton className="h-64 w-full" /><Skeleton className="h-40 w-full" />
          </div>
        )}

        {!isLoading && !moved && (isError || !post) && (
          <div className="py-20 text-center text-slate-400">
            <p className="text-lg font-medium text-slate-700">Post not found</p>
            <p className="mt-1">It may be unpublished or removed.</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/blog">Back to the blog</Link></Button>
          </div>
        )}

        {!isLoading && post && data && (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-12">
            <article className="min-w-0 max-w-3xl">
              {data.series && (() => {
                const n = data.series.items.findIndex((i) => i.current) + 1;
                return (
                  <Link to="/blog/series/$slug" params={{ slug: data.series.series.slug }}
                    className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                    <BookOpen size={14} /> {data.series.series.title}{n ? ` · Part ${n} of ${data.series.items.length}` : ''}
                  </Link>
                );
              })()}
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900">{post.title}</h1>
              {post.subtitle && <p className="mt-3 text-xl text-slate-500">{post.subtitle}</p>}

              {/* Byline */}
              <div className="mt-5 flex items-center gap-3 border-b border-slate-100 pb-5">
                {data.author && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                    {data.author.initials}
                  </span>
                )}
                <div className="text-sm text-slate-500">
                  {data.author && <div className="font-medium text-slate-700">{data.author.name}</div>}
                  <div>{[fmtDate(post.publishedAt), post.readingTimeMinutes ? `${post.readingTimeMinutes} min read` : ''].filter(Boolean).join(' · ')}</div>
                </div>
              </div>

              {post.coverImageKey && (
                <img src={mediaUrl(post.coverImageKey)} alt={post.coverImageAlt || post.title} className="mt-8 w-full rounded-lg object-cover" />
              )}

              {/* body_html is sanitized server-side (sole XSS boundary). */}
              <div ref={proseRef} className="blog-prose mt-8" dangerouslySetInnerHTML={{ __html: post.bodyHtml || '' }} />

              {/* Within-series navigation */}
              {data.series && (
                <section className="mt-12 rounded-lg border border-slate-200 p-5">
                  <Link to="/blog/series/$slug" params={{ slug: data.series.series.slug }}
                    className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900">
                    <BookOpen size={15} /> {data.series.series.title}
                  </Link>
                  <ol className="space-y-1.5 text-sm">
                    {data.series.items.map((it, i) => (it.current ? (
                      <li key={it.slug} className="font-medium text-slate-900">{i + 1}. {it.title} <span className="text-emerald-600">· you are here</span></li>
                    ) : (
                      <li key={it.slug}><Link to="/blog/$slug" params={{ slug: it.slug }} className="text-slate-600 hover:text-slate-900">{i + 1}. {it.title}</Link></li>
                    )))}
                  </ol>
                  <div className="mt-4 flex justify-between gap-4 text-sm">
                    {data.series.prev ? (
                      <Link to="/blog/$slug" params={{ slug: data.series.prev.slug }} className="text-emerald-700 hover:underline">← {data.series.prev.title}</Link>
                    ) : <span />}
                    {data.series.next && (
                      <Link to="/blog/$slug" params={{ slug: data.series.next.slug }} className="text-right text-emerald-700 hover:underline">{data.series.next.title} →</Link>
                    )}
                  </div>
                </section>
              )}

              {/* Related */}
              {data.related.length > 0 && (
                <section className="mt-14">
                  <h3 className="mb-4 text-lg font-bold text-slate-900">Related posts</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.related.map((r) => (
                      <Link key={r.postId} to="/blog/$slug" params={{ slug: r.slug }} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
                        <span className="block font-semibold text-slate-900">{r.title}</span>
                        {(r.excerpt || r.subtitle) && <span className="mt-1 line-clamp-2 block text-sm text-slate-500">{r.excerpt || r.subtitle}</span>}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Referenced by — other posts that link to this one (backlinks) */}
              {data.backlinks.length > 0 && (
                <section className="mt-14">
                  <h3 className="mb-4 text-lg font-bold text-slate-900">Referenced by</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.backlinks.map((b) => (
                      <Link key={b.slug} to="/blog/$slug" params={{ slug: b.slug }} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
                        <span className="block font-semibold text-slate-900">{b.title}</span>
                        {b.excerpt && <span className="mt-1 line-clamp-2 block text-sm text-slate-500">{b.excerpt}</span>}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <BlogComments slug={slug} postId={post.postId} />
            </article>

            {/* On this page (TOC + scroll-spy) */}
            {toc.length > 1 && (
              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">On this page</p>
                  <nav className="space-y-1 border-l border-slate-200 text-sm">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={(e) => scrollToHeading(e, item)}
                        className={`block border-l-2 py-1 transition-colors ${item.level === 3 ? 'pl-6' : 'pl-3'} ${
                          activeId === item.id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Fixed footer bar: previous / next post navigation, always visible while reading. */}
      {!isLoading && post && data && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
            {data.prev ? (
              <Link to="/blog/$slug" params={{ slug: data.prev.slug }} className="group flex min-w-0 flex-1 items-center gap-2">
                <ArrowLeft size={18} className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-700" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Previous</span>
                  <span className="block truncate text-sm font-semibold text-slate-700 group-hover:text-slate-900">{data.prev.title}</span>
                </span>
              </Link>
            ) : <span className="flex-1" />}

            <Button asChild variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex">
              <Link to="/blog">All posts</Link>
            </Button>

            {data.next ? (
              <Link to="/blog/$slug" params={{ slug: data.next.slug }} className="group flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next</span>
                  <span className="block truncate text-sm font-semibold text-slate-700 group-hover:text-slate-900">{data.next.title}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-700" />
              </Link>
            ) : <span className="flex-1" />}
          </div>
        </nav>
      )}
    </PublicBlogLayout>
  );
}
