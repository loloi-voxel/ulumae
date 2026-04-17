'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

    const isDanger = variant === 'danger';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-warm-dark/70 backdrop-blur-sm px-4"
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white border border-warm-border/30 rounded-none shadow-xl"
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-5">
                    <div className="flex items-start gap-3">
                        {isDanger && (
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center bg-warm-brown/10 text-warm-brown rounded-none">
                                <AlertTriangle size={18} />
                            </div>
                        )}
                        <h2 id="confirm-dialog-title" className="font-serif text-xl text-warm-dark">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close dialog"
                        className="text-warm-outline hover:text-warm-dark transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="px-6 pb-5 pt-3">
                    <p className="text-sm text-warm-muted leading-relaxed">{description}</p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-warm-border/30 bg-surface-low/60 px-6 py-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="border border-warm-border/40 bg-white px-4 py-2 text-sm text-warm-dark hover:bg-surface-mid/60 transition-colors rounded-none"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white transition-colors rounded-none ${
                            isDanger
                                ? 'bg-warm-brown hover:bg-warm-brown/90'
                                : 'bg-warm-dark hover:bg-warm-dark/90'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
