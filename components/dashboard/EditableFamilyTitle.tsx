'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

const DEFAULT_TITLE = 'The legacy archive of your family';
const HELPER_TEXT = 'You can personalize this title by entering your family name';

interface EditableFamilyTitleProps {
    canEdit?: boolean;
    className?: string;
    inputClassName?: string;
}

function formatTitle(name: string | null): string {
    if (!name) return DEFAULT_TITLE;
    return `The ${name} legacy archive`;
}

export default function EditableFamilyTitle({
    canEdit = true,
    className = 'font-serif text-4xl text-warm-dark',
    inputClassName,
}: EditableFamilyTitleProps) {
    const [name, setName] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/user/family-display-name', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                setName(typeof data.name === 'string' ? data.name : null);
            } catch {
                // Ignore — default title will display
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const openEditor = () => {
        setDraft(name || '');
        setEditing(true);
    };

    const cancel = () => {
        setDraft('');
        setEditing(false);
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/user/family-display-name', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: draft }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setName(typeof data.name === 'string' ? data.name : null);
            setEditing(false);
        } catch {
            // Keep editor open on failure
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Your family name"
                        autoFocus
                        maxLength={80}
                        className={
                            inputClassName ||
                            'glass-input rounded-none max-w-md text-2xl font-serif'
                        }
                    />
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        aria-label="Save title"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-olive/30 bg-olive/10 text-olive transition-colors hover:bg-olive/20 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={cancel}
                        disabled={saving}
                        aria-label="Cancel"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-warm-border/30 bg-white text-warm-muted transition-colors hover:bg-surface-mid"
                    >
                        <X size={16} />
                    </button>
                </div>
                <p className="text-xs text-warm-outline font-sans">{HELPER_TEXT}</p>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <h1 className={className} aria-live="polite">
                {loaded ? formatTitle(name) : DEFAULT_TITLE}
            </h1>
            {canEdit && (
                <button
                    type="button"
                    onClick={openEditor}
                    aria-label="Edit family title"
                    title="Edit family title"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-warm-border/30 bg-white text-warm-muted transition-colors hover:bg-surface-mid hover:text-warm-dark"
                >
                    <Pencil size={14} />
                </button>
            )}
        </div>
    );
}
