// components/wizard/GhostPresence.tsx
// Ghost Presence Effect: Missing content is felt through absence
// Empty sections appear as faded, blurred, partially rendered placeholders
'use client';

interface GhostPresenceProps {
  variant: 'text' | 'image' | 'video' | 'voice' | 'gallery';
  whisper: string;
  count?: number; // for gallery: how many ghost silhouettes to show
  className?: string;
  plan?: 'draft' | 'personal' | 'family';
}

export default function GhostPresence({
  variant,
  whisper,
  count = 3,
  className = '',
  plan = 'draft',
}: GhostPresenceProps) {
  if (plan === 'personal' || plan === 'family') {
    return null;
  }

  if (variant === 'text') {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div className="space-y-2.5 opacity-[0.12] select-none" aria-hidden="true">
          <div className="h-3 bg-warm-dark/60 rounded w-full" />
          <div className="h-3 bg-warm-dark/60 rounded w-[92%]" />
          <div className="h-3 bg-warm-dark/60 rounded w-[85%]" />
          <div className="h-3 bg-warm-dark/60 rounded w-[78%]" />
          <div className="h-3 bg-warm-dark/60 rounded w-[60%]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-low" />
        <p className="mt-3 text-xs text-warm-dark/30 italic tracking-wide">
          {whisper}
        </p>
      </div>
    );
  }

  if (variant === 'image') {
    return (
      <div className={`relative ${className}`}>
        <div className="aspect-[4/3] rounded-xl border border-dashed border-warm-border/20 bg-warm-border/5 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-warm-border/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-warm-dark/15">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
            </div>
            <p className="text-xs text-warm-dark/25 italic tracking-wide">
              {whisper}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'gallery') {
    return (
      <div className={`grid grid-cols-3 gap-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg border border-dashed border-warm-border/15 bg-warm-border/5 flex items-center justify-center"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-warm-dark/10">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          </div>
        ))}
        <p className="col-span-3 text-xs text-warm-dark/25 italic tracking-wide text-center mt-1">
          {whisper}
        </p>
      </div>
    );
  }

  if (variant === 'video') {
    return (
      <div className={`relative ${className}`}>
        <div className="aspect-video rounded-xl border border-dashed border-warm-border/20 bg-warm-border/5 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-warm-border/8 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-warm-dark/12">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </div>
            <p className="text-xs text-warm-dark/25 italic tracking-wide">
              {whisper}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'voice') {
    return (
      <div className={`relative ${className}`}>
        <div className="rounded-xl border border-dashed border-warm-border/20 bg-warm-border/5 px-6 py-5 flex items-center gap-4">
          {/* Ghost waveform */}
          <div className="flex items-end gap-0.5 h-8 opacity-[0.12]" aria-hidden="true">
            {[3, 5, 8, 6, 10, 7, 4, 9, 5, 7, 3, 6, 8, 4, 7, 5, 9, 6, 3, 5].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-warm-dark/60 rounded-full"
                style={{ height: `${h * 3}px` }}
              />
            ))}
          </div>
          <p className="text-xs text-warm-dark/25 italic tracking-wide flex-1">
            {whisper}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
