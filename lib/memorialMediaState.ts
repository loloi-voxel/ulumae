import type { MemorialData } from '@/types/memorial';

function isBlobMediaUrl(url?: string | null) {
  return typeof url === 'string' && /^blob:/i.test(url.trim());
}

function hasBlockingMediaItem({
  assetId,
  file,
  uploadStatus,
  primaryUrl,
  secondaryUrl,
  secondaryAssetId,
}: {
  assetId?: string | null;
  file?: File | null;
  uploadStatus?: string | null;
  primaryUrl?: string | null;
  secondaryUrl?: string | null;
  secondaryAssetId?: string | null;
}) {
  if (uploadStatus === 'uploading') {
    return true;
  }

  if (file && !assetId) {
    return true;
  }

  if (!assetId && isBlobMediaUrl(primaryUrl)) {
    return true;
  }

  if (
    secondaryUrl &&
    secondaryUrl !== primaryUrl &&
    !secondaryAssetId &&
    isBlobMediaUrl(secondaryUrl)
  ) {
    return true;
  }

  return false;
}

export function hasBlockingMemorialMediaState(data: MemorialData) {
  if (
    hasBlockingMediaItem({
      assetId: data.step1.profilePhotoAssetId,
      file: data.step1.profilePhoto,
      uploadStatus: data.step1.profilePhotoUploadStatus,
      primaryUrl: data.step1.profilePhotoPreview,
    })
  ) {
    return true;
  }

  if (
    hasBlockingMediaItem({
      assetId: data.step8.coverPhotoAssetId,
      file: data.step8.coverPhoto,
      uploadStatus: data.step8.coverPhotoUploadStatus,
      primaryUrl: data.step8.coverPhotoPreview,
    })
  ) {
    return true;
  }

  for (const item of data.step2.childhoodPhotos || []) {
    if (
      hasBlockingMediaItem({
        assetId: item.assetId,
        file: item.file,
        uploadStatus: item.uploadStatus,
        primaryUrl: item.preview,
      })
    ) {
      return true;
    }
  }

  for (const item of data.step8.gallery || []) {
    if (
      hasBlockingMediaItem({
        assetId: item.assetId,
        file: item.file,
        uploadStatus: item.uploadStatus,
        primaryUrl: item.preview,
      })
    ) {
      return true;
    }
  }

  for (const item of data.step8.interactiveGallery || []) {
    if (
      hasBlockingMediaItem({
        assetId: item.assetId,
        file: item.file,
        uploadStatus: item.uploadStatus,
        primaryUrl: item.preview,
      })
    ) {
      return true;
    }
  }

  for (const item of data.step8.voiceRecordings || []) {
    if (
      hasBlockingMediaItem({
        assetId: item.assetId,
        file: item.file,
        uploadStatus: item.uploadStatus,
        primaryUrl: item.url,
      })
    ) {
      return true;
    }
  }

  for (const item of data.step9.videos || []) {
    if (
      hasBlockingMediaItem({
        assetId: item.assetId,
        file: item.file,
        uploadStatus: item.uploadStatus,
        primaryUrl: item.url,
        secondaryUrl: item.thumbnail,
        secondaryAssetId: item.thumbnailAssetId,
      })
    ) {
      return true;
    }
  }

  return false;
}
