import crypto from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { MemorialData } from '@/types/memorial';
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
    bucket: 'videos',
    folder: 'thumbnails',
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
}

interface ResolvedMediaAsset {
  asset: StoredMediaAsset | null;
  sourceUrl: string | null;
}

const MEDIA_SELECT =
  'id, memorial_id, contribution_id, kind, bucket, storage_path, public_url, original_file_name, mime_type, file_size, sha256_hash, metadata, created_by, created_at, updated_at, deleted_at, deleted_by';

function getKindConfig(kind: MediaKind) {
  return MEDIA_KIND_CONFIG[kind];
}

function serializeMediaAsset(row: MediaAssetRow): StoredMediaAsset {
  return {
    id: row.id,
    memorialId: row.memorial_id,
    contributionId: row.contribution_id,
    kind: row.kind,
    bucket: row.bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    sha256Hash: row.sha256_hash,
    metadata: row.metadata || {},
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
  kind: MediaKind,
  originalFileName: string
) {
  const config = getKindConfig(kind);
  const safeName = sanitizeFileName(originalFileName);
  const ext =
    safeName.includes('.') && safeName.split('.').pop()
      ? safeName.split('.').pop()!
      : extensionFromMimeType('application/octet-stream');

  return `${memorialId}/${config.folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

function ensureMimeAndSize(
  kind: MediaKind,
  mimeType: string,
  byteLength: number
) {
  const config = getKindConfig(kind);
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
  ensureMimeAndSize(kind, mimeType, buffer.byteLength);

  const config = getKindConfig(kind);
  const storagePath = buildStoragePath(memorialId, kind, originalFileName);
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const { error: uploadError } = await admin.storage
    .from(config.bucket)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Upload failed.');
  }

  const { data: publicUrlData } = admin.storage
    .from(config.bucket)
    .getPublicUrl(storagePath);

  const insertPayload = {
    memorial_id: memorialId,
    contribution_id: contributionId,
    kind,
    bucket: config.bucket,
    storage_path: storagePath,
    public_url: publicUrlData.publicUrl,
    original_file_name: originalFileName,
    mime_type: mimeType,
    file_size: buffer.byteLength,
    sha256_hash: sha256Hash,
    metadata,
    created_by: createdBy,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('memorial_media_assets')
    .insert(insertPayload)
    .select(MEDIA_SELECT)
    .single();

  if (error || !data) {
    await admin.storage.from(config.bucket).remove([storagePath]).catch(() => undefined);
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

    await updateAssetMetadata(admin, resolved.asset.id, {
      caption: item.caption || '',
      year: item.year || '',
      position: index,
      section: 'childhood_photos',
    });

    normalized.step2.childhoodPhotos.push({
      ...stripTransientFileFields(item),
      id: item.id || resolved.asset.id,
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

    await updateAssetMetadata(admin, resolved.asset.id, {
      caption: item.caption || '',
      year: item.year || '',
      position: index,
    });

    normalized.step8.gallery.push({
      ...stripTransientFileFields(item),
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

    await updateAssetMetadata(admin, resolved.asset.id, {
      description: item.description || '',
      position: index,
    });

    normalized.step8.interactiveGallery.push({
      ...stripTransientFileFields(item),
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

    await updateAssetMetadata(admin, resolved.asset.id, {
      title: item.title || '',
      position: index,
    });

    normalized.step8.voiceRecordings.push({
      ...stripTransientFileFields(item),
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

    await updateAssetMetadata(admin, videoAsset.asset.id, {
      title: item.title || '',
      description: item.description || '',
      duration: item.duration || '',
      position: index,
      thumbnailAssetId: thumbnailAsset.asset?.id || null,
    });

    normalized.step9.videos.push({
      ...stripTransientFileFields(item),
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
      thumbnailAssetId: thumbnailAsset.asset?.id || null,
      thumbnailBucket: thumbnailAsset.asset?.bucket || null,
      thumbnailStoragePath: thumbnailAsset.asset?.storagePath || null,
      thumbnailMimeType: thumbnailAsset.asset?.mimeType || null,
      thumbnailFileSize: thumbnailAsset.asset?.fileSize || null,
      thumbnailUploadedAt: thumbnailAsset.asset?.createdAt || null,
    });
  }

  normalized.step1.profilePhoto = null;
  normalized.step8.coverPhoto = null;

  return normalized;
}

export function getMediaPermissionForKind(kind: MediaKind) {
  return getKindConfig(kind).permission;
}

export function getMediaKindBucket(kind: MediaKind) {
  return getKindConfig(kind).bucket;
}
