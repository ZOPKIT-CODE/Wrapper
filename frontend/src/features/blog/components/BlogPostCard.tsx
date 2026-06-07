import { Link } from '@tanstack/react-router';
import { mediaUrl } from '../api/blog';
import type { BlogPost } from '../types/blog';

function fmtDate(s: string | null) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

/** Medium-style post card used on the feed and tag pages. */
export function BlogPostCard({ post }: { post: BlogPost }) {
  const meta = [fmtDate(post.publishedAt), post.readingTimeMinutes ? `${post.readingTimeMinutes} min read` : '']
    .filter(Boolean).join(' · ');
  const tags = Array.isArray(post.tags) ? post.tags : [];

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-8 sm:flex-row sm:items-start sm:gap-8">
      <div className="min-w-0 flex-1">
        <Link to="/blog/$slug" params={{ slug: post.slug }} className="group">
          <h2 className="text-xl font-bold text-slate-900 group-hover:text-slate-700">{post.title}</h2>
          {(post.subtitle || post.excerpt) && (
            <p className="mt-1.5 line-clamp-2 text-slate-500">{post.subtitle || post.excerpt}</p>
          )}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span>{meta}</span>
          {tags.slice(0, 3).map((t) => (
            <Link key={t} to="/blog/tag/$tag" params={{ tag: t }} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200">
              {t}
            </Link>
          ))}
        </div>
      </div>
      {post.coverImageKey && (
        <Link to="/blog/$slug" params={{ slug: post.slug }} className="shrink-0">
          <img src={mediaUrl(post.coverImageKey)} alt={post.coverImageAlt || post.title} className="h-32 w-full rounded-lg object-cover sm:w-48" />
        </Link>
      )}
    </div>
  );
}
