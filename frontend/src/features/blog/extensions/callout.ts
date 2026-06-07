import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Callout / admonition block: a <div data-callout="type"> wrapping block content.
 * MUST be byte-identical to the backend copy
 * (backend/src/features/blog/extensions/callout.ts) so the editor and the
 * server renderer produce the same HTML (schema parity).
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-callout') || 'info',
        renderHTML: (attrs) => ({ 'data-callout': attrs.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = (HTMLAttributes['data-callout'] as string) || 'info';
    return ['div', mergeAttributes(HTMLAttributes, { class: `callout callout-${type}` }), 0];
  },
});
