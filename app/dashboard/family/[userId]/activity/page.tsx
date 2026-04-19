'use client';

import { use, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { History, Loader2, MessageSquareText } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNotifications } from '@/hooks/useNotifications';

interface DayGroup {
    dayKey: string;
    dayLabel: string;
    items: Array<{
        id: string;
        memorialName: string;
        actor: string;
        summary: string;
        createdAt: string;
    }>;
}

function formatDayLabel(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(value));
}

function dayKey(value: string): string {
    const date = new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default function FamilyActivityPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();
    const { data, loading, error } = useNotifications();

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/family/${auth.user.id}/activity`);
            return;
        }
        if (auth.plan === 'personal') {
            router.replace(`/dashboard/personal/${userId}`);
            return;
        }
        if (auth.plan === 'draft' || auth.plan === 'none') {
            router.replace(`/dashboard/draft/${userId}`);
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, userId, router]);

    const grouped = useMemo<DayGroup[]>(() => {
        const map = new Map<string, DayGroup>();
        for (const item of data.recentActivity || []) {
            const key = dayKey(item.createdAt);
            const entry = map.get(key);
            const mapped = {
                id: item.id,
                memorialName: item.memorialName,
                actor: item.actorEmail || 'Someone',
                summary: item.summary || 'Archive updated',
                createdAt: item.createdAt,
            };
            if (entry) {
                entry.items.push(mapped);
            } else {
                map.set(key, {
                    dayKey: key,
                    dayLabel: formatDayLabel(item.createdAt),
                    items: [mapped],
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    }, [data.recentActivity]);

    const hasAccess = auth.plan === 'family' || auth.plan === 'concierge';
    if (auth.loading || !auth.authenticated || !hasAccess) {
        return (
            <div className="bg-surface-low min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-2 border-warm-border/30 border-t-olive rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <DashboardShell userId={userId}>
            <div className="min-h-screen bg-surface-low">
                <div className="mx-auto max-w-4xl px-6 py-12">
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Activity</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Recent changes</h1>
                        <p className="mt-3 max-w-2xl text-sm text-warm-muted font-sans">
                            A chronological record of meaningful actions across your family workspace &mdash; creations, edits, invitations.
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 size={24} className="mx-auto text-olive animate-spin mb-3" />
                            <p className="text-sm text-warm-muted font-sans">Loading activity...</p>
                        </div>
                    ) : error ? (
                        <div className="border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 rounded-none">
                            {error}
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="border-2 border-dashed border-warm-border/35 bg-white px-6 py-16 text-center rounded-none">
                            <History size={28} className="mx-auto mb-3 text-warm-muted" />
                            <p className="font-serif text-2xl text-warm-dark">No activity yet</p>
                            <p className="mt-2 text-sm text-warm-muted font-sans">
                                When a family member edits a memorial or accepts an invitation, it will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {grouped.map((group) => (
                                <section key={group.dayKey}>
                                    <h2 className="mb-4 text-[11px] uppercase tracking-[0.18em] text-warm-outline">
                                        {group.dayLabel}
                                    </h2>
                                    <div className="space-y-3">
                                        {group.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-start gap-4 border border-warm-border/30 bg-white p-5 rounded-none"
                                            >
                                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-olive/10 text-olive rounded-none">
                                                    <MessageSquareText size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-warm-dark font-sans">
                                                        Updated <span className="font-semibold">{item.memorialName}</span>
                                                        {' '}by{' '}
                                                        <span className="font-semibold">{item.actor}</span>
                                                    </p>
                                                    <p className="mt-1 text-sm text-warm-muted font-sans leading-relaxed">
                                                        {item.summary}
                                                    </p>
                                                    <p className="mt-2 text-xs text-warm-outline font-sans">
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
