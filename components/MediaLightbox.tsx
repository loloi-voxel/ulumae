'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MousePointer, Play, X } from 'lucide-react';

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
    'Move your cursor to reveal the photo.'
  );
}

export default function MediaLightbox({
  items,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [interactivePointer, setInteractivePointer] = useState({ x: 50, y: 50 });
  const [isInteractiveHovering, setIsInteractiveHovering] = useState(false);
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
  const hasMeta =
    currentItem.title ||
    currentItem.description ||
    currentItem.caption ||
    currentItem.year;

  const handleInteractiveMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setInteractivePointer({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    setIsInteractiveHovering(true);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-warm-dark/95 backdrop-blur-sm"
      onWheel={handleWheel}
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

      <div className="relative mx-auto w-full max-w-7xl px-4 md:px-20">
        {isInteractiveStory ? (
          <div className="grid max-h-[88vh] w-full gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl"
              onMouseMove={handleInteractiveMouseMove}
              onMouseLeave={() => setIsInteractiveHovering(false)}
            >
              <div className="absolute inset-0 z-10 flex items-center justify-center p-6 md:p-10">
                <div className="max-w-2xl rounded-3xl bg-surface-low/88 px-6 py-5 shadow-xl backdrop-blur-sm">
                  <p className="font-serif text-xl leading-relaxed text-warm-dark md:text-3xl">
                    {interactiveStoryCopy}
                  </p>
                </div>
              </div>

              <div
                className="absolute inset-0 z-20 transition-opacity duration-300"
                style={{
                  maskImage: isInteractiveHovering
                    ? `radial-gradient(circle 140px at ${interactivePointer.x}px ${interactivePointer.y}px, transparent 0%, transparent 45%, rgba(0,0,0,0.3) 72%, black 100%)`
                    : 'none',
                  WebkitMaskImage: isInteractiveHovering
                    ? `radial-gradient(circle 140px at ${interactivePointer.x}px ${interactivePointer.y}px, transparent 0%, transparent 45%, rgba(0,0,0,0.3) 72%, black 100%)`
                    : 'none',
                }}
              >
                <img
                  src={currentItem.src}
                  alt={currentItem.alt || currentItem.title || 'Interactive story'}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>

              <div className="absolute left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full bg-warm-dark/70 px-3 py-1.5 text-xs tracking-wide text-surface-low">
                <MousePointer size={14} />
                Move to reveal
              </div>

              {items.length > 1 && (
                <div className="absolute bottom-4 right-4 z-30 rounded-full bg-warm-dark/70 px-3 py-1.5 text-xs tracking-wide text-surface-low">
                  Scroll to continue
                </div>
              )}
            </div>

            <aside className="flex max-h-[88vh] min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-low/96 p-6 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.28em] text-warm-dark/35">
                Interactive Story {currentIndex + 1} of {items.length}
              </p>
              <h3 className="mt-4 font-serif text-3xl text-warm-dark">
                {currentItem.title || `Interactive photo story ${currentIndex + 1}`}
              </h3>

              <div className="mt-5 flex-1 overflow-y-auto pr-2">
                <p className="whitespace-pre-wrap text-lg leading-relaxed text-warm-dark/82">
                  {interactiveStoryCopy}
                </p>

                {currentItem.year && (
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-warm-dark/35">
                    {currentItem.year}
                  </p>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-warm-border/25 bg-white/70 p-4 text-sm leading-relaxed text-warm-dark/60">
                Move your cursor across the image to reveal the moment. Use the mouse wheel,
                arrow keys, or the story strip below to travel through the full set.
              </div>
            </aside>
          </div>
        ) : (
          <div className="relative mx-auto max-h-[90vh] max-w-7xl">
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
          </div>
        )}

        <div
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-warm-dark/80 px-4 py-2"
          aria-live="polite"
        >
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
