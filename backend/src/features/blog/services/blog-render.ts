import { renderToHTMLString } from '@tiptap/static-renderer';
import type { JSONContent } from '@tiptap/core';
import sanitizeHtml from 'sanitize-html';
import { blogExtensions } from '../tiptap-schema.js';

/**
 * Sanitization allow-list. This is the SOLE XSS boundary for the public blog:
 * the blog is fully public (untrusted authors), the stored JSON is rendered to
 * HTML, and that HTML is rendered client-side via dangerouslySetInnerHTML. SVG /
 * script / style / iframe are dropped by omission; link/img schemes restricted.
 */
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'strong', 'b', 'em', 'i', 's', 'del', 'br', 'hr', 'a', 'img',
    // span needed for lowlight syntax-highlight tokens (<span class="hljs-*">)
    'span',
    // tables (resizable disabled → no colgroup/col/style markup)
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // callout / admonition block (<div data-callout="type" class="callout …">)
    'div',
  ],
  allowedAttributes: {
    // data-post-id marks an internal article reference (resolved server-side).
    // class + data-link-card support the LinkCard preview (<a class="blog-card"
    // data-link-card>…); class is presentational only (no script vector).
    a: ['href', 'title', 'target', 'rel', 'data-post-id', 'class', 'data-link-card'],
    img: ['src', 'alt', 'title', 'width', 'height', 'class'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    // class is presentational only (no script vector); data-callout drives styling
    div: ['class', 'data-callout'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // Internal references (server-resolved to a relative /blog/<slug> href) stay
    // same-tab and followed; everything else is an untrusted external link (new
    // tab + nofollow). The "internal" test keys off the RELATIVE href the
    // renderer produced — never off data-post-id presence — so an author cannot
    // opt a hostile href into the followed branch. allowedSchemes still strips
    // javascript:/data: in either branch.
    a: (_tagName: string, attribs: Record<string, string>) => {
      const href = attribs.href ?? '';
      if (href.startsWith('/blog/')) {
        const { target: _t, rel: _r, ...rest } = attribs;
        return { tagName: 'a', attribs: rest };
      }
      return { tagName: 'a', attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' } };
    },
  },
};

/** Resolves internal post-reference ids → their current slug + whether public. */
export type RefResolver = (postIds: string[]) => Promise<Map<string, { slug: string; live: boolean }>>;

/** Collect the distinct postIds carried by internal link marks OR internal
 *  linkCard nodes in a Tiptap doc. */
export function collectLinkPostIds(body: unknown): string[] {
  const ids = new Set<string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: string;
      attrs?: { variant?: unknown; postId?: unknown };
      marks?: { type?: string; attrs?: { postId?: unknown } }[];
      content?: unknown[];
    };
    if (Array.isArray(n.marks)) {
      for (const m of n.marks) if (m?.type === 'link' && m.attrs?.postId) ids.add(String(m.attrs.postId));
    }
    if (n.type === 'linkCard' && n.attrs?.variant === 'internal' && n.attrs?.postId) {
      ids.add(String(n.attrs.postId));
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(body);
  return [...ids];
}

/**
 * Rewrite internal link marks: a reference to a LIVE post gets its href set to
 * the post's CURRENT slug; a reference to a missing/unpublished/deleted post has
 * the link mark dropped (renders as plain text — never a broken public link).
 */
function applyResolvedRefs(body: JSONContent, map: Map<string, { slug: string; live: boolean }>): JSONContent {
  const clone = structuredClone(body) as JSONContent;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: string;
      attrs?: { variant?: unknown; postId?: unknown; href?: string };
      marks?: { type?: string; attrs?: { postId?: unknown; href?: string } }[];
      content?: unknown[];
    };
    if (Array.isArray(n.marks)) {
      n.marks = n.marks.filter((m) => {
        if (m?.type === 'link' && m.attrs?.postId) {
          const entry = map.get(String(m.attrs.postId));
          if (entry && entry.live) { m.attrs.href = `/blog/${entry.slug}`; return true; }
          return false; // dangling / unpublished → drop the mark
        }
        return true;
      });
    }
    // Internal link cards: set the href to the live slug, or blank it so the node
    // renders nothing (renderHTML returns an empty span for internal + no href).
    if (n.type === 'linkCard' && n.attrs?.variant === 'internal' && n.attrs?.postId) {
      const entry = map.get(String(n.attrs.postId));
      n.attrs.href = entry && entry.live ? `/blog/${entry.slug}` : '';
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(clone);
  return clone;
}

/**
 * Render stored Tiptap JSON to sanitized HTML (the public article body).
 * If the doc carries internal references and a resolver is supplied, references
 * are resolved to current slugs first (dangling ones degrade to plain text).
 */
export async function renderBodyHtml(body: unknown, resolve?: RefResolver): Promise<string> {
  if (!body || typeof body !== 'object') return '';
  let doc = body as JSONContent;
  const ids = collectLinkPostIds(doc);
  if (ids.length) {
    const map = resolve ? await resolve(ids) : new Map<string, { slug: string; live: boolean }>();
    doc = applyResolvedRefs(doc, map);
  }
  const raw = renderToHTMLString({ content: doc, extensions: blogExtensions });
  return sanitizeHtml(raw, SANITIZE_OPTS);
}

/** Walk a Tiptap doc collecting text nodes — used for reading time / word count. */
export function extractPlainText(body: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === 'string') out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(body);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function computeWordCount(body: unknown): number {
  const text = extractPlainText(body);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function computeReadingTimeMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200)); // ~200 wpm
}

/** Build the public URL for an S3 media key (served by the backend media proxy). */
export function buildMediaUrl(key: string | null | undefined, origin: string): string {
  if (!key) return '';
  const base = origin.replace(/\/+$/, '');
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${base}/api/blog/media/${path}`;
}
