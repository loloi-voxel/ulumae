import crypto from 'crypto';

import { generateAnchorOfflineGallery } from '@/lib/anchor/offlineGallery';
import type { AnchorManifest, AnchorManifestFile } from '@/lib/anchor/shared';
import type { MemorialRenderDataResult } from '@/lib/memorialRenderData';

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/html': 'html',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/json': 'json',
};

function sanitizeSegment(value: string) {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'asset';
}

function stripExtension(value?: string | null) {
  return (value || '').replace(/\.[^/.]+$/, '');
}

function extensionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').pop() || '';
    const ext = segment.includes('.') ? segment.split('.').pop() : '';
    return ext ? ext.toLowerCase() : '';
  } catch {
    return '';
  }
}

function extensionForFile(
  mimeType: string,
  originalFileName?: string | null,
  url?: string | null
) {
  const nameExt = originalFileName && originalFileName.includes('.')
    ? originalFileName.split('.').pop() || ''
    : '';
  const urlExt = url ? extensionFromUrl(url) : '';
  const mimeExt = MIME_EXTENSIONS[mimeType.toLowerCase()] || '';

  return sanitizeSegment(nameExt || urlExt || mimeExt || 'bin');
}

function fileNameFromPath(path: string) {
  return path.split('/').pop() || path;
}

function remoteSignature(
  id: string,
  size: number,
  sha256Hash: string | null | undefined,
  sourceUrl: string
) {
  return sha256Hash || crypto.createHash('sha256').update(`${id}:${size}:${sourceUrl}`).digest('hex');
}

function inlineSignature(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function buildRelativePath(
  folder: string,
  preferredName: string,
  stableId: string,
  mimeType: string,
  sourceUrl?: string | null
) {
  const extension = extensionForFile(mimeType, preferredName, sourceUrl);
  const stem = sanitizeSegment(stripExtension(preferredName) || stableId).slice(0, 48);
  const suffix = sanitizeSegment(stableId).slice(-8) || 'item';
  return `${folder}/${stem}-${suffix}.${extension}`;
}

function byteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function docDescriptor(file: AnchorManifestFile) {
  return {
    id: file.id,
    kind: file.kind,
    category: file.category,
    relativePath: file.relativePath,
    displayName: file.displayName,
    mimeType: file.mimeType,
    size: file.size,
    signature: file.signature,
  };
}

export function buildAnchorManifest({
  memorial,
  memorialData,
  relations,
}: MemorialRenderDataResult): AnchorManifest {
  const files: AnchorManifestFile[] = [];
  const resourceMap = new Map<string, string>();
  const seenRemoteKeys = new Map<string, AnchorManifestFile>();
  const memorialName = memorialData.step1.fullName || memorial.full_name || 'Legacy Vault';
  const suggestedVaultName = `legacy-vault-${sanitizeSegment(memorialName).toLowerCase()}`;

  const addRemoteFile = ({
    stableId,
    kind,
    category,
    folder,
    displayName,
    sourceUrl,
    mimeType,
    size,
    originalFileName,
    sha256Hash,
    countAsPrimaryPhoto = false,
  }: {
    stableId: string;
    kind: AnchorManifestFile['kind'];
    category: AnchorManifestFile['category'];
    folder: string;
    displayName: string;
    sourceUrl: string | null | undefined;
    mimeType: string | null | undefined;
    size: number | null | undefined;
    originalFileName?: string | null;
    sha256Hash?: string | null;
    countAsPrimaryPhoto?: boolean;
  }) => {
    if (!sourceUrl || !mimeType || !size || size <= 0) {
      return null;
    }

    const remoteKey = `${stableId}:${sourceUrl}`;
    const existing = seenRemoteKeys.get(remoteKey);
    if (existing) {
      resourceMap.set(sourceUrl, existing.relativePath);
      return existing;
    }

    const relativePath = buildRelativePath(
      folder,
      originalFileName || displayName,
      stableId,
      mimeType,
      sourceUrl
    );
    const file: AnchorManifestFile = {
      id: stableId,
      kind,
      category: countAsPrimaryPhoto && category === 'thumbnail' ? 'photo' : category,
      relativePath,
      displayName,
      fileName: fileNameFromPath(relativePath),
      mimeType,
      size,
      signature: remoteSignature(stableId, size, sha256Hash, sourceUrl),
      source: {
        type: 'remote',
        url: sourceUrl,
      },
    };

    files.push(file);
    resourceMap.set(sourceUrl, relativePath);
    seenRemoteKeys.set(remoteKey, file);
    return file;
  };

  const addInlineFile = ({
    id,
    kind,
    relativePath,
    displayName,
    mimeType,
    content,
  }: {
    id: string;
    kind: AnchorManifestFile['kind'];
    relativePath: string;
    displayName: string;
    mimeType: string;
    content: string;
  }) => {
    const file: AnchorManifestFile = {
      id,
      kind,
      category: 'metadata',
      relativePath,
      displayName,
      fileName: fileNameFromPath(relativePath),
      mimeType,
      size: byteLength(content),
      signature: inlineSignature(content),
      source: {
        type: 'inline',
        content,
        encoding: 'utf-8',
      },
    };

    files.push(file);
    return file;
  };

  addRemoteFile({
    stableId: `profile-${memorial.id}`,
    kind: 'profile_photo',
    category: 'photo',
    folder: 'media/profile',
    displayName: 'Profile portrait',
    sourceUrl: memorialData.step1.profilePhotoPreview,
    mimeType: memorialData.step1.profilePhotoMimeType || 'image/jpeg',
    size: memorialData.step1.profilePhotoFileSize,
    originalFileName: memorialData.step1.profilePhotoStoragePath,
    sha256Hash: memorialData.step1.profilePhotoHash,
  });

  addRemoteFile({
    stableId: `cover-${memorial.id}`,
    kind: 'cover_photo',
    category: 'photo',
    folder: 'media/cover',
    displayName: 'Cover image',
    sourceUrl: memorialData.step8.coverPhotoPreview,
    mimeType: memorialData.step8.coverPhotoMimeType || 'image/jpeg',
    size: memorialData.step8.coverPhotoFileSize,
    originalFileName: memorialData.step8.coverPhotoStoragePath,
    sha256Hash: memorialData.step8.coverPhotoHash,
  });

  for (const item of memorialData.step2.childhoodPhotos || []) {
    addRemoteFile({
      stableId: item.assetId || item.id,
      kind: 'gallery_photo',
      category: 'photo',
      folder: 'media/photos/childhood',
      displayName: item.caption || 'Childhood photo',
      sourceUrl: item.preview,
      mimeType: item.mimeType || 'image/jpeg',
      size: item.fileSize,
      originalFileName: item.originalFileName,
      sha256Hash: item.sha256_hash,
    });
  }

  for (const item of memorialData.step8.gallery || []) {
    addRemoteFile({
      stableId: item.assetId || item.id,
      kind: 'gallery_photo',
      category: 'photo',
      folder: 'media/photos/gallery',
      displayName: item.caption || 'Photo',
      sourceUrl: item.preview,
      mimeType: item.mimeType || 'image/jpeg',
      size: item.fileSize,
      originalFileName: item.originalFileName,
      sha256Hash: item.sha256_hash,
    });
  }

  for (const item of memorialData.step8.interactiveGallery || []) {
    addRemoteFile({
      stableId: item.assetId || item.id,
      kind: 'interactive_photo',
      category: 'photo',
      folder: 'media/photos/interactive',
      displayName: item.description || 'Interactive photo story',
      sourceUrl: item.preview,
      mimeType: item.mimeType || 'image/jpeg',
      size: item.fileSize,
      originalFileName: item.originalFileName,
      sha256Hash: item.sha256_hash,
    });
  }

  for (const item of memorialData.step8.voiceRecordings || []) {
    addRemoteFile({
      stableId: item.assetId || item.id,
      kind: 'voice_recording',
      category: 'audio',
      folder: 'media/audio',
      displayName: item.title || 'Voice recording',
      sourceUrl: item.url,
      mimeType: item.mimeType || 'audio/mpeg',
      size: item.fileSize,
      originalFileName: item.originalFileName,
      sha256Hash: item.sha256_hash,
    });
  }

  for (const item of memorialData.step9.videos || []) {
    addRemoteFile({
      stableId: item.assetId || item.id,
      kind: 'video',
      category: 'video',
      folder: 'media/videos',
      displayName: item.title || 'Video memory',
      sourceUrl: item.url,
      mimeType: item.mimeType || 'video/mp4',
      size: item.fileSize,
      originalFileName: item.originalFileName,
      sha256Hash: item.sha256_hash,
    });

    addRemoteFile({
      stableId: item.thumbnailAssetId || `${item.id}-thumbnail`,
      kind: 'video_thumbnail',
      category: 'thumbnail',
      folder: 'media/videos/thumbnails',
      displayName: `${item.title || 'Video memory'} thumbnail`,
      sourceUrl: item.thumbnail,
      mimeType: item.thumbnailMimeType || 'image/jpeg',
      size: item.thumbnailFileSize,
      originalFileName: item.originalFileName,
      sha256Hash: null,
    });
  }

  const memorialDocument = JSON.stringify(
    {
      memorialId: memorial.id,
      memorialName,
      generatedAt: new Date().toISOString(),
      relations,
      memorialData,
    },
    null,
    2
  );

  const readme = [
    `ULUMAE LEGACY VAULT`,
    `====================`,
    ``,
    `Archive for: ${memorialName}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `How to open this archive offline:`,
    `1. Open index.html in any modern browser.`,
    `2. Keep the media folder beside index.html.`,
    `3. No internet connection is required.`,
    ``,
    `This vault contains the memorial text, gallery images, video memories,`,
    `and a self-contained offline viewer generated for local preservation.`,
  ].join('\n');

  const offlineHtml = generateAnchorOfflineGallery(memorialData, relations, resourceMap);

  addInlineFile({
    id: `memorial-json-${memorial.id}`,
    kind: 'memorial_json',
    relativePath: 'memorial.json',
    displayName: 'Memorial data',
    mimeType: 'application/json',
    content: memorialDocument,
  });

  addInlineFile({
    id: `offline-gallery-${memorial.id}`,
    kind: 'offline_gallery',
    relativePath: 'index.html',
    displayName: 'Offline gallery',
    mimeType: 'text/html',
    content: offlineHtml,
  });

  addInlineFile({
    id: `readme-${memorial.id}`,
    kind: 'readme',
    relativePath: 'README.txt',
    displayName: 'How to open this archive',
    mimeType: 'text/plain',
    content: readme,
  });

  const manifestSnapshotBase = {
    version: 1,
    memorialId: memorial.id,
    memorialName,
    generatedAt: new Date().toISOString(),
    updatedAt: memorial.updated_at,
    files: files.map(docDescriptor),
  };

  const bytesWithoutManifest = files.reduce((sum, file) => sum + file.size, 0);
  let manifestDocument = JSON.stringify(
    {
      ...manifestSnapshotBase,
      totalBytes: bytesWithoutManifest,
    },
    null,
    2
  );
  let manifestSize = byteLength(manifestDocument);
  let totalBytes = bytesWithoutManifest + manifestSize;

  manifestDocument = JSON.stringify(
    {
      ...manifestSnapshotBase,
      totalBytes,
      files: [
        ...files.map(docDescriptor),
        {
          id: `manifest-json-${memorial.id}`,
          kind: 'manifest_json',
          category: 'metadata',
          relativePath: 'manifest.json',
          displayName: 'Vault manifest',
          mimeType: 'application/json',
          size: manifestSize,
        },
      ],
    },
    null,
    2
  );
  manifestSize = byteLength(manifestDocument);
  totalBytes = bytesWithoutManifest + manifestSize;

  addInlineFile({
    id: `manifest-json-${memorial.id}`,
    kind: 'manifest_json',
    relativePath: 'manifest.json',
    displayName: 'Vault manifest',
    mimeType: 'application/json',
    content: manifestDocument,
  });

  const summary = {
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    totalFiles: files.length,
    photoCount: files.filter((file) => file.category === 'photo').length,
    videoCount: files.filter((file) => file.category === 'video').length,
    audioCount: files.filter((file) => file.category === 'audio').length,
    metadataCount: files.filter((file) => file.category === 'metadata').length,
    galleryCount: 1,
  };

  const manifestFingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        memorialId: memorial.id,
        updatedAt: memorial.updated_at,
        files: files.map((file) => ({
          id: file.id,
          relativePath: file.relativePath,
          signature: file.signature,
          size: file.size,
        })),
      })
    )
    .digest('hex');

  return {
    memorialId: memorial.id,
    memorialName,
    generatedAt: new Date().toISOString(),
    updatedAt: memorial.updated_at,
    plan: 'family',
    suggestedVaultName,
    manifestFingerprint,
    files,
    summary,
    offline: {
      routePath: `/anchor/offline/${memorial.id}`,
      relativeIndexPath: 'index.html',
      remoteUrlMap: files
        .filter((file): file is AnchorManifestFile & { source: { type: 'remote'; url: string } } => file.source.type === 'remote')
        .map((file) => ({
          url: file.source.url,
          relativePath: file.relativePath,
          mimeType: file.mimeType,
        })),
    },
  };
}
