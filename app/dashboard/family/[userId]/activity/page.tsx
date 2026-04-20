'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, History, Loader2, MessageSquareText } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNotifications } from '@/hooks/useNotifications';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ActivityItem {
    id: string;
    memorialName: string;
    actor: string;
    summary: string;
    createdAt: string;
}

interface DayGroup {
    dayKey: string;
    dayLabel: string;
    items: ActivityItem[];
}

interface MonthGroup {
    monthKey: string;
    monthLabel: string;
    days: DayGroup[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDayLabel(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(new Date(value));
}

function formatMonthLabel(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
    }).format(new Date(value));
}

function toDayKey(value: string): string {
    const date = new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function toMonthKey(value: string): string {
    const date = new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function mapItem(raw: {
    id: string;
    memorialName: string;
    actorEmail: string | null;
    summary: string;
    createdAt: string;
}): ActivityItem {
    return {
        id: raw.id,
        memorialName: raw.memorialName,
        actor: raw.actorEmail || 'Someone',
        summary: raw.summary || 'Archive updated',
        createdAt: raw.createdAt,
    };
}

/* ------------------------------------------------------------------ */
/*  Activity Item Card                                                 */
/* ------------------------------------------------------------------ */

function ActivityCard({ item }: { item: ActivityItem }) {
    return (
        <div className="flex items-start gap-4 border border-warm-border/30 bg-surface-mid/25 p-4 rounded-none">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-olive/10 text-olive rounded-none">
                <MessageSquareText size={16} />
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
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FamilyActivityPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();
    const { data, loading, error } = useNotifications();

    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    function toggleMonth(key: string) {
        setExpandedMonths((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    function toggleDay(key: string) {
        setExpandedDays((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    /* Auth guard */
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

    /* Group: Month → Day → Items */
    const hierarchy = useMemo<MonthGroup[]>(() => {
        const monthMap = new Map<string, MonthGroup>();

        for (const raw of data.recentActivity || []) {
            const mKey = toMonthKey(raw.createdAt);
            const dKey = toDayKey(raw.createdAt);
            const item = mapItem(raw);

            let month = monthMap.get(mKey);
            if (!month) {
                month = { monthKey: mKey, monthLabel: formatMonthLabel(raw.createdAt), days: [] };
                monthMap.set(mKey, month);
            }

            let day = month.days.find((d) => d.dayKey === dKey);
            if (!day) {
                day = { dayKey: dKey, dayLabel: formatDayLabel(raw.createdAt), items: [] };
                month.days.push(day);
            }

            day.items.push(item);
        }

        // Sort months descending
        const months = Array.from(monthMap.values()).sort((a, b) =>
            b.monthKey.localeCompare(a.monthKey)
        );

        for (const month of months) {
            // Sort days descending within each month
            month.days.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
            // Sort items within each day descending by createdAt
            for (const day of month.days) {
                day.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            }
        }

        return months;
    }, [data.recentActivity]);

    const totalItems = (data.recentActivity || []).length;

    /* Access check */
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
                    {/* Header */}
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Activity</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Recent changes</h1>
                        <p className="mt-3 max-w-2xl text-sm text-warm-muted font-sans">
                            A chronological record of meaningful actions across your family workspace &mdash; creations, edits, invitations.
                        </p>
                    </div>

                    {/* Loading */}
                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 size={24} className="mx-auto text-olive animate-spin mb-3" />
                            <p className="text-sm text-warm-muted font-sans">Loading activity...</p>
                        </div>
                    ) : error ? (
                        <div className="border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 rounded-none">
                            {error}
                        </div>
                    ) : totalItems === 0 ? (
                        <div className="border-2 border-dashed border-warm-border/35 bg-white px-6 py-16 text-center rounded-none">
                            <History size={28} className="mx-auto mb-3 text-warm-muted" />
                            <p className="font-serif text-2xl text-warm-dark">No activity yet</p>
                            <p className="mt-2 text-sm text-warm-muted font-sans">
                                When a family member edits a memorial or accepts an invitation, it will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {hierarchy.map((month) => {
                                const monthOpen = expandedMonths.has(month.monthKey);
                                const monthItemCount = month.days.reduce((sum, d) => sum + d.items.length, 0);

                                return (
                                    <div key={month.monthKey} className="border border-warm-border/30 bg-white rounded-none">
                                        {/* Month row */}
                                        <button
                                            onClick={() => toggleMonth(month.monthKey)}
                                            className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-surface-mid/30"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-olive/10 text-olive rounded-none">
                                                    {monthOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </div>
                                                <div>
                                                    <h2 className="font-serif text-xl text-warm-dark">{month.monthLabel}</h2>
                                                    <p className="text-xs text-warm-muted font-sans">
                                                        {monthItemCount} item{monthItemCount !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] uppercase tracking-[0.14em] text-warm-outline font-sans">
                                                    {monthOpen ? 'Collapse' : 'Expand'}
                                                </span>
                                                {monthOpen ? (
                                                    <ChevronDown size={18} className="text-warm-muted" />
                                                ) : (
                                                    <ChevronRight size={18} className="text-warm-muted" />
                                                )}
                                            </div>
                                        </button>

                                        {/* Days within month */}
                                        {monthOpen && (
                                            <div className="border-t border-warm-border/20 px-6 pb-6 pt-2">
                                                <div className="space-y-3">
                                                    {month.days.map((day) => {
                                                        const dayOpen = expandedDays.has(day.dayKey);

                                                        return (
                                                            <div key={day.dayKey} className="border border-warm-border/30 bg-surface-low rounded-none">
                                                                {/* Day row */}
                                                                <button
                                                                    onClick={() => toggleDay(day.dayKey)}
                                                                    className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-mid/30"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-olive/10 text-olive rounded-none">
                                                                            {dayOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="font-serif text-lg text-warm-dark">{day.dayLabel}</h3>
                                                                            <p className="text-xs text-warm-muted font-sans">
                                                                                {day.items.length} item{day.items.length !== 1 ? 's' : ''}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] uppercase tracking-[0.14em] text-warm-outline font-sans">
                                                                            {dayOpen ? 'Collapse' : 'Expand'}
                                                                        </span>
                                                                        {dayOpen ? (
                                                                            <ChevronDown size={16} className="text-warm-muted" />
                                                                        ) : (
                                                                            <ChevronRight size={16} className="text-warm-muted" />
                                                                        )}
                                                                    </div>
                                                                </button>

                                                                {/* Activity items within day */}
                                                                {dayOpen && (
                                                                    <div className="border-t border-warm-border/20 px-5 pb-4 pt-3">
                                                                        <div className="space-y-3">
                                                                            {day.items.map((item) => (
                                                                                <ActivityCard key={item.id} item={item} />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
