import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { buildMediaUrl } from './blog-render.js';

// Reuse the existing wrapper logos bucket (see utils/s3-logo-upload.ts and the
// IRSA grant in deploy/terraform/iam_irsa.tf). Blog media lives under a distinct
// `blog/` prefix so it never collides with logos and the media proxy can safely
// allow-list only that prefix when serving.
const BUCKET = process.env.S3_LOGO_BUCKET ?? '';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

const s3 = new S3Client({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

// SVG deliberately excluded (XSS). This is the upload security boundary.
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
const MAX_BYTES = 10 * 1024 * 1024;

export type UploadKind = 'cover' | 'inline';

export interface UploadedMedia {
  key: string;
  publicUrl: string;
}

/**
 * Upload an image buffer to S3 server-side (proxy pattern — mirrors
 * utils/s3-logo-upload.ts). Avoids browser→S3 CORS entirely and lets the server
 * validate the real bytes. The client never chooses the key.
 */
export async function uploadBlogImageBuffer(opts: {
  buffer: Buffer;
  contentType: string;
  filename?: string;
  kind: UploadKind;
  origin: string;
}): Promise<UploadedMedia> {
  if (!BUCKET) throw new Error('S3_LOGO_BUCKET environment variable is not configured');

  const ext = ALLOWED_MIME[opts.contentType];
  if (!ext) {
    throw new Error(`Unsupported image type "${opts.contentType}". Use JPG, PNG, WebP, AVIF or GIF.`);
  }
  if (opts.buffer.length > MAX_BYTES) {
    throw new Error('Image exceeds the 10 MB limit');
  }

  const fileExt = (extname(opts.filename ?? '').slice(1).toLowerCase().replace(/[^a-z0-9]/g, '')) || ext;
  const date = new Date().toISOString().slice(0, 10);
  const key = `blog/${opts.kind}/${date}/${randomUUID()}.${fileExt}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: opts.buffer,
    ContentType: opts.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, publicUrl: buildMediaUrl(key, opts.origin) };
}

// ── Public media serving (private bucket → backend proxy) ───────────────────

// Only blog media may be served publicly — never logos or other objects that
// share this bucket.
const BLOG_MEDIA_KEY = /^blog\/(cover|inline)\/[\w-]+\/[\w.-]+$/;

export function isServableBlogMediaKey(key: string): boolean {
  return BLOG_MEDIA_KEY.test(key);
}

export interface BlogMediaObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
}

/** Fetch a blog media object for the public streaming proxy. Returns null if missing. */
export async function getBlogMediaObject(key: string): Promise<BlogMediaObject | null> {
  if (!BUCKET) throw new Error('S3_LOGO_BUCKET environment variable is not configured');
  if (!isServableBlogMediaKey(key)) return null;
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!out.Body) return null;
    return {
      body: out.Body as Readable,
      contentType: out.ContentType,
      contentLength: out.ContentLength,
      cacheControl: out.CacheControl,
    };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    throw err;
  }
}
