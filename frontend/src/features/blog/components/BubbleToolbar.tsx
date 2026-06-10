import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Bold, Italic, Link2, Heading2, Heading3, Quote, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Medium-style selection toolbar. Rendered inside <BubbleMenu>. Active states
 * are read via useEditorState because v3 sets shouldRerenderOnTransaction:false
 * (without it the buttons would never highlight).
 */
export default function BubbleToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      quote: e.isActive('blockquote'),
    }),
  });

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const Btn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded text-gray-200 transition-colors hover:text-white',
        active && 'text-emerald-400',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-gray-900 px-1.5 py-1 shadow-xl">
      <Btn title="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn title="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn title="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} /></Btn>
      <Btn title="Link" active={state.link} onClick={setLink}><Link2 size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-gray-700" />
      <Btn title="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn title="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <Btn title="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></Btn>
    </div>
  );
}
