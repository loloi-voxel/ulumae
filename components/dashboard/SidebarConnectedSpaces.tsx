'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Layers } from 'lucide-react';
import { useConnectedSpaces } from '@/hooks/useConnectedSpaces';

export default function SidebarConnectedSpaces({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { spaces, loading, error } = useConnectedSpaces();

    if (loading || error || spaces.length === 0) {
        return null;
    }

    const preview = spaces.slice(0, 3);

    return (
        <div className="px-4 pb-5">
            <div className="rounded-none border border-warm-border/28 bg-white/70 px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Layers size={12} className="text-warm-outline" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-warm-outline">
                            Connected spaces
                        </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-warm-outline/80">
                        {spaces.length}
                    </span>
                </div>
                <ul className="space-y-2">
                    {preview.map((space) => {
                        const isActive = pathname === space.href || pathname.startsWith(`${space.href}/`);
                        return (
                            <li key={`${space.id}-${space.role}`}>
                                <Link
                                    href={space.href}
                                    onClick={onNavigate}
                                    className={`group flex items-center gap-2 rounded-none border px-3 py-2 transition-all ${
                                        isActive
                                            ? 'border-olive/30 bg-olive/10 text-warm-dark'
                                            : 'border-transparent bg-transparent text-warm-dark/75 hover:border-warm-border/30 hover:bg-surface-mid/40'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-serif text-warm-dark">
                                            {space.fullName || 'Untitled archive'}
                                        </p>
                                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-warm-outline">
                                            {space.roleLabel}
                                        </p>
                                    </div>
                                    <ArrowRight
                                        size={12}
                                        className={`flex-shrink-0 transition-transform ${
                                            isActive
                                                ? 'text-olive'
                                                : 'text-warm-outline group-hover:translate-x-0.5'
                                        }`}
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
                {spaces.length > preview.length && (
                    <Link
                        href="/dashboard/spaces"
                        onClick={onNavigate}
                        className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-warm-outline hover:text-warm-dark transition-colors"
                    >
                        View all {spaces.length}
                        <ArrowRight size={10} />
                    </Link>
                )}
            </div>
        </div>
    );
}
