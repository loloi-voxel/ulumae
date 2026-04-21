// components/wizard/PreviewModal.tsx
// Preview as mirror: reveals both beauty and absence
'use client';

import { X } from 'lucide-react';
import { MemorialData } from '@/types/memorial';
import MemorialRenderer from '@/components/MemorialRenderer';
import { calculateEmotionalState } from '@/lib/emotionalState';

interface PreviewModalProps {
    data: MemorialData;
    plan?: string;
    onClose: () => void;
}

export default function PreviewModal({ data, plan = 'draft', onClose }: PreviewModalProps) {
    const { enabled, missingDimensions, fragmentCount, state } = calculateEmotionalState(data, plan);

    return (
        <div className="fixed inset-0 bg-warm-dark/90 backdrop-blur-sm z-50 overflow-y-auto">
            <div className="min-h-screen py-12 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6 px-4">
                        <div>
                            <h2 className="text-2xl font-semibold text-surface-low mb-1">Archive Preview</h2>
                            <p className="text-surface-low/50 text-sm">
                                {enabled && state === 'eternal'
                                    ? 'This is how their archive will appear - complete and luminous.'
                                    : 'A mirror of what you have built so far.'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 bg-surface-low/10 hover:bg-surface-low/20 rounded-full transition-all"
                        >
                            <X size={24} className="text-surface-low" />
                        </button>
                    </div>

                    <div className="rounded-2xl shadow-2xl overflow-hidden">
                        <MemorialRenderer
                            data={data}
                            isPreview={true}
                            compact={false}
                        />
                    </div>

                    {enabled && missingDimensions.length > 0 && state !== 'eternal' && (
                        <div className="mt-8 p-6 rounded-xl bg-surface-low/5 border border-surface-low/10">
                            <p className="text-surface-low/40 text-xs uppercase tracking-wider mb-4">
                                What remains to be preserved
                            </p>
                            <div className="space-y-3">
                                {missingDimensions.slice(0, 4).map((dim) => (
                                    <div key={dim.key} className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-surface-low/15 mt-1.5 flex-shrink-0" />
                                        <p className="text-sm text-surface-low/35 italic">{dim.whisper}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-surface-low/20 text-xs mt-4">
                                {fragmentCount} fragments gathered so far.
                            </p>
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-surface-low hover:bg-surface-low/90 text-warm-dark rounded-xl font-medium transition-all shadow-lg"
                        >
                            Return to the archive
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
