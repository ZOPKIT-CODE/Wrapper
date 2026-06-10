import { useRef } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Heading2, Heading3,
  List, ListOrdered, Quote, Code2, Minus, Link2, Image as ImageIcon, Undo2, Redo2,
  Table as TableIcon, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import LinkPostDialog from './LinkPostDialog';
import type { UploadKind } from '../types/blog';

interface Props {
  editor: Editor;
  uploadImage: (file: File, kind: UploadKind) => Promise<{ publicUrl: string }>;
  currentPostId?: string;
}

function Btn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // onMouseDown + preventDefault keeps the editor selection/focus intact so
      // the command applies to the caret and the next keystroke isn't dropped
      // (fixes the "first character after a toolbar click vanishes" race).
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors',
        'hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent',
        active && 'bg-gray-900 text-white hover:bg-gray-900',
      )}
    >
      {children}
    </button>
  );
}

export default function EditorToolbar({ editor, uploadImage, currentPostId }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  // Read active/disabled state reactively. With shouldRerenderOnTransaction:false
  // (v3 default) reading editor.isActive() directly in render goes stale and the
  // buttons never reflect the cursor's formatting; useEditorState re-renders only
  // when the selected slice changes.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'), code: e.isActive('code'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'), callout: e.isActive('callout'), link: e.isActive('link'),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });

  const addLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { publicUrl } = await uploadImage(file, 'inline');
    editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white/95 px-1 py-1 backdrop-blur">
      <Btn title="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn title="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn title="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></Btn>
      <Btn title="Inline code" active={s.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <Btn title="Heading 2" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn title="Heading 3" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <Btn title="Bullet list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn title="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn title="Quote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></Btn>
      <Btn title="Code block" active={s.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={16} /></Btn>
      <Btn title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></Btn>
      <Btn title="Callout" active={s.callout} onClick={() => editor.chain().focus().toggleWrap('callout', { type: 'info' }).run()}><Info size={16} /></Btn>
      <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <Btn title="Link" active={s.link} onClick={addLink}><Link2 size={16} /></Btn>
      <LinkPostDialog editor={editor} currentPostId={currentPostId} />
      <Btn title="Insert image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <Btn title="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></Btn>
      <Btn title="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></Btn>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickImage} />
    </div>
  );
}
