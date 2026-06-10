import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Plus, Image as ImageIcon, Heading2, Quote, Code2, Minus, Table as TableIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadKind } from '../types/blog';

/**
 * Medium-style "+" insert menu, rendered inside <FloatingMenu> (auto-appears on
 * empty lines). Click "+" to reveal block-insert options. Adds no nodes itself —
 * just runs commands for nodes the schema already defines (so no parity impact).
 */
export default function InsertMenu({
  editor, uploadImage,
}: {
  editor: Editor;
  uploadImage: (file: File, kind: UploadKind) => Promise<{ publicUrl: string }>;
}) {
  const [open, setOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { publicUrl } = await uploadImage(file, 'inline');
      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
    } catch { /* toast handled in uploader */ }
    setOpen(false);
  };

  const Item = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900"
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title="Insert"
        aria-label="Insert block"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-transform hover:text-gray-900"
      >
        <Plus size={18} className={cn('transition-transform', open && 'rotate-45')} />
      </button>
      {open && (
        <div className="flex items-center gap-1">
          <Item title="Image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></Item>
          <Item title="Heading" onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setOpen(false); }}><Heading2 size={16} /></Item>
          <Item title="Quote" onClick={() => { editor.chain().focus().toggleBlockquote().run(); setOpen(false); }}><Quote size={16} /></Item>
          <Item title="Code block" onClick={() => { editor.chain().focus().toggleCodeBlock().run(); setOpen(false); }}><Code2 size={16} /></Item>
          <Item title="Table" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setOpen(false); }}><TableIcon size={16} /></Item>
          <Item title="Callout" onClick={() => { editor.chain().focus().toggleWrap('callout', { type: 'info' }).run(); setOpen(false); }}><Info size={16} /></Item>
          <Item title="Divider" onClick={() => { editor.chain().focus().setHorizontalRule().run(); setOpen(false); }}><Minus size={16} /></Item>
        </div>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPick} />
    </div>
  );
}
