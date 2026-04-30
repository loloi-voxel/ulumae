import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { MediaKind } from '@/types/media';

const R2_MEDIA_KINDS: MediaKind[] = ['voice_recording', 'video'];

let r2Client: S3Client | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getR2BucketName() {
  return getRequiredEnv('R2_BUCKET_NAME');
}

export function getSiteBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!configured) return '';
  return configured.replace(/\/+$/, '');
}

export function buildManagedR2MediaUrl(assetId: string) {
  const baseUrl = getSiteBaseUrl();
  const path = `/api/media/object/${assetId}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

function getR2Client() {
  if (r2Client) return r2Client;

  r2Client = new S3Client({
    region: 'auto',
    endpoint: getRequiredEnv('R2_ENDPOINT_URL'),
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });

  return r2Client;
}

export function shouldUseR2Storage(
  kind: MediaKind,
  memorialMode?: string | null
) {
  return (
    R2_MEDIA_KINDS.includes(kind) &&
    (memorialMode === 'personal' || memorialMode === 'family')
  );
}

export async function uploadBufferToR2({
  key,
  body,
  contentType,
  metadata,
}: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}) {
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  });

  await getR2Client().send(command);
}

export async function deleteR2Object(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
  });

  await getR2Client().send(command);
}

export async function downloadR2Object({
  key,
  range,
}: {
  key: string;
  range?: string | null;
}) {
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    Range: range || undefined,
  });

  const response = await getR2Client().send(command);
  const bytes = response.Body && 'transformToByteArray' in response.Body
    ? await response.Body.transformToByteArray()
    : new Uint8Array();

  return {
    bytes,
    contentLength: response.ContentLength ?? bytes.byteLength,
    contentType: response.ContentType || 'application/octet-stream',
    contentRange: response.ContentRange || null,
    eTag: response.ETag || null,
    lastModified: response.LastModified?.toUTCString() || null,
  };
}
