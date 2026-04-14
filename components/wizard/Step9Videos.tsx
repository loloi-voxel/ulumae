'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import TutorialPopup from '@/components/TutorialPopup';
import { DRAFT_VIDEO_LIMIT, MAX_VIDEO_FILE_SIZE_BYTES, PAID_VIDEO_LIMIT } from '@/lib/constants';
import { deleteMediaAssets, secureUpload } from '@/lib/uploadService';
import type { VideoContent, VideoReference } from '@/types/memorial';

interface Step9Props {
  data: VideoContent;
  onUpdate: (data: VideoContent) => void;
  onNext: () => void;
  onBack: () => void;
  memorialId: string | null;
  isPaid?: boolean;
  readOnly?: boolean;
}

type DeletedVideo = { video: VideoReference };

const PAGE_SIZE = 8;

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
  return 'Ready';
}

async function getVideoDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const mins = Math.floor(video.duration / 60);
      const secs = Math.floor(video.duration % 60);
      URL.revokeObjectURL(video.src);
      resolve(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve('0:00');
    };
    video.src = URL.createObjectURL(file);
  });
}

async function createVideoThumbnail(file: File) {
  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, Math.max(video.duration / 3, 0.2));
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not create a thumbnail.'));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src);
        if (!blob) {
          reject(new Error('Could not create a thumbnail.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not load the selected video.'));
    };

    video.src = URL.createObjectURL(file);
  });
}

export default function Step9Videos({
  data,
  onUpdate,
  onNext,
  onBack,
  memorialId,
  isPaid = false,
  readOnly,
}: Step9Props) {
  const videoRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef(data);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedVideo[]>([]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (data.videos.length === 0 && !readOnly) {
      const timer = window.setTimeout(() => setShowTutorial(true), 400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [data.videos.length, readOnly]);

  const applyUpdate = (updater: (current: VideoContent) => VideoContent) => {
    const next = updater(dataRef.current);
    dataRef.current = next;
    onUpdate(next);
  };

  const detailItem = useMemo(
    () => data.videos.find((item) => item.id === selectedDetailId) || null,
    [data.videos, selectedDetailId]
  );

  const maxVideos = isPaid ? PAID_VIDEO_LIMIT : DRAFT_VIDEO_LIMIT;

  const ensureMemorial = () => {
    if (!memorialId) {
      setErrorMessage('Please wait for the memorial draft to finish initializing before adding videos.');
      return false;
    }
    return true;
  };

  const uploadVideoFiles = async (files: File[]) => {
    if (!ensureMemorial()) return;
    const remaining = maxVideos - dataRef.current.videos.length;
    if (remaining <= 0) {
      setErrorMessage(`This memorial can hold up to ${maxVideos} video item(s).`);
      return;
    }

    const accepted = files.slice(0, remaining);
    if (accepted.length < files.length) {
      setErrorMessage(`Only ${remaining} video slot(s) remain right now.`);
    }

    for (const file of accepted) {
      if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        setErrorMessage(`"${file.name}" exceeds the ${Math.round(MAX_VIDEO_FILE_SIZE_BYTES / 1024 / 1024)}MB video limit.`);
        continue;
      }

      const tempId = `video-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const localUrl = URL.createObjectURL(file);
      const duration = await getVideoDuration(file);
      const pendingVideo: VideoReference = {
        id: tempId,
        file,
        url: localUrl,
        thumbnail: localUrl,
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: '',
        duration,
        uploadStatus: 'uploading',
        uploadError: null,
      };

      applyUpdate((current) => ({
        ...current,
        videos: [...current.videos, pendingVideo],
      }));

      const videoResult = await secureUpload(file, {
        memorialId: memorialId!,
        kind: 'video',
        metadata: { duration },
      });

      if (!videoResult.success || !videoResult.asset) {
        applyUpdate((current) => ({
          ...current,
          videos: current.videos.map((item) =>
            item.id === tempId ? { ...item, uploadStatus: 'error', uploadError: videoResult.error || 'Upload failed.' } : item
          ),
        }));
        setErrorMessage(videoResult.error || `Could not upload ${file.name}.`);
        continue;
      }

      let thumbnailAsset = null;
      try {
        const thumbnailBlob = await createVideoThumbnail(file);
        const thumbnailFile = new File([thumbnailBlob], `${tempId}.png`, { type: 'image/png' });
        const thumbResult = await secureUpload(thumbnailFile, {
          memorialId: memorialId!,
          kind: 'video_thumbnail',
          metadata: { videoAssetId: videoResult.asset.id },
        });
        if (thumbResult.success && thumbResult.asset) {
          thumbnailAsset = thumbResult.asset;
        }
      } catch {
        thumbnailAsset = null;
      }

      applyUpdate((current) => ({
        ...current,
        videos: current.videos.map((item) =>
          item.id === tempId
            ? {
                ...item,
                file: null,
                url: videoResult.asset!.publicUrl,
                thumbnail: thumbnailAsset?.publicUrl || videoResult.asset!.publicUrl,
                assetId: videoResult.asset!.id,
                bucket: videoResult.asset!.bucket,
                storagePath: videoResult.asset!.storagePath,
                originalFileName: videoResult.asset!.originalFileName,
                mimeType: videoResult.asset!.mimeType,
                fileSize: videoResult.asset!.fileSize,
                uploadedAt: videoResult.asset!.createdAt,
                uploadStatus: 'ready',
                uploadError: null,
                sha256_hash: videoResult.asset!.sha256Hash,
                thumbnailAssetId: thumbnailAsset?.id || null,
                thumbnailBucket: thumbnailAsset?.bucket || null,
                thumbnailStoragePath: thumbnailAsset?.storagePath || null,
                thumbnailMimeType: thumbnailAsset?.mimeType || null,
                thumbnailFileSize: thumbnailAsset?.fileSize || null,
                thumbnailUploadedAt: thumbnailAsset?.createdAt || null,
              }
            : item
        ),
      }));
    }
  };

  const removeVideo = async (id: string) => {
    if (readOnly) return;
    const video = dataRef.current.videos.find((item) => item.id === id);
    if (!video) return;
    if (!window.confirm('Remove this video? You can restore it while you stay on this page.')) {
      return;
    }

    try {
      const assetIds = [video.assetId, video.thumbnailAssetId].filter(Boolean) as string[];
      if (memorialId && assetIds.length > 0) {
        await deleteMediaAssets(memorialId, assetIds, 'soft');
      }
      setRecentlyDeleted((current) => [{ video }, ...current]);
      applyUpdate((current) => ({
        ...current,
        videos: current.videos.filter((item) => item.id !== id),
      }));
      setSelectedIds((current) => current.filter((value) => value !== id));
      setSelectedDetailId(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not remove this video.');
    }
  };

  const restoreVideo = async (entry: DeletedVideo, index: number) => {
    try {
      const assetIds = [entry.video.assetId, entry.video.thumbnailAssetId].filter(Boolean) as string[];
      if (memorialId && assetIds.length > 0) {
        await deleteMediaAssets(memorialId, assetIds, 'restore');
      }
      applyUpdate((current) => ({
        ...current,
        videos: [entry.video, ...current.videos],
      }));
      setRecentlyDeleted((current) => current.filter((_, itemIndex) => itemIndex !== index));
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not restore this video.');
    }
  };

  const moveVideo = (id: string, direction: -1 | 1) => {
    applyUpdate((current) => {
      const index = current.videos.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.videos.length) return current;
      return {
        ...current,
        videos: moveItem(current.videos, index, nextIndex),
      };
    });
  };

  const updateVideoField = (id: string, field: 'title' | 'description', value: string) => {
    applyUpdate((current) => ({
      ...current,
      videos: current.videos.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const bulkDelete = async () => {
    for (const id of selectedIds) {
      // eslint-disable-next-line no-await-in-loop
      await removeVideo(id);
    }
    setSelectedIds([]);
  };

  const tutorialSteps = [
    {
      target: '[data-tutorial="videos"]',
      title: 'Add videos',
      description: 'Upload, order, and recover video memories from this single media queue.',
      position: 'bottom' as const,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-10">
        <h2 className="font-serif text-4xl text-warm-dark">Video memories</h2>
        <p className="mt-3 text-lg text-warm-dark/60">
          Secure uploads, ordering, and recovery now work the same way they do for photos.
        </p>
      </div>

      <div className="space-y-6">
        {errorMessage && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-warm-border/30 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-warm-dark">Video gallery</h3>
              <p className="text-sm text-warm-dark/50">
                {data.videos.length} of {maxVideos} video slot(s) used.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!readOnly && selectedIds.length > 0 && (
                <button onClick={bulkDelete} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                  <Trash2 size={16} />
                  Delete selected
                </button>
              )}
              {!readOnly && (
                <button data-tutorial="videos" onClick={() => videoRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                  <Plus size={16} />
                  Add videos
                </button>
              )}
            </div>
          </div>

          {data.videos.length === 0 ? (
            <div className="mt-5 flex min-h-[16rem] items-center justify-center rounded-2xl border-2 border-dashed border-warm-border/40 bg-warm-border/10 text-center text-warm-dark/40">
              <div>
                <Film size={32} className="mx-auto mb-3" />
                <p>No videos yet.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.videos.slice(0, visibleCount).map((video, index) => (
                  <div key={video.id} className="rounded-2xl border border-warm-border/30 p-4 shadow-sm">
                    <div className="relative overflow-hidden rounded-xl bg-warm-dark/10">
                      <button type="button" onClick={() => setSelectedDetailId(video.id)} className="block w-full">
                        <video controls preload="metadata" className="aspect-video w-full object-cover" poster={video.thumbnail}>
                          <source src={video.url} type={video.mimeType || 'video/mp4'} />
                        </video>
                      </button>
                      {!readOnly && (
                        <label className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-2 py-1 text-xs shadow-sm">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(video.id)}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked ? [...current, video.id] : current.filter((value) => value !== video.id)
                              )
                            }
                          />
                          Select
                        </label>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div className="flex items-center justify-between text-xs text-warm-dark/45">
                        <span>{statusLabel(video.uploadStatus)}</span>
                        {!readOnly && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveVideo(video.id, -1)} className="rounded-lg border border-warm-border/30 p-1 hover:bg-warm-border/10" disabled={index === 0}>
                              <ChevronLeft size={14} />
                            </button>
                            <button onClick={() => moveVideo(video.id, 1)} className="rounded-lg border border-warm-border/30 p-1 hover:bg-warm-border/10" disabled={index === data.videos.length - 1}>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <input type="text" value={video.title} onChange={(event) => updateVideoField(video.id, 'title', event.target.value)} disabled={readOnly} placeholder="Title" className="rounded-xl border border-warm-border/30 px-3 py-2 text-sm focus:border-olive focus:outline-none disabled:bg-warm-border/10" />
                      <textarea value={video.description || ''} onChange={(event) => updateVideoField(video.id, 'description', event.target.value)} rows={3} disabled={readOnly} placeholder="Description" className="rounded-xl border border-warm-border/30 px-3 py-3 text-sm focus:border-olive focus:outline-none disabled:bg-warm-border/10" />
                      <div className="flex items-center justify-between text-xs text-warm-dark/45">
                        <span className="inline-flex items-center gap-1">
                          <Play size={12} />
                          {video.duration || '0:00'}
                        </span>
                        {!readOnly && (
                          <button onClick={() => removeVideo(video.id)} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {visibleCount < data.videos.length && (
                <div className="pt-4 text-center">
                  <button onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Load more videos
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {recentlyDeleted.length > 0 && (
          <div className="rounded-2xl border border-warm-border/30 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-warm-dark">Recently removed</h3>
            <p className="text-sm text-warm-dark/50">You can restore removed videos while you stay on this page.</p>
            <div className="mt-4 space-y-3">
              {recentlyDeleted.map((entry, index) => (
                <div key={`${entry.video.id}-${index}`} className="flex items-center justify-between rounded-xl border border-warm-border/30 px-4 py-3 text-sm">
                  <span className="text-warm-dark/70">{entry.video.title || 'Untitled video'}</span>
                  <button onClick={() => restoreVideo(entry, index)} className="rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <input ref={videoRef} type="file" accept="video/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length > 0) uploadVideoFiles(files); event.currentTarget.value = ''; }} disabled={readOnly} />
      <input ref={replaceRef} type="file" accept="video/*" className="hidden" onChange={() => undefined} />

      <div className="mt-10 flex gap-4">
        <button onClick={onBack} className="rounded-xl border border-warm-border/30 px-6 py-4 font-medium hover:bg-warm-border/10">
          Return
        </button>
        <button onClick={onNext} className="flex-1 rounded-xl bg-olive px-6 py-4 font-medium text-warm-bg hover:bg-olive/90">
          Continue to review
        </button>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-[120] bg-warm-dark/60 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-4xl items-center justify-center">
            <div className="w-full rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-warm-dark">{detailItem.title || 'Video'}</h3>
                  <p className="text-sm text-warm-dark/50">{detailItem.duration || '0:00'}</p>
                </div>
                <button onClick={() => setSelectedDetailId(null)} className="rounded-full p-2 hover:bg-warm-border/10">
                  <X size={18} />
                </button>
              </div>
              <video controls preload="metadata" className="aspect-video w-full rounded-2xl bg-warm-dark/10" poster={detailItem.thumbnail}>
                <source src={detailItem.url} type={detailItem.mimeType || 'video/mp4'} />
              </video>
              {!readOnly && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => moveVideo(detailItem.id, -1)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Move earlier
                  </button>
                  <button onClick={() => moveVideo(detailItem.id, 1)} className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10">
                    Move later
                  </button>
                  <button onClick={() => removeVideo(detailItem.id)} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTutorial && (
        <TutorialPopup
          steps={tutorialSteps}
          onComplete={() => setShowTutorial(false)}
          onSkip={() => setShowTutorial(false)}
        />
      )}
    </div>
  );
}
