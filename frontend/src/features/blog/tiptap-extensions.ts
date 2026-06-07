import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { createLowlight, common } from 'lowlight';
import { Callout } from './extensions/callout';

const lowlight = createLowlight(common);

/**
 * Editor extension list. The content-bearing extensions (StarterKit, Link,
 * Image) MUST match the backend renderer (backend tiptap-schema.ts) so the
 * server-rendered public HTML matches the WYSIWYG view. Placeholder is
 * editor-only (no nodes/marks) and intentionally absent on the backend.
 *
 * Keep the @tiptap/* versions in lock-step with the backend.
 */
export const blogEditorExtensions = [
  // codeBlock disabled — replaced by CodeBlockLowlight (same node name). MUST
  // match backend tiptap-schema.ts exactly (schema parity).
  StarterKit.configure({ codeBlock: false }),
  // Link extended with a `postId` attribute for internal article-to-article
  // references (carried as data-post-id). Adding only a mark ATTRIBUTE keeps the
  // node/mark set — and the parity test — unchanged, but this Link.extend(...)
  // block MUST stay byte-identical to the backend copy (tiptap-schema.ts).
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
  // Tables — resizable disabled so editor output matches the backend renderer
  // (no colgroup/colwidth). MUST match backend tiptap-schema.ts (schema parity).
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  // Callout / admonition block (custom node, shared verbatim with the backend).
  Callout,
  Placeholder.configure({ placeholder: 'Tell your story…' }),
];
