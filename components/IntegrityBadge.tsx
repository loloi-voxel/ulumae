'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface IntegrityBadgeProps {
    hash?: string;
    className?: string;
}

export default function IntegrityBadge({ hash, className = '' }: IntegrityBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!hash) return null;

    return (
        <div className={`absolute top-2 left-2 z-20 ${className}`}>
            {/* The Badge Icon — click to toggle */}
            <div
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setShowTooltip(!showTooltip); } }}
                className="bg-white/90 backdrop-blur-sm text-plum p-1.5 rounded-full shadow-sm border border-plum/20 cursor-pointer transition-transform hover:scale-110"
            >
                <ShieldCheck size={14} />
            </div>

            {/* The Tooltip (appears on click) */}
            {showTooltip && (
                <div className="absolute top-0 left-8 w-64 bg-warm-dark text-surface-low text-xs p-3 rounded-lg shadow-xl animate-fadeIn">
                    <p className="font-semibold mb-1 flex items-center gap-1">
                        <ShieldCheck size={12} /> Authenticity Verified
                    </p>
                    <p className="opacity-80 leading-relaxed">
                        This media is cryptographically signed.
                    </p>
                    <div className="mt-2 pt-2 border-t border-white/10 font-mono text-[10px] opacity-60 break-all">
                        SHA-256: {hash}
                    </div>
                </div>
            )}
        </div>
    );
}