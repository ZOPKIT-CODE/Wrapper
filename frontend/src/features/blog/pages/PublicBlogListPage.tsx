import { Link } from '@tanstack/react-router';
import { Search, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicBlogLayout } from '../components/PublicBlogLayout';
import { BlogPostCard } from '../components/BlogPostCard';
import { usePublicPosts, usePublicSeriesList } from '../hooks/useBlog';

// Open the ⌘K palette (handled by BlogSearchCommand's global keydown listener).
const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }));

export default function PublicBlogListPage() {
  const { data: posts, isLoading } = usePublicPosts();
  const { data: series } = usePublicSeriesList();

  return (
    <PublicBlogLayout>
      <title>Blog</title>
      <meta name="description" content="Stories, updates and ideas from the team." />
      <meta property="og:title" content="Blog" />
      <meta property="og:type" content="website" />
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Blog</h1>
          <p className="mt-2 text-slate-500">Stories, updates and ideas from the team.</p>
          <button
            type="button"
            onClick={openSearch}
            className="mt-5 flex w-full max-w-sm items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 hover:border-slate-300"
          >
            <Search size={16} /> Search posts
            <kbd className="ml-auto rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">⌘K</kbd>
          </button>
        </div>

        {/* Series — collections to read in order */}
        {series && series.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <BookOpen size={15} /> Series
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {series.map((s) => (
                <Link key={s.seriesId} to="/blog/series/$slug" params={{ slug: s.slug }}
                  className="rounded-lg border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40">
                  <span className="block font-semibold text-slate-900">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {s.description ? <span className="line-clamp-1">{s.description}</span> : null}
                    <span className="text-emerald-700">{s.postCount} part{s.postCount === 1 ? '' : 's'}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && posts && posts.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <p className="text-lg font-medium">No posts yet</p>
            <p className="mt-1">Check back soon.</p>
          </div>
        )}

        {!isLoading && posts?.map((p) => <BlogPostCard key={p.postId} post={p} />)}
      </div>
    </PublicBlogLayout>
  );
}
