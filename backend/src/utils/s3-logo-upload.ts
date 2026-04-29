import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

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

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadLogoResult {
  url: string;
  key: string;
}

/**
 * Uploads a logo buffer to S3 and returns the public URL.
 * Stored at: tenants/{tenantId}/logo/{uuid}{ext}
 */
export async function uploadTenantLogo(
  tenantId: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
): Promise<UploadLogoResult> {
  if (!BUCKET) {
    throw new Error('S3_LOGO_BUCKET environment variable is not configured');
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`File type "${mimeType}" is not allowed. Use PNG, JPG, GIF, WebP, or SVG.`);
  }

  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error(`File size exceeds the 5 MB limit`);
  }

  const ext = extname(originalFilename) || mimeTypeToExt(mimeType);
  const key = `tenants/${tenantId}/logo/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000',
    }),
  );

  const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  return { url, key };
}

function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };
  return map[mimeType] ?? '.bin';
}
