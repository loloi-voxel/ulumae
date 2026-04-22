import {
  ChildhoodPhotoReference,
  InteractiveMediaReference,
  MediaImageReference,
  MemorialData,
  VideoReference,
  VoiceRecordingReference,
} from '@/types/memorial';

type MediaWithFile = {
  file?: File | null;
};

function isPersistableUrl(value?: string | null) {
  return Boolean(value && !value.startsWith('blob:'));
}

function stripFileField<T extends MediaWithFile>(item: T): T {
  return {
    ...item,
    file: null,
  };
}

function shouldKeepImageItem(
  item: MediaImageReference | ChildhoodPhotoReference | InteractiveMediaReference,
  sourceUrl: string
) {
  return Boolean(item.assetId || isPersistableUrl(sourceUrl));
}

function shouldKeepVoiceItem(item: VoiceRecordingReference) {
  return Boolean(item.assetId || isPersistableUrl(item.url || null));
}

function shouldKeepVideoItem(item: VideoReference) {
  return Boolean(item.assetId || isPersistableUrl(item.url || null));
}

function isPendingMediaItem(
  item: {
    assetId?: string | null;
    uploadStatus?: string | null;
  },
  sourceUrl?: string | null
) {
  if (item.uploadStatus === 'uploading') {
    return true;
  }

  return !item.assetId && !isPersistableUrl(sourceUrl);
}

export function serializeMemorialDataForSave(data: MemorialData): MemorialData {
  return {
    ...data,
    step1: {
      ...data.step1,
      profilePhoto: null,
    },
    step2: {
      ...data.step2,
      childhoodPhotos: (data.step2.childhoodPhotos || [])
        .map(stripFileField)
        .filter((item) => shouldKeepImageItem(item, item.preview)),
    },
    step8: {
      ...data.step8,
      coverPhoto: null,
      gallery: (data.step8.gallery || [])
        .map(stripFileField)
        .filter((item) => shouldKeepImageItem(item, item.preview)),
      interactiveGallery: (data.step8.interactiveGallery || [])
        .map(stripFileField)
        .filter((item) => shouldKeepImageItem(item, item.preview)),
      voiceRecordings: (data.step8.voiceRecordings || [])
        .map(stripFileField)
        .filter(shouldKeepVoiceItem),
    },
    step9: {
      ...data.step9,
      videos: (data.step9.videos || [])
        .map(stripFileField)
        .filter(shouldKeepVideoItem),
    },
  };
}

export function hasPendingMemorialMedia(data: MemorialData) {
  if (data.step1.profilePhotoUploadStatus === 'uploading') {
    return true;
  }

  if (data.step8.coverPhotoUploadStatus === 'uploading') {
    return true;
  }

  return (
    (data.step2.childhoodPhotos || []).some((item) => isPendingMediaItem(item, item.preview)) ||
    (data.step8.gallery || []).some((item) => isPendingMediaItem(item, item.preview)) ||
    (data.step8.interactiveGallery || []).some((item) => isPendingMediaItem(item, item.preview)) ||
    (data.step8.voiceRecordings || []).some((item) => isPendingMediaItem(item, item.url || null)) ||
    (data.step9.videos || []).some((item) => isPendingMediaItem(item, item.url || null))
  );
}
