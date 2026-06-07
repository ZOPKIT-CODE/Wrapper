import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mediaUrl } from '../api/blog';
import type { UploadKind } from '../types/blog';

interface Props {
  coverImageKey: string | null;
  uploadImage: (file: File, kind: UploadKind) => Promise<{ key: string; publicUrl: string }>;
  onChange: (key: string | null) => void;
}

export default function CoverImageUploader({ coverImageKey, uploadImage, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { key } = await uploadImage(file, 'cover');
      onChange(key);
    } catch {
      /* toast handled in uploader */
    } finally {
      setUploading(false);
    }
  };

  if (coverImageKey) {
    return (
      <div className="group relative overflow-hidden rounded-lg border border-gray-200">
        <img src={mediaUrl(coverImageKey)} alt="Cover" className="h-56 w-full object-cover" />
        <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
            Replace
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => onChange(null)}>
            <X size={14} />
          </Button>
        </div>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => fileInput.current?.click()}
      disabled={uploading}
      className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
    >
      {uploading ? <Loader2 className="animate-spin" size={22} /> : <ImagePlus size={22} />}
      <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Add a cover image'}</span>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />
    </button>
  );
}
