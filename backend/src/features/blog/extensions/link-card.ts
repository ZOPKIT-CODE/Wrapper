import { Node, mergeAttributes } from '@tiptap/core';

/**
 * LinkCard — a rich link preview rendered as a block card (Medium-style "bookmark").
 * Two variants:
 *   • internal: references another blog post by `postId`. The href/title/description/
 *     image are RESOLVED server-side at render time from the live post (so the card
 *     follows slug changes and drops if the post is unpublished/deleted), exactly
 *     like internal Link references. Only `postId` is authored/stored.
 *   • external: a link to any URL. Its title/description/image/siteName are fetched
 *     once at insert time (backend OG endpoint) and STORED on the node, so the
 *     public reader renders without re-fetching.
 *
 * MUST be byte-identical to the frontend copy
 * (frontend/src/features/blog/extensions/link-card.ts) so the editor and the
 * server renderer agree on the schema (parity). The frontend additionally wraps
 * this with a React NodeView for the editing surface; that does not change the
 * schema (name/attrs/renderHTML), so parity holds.
 */
export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      // 'internal' (resolved from postId at render) | 'external' (stored OG data).
      variant: { default: 'external' },
      // Internal reference target — resolved server-side; the only stored field for internal cards.
      postId: { default: null },
      // Resolved/stored presentation fields (populated server-side for internal cards).
      href: { default: null },
      title: { default: null },
      description: { default: null },
      image: { default: null },
      siteName: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-link-card]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as Record<string, unknown>;
    const href = typeof a.href === 'string' ? a.href : '';
    const title = typeof a.title === 'string' ? a.title : '';
    const description = typeof a.description === 'string' ? a.description : '';
    const image = typeof a.image === 'string' ? a.image : '';
    const siteName = typeof a.siteName === 'string' ? a.siteName : '';
    const internal = a.variant === 'internal';

    // Internal references that did not resolve to a live post (href empty) render
    // nothing — never a broken public card. (The resolver drops dangling refs.)
    if (internal && !href) return ['span', {}, ''];

    const children: unknown[] = [];
    if (image) {
      children.push(['img', { class: 'blog-card-image', src: image, alt: '' }]);
    }
    const body: unknown[] = ['span', { class: 'blog-card-body' }, ['span', { class: 'blog-card-title' }, title || href]];
    if (description) body.push(['span', { class: 'blog-card-desc' }, description]);
    body.push(['span', { class: 'blog-card-site' }, siteName || hostOf(href)]);
    children.push(body);

    // The sanitizer/transformTags layer assigns rel/target based on the href
    // (internal /blog/* stays followed; external gets nofollow + _blank).
    return ['a', mergeAttributes({ 'data-link-card': internal ? 'internal' : 'external', class: 'blog-card', href }), ...children];
  },
});

function hostOf(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}
