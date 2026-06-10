import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicBlogLayout } from '../components/PublicBlogLayout';
import { BlogPostCard } from '../components/BlogPostCard';
import { usePublicPosts } from '../hooks/useBlog';

export default function PublicBlogTagPage() {
  const { tag } = useParams({ strict: false }) as { tag: string };
  const { data: posts, isLoading } = usePublicPosts(tag);

  return (
    <PublicBlogLayout>
      <title>{`#${tag} — Blog`}</title>
      <meta name="robots" content="noindex" />
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-slate-500">
          <Link to="/blog"><ArrowLeft size={16} className="mr-1" /> All posts</Link>
        </Button>
        <div className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Tag</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">{tag}</h1>
        </div>

        {isLoading && (
          <div className="space-y-8">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>
        )}
        {!isLoading && posts && posts.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <p className="text-lg font-medium">No posts tagged “{tag}”.</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/blog">Back to the blog</Link></Button>
          </div>
        )}
        {!isLoading && posts?.map((p) => <BlogPostCard key={p.postId} post={p} />)}
      </div>
    </PublicBlogLayout>
  );
}
