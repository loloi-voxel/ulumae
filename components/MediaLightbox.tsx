'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface MediaLightboxItem {
  id: string;
  kind: 'image' | 'video';
  variant?: 'default' | 'interactive-story';
  src: string;
  thumbnailSrc?: string | null;
  poster?: string | null;
  mimeType?: string | null;
  alt?: string;
  title?: string;
  description?: string;
  caption?: string;
  year?: string;
}

interface MediaLightboxProps {
  items: MediaLightboxItem[];
  initialIndex: number;
  onClose: () => void;
}

function getInteractiveStoryCopy(item: MediaLightboxItem) {
  return (
    item.description ||
    item.caption ||
    item.title ||
    'Hover to reveal the story.'
  );
}

export default function MediaLightbox({
  items,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const wheelLockRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (currentIndex > items.length - 1) {
      setCurrentIndex(Math.max(items.length - 1, 0));
    }
  }, [currentIndex, items.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((previous) => (previous > 0 ? previous - 1 : items.length - 1));
  }, [items.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((previous) => (previous < items.length - 1 ? previous + 1 : 0));
  }, [items.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNext();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.querySelector<HTMLElement>('[data-close]')?.focus();

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (wheelLockRef.current) {
        window.clearTimeout(wheelLockRef.current);
      }
      previouslyFocusedRef.current?.focus();
    };
  }, [goToNext, goToPrevious, onClose]);

  if (!items.length) return null;

  const currentItem = items[currentIndex];
  const embedUrl = getVideoEmbedUrl(currentItem);
  const isInteractiveStory = currentItem.variant === 'interactive-story';
  const interactiveStoryCopy = getInteractiveStoryCopy(currentItem);
  const displayTitle = currentItem.title?.trim();
  const displayDescription = currentItem.description?.trim() || currentItem.caption?.trim();
  const displayYear = currentItem.year?.trim();
  const hasMeta = displayTitle || displayDescription || displayYear;
  const standardFrameStyle = {
    height:
      currentItem.kind === 'video'
        ? 'clamp(260px, 56vw, 720px)'
        : 'clamp(320px, 72vw, 820px)',
    maxHeight: '82vh',
  };
  const interactiveStoryStyle = {
    height: 'clamp(320px, 72vw, 760px)',
    maxHeight: '82vh',
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isInteractiveStory || items.length <= 1 || Math.abs(event.deltaY) < 16) {
      return;
    }

    event.preventDefault();

    if (wheelLockRef.current) {
      return;
    }

    if (event.deltaY > 0) {
      goToNext();
    } else {
      goToPrevious();
    }

    wheelLockRef.current = window.setTimeout(() => {
      wheelLockRef.current = null;
    }, 420);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={currentItem.title || `Media viewer ${currentIndex + 1} of ${items.length}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm"
      onWheel={handleWheel}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <button
        data-close
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/10 p-3 transition-all hover:bg-black/20"
        aria-label="Close viewer"
      >
        <X size={24} className="text-gray-700" />
      </button>

      {items.length > 1 && (
        <button
          onClick={goToPrevious}
          className="absolute left-4 z-10 rounded-full bg-black/10 p-3 transition-all hover:bg-black/20"
          aria-label="Previous item"
        >
          <ChevronLeft size={32} className="text-gray-700" />
        </button>
      )}

      <div className="relative mx-auto w-full max-w-7xl px-4 md:px-20">
        {isInteractiveStory ? (
          <div className="mx-auto flex w-full max-w-6xl items-center justify-center">
            <div
              className="group relative w-full overflow-hidden rounded-[30px] bg-warm-border/10 shadow-2xl"
              style={interactiveStoryStyle}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-surface-low via-[#f7f0e9] to-[#efe4d8] p-4">
                <div className="max-w-[84%] text-center">
                  {displayTitle ? (
                    <p className="mb-3 text-xs uppercase tracking-[0.24em] text-warm-dark/35">
                      {displayTitle}
                    </p>
                  ) : null}
                  <p className="font-serif text-center font-medium leading-relaxed text-warm-dark text-2xl md:text-3xl">
                    {interactiveStoryCopy}
                  </p>
                  {displayYear ? (
                    <p className="mt-4 text-xs uppercase tracking-[0.22em] text-warm-dark/30">
                      {displayYear}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="absolute inset-0 z-20 transition-opacity duration-300 ease-out group-hover:opacity-[0.14] group-focus-within:opacity-[0.14]">
                <img
                  src={currentItem.src}
                  alt={currentItem.alt || currentItem.title || 'Interactive story'}
                  className="h-full w-full object-cover object-center"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-warm-dark/10 transition-opacity duration-300 ease-out group-hover:opacity-0 group-focus-within:opacity-0" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-4">
            <div
              className="flex w-full items-center justify-center overflow-hidden rounded-[30px] shadow-2xl"
              style={standardFrameStyle}
              onClick={(event) => event.stopPropagation()}
            >
              {currentItem.kind === 'video' ? (
                embedUrl ? (
                  <div className="h-full w-full">
                    <iframe
                      key={currentItem.id}
                      src={embedUrl}
                      title={currentItem.title || 'Video viewer'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <video
                    key={currentItem.id}
                    controls
                    autoPlay
                    preload="metadata"
                    className="block h-full w-full object-cover object-center"
                    poster={currentItem.poster || undefined}
                  >
                    <source src={currentItem.src} type={currentItem.mimeType || undefined} />
                  </video>
                )
              ) : (
                <img
                  src={currentItem.src}
                  alt={currentItem.alt || currentItem.caption || currentItem.title || 'Media item'}
                  className="block h-full w-full object-cover object-center"
                />
              )}
            </div>

            {hasMeta && (
              <div className="w-full max-w-3xl rounded-[28px] border border-black/10 bg-black/5 px-5 py-4 text-center shadow-lg backdrop-blur-md">
                {displayTitle && (
                  <p className="text-lg text-gray-800">{displayTitle}</p>
                )}
                {displayDescription && (
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{displayDescription}</p>
                )}
                {displayYear && (
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-gray-400">{displayYear}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/10 px-4 py-2"
          aria-live="polite"
        >
          <p className="text-sm text-gray-700">
            {currentIndex + 1} / {items.length}
          </p>
        </div>
      </div>

      {items.length > 1 && (
        <button
          onClick={goToNext}
          className="absolute right-4 z-10 rounded-full bg-black/10 p-3 transition-all hover:bg-black/20"
          aria-label="Next item"
        >
          <ChevronRight size={32} className="text-gray-700" />
        </button>
      )}
    </div>
  );
}

function getVideoEmbedUrl(item: MediaLightboxItem): string | null {
  if (item.kind !== 'video') {
    return null;
  }

  try {
    const url = new URL(item.src);
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
