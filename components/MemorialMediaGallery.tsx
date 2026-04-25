'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  Play,
  X,
} from 'lucide-react';

import IntegrityBadge from '@/components/IntegrityBadge';

export interface MemorialGalleryPhotoItem {
  id: string;
  src: string;
  alt: string;
  name: string;
  caption?: string;
  year?: string;
  integrityHash?: string;
  isLocal?: boolean;
}

export interface MemorialGalleryVideoItem {
  id: string;
  src: string;
  name: string;
  title?: string;
  description?: string;
  thumbnailSrc?: string | null;
  poster?: string | null;
  mimeType?: string | null;
  integrityHash?: string;
  isLocal?: boolean;
}

interface MemorialMediaGalleryProps {
  photos: MemorialGalleryPhotoItem[];
  videos: MemorialGalleryVideoItem[];
  isPreview?: boolean;
}

const GRID_PREVIEW_LIMIT = 8;

function getVideoEmbedUrl(video: MemorialGalleryVideoItem): string | null {
  try {
    const url = new URL(video.src);
    const hostname = url.hostname.replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const videoId = url.searchParams.get('v');
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
      }

      const match = url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/);
      return match?.[1] ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
    }

    if (hostname === 'vimeo.com' || hostname === 'player.vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean).pop();
      return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : null;
    }
  } catch {
    return null;
  }

  return null;
}

function countLabel(label: 'photo' | 'video', count: number) {
  if (count === 0) return '';
  return `${count} ${label}${count > 1 ? 's' : ''}`;
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive/10 text-olive">
          {icon}
        </div>
        <div>
          <h2 className="font-serif text-4xl text-warm-dark">{title}</h2>
        </div>
      </div>

      {count ? (
        <span className="inline-flex w-fit items-center rounded-full border border-warm-border/40 bg-surface-mid px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-warm-dark/60">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function MediaGrid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}

function PhotoThumb({
  photo,
  onClick,
  disabled,
}: {
  photo: MemorialGalleryPhotoItem;
  onClick: () => void;
  disabled?: boolean;
}) {
  const hasMeta = Boolean(photo.caption || photo.year);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative aspect-[16/10] overflow-hidden rounded-[24px] border border-warm-border/25 bg-white text-left shadow-sm transition-all ${
        disabled ? 'cursor-default opacity-45' : 'hover:-translate-y-0.5 hover:shadow-lg'
      }`}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
      />

      {hasMeta ? (
        <div className="absolute right-3 top-3 max-w-[70%] rounded-2xl bg-surface-low/92 px-3 py-2 text-right shadow-lg backdrop-blur-sm">
          {photo.caption ? <p className="line-clamp-2 text-sm text-warm-dark">{photo.caption}</p> : null}
          {photo.year ? <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-warm-dark/60">{photo.year}</p> : null}
        </div>
      ) : null}

      {photo.integrityHash ? <IntegrityBadge hash={photo.integrityHash} className="top-3 left-3" /> : null}
    </button>
  );
}

function VideoThumb({
  video,
  onClick,
  disabled,
}: {
  video: MemorialGalleryVideoItem;
  onClick: () => void;
  disabled?: boolean;
}) {
  const embedUrl = getVideoEmbedUrl(video);
  const canPreviewWithVideoTag = !embedUrl && !video.thumbnailSrc;
  const hasTitle = Boolean(video.title?.trim());

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative aspect-[16/10] overflow-hidden rounded-[24px] border border-warm-border/25 bg-white text-left shadow-sm transition-all ${
        disabled ? 'cursor-default opacity-45' : 'hover:-translate-y-0.5 hover:shadow-lg'
      }`}
    >
      <div className="relative h-full w-full overflow-hidden bg-warm-dark/10">
        {video.thumbnailSrc ? (
          <img
            src={video.thumbnailSrc}
            alt={video.title || 'Video thumbnail'}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : canPreviewWithVideoTag ? (
          <video
            src={video.src}
            muted
            preload="metadata"
            playsInline
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-warm-dark/15">
            <Clapperboard size={28} className="text-warm-dark/50" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-warm-dark/90 via-warm-dark/10 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-low/90 shadow-lg">
            <Play size={20} className="fill-warm-dark text-warm-dark" />
          </div>
        </div>
      </div>

      {hasTitle ? (
        <div className="absolute right-3 top-3 z-10 max-w-[70%] rounded-2xl bg-surface-low/92 px-3 py-2 text-right shadow-lg backdrop-blur-sm">
          <p className="line-clamp-2 text-sm text-warm-dark">{video.title}</p>
        </div>
      ) : null}

      {video.integrityHash ? <IntegrityBadge hash={video.integrityHash} className="top-3 left-3" /> : null}
    </button>
  );
}

function EmptyState({
  title,
}: {
  title: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-warm-border/40 bg-surface-mid/70 px-6 py-10 text-center text-sm text-warm-dark/50">
      {title}
    </div>
  );
}

function GalleryModal({
  open,
  title,
  count,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  count: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 overflow-hidden bg-surface-low"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} gallery`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-full w-full flex-col bg-surface-low">
        <div className="flex items-center justify-between gap-4 border-b border-warm-border/20 bg-surface-low px-5 py-4 md:px-8 md:py-5">
          <div>
            <h3 className="font-serif text-3xl text-warm-dark">{title}</h3>
            <p className="mt-1 text-sm text-warm-dark/50">
              {count} item{count > 1 ? 's' : ''}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-warm-border/35 bg-white text-warm-dark transition-colors hover:bg-surface-mid"
            aria-label={`Close ${title} gallery`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-low px-5 py-5 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ViewerControls({
  currentIndex,
  total,
  onPrevious,
  onNext,
}: {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const previousDisabled = currentIndex === 0;
  const nextDisabled = currentIndex === total - 1;

  return (
    <>
      <button
        type="button"
        onClick={onPrevious}
        disabled={previousDisabled}
        className="fixed left-3 top-1/2 z-[80] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-warm-dark/70 text-surface-low shadow-xl backdrop-blur-md transition-all hover:bg-warm-dark/82 disabled:cursor-not-allowed disabled:opacity-30 md:left-6 md:h-16 md:w-16"
        aria-label="Previous item"
      >
        <ChevronLeft size={28} />
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="fixed right-3 top-1/2 z-[80] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-warm-dark/70 text-surface-low shadow-xl backdrop-blur-md transition-all hover:bg-warm-dark/82 disabled:cursor-not-allowed disabled:opacity-30 md:right-6 md:h-16 md:w-16"
        aria-label="Next item"
      >
        <ChevronRight size={28} />
      </button>
    </>
  );
}

function Lightbox({
  photos,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
}: {
  photos: MemorialGalleryPhotoItem[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const photo = photos[currentIndex];
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  if (!photo || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 isolate bg-warm-dark/92 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || photo.name || 'Photo viewer'}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-black/5 text-gray-700 transition-all hover:bg-black/10 md:right-6 md:top-6"
        aria-label="Close photo viewer"
      >
        <X size={20} />
      </button>

      {photos.length > 1 ? (
        <ViewerControls
          currentIndex={currentIndex}
          total={photos.length}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      ) : null}

      <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-6 md:px-20">
        <div className="relative flex max-h-full w-full flex-col items-center gap-5">
          <img
            src={photo.src}
            alt={photo.alt}
            className="max-h-[82vh] w-auto max-w-full rounded-[28px] object-contain shadow-2xl"
          />

          {(photo.caption || photo.year) ? (
            <div className="absolute right-3 top-3 z-10 max-w-[min(32rem,70vw)] rounded-[28px] border border-warm-border/20 bg-surface-low/95 px-5 py-4 text-right shadow-lg backdrop-blur-md md:right-6 md:top-6">
              {photo.caption ? <p className="text-lg text-warm-dark">{photo.caption}</p> : null}
              {photo.year ? (
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-warm-dark/55">{photo.year}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-black/10 bg-black/5 px-4 py-2">
        <p className="text-sm text-gray-700">
          {currentIndex + 1} / {photos.length}
        </p>
      </div>
    </div>,
    document.body
  );
}

function VideoPlayerModal({
  videos,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
}: {
  videos: MemorialGalleryVideoItem[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const video = videos[currentIndex];
  const embedUrl = video ? getVideoEmbedUrl(video) : null;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  if (!video || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 isolate bg-warm-dark/94 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={video.title || video.name || 'Video viewer'}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-black/5 text-gray-700 transition-all hover:bg-black/10 md:right-6 md:top-6"
        aria-label="Close video player"
      >
        <X size={20} />
      </button>

      {videos.length > 1 ? (
        <ViewerControls
          currentIndex={currentIndex}
          total={videos.length}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      ) : null}

      <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-6 md:px-20">
        <div className="relative flex w-full max-w-5xl flex-col items-center gap-5">
          <div className="w-full overflow-hidden rounded-[28px] bg-black shadow-2xl">
            {embedUrl ? (
              <div className="aspect-video w-full">
                <iframe
                  key={video.id}
                  src={embedUrl}
                  title={video.title || 'Video player'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            ) : (
              <video
                key={video.id}
                controls
                autoPlay
                preload="metadata"
                poster={video.poster || video.thumbnailSrc || undefined}
                className="block max-h-[80vh] w-full bg-black"
              >
                <source src={video.src} type={video.mimeType || undefined} />
              </video>
            )}
          </div>

          {(video.title || video.description) ? (
            <div className="absolute right-3 top-3 z-10 max-w-[min(32rem,70vw)] rounded-[28px] border border-warm-border/20 bg-surface-low/95 px-5 py-4 text-right shadow-lg backdrop-blur-md md:right-6 md:top-6">
              {video.title ? <p className="text-lg text-warm-dark">{video.title}</p> : null}
              {video.description ? (
                <p className="mt-1 text-sm leading-relaxed text-warm-dark/80">{video.description}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-black/10 bg-black/5 px-4 py-2">
        <p className="text-sm text-gray-700">
          {currentIndex + 1} / {videos.length}
        </p>
      </div>
    </div>,
    document.body
  );
}

function PhotoSection({
  photos,
  isPreview,
  onOpenGallery,
  onOpenPhoto,
}: {
  photos: MemorialGalleryPhotoItem[];
  isPreview: boolean;
  onOpenGallery: () => void;
  onOpenPhoto: (index: number) => void;
}) {
  const visiblePhotos = photos.slice(0, GRID_PREVIEW_LIMIT);
  const shouldShowOpenAll = photos.length > GRID_PREVIEW_LIMIT && !isPreview;

  return (
    <section className="rounded-3xl border border-warm-border/30 bg-white/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
      <div className="space-y-6">
        <SectionHeader
          icon={<ImageIcon size={22} className="text-olive" />}
          title="Photos"
          count={countLabel('photo', photos.length)}
        />

        {photos.length === 0 ? (
          <EmptyState title="No photos yet. Start by adding a few images." />
        ) : (
          <MediaGrid>
            {visiblePhotos.map((photo, index) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onClick={() => onOpenPhoto(index)}
                disabled={isPreview && index > 0}
              />
            ))}
          </MediaGrid>
        )}

        {shouldShowOpenAll ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onOpenGallery}
              className="rounded-full border border-olive/20 bg-olive px-5 py-3 text-sm font-medium text-surface-low transition-all hover:bg-olive/90"
            >
              Open all photos ({photos.length})
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function VideoSection({
  videos,
  isPreview,
  onOpenGallery,
  onOpenVideo,
}: {
  videos: MemorialGalleryVideoItem[];
  isPreview: boolean;
  onOpenGallery: () => void;
  onOpenVideo: (index: number) => void;
}) {
  const visibleVideos = videos.slice(0, GRID_PREVIEW_LIMIT);
  const shouldShowOpenAll = videos.length > GRID_PREVIEW_LIMIT && !isPreview;

  return (
    <section className="rounded-3xl border border-warm-border/30 bg-white/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
      <div className="space-y-6">
        <SectionHeader
          icon={<Clapperboard size={22} className="text-olive" />}
          title="Videos"
          count={countLabel('video', videos.length)}
        />

        {videos.length === 0 ? (
          <EmptyState title="No videos yet. Start by adding a few clips." />
        ) : (
          <MediaGrid>
            {visibleVideos.map((video, index) => (
              <VideoThumb
                key={video.id}
                video={video}
                onClick={() => onOpenVideo(index)}
                disabled={isPreview && index > 0}
              />
            ))}
          </MediaGrid>
        )}

        {shouldShowOpenAll ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onOpenGallery}
              className="rounded-full border border-olive/20 bg-olive px-5 py-3 text-sm font-medium text-surface-low transition-all hover:bg-olive/90"
            >
              Open all videos ({videos.length})
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function MemorialMediaGallery({
  photos,
  videos,
  isPreview = false,
}: MemorialMediaGalleryProps) {
  const [isPhotoGalleryOpen, setIsPhotoGalleryOpen] = useState(false);
  const [isVideoGalleryOpen, setIsVideoGalleryOpen] = useState(false);
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null);
  const [videoPlayerIndex, setVideoPlayerIndex] = useState<number | null>(null);
  const allPhotos = photos;
  const allVideos = videos;

  useEffect(() => {
    const hasOverlayOpen =
      isPhotoGalleryOpen ||
      isVideoGalleryOpen ||
      photoLightboxIndex !== null ||
      videoPlayerIndex !== null;

    if (!hasOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPhotoGalleryOpen, isVideoGalleryOpen, photoLightboxIndex, videoPlayerIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (photoLightboxIndex !== null) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setPhotoLightboxIndex(null);
          return;
        }
        if (event.key === 'ArrowLeft' && photoLightboxIndex > 0) {
          event.preventDefault();
          setPhotoLightboxIndex((current) => (current === null ? current : current - 1));
          return;
        }
        if (event.key === 'ArrowRight' && photoLightboxIndex < allPhotos.length - 1) {
          event.preventDefault();
          setPhotoLightboxIndex((current) => (current === null ? current : current + 1));
          return;
        }
        return;
      }

      if (videoPlayerIndex !== null) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setVideoPlayerIndex(null);
          return;
        }
        if (event.key === 'ArrowLeft' && videoPlayerIndex > 0) {
          event.preventDefault();
          setVideoPlayerIndex((current) => (current === null ? current : current - 1));
          return;
        }
        if (event.key === 'ArrowRight' && videoPlayerIndex < allVideos.length - 1) {
          event.preventDefault();
          setVideoPlayerIndex((current) => (current === null ? current : current + 1));
          return;
        }
        return;
      }

      if (event.key !== 'Escape') return;

      if (isPhotoGalleryOpen) {
        event.preventDefault();
        setIsPhotoGalleryOpen(false);
        return;
      }

      if (isVideoGalleryOpen) {
        event.preventDefault();
        setIsVideoGalleryOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [allPhotos.length, allVideos.length, isPhotoGalleryOpen, isVideoGalleryOpen, photoLightboxIndex, videoPlayerIndex]);

  return (
    <>
      <div className="space-y-8">
        <PhotoSection
          photos={allPhotos}
          isPreview={isPreview}
          onOpenGallery={() => setIsPhotoGalleryOpen(true)}
          onOpenPhoto={setPhotoLightboxIndex}
        />

        <VideoSection
          videos={allVideos}
          isPreview={isPreview}
          onOpenGallery={() => setIsVideoGalleryOpen(true)}
          onOpenVideo={setVideoPlayerIndex}
        />
      </div>

      <GalleryModal
        open={isPhotoGalleryOpen}
        title="All photos"
        count={allPhotos.length}
        onClose={() => setIsPhotoGalleryOpen(false)}
      >
        {allPhotos.length === 0 ? (
          <EmptyState title="No photos available yet." />
        ) : (
          <MediaGrid>
            {allPhotos.map((photo, index) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onClick={() => setPhotoLightboxIndex(index)}
              />
            ))}
          </MediaGrid>
        )}
      </GalleryModal>

      <GalleryModal
        open={isVideoGalleryOpen}
        title="All videos"
        count={allVideos.length}
        onClose={() => setIsVideoGalleryOpen(false)}
      >
        {allVideos.length === 0 ? (
          <EmptyState title="No videos available yet." />
        ) : (
          <MediaGrid>
            {allVideos.map((video, index) => (
              <VideoThumb
                key={video.id}
                video={video}
                onClick={() => setVideoPlayerIndex(index)}
              />
            ))}
          </MediaGrid>
        )}
      </GalleryModal>

      {photoLightboxIndex !== null ? (
        <Lightbox
          photos={allPhotos}
          currentIndex={photoLightboxIndex}
          onClose={() => setPhotoLightboxIndex(null)}
          onPrevious={() => setPhotoLightboxIndex((current) => (current === null ? current : Math.max(current - 1, 0)))}
          onNext={() => setPhotoLightboxIndex((current) => (current === null ? current : Math.min(current + 1, allPhotos.length - 1)))}
        />
      ) : null}

      {videoPlayerIndex !== null ? (
        <VideoPlayerModal
          videos={allVideos}
          currentIndex={videoPlayerIndex}
          onClose={() => setVideoPlayerIndex(null)}
          onPrevious={() => setVideoPlayerIndex((current) => (current === null ? current : Math.max(current - 1, 0)))}
          onNext={() => setVideoPlayerIndex((current) => (current === null ? current : Math.min(current + 1, allVideos.length - 1)))}
        />
      ) : null}
    </>
  );
}
