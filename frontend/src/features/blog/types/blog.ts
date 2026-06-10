export type BlogStatus = 'draft' | 'published' | 'archived';

// Tiptap/ProseMirror document JSON. Loosely typed — the editor owns the shape.
export type TiptapDoc = { type: string; content?: unknown[]; [key: string]: unknown };

export interface BlogPost {
  postId: string;
  tenantId: string;
  authorId: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  body: TiptapDoc;
  bodyHtml: string | null;
  coverImageKey: string | null;
  coverImageAlt: string | null;
  tags: string[];
  status: BlogStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageKey: string | null;
  seoNoindex: boolean;
  readingTimeMinutes: number | null;
  wordCount: number | null;
  seriesId: string | null;
  seriesPosition: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostInput {
  title: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  body?: TiptapDoc;
  tags?: string[];
  coverImageKey?: string | null;
  coverImageAlt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageKey?: string | null;
  seoNoindex?: boolean;
  seriesId?: string | null;
}

export interface UploadedMedia {
  key: string;
  publicUrl: string;
}

export type UploadKind = 'cover' | 'inline';

export interface PostAuthor { name: string; initials: string }
export interface AdjacentRef { slug: string; title: string }

export interface BlogSeries {
  seriesId: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SeriesWithCount extends BlogSeries { postCount: number }
export interface SeriesInput { title: string; slug?: string; description?: string | null; coverImageKey?: string | null }

/** Within-series navigation surfaced on a post page. */
export interface SeriesNav {
  series: { title: string; slug: string };
  items: { slug: string; title: string; current: boolean }[];
  prev: AdjacentRef | null;
  next: AdjacentRef | null;
}

/** A post that references the current one (the public "Referenced by" panel). */
export interface Backlink { slug: string; title: string; excerpt: string | null }

/** The public single-post response: the post plus reading-experience extras. */
export interface PostView {
  post: BlogPost;
  author: PostAuthor | null;
  prev: AdjacentRef | null;
  next: AdjacentRef | null;
  related: BlogPost[];
  series: SeriesNav | null;
  backlinks: Backlink[];
}

/** A post the editor can link to (the "Link to a post" picker). */
export interface PostSearchHit { postId: string; title: string; slug: string; status: BlogStatus; excerpt: string | null; coverImageKey: string | null }

/** A public series summary for the blog-index grouping. */
export interface PublicSeriesSummary {
  seriesId: string; title: string; slug: string; description: string | null;
  coverImageKey: string | null; postCount: number;
}

export interface PublicComment {
  commentId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PendingComment extends PublicComment {
  authorEmail: string | null;
  status: string;
  postTitle: string | null;
  postSlug: string | null;
}

export interface SubmitCommentInput {
  postId: string;
  authorName: string;
  authorEmail?: string;
  body: string;
}
