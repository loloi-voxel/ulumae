'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

export interface MediaLightboxItem {
  id: string;
  kind: 'image' | 'video';
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

export default function MediaLightbox({
  items,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

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

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.querySelector<HTMLElement>('[data-close]')?.focus();

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [goToNext, goToPrevious, onClose]);

  if (!items.length) return null;

  const currentItem = items[currentIndex];
  const embedUrl = getVideoEmbedUrl(currentItem);
  const hasMeta =
    currentItem.title ||
    currentItem.description ||
    currentItem.caption ||
    currentItem.year;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={currentItem.title || `Media viewer ${currentIndex + 1} of ${items.length}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-warm-dark/95 backdrop-blur-sm"
    >
      <button
        data-close
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 transition-all hover:bg-white/20"
        aria-label="Close viewer"
      >
        <X size={24} className="text-surface-low" />
      </button>

      {items.length > 1 && (
        <button
          onClick={goToPrevious}
          className="absolute left-4 z-10 rounded-full bg-white/10 p-3 transition-all hover:bg-white/20"
          aria-label="Previous item"
        >
          <ChevronLeft size={32} className="text-surface-low" />
        </button>
      )}

      <div className="relative mx-auto max-h-[90vh] max-w-7xl px-20">
        <div className="overflow-hidden rounded-lg shadow-2xl">
          {currentItem.kind === 'video' ? (
            embedUrl ? (
              <div className="aspect-video w-[min(92vw,1200px)] max-w-full bg-black">
                <iframe
                  key={currentItem.id}
                  src={embedUrl}
                  title={currentItem.title || 'Video viewer'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <video
                key={currentItem.id}
                controls
                autoPlay
                preload="metadata"
                className="max-h-[85vh] max-w-full bg-black object-contain"
                poster={currentItem.poster || undefined}
              >
                <source src={currentItem.src} type={currentItem.mimeType || undefined} />
              </video>
            )
          ) : (
            <img
              src={currentItem.src}
              alt={currentItem.alt || currentItem.caption || currentItem.title || 'Media item'}
              className="max-h-[85vh] max-w-full object-contain"
            />
          )}
        </div>

        {hasMeta && (
          <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-warm-dark/95 to-transparent p-6">
            {currentItem.title && (
              <p className="text-lg text-surface-low">{currentItem.title}</p>
            )}
            {currentItem.description && (
              <p className="mt-1 text-sm text-surface-low/90">{currentItem.description}</p>
            )}
            {currentItem.caption && !currentItem.description && (
              <p className="mt-1 text-sm text-surface-low/90">{currentItem.caption}</p>
            )}
            {currentItem.year && (
              <p className="mt-1 text-xs text-surface-low/70">{currentItem.year}</p>
            )}
          </div>
        )}

        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-warm-dark/80 px-4 py-2" aria-live="polite">
          <p className="text-sm text-surface-low">
            {currentIndex + 1} / {items.length}
          </p>
        </div>
      </div>

      {items.length > 1 && (
        <button
          onClick={goToNext}
          className="absolute right-4 z-10 rounded-full bg-white/10 p-3 transition-all hover:bg-white/20"
          aria-label="Next item"
        >
          <ChevronRight size={32} className="text-surface-low" />
        </button>
      )}

      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 max-w-4xl -translate-x-1/2 overflow-x-auto">
          <div className="flex gap-2 px-4">
            {items.map((item, index) => {
              const previewSrc = item.thumbnailSrc || item.poster || item.src;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`View item ${index + 1}`}
                  className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    index === currentIndex
                      ? 'scale-110 border-olive'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {previewSrc ? (
                    <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/10" />
                  )}
                  {item.kind === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-warm-dark/35">
                      <Play size={14} className="fill-surface-low text-surface-low" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
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
