'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Layers, Loader2 } from 'lucide-react';

interface SpaceEntry {
    id: string;
    fullName: string | null;
    profilePhotoUrl: string | null;
    mode: string | null;
    role: 'owner' | 'co_guardian' | 'witness' | 'reader';
    roleLabel: string;
    plan: string;
    href: string;
}

interface ConnectedSpacesPanelProps {
    variant?: 'panel' | 'list';
    className?: string;
    title?: string;
    emptyMessage?: string;
}

export default function ConnectedSpacesPanel({
    variant = 'panel',
    className = '',
    title = 'Connected spaces',
    emptyMessage = 'You are not yet connected to any other archives.',
}: ConnectedSpacesPanelProps) {
    const pathname = usePathname();
    const [spaces, setSpaces] = useState<SpaceEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/user/spaces', { cache: 'no-store' })
            .then((res) => res.json())
            .then((payload) => {
                if (cancelled) return;
                if (payload?.authenticated === false) {
                    setSpaces([]);
                    return;
                }
                setSpaces(payload?.spaces || []);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err?.message || 'Could not load spaces');
                setSpaces([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const sorted = useMemo(() => {
        if (!spaces) return [] as SpaceEntry[];
        const rank = (role: SpaceEntry['role']) =>
            role === 'owner' ? 0 : role === 'co_guardian' ? 1 : role === 'witness' ? 2 : 3;
        return [...spaces].sort((a, b) => rank(a.role) - rank(b.role));
    }, [spaces]);

    if (spaces === null) {
        return (
            <div className={`flex items-center gap-2 text-warm-outline text-xs font-sans ${className}`}>
                <Loader2 size={14} className="animate-spin" />
                Loading spaces…
            </div>
        );
    }

    if (error) {
        return (
            <p className={`text-xs text-warm-outline font-sans ${className}`}>
                {error}
            </p>
        );
    }

    const content = (
        <ul className="space-y-3">
            {sorted.map((space) => {
                const isCurrent = pathname === space.href || pathname.startsWith(`${space.href}/`);
                return (
                    <li key={`${space.id}-${space.role}`}>
                        <Link
                            href={space.href}
                            className={`group flex items-center gap-3 rounded-none border px-4 py-3 transition-all ${
                                isCurrent
                                    ? 'border-olive/30 bg-olive/10 text-warm-dark shadow-sm'
                                    : 'border-warm-border/30 bg-white/70 text-warm-dark/80 hover:border-warm-border/50 hover:bg-white'
                            }`}
                        >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-none bg-surface-mid/60 text-warm-dark/70 overflow-hidden">
                                {space.profilePhotoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={space.profilePhotoUrl}
                                        alt={space.fullName || 'Archive'}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="font-serif text-sm">
                                        {(space.fullName || 'A').charAt(0)}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-serif text-sm text-warm-dark">
                                    {space.fullName || 'Untitled archive'}
                                </p>
                                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-warm-outline">
                                    {space.roleLabel}
                                    {space.plan ? ` • ${space.plan}` : ''}
                                </p>
                            </div>
                            <ArrowRight
                                size={14}
                                className={`flex-shrink-0 transition-transform ${
                                    isCurrent ? 'text-olive' : 'text-warm-outline group-hover:translate-x-0.5'
                                }`}
                            />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );

    if (sorted.length === 0) {
        if (variant === 'list') {
            return (
                <p className={`text-xs text-warm-outline font-sans ${className}`}>
                    {emptyMessage}
                </p>
            );
        }
        return (
            <div className={`rounded-none border border-warm-border/30 bg-white/70 px-5 py-6 ${className}`}>
                <div className="flex items-center gap-2 mb-2">
                    <Layers size={14} className="text-warm-outline" />
                    <p className="text-[10px] uppercase tracking-[0.18em] text-warm-outline">{title}</p>
                </div>
                <p className="text-sm text-warm-dark/60 font-sans">{emptyMessage}</p>
            </div>
        );
    }

    if (variant === 'list') {
        return <div className={className}>{content}</div>;
    }

    return (
        <section className={`rounded-none border border-warm-border/30 bg-white/70 px-5 py-5 ${className}`}>
            <div className="flex items-center gap-2 mb-4">
                <Layers size={14} className="text-warm-outline" />
                <p className="text-[10px] uppercase tracking-[0.18em] text-warm-outline">{title}</p>
            </div>
            {content}
        </section>
    );
}
