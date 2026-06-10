import { useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import type { Content } from '@tiptap/core';
import { blogEditorExtensions } from '../tiptap-extensions';
import EditorToolbar from './EditorToolbar';
import BubbleToolbar from './BubbleToolbar';
import InsertMenu from './InsertMenu';
import TableControls from './TableControls';
import type { TiptapDoc, UploadKind } from '../types/blog';
import './blog-editor.css';

const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

interface Props {
  value?: TiptapDoc;
  onChange: (doc: TiptapDoc) => void;
  uploadImage: (file: File, kind: UploadKind) => Promise<{ publicUrl: string; key: string }>;
  onStats?: (stats: { words: number; minutes: number }) => void;
  /** The post being edited, excluded from the "link to a post" picker. */
  currentPostId?: string;
}

/**
 * Notion/Medium-style rich text editor: fixed toolbar + selection bubble menu +
 * "+" insert menu + drag/paste image upload + code-block syntax highlighting.
 * Mount with a stable `key` (the post id) so switching posts re-creates it.
 */
export function TiptapEditor({ value, onChange, uploadImage, onStats, currentPostId }: Props) {
  const editorRef = useRef<Editor | null>(null);

  const emitStats = (ed: Editor) => {
    if (!onStats) return;
    const words = ed.getText().trim().split(/\s+/).filter(Boolean).length;
    // Match the backend formula (blog-render.ts computeReadingTimeMinutes) so the
    // editor and the public page never disagree on read-time.
    onStats({ words, minutes: Math.max(1, Math.round(words / 200)) });
  };

  const insertImageFiles = (files: File[]) => {
    files.filter((f) => f.type.startsWith('image/')).forEach(async (file) => {
      try {
        const { publicUrl } = await uploadImage(file, 'inline');
        editorRef.current?.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
      } catch { /* toast handled in uploader */ }
    });
  };

  const editor = useEditor({
    extensions: blogEditorExtensions,
    content: (value ?? EMPTY_DOC) as Content,
    onCreate: ({ editor }) => emitStats(editor),
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as TiptapDoc);
      emitStats(editor);
    },
    editorProps: {
      attributes: { class: 'blog-prose min-h-[420px] max-w-none px-1 py-6' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        insertImageFiles(files);
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        insertImageFiles(files);
        return true;
      },
    },
  });
  editorRef.current = editor;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {editor && <EditorToolbar editor={editor} uploadImage={uploadImage} currentPostId={currentPostId} />}
      {editor && <TableControls editor={editor} />}
      {editor && (
        <>
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: e, from, to }) =>
              from !== to && !e.isActive('image') && !e.isActive('codeBlock')}
          >
            <BubbleToolbar editor={editor} />
          </BubbleMenu>
          <FloatingMenu editor={editor} options={{ placement: 'left-start' }}>
            <InsertMenu editor={editor} uploadImage={uploadImage} />
          </FloatingMenu>
        </>
      )}
      <div className="px-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
