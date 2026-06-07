import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { createLowlight, common } from 'lowlight';
import type { Extensions } from '@tiptap/core';
import { Callout } from './extensions/callout.js';

const lowlight = createLowlight(common);

/**
 * Canonical Tiptap extension list for the blog.
 *
 * MUST stay in lock-step with the frontend editor's extension list
 * (frontend/src/features/blog/tiptap-extensions.ts). The server renders stored
 * ProseMirror JSON to HTML with exactly these extensions, so any node/mark the
 * editor can produce must be representable here or the public HTML diverges
 * from the WYSIWYG view. A schema-parity test asserts the resulting node/mark
 * set matches the expected list.
 *
 * Editor-only UX extensions (Placeholder, FileHandler) are intentionally
 * excluded: they add no nodes/marks and do not affect rendered output.
 */
export const blogExtensions: Extensions = [
  // codeBlock disabled here — CodeBlockLowlight (syntax highlighting) replaces it
  // under the SAME node name ('codeBlock'), so schema parity is preserved.
  StarterKit.configure({ codeBlock: false }),
  // Link extended with a `postId` attribute for internal article-to-article
  // references (carried as data-post-id). Adding only a mark ATTRIBUTE keeps the
  // node/mark set — and the parity test — unchanged, but this Link.extend(...)
  // block MUST stay byte-identical to the frontend copy (tiptap-extensions.ts).
  Link.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        postId: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-post-id'),
          renderHTML: (attrs) => (attrs.postId ? { 'data-post-id': attrs.postId } : {}),
        },
      };
    },
  }).configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
  }),
  Image.configure({ inline: false, allowBase64: false }),
  CodeBlockLowlight.configure({ lowlight }),
  // Tables — resizable disabled so no colgroup/colwidth markup is emitted
  // (keeps the sanitizer allow-list small: table/thead/tbody/tr/th/td + col/rowspan).
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  // Callout / admonition block (custom node, shared verbatim with the frontend).
  Callout,
];

/**
 * The node + mark names these extensions contribute. Frontend and backend must
 * agree on this set; the parity test compares the live schema against it.
 */
export const EXPECTED_BLOG_NODES = [
  'doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem',
  'blockquote', 'codeBlock', 'horizontalRule', 'hardBreak', 'image',
  'table', 'tableRow', 'tableHeader', 'tableCell', 'callout',
] as const;

export const EXPECTED_BLOG_MARKS = [
  'bold', 'italic', 'strike', 'code', 'link',
] as const;
