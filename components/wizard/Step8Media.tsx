'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MousePointer,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import type {
  InteractiveMediaReference,
  MediaImageReference,
  MediaLegacy,
  VoiceRecordingReference,
} from '@/types/memorial';
import { DRAFT_MEDIA_LIMIT, PLAN_PRICES_USD } from '@/lib/constants';
import { deleteMediaAssets, secureUpload, updateMediaAssetMetadata } from '@/lib/uploadService';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';

interface Step8Props {
  data: MediaLegacy;
  onUpdate: (data: MediaLegacy) => void;
  onNext: () => void;
  onBack: () => void;
  isPaid: boolean;
  completedPathsCount: number;
  onBackToHub?: () => void;
  memorialId: string | null;
  readOnly?: boolean;
}

type MediaSection = 'cover' | 'gallery' | 'interactive' | 'voice';

type DeletedItem =
  | {
      section: 'cover';
      item: Pick<
        MediaLegacy,
        | 'coverPhotoPreview'
        | 'coverPhotoAssetId'
        | 'coverPhotoBucket'
        | 'coverPhotoStoragePath'
        | 'coverPhotoMimeType'
        | 'coverPhotoFileSize'
        | 'coverPhotoUploadedAt'
        | 'coverPhotoHash'
      >;
    }
  | { section: 'gallery'; item: MediaImageReference }
  | { section: 'interactive'; item: InteractiveMediaReference }
  | { section: 'voice'; item: VoiceRecordingReference };

type PendingRemoval =
  | { kind: 'single'; section: MediaSection; id?: string }
  | { kind: 'bulk-gallery' };

const PAGE_SIZE = 12;

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function statusLabel(status?: string) {
  if (status === 'uploading') return 'Uploading';
  if (status === 'error') return 'Needs retry';
  if (status === 'deleting') return 'Removing';
  return '';
}

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p>{message}</p>
      <button onClick={onDismiss} className="text-red-500 hover:text-red-700">
        <X size={16} />
      </button>
    </div>
  );
}

function ImageFallbackCard({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[12rem] w-full items-center justify-center rounded-xl border border-dashed border-warm-border/40 bg-warm-border/10 p-4 text-center text-sm text-warm-dark/40">
      {label}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-warm-border/30 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-warm-dark">{title}</h3>
          <p className="text-sm text-warm-dark/50">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function Step8Media({
  data,
  onUpdate,
  onNext,
  onBack,
  isPaid,
  onBackToHub,
  memorialId,
  readOnly,
}: Step8Props) {
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const interactiveRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef(data);
  const interactiveMetadataTimersRef = useRef<Record<string, number>>({});
  const galleryMetadataTimersRef = useRef<Record<string, number>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<string[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<{ section: MediaSection; id?: string } | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ section: MediaSection; id?: string } | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedItem[]>([]);
  const [visibleGalleryCount, setVisibleGalleryCount] = useState(PAGE_SIZE);
  const [visibleInteractiveCount, setVisibleInteractiveCount] = useState(PAGE_SIZE);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    return () => {
      Object.values(galleryMetadataTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      Object.values(interactiveMetadataTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  const applyUpdate = (updater: (current: MediaLegacy) => MediaLegacy) => {
    const next = updater(dataRef.current);
    dataRef.current = next;
    onUpdate(next);
  };

  const syncInteractiveMetadata = async (id: string) => {
    const currentItem = dataRef.current.interactiveGallery.find((item) => item.id === id);

    if (!memorialId || !currentItem?.assetId) {
      delete interactiveMetadataTimersRef.current[id];
      return;
    }

    try {
      await updateMediaAssetMetadata(memorialId, currentItem.assetId, {
        description: currentItem.description || '',
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not save the story text yet.');
    } finally {
      delete interactiveMetadataTimersRef.current[id];
    }
  };

  const queueInteractiveMetadataSync = (id: string, delay = 500) => {
    const existingTimer = interactiveMetadataTimersRef.current[id];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    interactiveMetadataTimersRef.current[id] = window.setTimeout(() => {
      void syncInteractiveMetadata(id);
    }, delay);
  };

  const syncGalleryMetadata = async (id: string) => {
    const currentItem = dataRef.current.gallery.find((item) => item.id === id);

    if (!memorialId || !currentItem?.assetId) {
      delete galleryMetadataTimersRef.current[id];
      return;
    }

    try {
      await updateMediaAssetMetadata(memorialId, currentItem.assetId, {
        caption: currentItem.caption || '',
        year: currentItem.year || '',
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not save the photo details yet.');
    } finally {
      delete galleryMetadataTimersRef.current[id];
    }
  };

  const queueGalleryMetadataSync = (id: string, delay = 500) => {
    const existingTimer = galleryMetadataTimersRef.current[id];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    galleryMetadataTimersRef.current[id] = window.setTimeout(() => {
      void syncGalleryMetadata(id);
    }, delay);
  };

  const maxAllowed = isPaid ? Number.POSITIVE_INFINITY : DRAFT_MEDIA_LIMIT;

  const detailItem = useMemo(() => {
    if (!selectedDetail) return null;
    if (selectedDetail.section === 'cover') {
      return {
        section: 'cover' as const,
        preview: data.coverPhotoPreview,
        title: 'Cover photo',
        subtitle: data.coverPhotoUploadedAt || '',
        assetId: data.coverPhotoAssetId || null,
      };
    }
    if (selectedDetail.section === 'gallery') {
      const item = data.gallery.find((entry) => entry.id === selectedDetail.id);
      return item ? { section: 'gallery' as const, preview: item.preview, title: item.caption || 'Gallery photo', subtitle: item.year || item.originalFileName || '', assetId: item.assetId || null, item } : null;
    }
    if (selectedDetail.section === 'interactive') {
      const item = data.interactiveGallery.find((entry) => entry.id === selectedDetail.id);
      return item ? { section: 'interactive' as const, preview: item.preview, title: 'Interactive story', subtitle: item.description || item.originalFileName || '', assetId: item.assetId || null, item } : null;
    }
    const item = data.voiceRecordings.find((entry) => entry.id === selectedDetail.id);
    return item ? { section: 'voice' as const, preview: item.url || '', title: item.title || 'Voice recording', subtitle: item.originalFileName || '', assetId: item.assetId || null, item } : null;
  }, [data, selectedDetail]);

  const ensureMemorial = () => {
    if (!memorialId) {
      setErrorMessage('Please wait until the private preview is ready before adding media.');
      return false;
    }
    return true;
  };

  const uploadCover = async (file: File) => {
    if (!ensureMemorial()) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const preview = reader.result as string;
      applyUpdate((current) => ({
        ...current,
        coverPhoto: file,
        coverPhotoPreview: preview,
        coverPhotoUploadStatus: 'uploading',
        coverPhotoUploadError: null,
      }));

      const result = await secureUpload(file, {
        memorialId: memorialId!,
        kind: 'cover_photo',
      });

      if (!result.success || !result.asset) {
        applyUpdate((current) => ({
          ...current,
          coverPhoto: file,
          coverPhotoPreview: preview,
          coverPhotoUploadStatus: 'error',
          coverPhotoUploadError: result.error || 'Could not upload the cover photo.',
        }));
        setErrorMessage(result.error || 'Could not upload the cover photo.');
        return;
      }
      const asset = result.asset;

      applyUpdate((current) => ({
        ...current,
        coverPhoto: null,
        coverPhotoPreview: asset.publicUrl,
        coverPhotoAssetId: asset.id,
        coverPhotoBucket: asset.bucket,
        coverPhotoStoragePath: asset.storagePath,
        coverPhotoMimeType: asset.mimeType,
        coverPhotoFileSize: asset.fileSize,
        coverPhotoUploadedAt: asset.createdAt,
        coverPhotoUploadStatus: 'ready',
        coverPhotoUploadError: null,
        coverPhotoHash: asset.sha256Hash,
      }));
    };
    reader.readAsDataURL(file);
  };

  const uploadGalleryFiles = async (files: File[]) => {
    if (!ensureMemorial()) return;
    const remaining = maxAllowed - dataRef.current.gallery.length;
    if (remaining <= 0) {
      setErrorMessage(
        isPaid
          ? 'The gallery is currently at its limit.'
          : `Private previews can hold up to ${DRAFT_MEDIA_LIMIT} gallery items.`
      );
      return;
    }

    const accepted = isPaid ? files : files.slice(0, remaining);
    if (!isPaid && accepted.length < files.length) {
      setErrorMessage(`Only ${remaining} gallery item(s) fit in this private preview right now.`);
    }

    for (const file of accepted) {
      const tempId = `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      const pendingItem: MediaImageReference = {
        id: tempId,
        file,
        preview,
        caption: '',
        year: '',
        type: 'photo',
        uploadStatus: 'uploading',
        uploadError: null,
      };

      applyUpdate((current) => ({
        ...current,
        gallery: [...current.gallery, pendingItem],
      }));

      const result = await secureUpload(file, {
        memorialId: memorialId!,
        kind: 'gallery_photo',
      });

      if (!result.success || !result.asset) {
        applyUpdate((current) => ({
          ...current,
          gallery: current.gallery.map((item) =>
            item.id === tempId
              ? { ...item, uploadStatus: 'error', uploadError: result.error || 'Upload failed.' }
              : item
          ),
        }));
        setErrorMessage(result.error || `Could not upload ${file.name}.`);
        continue;
      }
      const asset = result.asset;

      applyUpdate((current) => ({
        ...current,
        gallery: current.gallery.map((item) =>
          item.id === tempId
            ? {
                ...item,
                file: null,
                preview: asset.publicUrl,
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
              }
            : item
        ),
      }));
    }
  };

  const uploadInteractiveFiles = async (files: File[]) => {
    if (!ensureMemorial()) return;
    const accepted = isPaid ? files : files.slice(0, Math.max(0, maxAllowed - dataRef.current.interactiveGallery.length));
    if (!isPaid && accepted.length < files.length) {
      setErrorMessage(`Only ${accepted.length} interactive item(s) fit in this private preview.`);
    }

    for (const file of accepted) {
      const tempId = `interactive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      const pendingItem: InteractiveMediaReference = {
        id: tempId,
        file,
        preview,
        description: '',
        uploadStatus: 'uploading',
        uploadError: null,
      };

      applyUpdate((current) => ({
        ...current,
        interactiveGallery: [...current.interactiveGallery, pendingItem],
      }));

      const result = await secureUpload(file, {
        memorialId: memorialId!,
        kind: 'interactive_photo',
      });

      if (!result.success || !result.asset) {
        applyUpdate((current) => ({
          ...current,
          interactiveGallery: current.interactiveGallery.map((item) =>
            item.id === tempId
              ? { ...item, uploadStatus: 'error', uploadError: result.error || 'Upload failed.' }
              : item
          ),
        }));
        setErrorMessage(result.error || `Could not upload ${file.name}.`);
        continue;
      }
      const asset = result.asset;

      applyUpdate((current) => ({
        ...current,
        interactiveGallery: current.interactiveGallery.map((item) =>
          item.id === tempId
            ? {
                ...item,
                file: null,
                preview: asset.publicUrl,
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
              }
            : item
        ),
      }));

      queueInteractiveMetadataSync(tempId);
    }
  };

  const uploadVoiceFiles = async (files: File[]) => {
    if (!ensureMemorial()) return;
    const accepted = isPaid ? files : files.slice(0, Math.max(0, maxAllowed - dataRef.current.voiceRecordings.length));
    if (!isPaid && accepted.length < files.length) {
      setErrorMessage(`Only ${accepted.length} recording(s) fit in this private preview.`);
    }

    for (const file of accepted) {
      const tempId = `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const pendingItem: VoiceRecordingReference = {
        id: tempId,
        file,
        title: file.name.replace(/\.[^/.]+$/, ''),
        uploadStatus: 'uploading',
        uploadError: null,
      };

      applyUpdate((current) => ({
        ...current,
        voiceRecordings: [...current.voiceRecordings, pendingItem],
      }));

      const result = await secureUpload(file, {
        memorialId: memorialId!,
        kind: 'voice_recording',
      });

      if (!result.success || !result.asset) {
        applyUpdate((current) => ({
          ...current,
          voiceRecordings: current.voiceRecordings.map((item) =>
            item.id === tempId
              ? { ...item, uploadStatus: 'error', uploadError: result.error || 'Upload failed.' }
              : item
          ),
        }));
        setErrorMessage(result.error || `Could not upload ${file.name}.`);
        continue;
      }
      const asset = result.asset;

      applyUpdate((current) => ({
        ...current,
        voiceRecordings: current.voiceRecordings.map((item) =>
          item.id === tempId
            ? {
                ...item,
                file: null,
                assetId: asset.id,
                bucket: asset.bucket,
                storagePath: asset.storagePath,
                originalFileName: asset.originalFileName,
                mimeType: asset.mimeType,
                fileSize: asset.fileSize,
                uploadedAt: asset.createdAt,
                uploadStatus: 'ready',
                uploadError: null,
                url: asset.publicUrl,
                sha256_hash: asset.sha256Hash,
              }
            : item
        ),
      }));
    }
  };

  const removeItem = async (section: MediaSection, id?: string) => {
    if (readOnly) return;

    try {
      if (section === 'cover') {
        if (memorialId && dataRef.current.coverPhotoAssetId) {
          await deleteMediaAssets(memorialId, [dataRef.current.coverPhotoAssetId], 'soft');
        }
        setRecentlyDeleted((current) => [
          {
            section: 'cover',
            item: {
              coverPhotoPreview: dataRef.current.coverPhotoPreview,
              coverPhotoAssetId: dataRef.current.coverPhotoAssetId,
              coverPhotoBucket: dataRef.current.coverPhotoBucket,
              coverPhotoStoragePath: dataRef.current.coverPhotoStoragePath,
              coverPhotoMimeType: dataRef.current.coverPhotoMimeType,
              coverPhotoFileSize: dataRef.current.coverPhotoFileSize,
              coverPhotoUploadedAt: dataRef.current.coverPhotoUploadedAt,
              coverPhotoHash: dataRef.current.coverPhotoHash,
            },
          },
          ...current,
        ]);
        applyUpdate((current) => ({
          ...current,
          coverPhoto: null,
          coverPhotoPreview: null,
          coverPhotoAssetId: null,
          coverPhotoBucket: null,
          coverPhotoStoragePath: null,
          coverPhotoMimeType: null,
          coverPhotoFileSize: null,
          coverPhotoUploadedAt: null,
          coverPhotoUploadStatus: 'idle',
          coverPhotoUploadError: null,
          coverPhotoHash: undefined,
        }));
        setSelectedDetail(null);
        return;
      }

      const collection =
        section === 'gallery'
          ? dataRef.current.gallery
          : section === 'interactive'
            ? dataRef.current.interactiveGallery
            : dataRef.current.voiceRecordings;
      const item = collection.find((entry) => entry.id === id);
      if (!item) return;

      if (memorialId && item.assetId) {
        await deleteMediaAssets(memorialId, [item.assetId], 'soft');
      }

      setRecentlyDeleted((current) => [
        { section: section as 'gallery' | 'interactive' | 'voice', item: item as any },
        ...current,
      ]);

      applyUpdate((current) => ({
        ...current,
        ...(section === 'gallery'
          ? { gallery: current.gallery.filter((entry) => entry.id !== id) }
          : section === 'interactive'
            ? { interactiveGallery: current.interactiveGallery.filter((entry) => entry.id !== id) }
            : { voiceRecordings: current.voiceRecordings.filter((entry) => entry.id !== id) }),
      }));
      setSelectedGalleryIds((current) => current.filter((value) => value !== id));
      setSelectedDetail(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not remove the media item.');
    }
  };

  const restoreDeletedItem = async (entry: DeletedItem, index: number) => {
    try {
      const assetId = entry.section === 'cover' ? entry.item.coverPhotoAssetId : entry.item.assetId;

      if (memorialId && assetId) {
        await deleteMediaAssets(memorialId, [assetId], 'restore');
      }

      applyUpdate((current) => {
        if (entry.section === 'cover') {
          return {
            ...current,
            coverPhotoPreview: entry.item.coverPhotoPreview || null,
            coverPhotoAssetId: entry.item.coverPhotoAssetId || null,
            coverPhotoBucket: entry.item.coverPhotoBucket || null,
            coverPhotoStoragePath: entry.item.coverPhotoStoragePath || null,
            coverPhotoMimeType: entry.item.coverPhotoMimeType || null,
            coverPhotoFileSize: entry.item.coverPhotoFileSize || null,
            coverPhotoUploadedAt: entry.item.coverPhotoUploadedAt || null,
            coverPhotoHash: entry.item.coverPhotoHash,
            coverPhotoUploadStatus: 'ready',
            coverPhotoUploadError: null,
          };
        }
        if (entry.section === 'gallery') {
          return { ...current, gallery: [entry.item, ...current.gallery] };
        }
        if (entry.section === 'interactive') {
          return { ...current, interactiveGallery: [entry.item, ...current.interactiveGallery] };
        }
        return { ...current, voiceRecordings: [entry.item, ...current.voiceRecordings] };
      });

      setRecentlyDeleted((current) => current.filter((_, itemIndex) => itemIndex !== index));
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not restore the media item.');
    }
  };

  const replaceMedia = async (file: File) => {
    if (!replaceTarget || !ensureMemorial()) return;

    try {
      if (replaceTarget.section === 'cover') {
        const previousAssetId = dataRef.current.coverPhotoAssetId;
        await uploadCover(file);
        if (previousAssetId) {
          await deleteMediaAssets(memorialId!, [previousAssetId], 'soft');
        }
        setReplaceTarget(null);
        return;
      }

      const targetCollection =
        replaceTarget.section === 'gallery'
          ? dataRef.current.gallery
          : replaceTarget.section === 'interactive'
            ? dataRef.current.interactiveGallery
            : dataRef.current.voiceRecordings;
      const currentItem = targetCollection.find((item) => item.id === replaceTarget.id);
      if (!currentItem) return;

      const kind =
        replaceTarget.section === 'gallery'
          ? 'gallery_photo'
          : replaceTarget.section === 'interactive'
            ? 'interactive_photo'
            : 'voice_recording';
      const result = await secureUpload(file, {
        memorialId: memorialId!,
        kind,
      });

      if (!result.success || !result.asset) {
        throw new Error(result.error || 'Replacement upload failed.');
      }
      const asset = result.asset;

      if (currentItem.assetId) {
        await deleteMediaAssets(memorialId!, [currentItem.assetId], 'soft');
      }

      applyUpdate((current) => {
        const updater = (item: any) =>
          item.id === replaceTarget.id
            ? {
                ...item,
                file: null,
                preview: kind === 'voice_recording' ? item.preview : asset.publicUrl,
                url: kind === 'voice_recording' ? asset.publicUrl : item.url,
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
              }
            : item;

        return {
          ...current,
          ...(replaceTarget.section === 'gallery'
            ? { gallery: current.gallery.map(updater) }
            : replaceTarget.section === 'interactive'
            ? { interactiveGallery: current.interactiveGallery.map(updater) }
              : { voiceRecordings: current.voiceRecordings.map(updater) }),
        };
      });
      if (replaceTarget.section === 'interactive' && replaceTarget.id) {
        queueInteractiveMetadataSync(replaceTarget.id);
      }
      setReplaceTarget(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not replace the selected media item.');
    }
  };

  const moveGalleryItem = (id: string, direction: -1 | 1) => {
    applyUpdate((current) => {
      const index = current.gallery.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.gallery.length) {
        return current;
      }
      return {
        ...current,
        gallery: moveItem(current.gallery, index, nextIndex),
      };
    });
  };

  const bulkDeleteGallery = async () => {
    if (selectedGalleryIds.length === 0) return;
    setPendingRemoval({ kind: 'bulk-gallery' });
  };

  const handleConfirmRemoval = async () => {
    if (!pendingRemoval) return;

    const action = pendingRemoval;
    setPendingRemoval(null);

    if (action.kind === 'bulk-gallery') {
      for (const id of selectedGalleryIds) {
        // eslint-disable-next-line no-await-in-loop
        await removeItem('gallery', id);
      }
      setSelectedGalleryIds([]);
      return;
    }

    await removeItem(action.section, action.id);
  };

  const updateGalleryField = (id: string, field: 'caption' | 'year', value: string) => {
    applyUpdate((current) => ({
      ...current,
      gallery: current.gallery.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));

    queueGalleryMetadataSync(id);
  };

  const updateInteractiveDescription = (id: string, value: string) => {
    applyUpdate((current) => ({
      ...current,
      interactiveGallery: current.interactiveGallery.map((item) =>
        item.id === id ? { ...item, description: value } : item
      ),
    }));

    queueInteractiveMetadataSync(id);
  };

  const updateVoiceTitle = (id: string, value: string) => {
    applyUpdate((current) => ({
      ...current,
      voiceRecordings: current.voiceRecordings.map((item) =>
        item.id === id ? { ...item, title: value } : item
      ),
    }));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-10 text-center">
        <h2 className="font-serif text-4xl text-warm-dark">Photos and Legacy</h2>
        <p className="mt-3 text-lg text-warm-dark/60">
          Upload, order, review, and recover media from one place.
        </p>
      </div>

      <div className="space-y-6">
        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

        <SectionCard
          title="Cover photo"
          description="This image anchors the memorial header."
          actions={
            !readOnly && (
              <button
                onClick={() => coverRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
              >
                <Upload size={16} />
                {data.coverPhotoPreview ? 'Replace' : 'Upload'}
              </button>
            )
          }
        >
          {data.coverPhotoPreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-warm-border/30">
              <button type="button" onClick={() => setSelectedDetail({ section: 'cover' })} className="block w-full">
                <img src={data.coverPhotoPreview} alt="Cover" className="h-72 w-full object-cover" />
              </button>
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-warm-dark shadow-sm">
                {statusLabel(data.coverPhotoUploadStatus) || 'Ready'}
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => coverRef.current?.click()}
              className="flex h-72 w-full items-center justify-center rounded-2xl border-2 border-dashed border-warm-border/40 bg-warm-border/10 text-warm-dark/45 hover:border-olive/30 hover:bg-olive/5 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Upload size={16} />
                Add a cover photo
              </span>
            </button>
          )}
        </SectionCard>

        <SectionCard
          title="Photo gallery"
          description="Large galleries stay tidy with ordering, bulk actions, and progressive loading."
          actions={
            <div className="flex items-center gap-2">
              {!readOnly && selectedGalleryIds.length > 0 && (
                <button
                  onClick={bulkDeleteGallery}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete selected
                </button>
              )}
              {!readOnly && (
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
                >
                  <Plus size={16} />
                  Add photos
                </button>
              )}
            </div>
          }
        >
          {data.gallery.length === 0 ? (
            <ImageFallbackCard label="No gallery photos yet." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.gallery.slice(0, visibleGalleryCount).map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-warm-border/30 p-3 shadow-sm">
                    <div className="relative overflow-hidden rounded-xl bg-warm-border/10">
                      {item.preview ? (
                        <button type="button" onClick={() => setSelectedDetail({ section: 'gallery', id: item.id })} className="block w-full">
                          <img src={item.preview} alt={item.caption || `Gallery photo ${index + 1}`} className="aspect-square w-full object-cover" />
                        </button>
                      ) : (
                        <ImageFallbackCard label="Image preview unavailable." />
                      )}
                      {!readOnly && (
                        <label className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-2 py-1 text-xs shadow-sm">
                          <input
                            type="checkbox"
                            checked={selectedGalleryIds.includes(item.id)}
                            onChange={(event) =>
                              setSelectedGalleryIds((current) =>
                                event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)
                              )
                            }
                          />
                          Select
                        </label>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-warm-dark/45">
                        <span>{statusLabel(item.uploadStatus) || 'Ready'}</span>
                        {!readOnly && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveGalleryItem(item.id, -1)} className="rounded-lg border border-warm-border/30 p-1 hover:bg-warm-border/10" disabled={index === 0}>
                              <ChevronLeft size={14} />
                            </button>
                            <button onClick={() => moveGalleryItem(item.id, 1)} className="rounded-lg border border-warm-border/30 p-1 hover:bg-warm-border/10" disabled={index === data.gallery.length - 1}>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <input type="text" value={item.caption} onChange={(event) => updateGalleryField(item.id, 'caption', event.target.value)} onBlur={() => queueGalleryMetadataSync(item.id, 0)} placeholder="Optional title" disabled={readOnly} className="rounded-xl border border-warm-border/30 px-3 py-2 text-sm focus:border-olive focus:outline-none disabled:bg-warm-border/10" />
                      <input type="text" value={item.year} onChange={(event) => updateGalleryField(item.id, 'year', event.target.value)} onBlur={() => queueGalleryMetadataSync(item.id, 0)} placeholder="Year" disabled={readOnly} className="rounded-xl border border-warm-border/30 px-3 py-2 text-sm focus:border-olive focus:outline-none disabled:bg-warm-border/10" />
                    </div>
                  </div>
                ))}
              </div>
              {visibleGalleryCount < data.gallery.length && (
                <div className="pt-2 text-center">
                  <button onClick={() => setVisibleGalleryCount((current) => current + PAGE_SIZE)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Load more gallery items
                  </button>
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Interactive photo stories"
          description="Pair an image with hidden context that appears when visitors linger."
          actions={
            !readOnly && (
              <button
                onClick={() => (isPaid ? interactiveRef.current?.click() : setShowPaywall(true))}
                className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
              >
                <MousePointer size={16} />
                Add story
              </button>
            )
          }
        >
          {data.interactiveGallery.length === 0 ? (
            <ImageFallbackCard label="No interactive stories yet." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.interactiveGallery.slice(0, visibleInteractiveCount).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-warm-border/30 p-3 shadow-sm">
                    <button type="button" onClick={() => setSelectedDetail({ section: 'interactive', id: item.id })} className="block w-full overflow-hidden rounded-xl">
                      <img src={item.preview} alt="Interactive story" className="aspect-video w-full object-cover" />
                    </button>
                    <textarea value={item.description} onChange={(event) => updateInteractiveDescription(item.id, event.target.value)} onBlur={() => queueInteractiveMetadataSync(item.id, 0)} rows={4} disabled={readOnly} placeholder="What story should this image reveal?" className="mt-3 w-full rounded-xl border border-warm-border/30 px-3 py-3 text-sm focus:border-olive focus:outline-none disabled:bg-warm-border/10" />
                    <p className="mt-2 text-xs leading-relaxed text-warm-dark/45">
                      This text appears on the public memorial and inside the story viewer.
                    </p>
                    {!readOnly && (
                      <div className="mt-2 flex justify-end">
                        <button onClick={() => setPendingRemoval({ kind: 'single', section: 'interactive', id: item.id })} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {visibleInteractiveCount < data.interactiveGallery.length && (
                <div className="pt-2 text-center">
                  <button onClick={() => setVisibleInteractiveCount((current) => current + PAGE_SIZE)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Load more interactive stories
                  </button>
                </div>
              )}
            </>
          )}
        </SectionCard>
        <SectionCard
          title="Voice recordings"
          description="Track spoken memories with upload state and restore support."
          actions={
            !readOnly && (
              <button
                onClick={() => (isPaid ? voiceRef.current?.click() : setShowPaywall(true))}
                className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
              >
                <AudioLines size={16} />
                Add recording
              </button>
            )
          }
        >
          {data.voiceRecordings.length === 0 ? (
            <ImageFallbackCard label="No voice recordings yet." />
          ) : (
            <div className="space-y-3">
              {data.voiceRecordings.map((item) => (
                <div key={item.id} className="rounded-2xl border border-warm-border/30 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <input type="text" value={item.title} onChange={(event) => updateVoiceTitle(item.id, event.target.value)} disabled={readOnly} className="w-full rounded-xl border border-warm-border/30 px-3 py-2 text-sm focus:border-olive focus:outline-none disabled:bg-warm-border/10" />
                      <p className="mt-2 text-xs text-warm-dark/45">{statusLabel(item.uploadStatus) || item.originalFileName || 'Ready'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.url && (
                        <button onClick={() => setSelectedDetail({ section: 'voice', id: item.id })} className="rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                          Details
                        </button>
                      )}
                      {!readOnly && (
                        <button onClick={() => setPendingRemoval({ kind: 'single', section: 'voice', id: item.id })} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Legacy statement" description="This appears prominently on the memorial page.">
          <textarea
            value={data.legacyStatement}
            onChange={(event) => applyUpdate((current) => ({ ...current, legacyStatement: event.target.value }))}
            rows={7}
            disabled={readOnly}
            placeholder="What should future generations understand about this life?"
            className="w-full rounded-2xl border border-warm-border/30 px-4 py-4 text-base leading-relaxed focus:border-olive focus:outline-none disabled:bg-warm-border/10"
          />
        </SectionCard>

        {recentlyDeleted.length > 0 && (
          <SectionCard title="Recently removed" description="Soft-deleted items can be restored while you stay on this page.">
            <div className="space-y-3">
              {recentlyDeleted.map((entry, index) => (
                <div key={`${entry.section}-${index}`} className="flex items-center justify-between rounded-xl border border-warm-border/30 px-4 py-3 text-sm">
                  <span className="text-warm-dark/70">
                    {entry.section === 'cover'
                      ? 'Cover photo'
                      : entry.section === 'gallery'
                        ? entry.item.caption || 'Gallery photo'
                        : entry.section === 'interactive'
                          ? 'Interactive story'
                          : entry.item.title || 'Voice recording'}
                  </span>
                  <button onClick={() => restoreDeletedItem(entry, index)} className="rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadCover(file); event.currentTarget.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length > 0) uploadGalleryFiles(files); event.currentTarget.value = ''; }} />
      <input ref={interactiveRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length > 0) uploadInteractiveFiles(files); event.currentTarget.value = ''; }} />
      <input ref={voiceRef} type="file" accept="audio/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length > 0) uploadVoiceFiles(files); event.currentTarget.value = ''; }} />
      <input ref={replaceRef} type="file" accept={replaceTarget?.section === 'voice' ? 'audio/*' : 'image/*'} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) replaceMedia(file); event.currentTarget.value = ''; }} />

      <div className="mt-10 flex gap-4">
        <button onClick={onBack} className="rounded-xl border border-warm-border/30 px-6 py-4 font-medium hover:bg-warm-border/10">
          Return
        </button>
        <button onClick={onNext} className="flex-1 rounded-xl bg-olive px-6 py-4 font-medium text-warm-bg hover:bg-olive/90">
          Continue to video memories
        </button>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-[120] bg-warm-dark/60 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-4xl items-center justify-center">
            <div className="w-full rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-warm-dark">{detailItem.title}</h3>
                  {detailItem.subtitle && <p className="text-sm text-warm-dark/50">{detailItem.subtitle}</p>}
                </div>
                <button onClick={() => setSelectedDetail(null)} className="rounded-full p-2 hover:bg-warm-border/10">
                  <X size={18} />
                </button>
              </div>
              {detailItem.section === 'voice' ? (
                detailItem.preview ? (
                  <audio controls className="w-full">
                    <source src={detailItem.preview} />
                  </audio>
                ) : (
                  <ImageFallbackCard label="Audio preview unavailable." />
                )
              ) : detailItem.preview ? (
                <img src={detailItem.preview} alt={detailItem.title} className="max-h-[60vh] w-full rounded-2xl object-contain" />
              ) : (
                <ImageFallbackCard label="Preview unavailable." />
              )}
              {!readOnly && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => { setReplaceTarget({ section: detailItem.section, id: detailItem.section === 'cover' ? undefined : detailItem.item?.id }); replaceRef.current?.click(); }} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Replace
                  </button>
                  {detailItem.section === 'gallery' && detailItem.item && (
                    <>
                      <button onClick={() => moveGalleryItem(detailItem.item.id, -1)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                        Move earlier
                      </button>
                      <button onClick={() => moveGalleryItem(detailItem.item.id, 1)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                        Move later
                      </button>
                    </>
                  )}
                  <button onClick={() => setPendingRemoval({ kind: 'single', section: detailItem.section, id: detailItem.section === 'cover' ? undefined : detailItem.item?.id })} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-warm-dark/60 p-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-10 text-center shadow-2xl">
            <button onClick={() => setShowPaywall(false)} className="absolute right-4 top-4 rounded-full p-2 text-warm-dark/30 hover:bg-warm-border/10 hover:text-warm-dark">
              <X size={18} />
            </button>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-olive/10">
              <Sparkles size={38} className="text-olive" />
            </div>
            <h3 className="font-serif text-3xl text-warm-dark">Unlock the full presence</h3>
            <p className="mt-4 text-sm leading-relaxed text-warm-dark/60">
              Private previews keep media intentionally small. Publish the memorial to unlock unlimited photos,
              interactive stories, and voice recordings.
            </p>
            <div className="mt-8 space-y-3">
              <button onClick={onBackToHub} className="w-full rounded-xl bg-warm-brown px-4 py-4 font-bold text-surface-low hover:shadow-xl">
                Become a Permanent Guardian (${PLAN_PRICES_USD.personal.toLocaleString()})
              </button>
              <button onClick={() => setShowPaywall(false)} className="w-full rounded-xl px-4 py-3 text-sm text-warm-dark/45 hover:bg-warm-border/10">
                Keep working in private preview
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={pendingRemoval !== null}
        title={pendingRemoval?.kind === 'bulk-gallery' ? 'Delete the selected photos?' : 'Remove this media item?'}
        description={
          pendingRemoval?.kind === 'bulk-gallery'
            ? 'The selected gallery photos will be removed, but you can still restore them while you stay on this page.'
            : 'This item will be removed, but you can still restore it while you stay on this page.'
        }
        confirmLabel={pendingRemoval?.kind === 'bulk-gallery' ? 'Delete selected' : 'Remove item'}
        variant="danger"
        onConfirm={() => {
          void handleConfirmRemoval();
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
