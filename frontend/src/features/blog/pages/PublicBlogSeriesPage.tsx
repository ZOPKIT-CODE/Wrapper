import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicBlogLayout } from '../components/PublicBlogLayout';
import { usePublicSeries } from '../hooks/useBlog';
import { mediaUrl } from '../api/blog';

export default function PublicBlogSeriesPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { data, isLoading, isError } = usePublicSeries(slug);

  return (
    <PublicBlogLayout>
      {data && <title>{`${data.series.title} — Series`}</title>}
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-slate-500">
          <Link to="/blog"><ArrowLeft size={16} className="mr-1" /> All posts</Link>
        </Button>

        {isLoading && <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /></div>}

        {!isLoading && (isError || !data) && (
          <div className="py-20 text-center text-slate-400">
            <p className="text-lg font-medium text-slate-700">Series not found</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/blog">Back to the blog</Link></Button>
          </div>
        )}

        {!isLoading && data && (() => {
          const totalMinutes = data.posts.reduce((sum, p) => sum + (p.readingTimeMinutes ?? 0), 0);
          const meta = [`${data.posts.length} part${data.posts.length === 1 ? '' : 's'}`, totalMinutes ? `~${totalMinutes} min total` : '']
            .filter(Boolean).join(' · ');
          return (
          <>
            <div className="mb-8 border-b border-slate-200 pb-6">
              <p className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-emerald-600">
                <BookOpen size={15} /> Series
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{data.series.title}</h1>
              {meta && <p className="mt-2 text-sm text-slate-400">{meta}</p>}
              {data.series.description && <p className="mt-2 text-slate-500">{data.series.description}</p>}
              {data.series.coverImageKey && (
                <img src={mediaUrl(data.series.coverImageKey)} alt={data.series.title} className="mt-6 w-full rounded-lg object-cover" />
              )}
            </div>

            {data.posts.length === 0 ? (
              <p className="text-slate-400">No published posts in this series yet.</p>
            ) : (
              <ol className="space-y-3">
                {data.posts.map((p, i) => (
                  <li key={p.postId}>
                    <Link to="/blog/$slug" params={{ slug: p.slug }}
                      className="flex items-start gap-4 rounded-lg border border-slate-200 p-4 hover:border-slate-300">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900">{p.title}</span>
                        {(p.excerpt || p.subtitle) && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{p.excerpt || p.subtitle}</span>}
                        {p.readingTimeMinutes ? <span className="mt-1 block text-xs text-slate-400">{p.readingTimeMinutes} min read</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
          );
        })()}
      </div>
    </PublicBlogLayout>
  );
}
