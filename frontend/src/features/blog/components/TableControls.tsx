import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  BetweenHorizontalStart, BetweenVerticalStart,
  Heading, Trash2, Combine, Split,
} from 'lucide-react';

/**
 * Contextual table controls. Renders only when the caret is inside a table
 * (Phase 3). Visibility is driven by useEditorState so it appears/disappears on
 * selection change — v3 sets shouldRerenderOnTransaction:false, so reading
 * editor.isActive inline in a static toolbar would go stale.
 *
 * The Table extension provides the commands (insertTable, addRow/Column*,
 * deleteRow/Column, mergeCells, splitCell, toggleHeaderRow, deleteTable).
 */
export default function TableControls({ editor }: { editor: Editor }) {
  const inTable = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive('table'),
  });

  if (!inTable) return null;

  const Btn = ({ onClick, title, danger, children }: {
    onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={[
        'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Table</span>
      <Btn title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <BetweenVerticalStart size={14} /> Col
      </Btn>
      <Btn title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <BetweenHorizontalStart size={14} /> Row
      </Btn>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <Btn title="Merge cells" onClick={() => editor.chain().focus().mergeCells().run()}>
        <Combine size={14} />
      </Btn>
      <Btn title="Split cell" onClick={() => editor.chain().focus().splitCell().run()}>
        <Split size={14} />
      </Btn>
      <Btn title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
        <Heading size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <Btn title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>− Col</Btn>
      <Btn title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>− Row</Btn>
      <Btn title="Delete table" danger onClick={() => editor.chain().focus().deleteTable().run()}>
        <Trash2 size={14} /> Table
      </Btn>
    </div>
  );
}
