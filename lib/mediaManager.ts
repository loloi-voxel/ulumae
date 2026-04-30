import crypto from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildManagedR2MediaUrl,
  deleteR2Object,
  shouldUseR2Storage,
  uploadBufferToR2,
} from '@/lib/r2Storage';
import type {
  ChildhoodPhotoReference,
  InteractiveMediaReference,
  MediaImageReference,
  MemorialData,
  VideoReference,
  VoiceRecordingReference,
} from '@/types/memorial';
import type {
  MediaBucket,
  MediaKind,
  StoredMediaAsset,
} from '@/types/media';

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const MEDIA_KIND_CONFIG: Record<
  MediaKind,
  {
    bucket: MediaBucket;
    folder: string;
    maxBytes: number;
    mimePrefixes: string[];
    permission: 'edit_archive' | 'contribute_content';
  }
> = {
  profile_photo: {
    bucket: 'memorial-media',
    folder: 'profile',
    maxBytes: IMAGE_MAX_BYTES,
    mimePrefixes: ['image/'],
    permission: 'edit_archive',
  },
  cover_photo: {
    bucket: 'memorial-media',
    folder: 'covers',
    maxBytes: IMAGE_MAX_BYTES,
    mimePrefixes: ['image/'],
    permission: 'edit_archive',
  },
  gallery_photo: {
    bucket: 'memorial-media',
    folder: 'gallery',
    maxBytes: IMAGE_MAX_BYTES,
    mimePrefixes: ['image/'],
    permission: 'edit_archive',
  },
  interactive_photo: {
    bucket: 'memorial-media',
    folder: 'interactive',
    maxBytes: IMAGE_MAX_BYTES,
    mimePrefixes: ['image/'],
    permission: 'edit_archive',
  },
  voice_recording: {
    bucket: 'memorial-media',
    folder: 'voice',
    maxBytes: AUDIO_MAX_BYTES,
    mimePrefixes: ['audio/'],
    permission: 'edit_archive',
  },
  video: {
    bucket: 'videos',
    folder: 'videos',
    maxBytes: VIDEO_MAX_BYTES,
    mimePrefixes: ['video/'],
    permission: 'edit_archive',
  },
  video_thumbnail: {
    bucket: 'memorial-media',
    folder: 'video-thumbnails',
    maxBytes: IMAGE_MAX_BYTES,
    mimePrefixes: ['image/'],
    permission: 'edit_archive',
  },
  contribution_photo: {
    bucket: 'memorial-media',
    folder: 'contributions',
    maxBytes: IMAGE_MAX_BYTES,
    mimePrefixes: ['image/'],
    permission: 'contribute_content',
  },
};

type MediaAssetRow = {
  id: string;
  memorial_id: string;
  contribution_id: string | null;
  kind: MediaKind;
  bucket: MediaBucket;
  storage_path: string;
  public_url: string;
  original_file_name: string | null;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  metadata: Record<string, unknown> | null;
  arweave_url: string | null;
  sealed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

interface UploadMediaAssetInput {
  admin: SupabaseClient;
  memorialId: string;
  createdBy: string;
  kind: MediaKind;
  file: File;
  metadata?: Record<string, unknown>;
  contributionId?: string | null;
}

interface UploadBufferInput {
  admin: SupabaseClient;
  memorialId: string;
  createdBy: string;
  kind: MediaKind;
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
  metadata?: Record<string, unknown>;
  contributionId?: string | null;
}

interface SyncMediaOptions {
  admin: SupabaseClient;
  memorialId: string;
  userId: string;
  data: MemorialData;
  preferAssetMetadata?: boolean;
}

interface ResolvedMediaAsset {
  asset: StoredMediaAsset | null;
  sourceUrl: string | null;
}

const MEDIA_SELECT =
  'id, memorial_id, contribution_id, kind, bucket, storage_path, public_url, original_file_name, mime_type, file_size, sha256_hash, metadata, arweave_url, sealed_at, created_by, created_at, updated_at, deleted_at, deleted_by';

function getKindConfig(kind: MediaKind) {
  return MEDIA_KIND_CONFIG[kind];
}

function getMediaPublicUrl(row: Pick<MediaAssetRow, 'id' | 'bucket' | 'public_url'>) {
  if (row.bucket === 'r2') {
    return buildManagedR2MediaUrl(row.id);
  }

  return row.public_url;
}

function serializeMediaAsset(row: MediaAssetRow): StoredMediaAsset {
  return {
    id: row.id,
    memorialId: row.memorial_id,
    contributionId: row.contribution_id,
    kind: row.kind,
    bucket: row.bucket,
    storagePath: row.storage_path,
    publicUrl: getMediaPublicUrl(row),
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    sha256Hash: row.sha256_hash,
    metadata: row.metadata || {},
    arweaveUrl: row.arweave_url,
    sealedAt: row.sealed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  };
}

function sanitizeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'asset';
}

function extensionFromMimeType(mimeType: string) {
  const [, extension] = mimeType.split('/');
  if (!extension) return 'bin';
  return extension.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'bin';
}

function buildStoragePath(
  memorialId: string,
  folder: string,
  originalFileName: string
) {
  const safeName = sanitizeFileName(originalFileName);
  const ext =
    safeName.includes('.') && safeName.split('.').pop()
      ? safeName.split('.').pop()!
      : extensionFromMimeType('application/octet-stream');

  return `${memorialId}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

async function getMemorialMode(
  admin: SupabaseClient,
  memorialId: string
) {
  const { data, error } = await admin
    .from('memorials')
    .select('mode')
    .eq('id', memorialId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not determine the memorial plan.');
  }

  return typeof data.mode === 'string' ? data.mode : null;
}

async function resolveStorageConfig(
  admin: SupabaseClient,
  memorialId: string,
  kind: MediaKind
) {
  const config = getKindConfig(kind);

  if (!shouldUseR2Storage(kind, await getMemorialMode(admin, memorialId))) {
    return config;
  }

  return {
    ...config,
    bucket: 'r2' as MediaBucket,
  };
}

function ensureMimeAndSize(
  kind: MediaKind,
  config: ReturnType<typeof getKindConfig>,
  mimeType: string,
  byteLength: number
) {
  const matchesMime = config.mimePrefixes.some((prefix) =>
    mimeType.toLowerCase().startsWith(prefix)
  );

  if (!matchesMime) {
    throw new Error(`Unsupported media type for ${kind}.`);
  }

  if (byteLength <= 0) {
    throw new Error('Cannot upload an empty file.');
  }

  if (byteLength > config.maxBytes) {
    throw new Error(`File exceeds the ${Math.round(config.maxBytes / 1024 / 1024)}MB limit.`);
  }
}

async function uploadBufferAsMediaAsset({
  admin,
  memorialId,
  createdBy,
  kind,
  buffer,
  mimeType,
  originalFileName,
  metadata = {},
  contributionId = null,
}: UploadBufferInput): Promise<StoredMediaAsset> {
  const config = await resolveStorageConfig(admin, memorialId, kind);
  ensureMimeAndSize(kind, config, mimeType, buffer.byteLength);

  const assetId = crypto.randomUUID();
  const storagePath = buildStoragePath(memorialId, config.folder, originalFileName);
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const now = new Date().toISOString();

  if (config.bucket === 'r2') {
    await uploadBufferToR2({
      key: storagePath,
      body: buffer,
      contentType: mimeType,
      metadata: {
        'asset-id': assetId,
        'memorial-id': memorialId,
        kind,
      },
    });
  } else {
    const { error: uploadError } = await admin.storage
      .from(config.bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed.');
    }
  }

  const publicUrl =
    config.bucket === 'r2'
      ? buildManagedR2MediaUrl(assetId)
      : admin.storage.from(config.bucket).getPublicUrl(storagePath).data.publicUrl;

  const insertPayload = {
    id: assetId,
    memorial_id: memorialId,
    contribution_id: contributionId,
    kind,
    bucket: config.bucket,
    storage_path: storagePath,
    public_url: publicUrl,
    original_file_name: originalFileName,
    mime_type: mimeType,
    file_size: buffer.byteLength,
    sha256_hash: sha256Hash,
    metadata,
    created_by: createdBy,
    updated_at: now,
  };

  const { data, error } = await admin
    .from('memorial_media_assets')
    .insert(insertPayload)
    .select(MEDIA_SELECT)
    .single();

  if (error || !data) {
    if (config.bucket === 'r2') {
      await deleteR2Object(storagePath).catch(() => undefined);
    } else {
      await admin.storage.from(config.bucket).remove([storagePath]).catch(() => undefined);
    }
    throw new Error(error?.message || 'Could not register uploaded media.');
  }

  return serializeMediaAsset(data as MediaAssetRow);
}

export async function uploadMemorialMediaAsset({
  admin,
  memorialId,
  createdBy,
  kind,
  file,
  metadata = {},
  contributionId = null,
}: UploadMediaAssetInput): Promise<StoredMediaAsset> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return uploadBufferAsMediaAsset({
    admin,
    memorialId,
    createdBy,
    kind,
    buffer,
    mimeType: file.type,
    originalFileName: file.name,
    metadata,
    contributionId,
  });
}

export async function getMemorialMediaAssetsByIds(
  admin: SupabaseClient,
  memorialId: string,
  assetIds: string[]
) {
  if (assetIds.length === 0) return [];

  const { data, error } = await admin
    .from('memorial_media_assets')
    .select(MEDIA_SELECT)
    .eq('memorial_id', memorialId)
    .in('id', assetIds);

  if (error) {
    throw new Error(error.message || 'Could not load media assets.');
  }

  return (data || []).map((row) => serializeMediaAsset(row as MediaAssetRow));
}

export async function softDeleteMemorialMediaAssets(
  admin: SupabaseClient,
  memorialId: string,
  assetIds: string[],
  deletedBy: string
) {
  if (assetIds.length === 0) return [];

  const now = new Date().toISOString();
  const assets = await getMemorialMediaAssetsByIds(admin, memorialId, assetIds);
  if (assets.length === 0) return [];

  const { error } = await admin
    .from('memorial_media_assets')
    .update({
      deleted_at: now,
      deleted_by: deletedBy,
      updated_at: now,
    })
    .eq('memorial_id', memorialId)
    .in(
      'id',
      assets.map((asset) => asset.id)
    );

  if (error) {
    throw new Error(error.message || 'Could not delete media assets.');
  }

  return assets;
}

export async function restoreMemorialMediaAssets(
  admin: SupabaseClient,
  memorialId: string,
  assetIds: string[]
) {
  if (assetIds.length === 0) return [];

  const assets = await getMemorialMediaAssetsByIds(admin, memorialId, assetIds);
  if (assets.length === 0) return [];

  const { error } = await admin
    .from('memorial_media_assets')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('memorial_id', memorialId)
    .in(
      'id',
      assets.map((asset) => asset.id)
    );

  if (error) {
    throw new Error(error.message || 'Could not restore media assets.');
  }

  return assets;
}

export async function hardDeleteMemorialMediaAssets(
  admin: SupabaseClient,
  memorialId: string,
  assetIds: string[]
) {
  if (assetIds.length === 0) return [];

  const assets = await getMemorialMediaAssetsByIds(admin, memorialId, assetIds);
  if (assets.length === 0) return [];

  const removals = new Map<MediaBucket, string[]>();
  for (const asset of assets) {
    if (asset.bucket === 'r2') {
      await deleteR2Object(asset.storagePath);
      continue;
    }

    const list = removals.get(asset.bucket) || [];
    list.push(asset.storagePath);
    removals.set(asset.bucket, list);
  }

  for (const [bucket, paths] of removals.entries()) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) {
      throw new Error(error.message || 'Could not remove storage objects.');
    }
  }

  const { error } = await admin
    .from('memorial_media_assets')
    .delete()
    .eq('memorial_id', memorialId)
    .in(
      'id',
      assets.map((asset) => asset.id)
    );

  if (error) {
    throw new Error(error.message || 'Could not delete media rows.');
  }

  return assets;
}

export function collectMemorialMediaAssetIds(data: MemorialData) {
  const ids = new Set<string>();

  if (data.step1.profilePhotoAssetId) ids.add(data.step1.profilePhotoAssetId);
  if (data.step8.coverPhotoAssetId) ids.add(data.step8.coverPhotoAssetId);

  for (const item of data.step2.childhoodPhotos || []) {
    if (item.assetId) ids.add(item.assetId);
  }

  for (const item of data.step8.gallery || []) {
    if (item.assetId) ids.add(item.assetId);
  }

  for (const item of data.step8.interactiveGallery || []) {
    if (item.assetId) ids.add(item.assetId);
  }

  for (const item of data.step8.voiceRecordings || []) {
    if (item.assetId) ids.add(item.assetId);
  }

  for (const item of data.step9.videos || []) {
    if (item.assetId) ids.add(item.assetId);
    if (item.thumbnailAssetId) ids.add(item.thumbnailAssetId);
  }

  return ids;
}

export async function getActiveMemorialMediaAssets(
  admin: SupabaseClient,
  memorialId: string
) {
  const { data, error } = await admin
    .from('memorial_media_assets')
    .select(MEDIA_SELECT)
    .eq('memorial_id', memorialId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Could not load active media assets.');
  }

  return (data || []).map((row) => serializeMediaAsset(row as MediaAssetRow));
}

function getAssetMetadataString(
  asset: StoredMediaAsset,
  key: string
) {
  const value = asset.metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function getAssetMetadataNumber(
  asset: StoredMediaAsset,
  key: string
) {
  const value = asset.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getAssetSortValue(asset: StoredMediaAsset) {
  return getAssetMetadataNumber(asset, 'position') ?? Number.MAX_SAFE_INTEGER;
}

function sortAssetsByPositionThenCreatedAt(a: StoredMediaAsset, b: StoredMediaAsset) {
  const positionDiff = getAssetSortValue(a) - getAssetSortValue(b);
  if (positionDiff !== 0) return positionDiff;

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function stripExtension(fileName?: string | null) {
  if (!fileName) return '';
  return fileName.replace(/\.[^/.]+$/, '');
}

function buildSealReferenceFields(asset: StoredMediaAsset) {
  return {
    arweaveUrl: asset.arweaveUrl,
    sealedAt: asset.sealedAt,
  };
}

function buildChildhoodPhotoReference(
  asset: StoredMediaAsset
): ChildhoodPhotoReference {
  return {
    id: asset.id,
    preview: asset.publicUrl,
    caption: getAssetMetadataString(asset, 'caption'),
    year: getAssetMetadataString(asset, 'year'),
    assetId: asset.id,
    bucket: asset.bucket,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    uploadedAt: asset.createdAt,
    uploadStatus: 'ready',
    uploadError: null,
    sha256_hash: asset.sha256Hash,
    ...buildSealReferenceFields(asset),
  };
}

function buildGalleryPhotoReference(
  asset: StoredMediaAsset
): MediaImageReference {
  return {
    id: asset.id,
    preview: asset.publicUrl,
    caption: getAssetMetadataString(asset, 'caption'),
    year: getAssetMetadataString(asset, 'year'),
    type: 'photo',
    assetId: asset.id,
    bucket: asset.bucket,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    uploadedAt: asset.createdAt,
    uploadStatus: 'ready',
    uploadError: null,
    sha256_hash: asset.sha256Hash,
    ...buildSealReferenceFields(asset),
  };
}

function buildInteractiveMediaReference(
  asset: StoredMediaAsset
): InteractiveMediaReference {
  return {
    id: asset.id,
    preview: asset.publicUrl,
    description: getAssetMetadataString(asset, 'description'),
    assetId: asset.id,
    bucket: asset.bucket,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    uploadedAt: asset.createdAt,
    uploadStatus: 'ready',
    uploadError: null,
    sha256_hash: asset.sha256Hash,
    ...buildSealReferenceFields(asset),
  };
}

function buildVoiceRecordingReference(
  asset: StoredMediaAsset
): VoiceRecordingReference {
  return {
    id: asset.id,
    title: getAssetMetadataString(asset, 'title') || stripExtension(asset.originalFileName) || 'Voice recording',
    url: asset.publicUrl,
    assetId: asset.id,
    bucket: asset.bucket,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    uploadedAt: asset.createdAt,
    uploadStatus: 'ready',
    uploadError: null,
    sha256_hash: asset.sha256Hash,
    ...buildSealReferenceFields(asset),
  };
}

function buildVideoReference(
  asset: StoredMediaAsset,
  thumbnailAsset: StoredMediaAsset | null
): VideoReference {
  return {
    id: asset.id,
    url: asset.publicUrl,
    thumbnail: thumbnailAsset?.publicUrl || asset.publicUrl,
    title: getAssetMetadataString(asset, 'title'),
    description: getAssetMetadataString(asset, 'description'),
    duration: getAssetMetadataString(asset, 'duration'),
    assetId: asset.id,
    bucket: asset.bucket,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    uploadedAt: asset.createdAt,
    uploadStatus: 'ready',
    uploadError: null,
    sha256_hash: asset.sha256Hash,
    ...buildSealReferenceFields(asset),
    thumbnailAssetId: thumbnailAsset?.id || null,
    thumbnailBucket: thumbnailAsset?.bucket || null,
    thumbnailStoragePath: thumbnailAsset?.storagePath || null,
    thumbnailMimeType: thumbnailAsset?.mimeType || null,
    thumbnailFileSize: thumbnailAsset?.fileSize || null,
    thumbnailUploadedAt: thumbnailAsset?.createdAt || null,
  };
}

function parseSupabasePublicUrl(url: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedUrl = url.replace(/\/+$/, '');
  const publicPrefix = `${normalizedBase}/storage/v1/object/public/`;

  if (!normalizedUrl.startsWith(publicPrefix)) {
    return null;
  }

  const remainder = normalizedUrl.slice(publicPrefix.length);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex === -1) return null;

  const bucket = remainder.slice(0, slashIndex) as MediaBucket;
  const storagePath = remainder.slice(slashIndex + 1);

  return { bucket, storagePath };
}

function splitStoragePath(storagePath: string) {
  const segments = storagePath.split('/');
  const fileName = segments.pop() || '';
  return {
    directory: segments.join('/'),
    fileName,
  };
}

async function storageObjectExists(
  admin: SupabaseClient,
  bucket: MediaBucket,
  storagePath: string
) {
  const { directory, fileName } = splitStoragePath(storagePath);
  const { data, error } = await admin.storage.from(bucket).list(directory, {
    limit: 1,
    search: fileName,
  });

  if (error) {
    return false;
  }

  return (data || []).some((item) => item.name === fileName);
}

function dataUrlToBuffer(source: string) {
  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function findExistingAssetByStorageLocation(
  admin: SupabaseClient,
  memorialId: string,
  bucket: MediaBucket,
  storagePath: string
) {
  const { data, error } = await admin
    .from('memorial_media_assets')
    .select(MEDIA_SELECT)
    .eq('memorial_id', memorialId)
    .eq('bucket', bucket)
    .eq('storage_path', storagePath)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Could not look up media asset.');
  }

  return data ? serializeMediaAsset(data as MediaAssetRow) : null;
}

async function registerExistingStorageAsset({
  admin,
  memorialId,
  userId,
  kind,
  bucket,
  storagePath,
  metadata = {},
}: {
  admin: SupabaseClient;
  memorialId: string;
  userId: string;
  kind: MediaKind;
  bucket: MediaBucket;
  storagePath: string;
  metadata?: Record<string, unknown>;
}) {
  const existingAsset = await findExistingAssetByStorageLocation(
    admin,
    memorialId,
    bucket,
    storagePath
  );

  if (existingAsset) {
    if (existingAsset.deletedAt) {
      await restoreMemorialMediaAssets(admin, memorialId, [existingAsset.id]);
      existingAsset.deletedAt = null;
    }
    return existingAsset;
  }

  const exists = await storageObjectExists(admin, bucket, storagePath);
  if (!exists) {
    return null;
  }

  const { data, error } = await admin.storage.from(bucket).download(storagePath);
  if (error || !data) {
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType =
    data.type || (bucket === 'videos' ? 'video/mp4' : 'image/jpeg');
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(storagePath);

  const insertPayload = {
    memorial_id: memorialId,
    kind,
    bucket,
    storage_path: storagePath,
    public_url: publicUrlData.publicUrl,
    original_file_name: splitStoragePath(storagePath).fileName,
    mime_type: mimeType,
    file_size: buffer.byteLength,
    sha256_hash: sha256Hash,
    metadata,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await admin
    .from('memorial_media_assets')
    .insert(insertPayload)
    .select(MEDIA_SELECT)
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || 'Could not register legacy media.');
  }

  return serializeMediaAsset(inserted as MediaAssetRow);
}

async function resolveMediaAssetForSource({
  admin,
  memorialId,
  userId,
  kind,
  assetId,
  sourceUrl,
  metadata = {},
}: {
  admin: SupabaseClient;
  memorialId: string;
  userId: string;
  kind: MediaKind;
  assetId?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ResolvedMediaAsset> {
  if (assetId) {
    const assets = await getMemorialMediaAssetsByIds(admin, memorialId, [assetId]);
    const asset = assets[0] || null;
    if (asset) {
      if (asset.deletedAt) {
        await restoreMemorialMediaAssets(admin, memorialId, [asset.id]);
        asset.deletedAt = null;
      }
      return { asset, sourceUrl: asset.publicUrl };
    }
  }

  if (!sourceUrl) {
    return { asset: null, sourceUrl: null };
  }

  const parsedPublicUrl = parseSupabasePublicUrl(sourceUrl);
  if (parsedPublicUrl) {
    const asset = await registerExistingStorageAsset({
      admin,
      memorialId,
      userId,
      kind,
      bucket: parsedPublicUrl.bucket,
      storagePath: parsedPublicUrl.storagePath,
      metadata,
    });

    return {
      asset,
      sourceUrl: asset?.publicUrl || sourceUrl,
    };
  }

  const dataUrl = dataUrlToBuffer(sourceUrl);
  if (dataUrl) {
    const asset = await uploadBufferAsMediaAsset({
      admin,
      memorialId,
      createdBy: userId,
      kind,
      buffer: dataUrl.buffer,
      mimeType: dataUrl.mimeType,
      originalFileName: `${kind}.${extensionFromMimeType(dataUrl.mimeType)}`,
      metadata,
    });

    return { asset, sourceUrl: asset.publicUrl };
  }

  return { asset: null, sourceUrl };
}

async function updateAssetMetadata(
  admin: SupabaseClient,
  assetId: string,
  metadata: Record<string, unknown>
) {
  const { error } = await admin
    .from('memorial_media_assets')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId);

  if (error) {
    throw new Error(error.message || 'Could not update media metadata.');
  }
}

export async function mergeMemorialMediaAssetMetadata(
  admin: SupabaseClient,
  memorialId: string,
  assetId: string,
  metadataPatch: Record<string, unknown>
) {
  const assets = await getMemorialMediaAssetsByIds(admin, memorialId, [assetId]);
  const asset = assets[0] || null;

  if (!asset) {
    throw new Error('Media asset not found.');
  }

  const mergedMetadata = {
    ...(asset.metadata || {}),
    ...Object.fromEntries(
      Object.entries(metadataPatch).filter(([, value]) => value !== undefined)
    ),
  };

  await updateAssetMetadata(admin, assetId, mergedMetadata);

  return {
    ...asset,
    metadata: mergedMetadata,
  };
}

function stripTransientFileFields<T extends Record<string, any>>(value: T) {
  const next = { ...value };
  delete next.file;
  delete next.uploadStatus;
  delete next.uploadError;
  return next;
}

export async function normalizeMemorialMediaData({
  admin,
  memorialId,
  userId,
  data,
  preferAssetMetadata = false,
}: SyncMediaOptions): Promise<MemorialData> {
  const step1 = { ...data.step1 };
  const step2 = {
    ...data.step2,
    childhoodPhotos: [] as MemorialData['step2']['childhoodPhotos'],
  };
  const step8 = {
    ...data.step8,
    gallery: [] as MemorialData['step8']['gallery'],
    interactiveGallery: [] as MemorialData['step8']['interactiveGallery'],
    voiceRecordings: [] as MemorialData['step8']['voiceRecordings'],
  };
  const step9 = {
    ...data.step9,
    videos: [] as MemorialData['step9']['videos'],
  };

  const normalized: MemorialData = {
    ...data,
    step1,
    step2,
    step8,
    step9,
  };

  const profileAsset = await resolveMediaAssetForSource({
    admin,
    memorialId,
    userId,
    kind: 'profile_photo',
    assetId: step1.profilePhotoAssetId || null,
    sourceUrl: step1.profilePhotoPreview || null,
  });

  if (profileAsset.asset) {
    normalized.step1 = {
      ...step1,
      profilePhoto: null,
      profilePhotoPreview: profileAsset.sourceUrl,
      profilePhotoAssetId: profileAsset.asset.id,
      profilePhotoBucket: profileAsset.asset.bucket,
      profilePhotoStoragePath: profileAsset.asset.storagePath,
      profilePhotoMimeType: profileAsset.asset.mimeType,
      profilePhotoFileSize: profileAsset.asset.fileSize,
      profilePhotoUploadedAt: profileAsset.asset.createdAt,
      profilePhotoUploadStatus: 'ready',
      profilePhotoUploadError: null,
      profilePhotoHash: profileAsset.asset.sha256Hash,
      profilePhotoArweaveUrl: profileAsset.asset.arweaveUrl,
      profilePhotoSealedAt: profileAsset.asset.sealedAt,
    };
  } else if (!step1.profilePhotoPreview) {
    normalized.step1 = {
      ...step1,
      profilePhoto: null,
      profilePhotoPreview: null,
      profilePhotoAssetId: null,
      profilePhotoBucket: null,
      profilePhotoStoragePath: null,
      profilePhotoMimeType: null,
      profilePhotoFileSize: null,
      profilePhotoUploadedAt: null,
      profilePhotoUploadStatus: 'idle',
      profilePhotoUploadError: null,
      profilePhotoHash: undefined,
      profilePhotoArweaveUrl: null,
      profilePhotoSealedAt: null,
    };
  }

  const coverAsset = await resolveMediaAssetForSource({
    admin,
    memorialId,
    userId,
    kind: 'cover_photo',
    assetId: step8.coverPhotoAssetId || null,
    sourceUrl: step8.coverPhotoPreview || null,
  });

  if (coverAsset.asset) {
    normalized.step8.coverPhoto = null;
    normalized.step8.coverPhotoPreview = coverAsset.sourceUrl;
    normalized.step8.coverPhotoAssetId = coverAsset.asset.id;
    normalized.step8.coverPhotoBucket = coverAsset.asset.bucket;
    normalized.step8.coverPhotoStoragePath = coverAsset.asset.storagePath;
    normalized.step8.coverPhotoMimeType = coverAsset.asset.mimeType;
    normalized.step8.coverPhotoFileSize = coverAsset.asset.fileSize;
    normalized.step8.coverPhotoUploadedAt = coverAsset.asset.createdAt;
    normalized.step8.coverPhotoUploadStatus = 'ready';
    normalized.step8.coverPhotoUploadError = null;
    normalized.step8.coverPhotoHash = coverAsset.asset.sha256Hash;
    normalized.step8.coverPhotoArweaveUrl = coverAsset.asset.arweaveUrl;
    normalized.step8.coverPhotoSealedAt = coverAsset.asset.sealedAt;
  } else if (!step8.coverPhotoPreview) {
    normalized.step8.coverPhoto = null;
    normalized.step8.coverPhotoPreview = null;
    normalized.step8.coverPhotoAssetId = null;
    normalized.step8.coverPhotoBucket = null;
    normalized.step8.coverPhotoStoragePath = null;
    normalized.step8.coverPhotoMimeType = null;
    normalized.step8.coverPhotoFileSize = null;
    normalized.step8.coverPhotoUploadedAt = null;
    normalized.step8.coverPhotoUploadStatus = 'idle';
    normalized.step8.coverPhotoUploadError = null;
    normalized.step8.coverPhotoHash = undefined;
    normalized.step8.coverPhotoArweaveUrl = null;
    normalized.step8.coverPhotoSealedAt = null;
  }

  for (const [index, item] of (step2.childhoodPhotos || []).entries()) {
    const resolved = await resolveMediaAssetForSource({
      admin,
      memorialId,
      userId,
      kind: 'gallery_photo',
      assetId: item.assetId || null,
      sourceUrl: item.preview || null,
      metadata: {
        caption: item.caption || '',
        year: item.year || '',
        position: index,
        section: 'childhood_photos',
      },
    });

    if (!resolved.asset || !resolved.sourceUrl) {
      continue;
    }

    const resolvedCaption = preferAssetMetadata
      ? getAssetMetadataString(resolved.asset, 'caption')
      : item.caption || '';
    const resolvedYear = preferAssetMetadata
      ? getAssetMetadataString(resolved.asset, 'year')
      : item.year || '';

    if (!preferAssetMetadata) {
      await updateAssetMetadata(admin, resolved.asset.id, {
        caption: resolvedCaption,
        year: resolvedYear,
        position: index,
        section: 'childhood_photos',
      });
    }

    normalized.step2.childhoodPhotos.push({
      ...stripTransientFileFields(item),
      id: item.id || resolved.asset.id,
      preview: resolved.sourceUrl,
      caption: resolvedCaption,
      year: resolvedYear,
      assetId: resolved.asset.id,
      bucket: resolved.asset.bucket,
      storagePath: resolved.asset.storagePath,
      originalFileName: resolved.asset.originalFileName,
      mimeType: resolved.asset.mimeType,
      fileSize: resolved.asset.fileSize,
      uploadedAt: resolved.asset.createdAt,
      uploadStatus: 'ready',
      uploadError: null,
      sha256_hash: resolved.asset.sha256Hash,
      ...buildSealReferenceFields(resolved.asset),
    });
  }

  for (const [index, item] of (step8.gallery || []).entries()) {
    const resolved = await resolveMediaAssetForSource({
      admin,
      memorialId,
      userId,
      kind: 'gallery_photo',
      assetId: item.assetId || null,
      sourceUrl: item.preview || null,
      metadata: {
        caption: item.caption || '',
        year: item.year || '',
        position: index,
      },
    });

    if (!resolved.asset || !resolved.sourceUrl) {
      continue;
    }

    const resolvedCaption = preferAssetMetadata
      ? getAssetMetadataString(resolved.asset, 'caption')
      : item.caption || '';
    const resolvedYear = preferAssetMetadata
      ? getAssetMetadataString(resolved.asset, 'year')
      : item.year || '';

    if (!preferAssetMetadata) {
      await updateAssetMetadata(admin, resolved.asset.id, {
        caption: resolvedCaption,
        year: resolvedYear,
        position: index,
      });
    }

    normalized.step8.gallery.push({
      ...stripTransientFileFields(item),
      caption: resolvedCaption,
      year: resolvedYear,
      preview: resolved.sourceUrl,
      assetId: resolved.asset.id,
      bucket: resolved.asset.bucket,
      storagePath: resolved.asset.storagePath,
      originalFileName: resolved.asset.originalFileName,
      mimeType: resolved.asset.mimeType,
      fileSize: resolved.asset.fileSize,
      uploadedAt: resolved.asset.createdAt,
      uploadStatus: 'ready',
      uploadError: null,
      sha256_hash: resolved.asset.sha256Hash,
      ...buildSealReferenceFields(resolved.asset),
    });
  }

  for (const [index, item] of (step8.interactiveGallery || []).entries()) {
    const resolved = await resolveMediaAssetForSource({
      admin,
      memorialId,
      userId,
      kind: 'interactive_photo',
      assetId: item.assetId || null,
      sourceUrl: item.preview || null,
      metadata: {
        description: item.description || '',
        position: index,
      },
    });

    if (!resolved.asset || !resolved.sourceUrl) {
      continue;
    }

    const resolvedDescription = preferAssetMetadata
      ? getAssetMetadataString(resolved.asset, 'description')
      : item.description || '';

    if (!preferAssetMetadata) {
      await updateAssetMetadata(admin, resolved.asset.id, {
        description: resolvedDescription,
        position: index,
      });
    }

    normalized.step8.interactiveGallery.push({
      ...stripTransientFileFields(item),
      description: resolvedDescription,
      preview: resolved.sourceUrl,
      assetId: resolved.asset.id,
      bucket: resolved.asset.bucket,
      storagePath: resolved.asset.storagePath,
      originalFileName: resolved.asset.originalFileName,
      mimeType: resolved.asset.mimeType,
      fileSize: resolved.asset.fileSize,
      uploadedAt: resolved.asset.createdAt,
      uploadStatus: 'ready',
      uploadError: null,
      sha256_hash: resolved.asset.sha256Hash,
      ...buildSealReferenceFields(resolved.asset),
    });
  }

  for (const [index, item] of (step8.voiceRecordings || []).entries()) {
    const resolved = await resolveMediaAssetForSource({
      admin,
      memorialId,
      userId,
      kind: 'voice_recording',
      assetId: item.assetId || null,
      sourceUrl: item.url || null,
      metadata: {
        title: item.title || '',
        position: index,
      },
    });

    if (!resolved.asset) {
      continue;
    }

    const resolvedTitle = preferAssetMetadata
      ? getAssetMetadataString(resolved.asset, 'title')
      : item.title || '';

    if (!preferAssetMetadata) {
      await updateAssetMetadata(admin, resolved.asset.id, {
        title: resolvedTitle,
        position: index,
      });
    }

    normalized.step8.voiceRecordings.push({
      ...stripTransientFileFields(item),
      title: resolvedTitle,
      assetId: resolved.asset.id,
      bucket: resolved.asset.bucket,
      storagePath: resolved.asset.storagePath,
      originalFileName: resolved.asset.originalFileName,
      mimeType: resolved.asset.mimeType,
      fileSize: resolved.asset.fileSize,
      uploadedAt: resolved.asset.createdAt,
      uploadStatus: 'ready',
      uploadError: null,
      url: resolved.asset.publicUrl,
      sha256_hash: resolved.asset.sha256Hash,
      ...buildSealReferenceFields(resolved.asset),
    });
  }

  for (const [index, item] of (step9.videos || []).entries()) {
    const videoAsset = await resolveMediaAssetForSource({
      admin,
      memorialId,
      userId,
      kind: 'video',
      assetId: item.assetId || null,
      sourceUrl: item.url || null,
      metadata: {
        title: item.title || '',
        description: item.description || '',
        duration: item.duration || '',
        position: index,
      },
    });

    if (!videoAsset.asset || !videoAsset.sourceUrl) {
      continue;
    }

    const thumbnailAsset = await resolveMediaAssetForSource({
      admin,
      memorialId,
      userId,
      kind: 'video_thumbnail',
      assetId: item.thumbnailAssetId || null,
      sourceUrl: item.thumbnail || null,
      metadata: {
        title: item.title || '',
        position: index,
      },
    });

    const resolvedTitle = preferAssetMetadata
      ? getAssetMetadataString(videoAsset.asset, 'title')
      : item.title || '';
    const resolvedDescription = preferAssetMetadata
      ? getAssetMetadataString(videoAsset.asset, 'description')
      : item.description || '';
    const resolvedDuration = preferAssetMetadata
      ? getAssetMetadataString(videoAsset.asset, 'duration')
      : item.duration || '';

    if (!preferAssetMetadata) {
      await updateAssetMetadata(admin, videoAsset.asset.id, {
        title: resolvedTitle,
        description: resolvedDescription,
        duration: resolvedDuration,
        position: index,
        thumbnailAssetId: thumbnailAsset.asset?.id || null,
      });
    }

    normalized.step9.videos.push({
      ...stripTransientFileFields(item),
      title: resolvedTitle,
      description: resolvedDescription,
      duration: resolvedDuration,
      url: videoAsset.sourceUrl,
      thumbnail: thumbnailAsset.sourceUrl || videoAsset.sourceUrl,
      assetId: videoAsset.asset.id,
      bucket: videoAsset.asset.bucket,
      storagePath: videoAsset.asset.storagePath,
      originalFileName: videoAsset.asset.originalFileName,
      mimeType: videoAsset.asset.mimeType,
      fileSize: videoAsset.asset.fileSize,
      uploadedAt: videoAsset.asset.createdAt,
      uploadStatus: 'ready',
      uploadError: null,
      sha256_hash: videoAsset.asset.sha256Hash,
      ...buildSealReferenceFields(videoAsset.asset),
      thumbnailAssetId: thumbnailAsset.asset?.id || null,
      thumbnailBucket: thumbnailAsset.asset?.bucket || null,
      thumbnailStoragePath: thumbnailAsset.asset?.storagePath || null,
      thumbnailMimeType: thumbnailAsset.asset?.mimeType || null,
      thumbnailFileSize: thumbnailAsset.asset?.fileSize || null,
      thumbnailUploadedAt: thumbnailAsset.asset?.createdAt || null,
    });
  }

  const activeAssets = await getActiveMemorialMediaAssets(admin, memorialId);
  const referencedAssetIds = collectMemorialMediaAssetIds(normalized);
  const thumbnailsByVideoId = new Map<string, StoredMediaAsset>();

  for (const asset of activeAssets) {
    if (asset.kind !== 'video_thumbnail') continue;

    const videoAssetId = asset.metadata?.videoAssetId;
    if (typeof videoAssetId === 'string' && videoAssetId) {
      thumbnailsByVideoId.set(videoAssetId, asset);
    }
  }

  if (!normalized.step1.profilePhotoPreview) {
    const latestProfile = activeAssets.filter((asset) => asset.kind === 'profile_photo').at(-1);
    if (latestProfile) {
      normalized.step1 = {
        ...normalized.step1,
        profilePhoto: null,
        profilePhotoPreview: latestProfile.publicUrl,
        profilePhotoAssetId: latestProfile.id,
        profilePhotoBucket: latestProfile.bucket,
        profilePhotoStoragePath: latestProfile.storagePath,
        profilePhotoMimeType: latestProfile.mimeType,
        profilePhotoFileSize: latestProfile.fileSize,
        profilePhotoUploadedAt: latestProfile.createdAt,
        profilePhotoUploadStatus: 'ready',
        profilePhotoUploadError: null,
        profilePhotoHash: latestProfile.sha256Hash,
        profilePhotoArweaveUrl: latestProfile.arweaveUrl,
        profilePhotoSealedAt: latestProfile.sealedAt,
      };
      referencedAssetIds.add(latestProfile.id);
    }
  }

  if (!normalized.step8.coverPhotoPreview) {
    const latestCover = activeAssets.filter((asset) => asset.kind === 'cover_photo').at(-1);
    if (latestCover) {
      normalized.step8.coverPhoto = null;
      normalized.step8.coverPhotoPreview = latestCover.publicUrl;
      normalized.step8.coverPhotoAssetId = latestCover.id;
      normalized.step8.coverPhotoBucket = latestCover.bucket;
      normalized.step8.coverPhotoStoragePath = latestCover.storagePath;
      normalized.step8.coverPhotoMimeType = latestCover.mimeType;
      normalized.step8.coverPhotoFileSize = latestCover.fileSize;
      normalized.step8.coverPhotoUploadedAt = latestCover.createdAt;
      normalized.step8.coverPhotoUploadStatus = 'ready';
      normalized.step8.coverPhotoUploadError = null;
      normalized.step8.coverPhotoHash = latestCover.sha256Hash;
      normalized.step8.coverPhotoArweaveUrl = latestCover.arweaveUrl;
      normalized.step8.coverPhotoSealedAt = latestCover.sealedAt;
      referencedAssetIds.add(latestCover.id);
    }
  }

  const orphanChildhoodPhotos = activeAssets
    .filter(
      (asset) =>
        asset.kind === 'gallery_photo' &&
        asset.metadata?.section === 'childhood_photos' &&
        !referencedAssetIds.has(asset.id)
    )
    .sort(sortAssetsByPositionThenCreatedAt);

  for (const asset of orphanChildhoodPhotos) {
    normalized.step2.childhoodPhotos.push(buildChildhoodPhotoReference(asset));
    referencedAssetIds.add(asset.id);
  }

  const orphanGalleryPhotos = activeAssets
    .filter(
      (asset) =>
        asset.kind === 'gallery_photo' &&
        asset.metadata?.section !== 'childhood_photos' &&
        !referencedAssetIds.has(asset.id)
    )
    .sort(sortAssetsByPositionThenCreatedAt);

  for (const asset of orphanGalleryPhotos) {
    normalized.step8.gallery.push(buildGalleryPhotoReference(asset));
    referencedAssetIds.add(asset.id);
  }

  const orphanInteractiveItems = activeAssets
    .filter(
      (asset) => asset.kind === 'interactive_photo' && !referencedAssetIds.has(asset.id)
    )
    .sort(sortAssetsByPositionThenCreatedAt);

  for (const asset of orphanInteractiveItems) {
    normalized.step8.interactiveGallery.push(buildInteractiveMediaReference(asset));
    referencedAssetIds.add(asset.id);
  }

  const orphanVoiceRecordings = activeAssets
    .filter(
      (asset) => asset.kind === 'voice_recording' && !referencedAssetIds.has(asset.id)
    )
    .sort(sortAssetsByPositionThenCreatedAt);

  for (const asset of orphanVoiceRecordings) {
    normalized.step8.voiceRecordings.push(buildVoiceRecordingReference(asset));
    referencedAssetIds.add(asset.id);
  }

  const orphanVideos = activeAssets
    .filter((asset) => asset.kind === 'video' && !referencedAssetIds.has(asset.id))
    .sort(sortAssetsByPositionThenCreatedAt);

  for (const asset of orphanVideos) {
    const thumbnailAsset = thumbnailsByVideoId.get(asset.id) || null;
    normalized.step9.videos.push(buildVideoReference(asset, thumbnailAsset));
    referencedAssetIds.add(asset.id);
    if (thumbnailAsset) {
      referencedAssetIds.add(thumbnailAsset.id);
    }
  }

  normalized.step1.profilePhoto = null;
  normalized.step8.coverPhoto = null;

  return normalized;
}

export function getMediaPermissionForKind(
  kind: MediaKind,
  metadata?: Record<string, unknown>
) {
  if (
    metadata?.contributionUpload === true &&
    (kind === 'interactive_photo' || kind === 'video' || kind === 'video_thumbnail')
  ) {
    return 'contribute_content';
  }

  return getKindConfig(kind).permission;
}

export function getMediaKindBucket(kind: MediaKind) {
  return getKindConfig(kind).bucket;
}
