'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Shield } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { isFamilyPlan, isPersonalPlan, useAuth } from '@/components/providers/AuthProvider';
import { DEAD_MAN_SWITCH_DELAY_OPTIONS } from '@/lib/constants';
import { formatDeadManSwitchDelayLabel } from '@/lib/deadManSwitch';

interface DeadManSwitchResponse {
    enabled: boolean;
    delayMonths: number;
    delayLabel: string;
    hasActiveSuccessionPlan: boolean;
    successor: {
        id: string;
        name: string;
        email: string;
        relationship: string;
        status: string;
    } | null;
    lastActiveAt: string | null;
    transferDate: string | null;
    daysUntilTransfer: number | null;
    confirmationVisible: boolean;
    transferDue: boolean;
    activeWarningStage: 30 | 7 | 1 | null;
    transferredAt: string | null;
}

function formatDateTime(value: string | null) {
    if (!value) return 'Not available';

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function DeadManSwitchPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();
    const [data, setData] = useState<DeadManSwitchResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadState = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/dead-man-switch', {
                cache: 'no-store',
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not load Dead Man Switch settings.');
            }

            setData(payload);
        } catch (loadError: any) {
            setError(loadError.message || 'Could not load Dead Man Switch settings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/dead-man-switch/${auth.user.id}`);
            return;
        }
        if (!isFamilyPlan(auth.plan) && !isPersonalPlan(auth.plan) && auth.user) {
            router.replace(`/dashboard/draft/${auth.user.id}`);
            return;
        }

        void loadState();
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, userId, router]);

    const updateSettings = async (changes: Partial<Pick<DeadManSwitchResponse, 'enabled' | 'delayMonths'>>) => {
        setSaving(true);
        setFeedback(null);
        setError(null);

        try {
            const response = await fetch('/api/dead-man-switch', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changes),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not update Dead Man Switch settings.');
            }

            setData(payload);
            setFeedback('Dead Man Switch settings updated.');
        } catch (updateError: any) {
            setError(updateError.message || 'Could not update Dead Man Switch settings.');
        } finally {
            setSaving(false);
        }
    };

    const confirmActivity = async () => {
        setSaving(true);
        setFeedback(null);
        setError(null);

        try {
            const response = await fetch('/api/dead-man-switch/confirm', {
                method: 'POST',
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not confirm account activity.');
            }

            await loadState();
            setFeedback('Activity confirmed. The transfer countdown has been reset.');
        } catch (confirmError: any) {
            setError(confirmError.message || 'Could not confirm account activity.');
        } finally {
            setSaving(false);
        }
    };

    if (auth.loading || !auth.authenticated || auth.user?.id !== userId || (!isFamilyPlan(auth.plan) && !isPersonalPlan(auth.plan))) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-warm-border/30 border-t-olive rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <DashboardShell userId={userId}>
            <div className="min-h-screen bg-surface-low">
                <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Succession</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Dead Man Switch</h1>
                        <p className="mt-3 max-w-3xl text-sm text-warm-muted">
                            Choose how long inactivity is allowed before stewardship transfers to your accepted successor. Regular activity keeps the timer moving forward automatically.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center rounded-none border border-warm-border/20 bg-white p-16">
                            <Loader2 size={28} className="animate-spin text-olive" />
                        </div>
                    ) : error && !data ? (
                        <div className="rounded-none border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                            {error}
                        </div>
                    ) : !data?.hasActiveSuccessionPlan ? (
                        <div className="rounded-none border border-warm-border/20 bg-white p-8">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-1 text-warm-brown" size={20} />
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Succession must be active first</h2>
                                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-warm-muted">
                                        This page unlocks after someone on your succession page accepts the stewardship invitation. Once that is active, you can enable the switch, choose a delay, and see the transfer date here.
                                    </p>
                                    <Link
                                        href={`/dashboard/succession/${userId}`}
                                        className="mt-5 inline-flex items-center rounded-none bg-warm-dark px-4 py-2 text-sm font-medium text-surface-low transition-colors hover:bg-warm-dark/90"
                                    >
                                        Go to succession
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {feedback && (
                                <div className="rounded-none border border-olive/20 bg-olive/10 px-4 py-3 text-sm text-warm-dark">
                                    {feedback}
                                </div>
                            )}

                            {error && (
                                <div className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            {data?.activeWarningStage && data.enabled && !data.transferredAt && (
                                <div className="rounded-none border border-warm-brown/25 bg-warm-brown/5 p-5">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="mt-0.5 text-warm-brown" size={18} />
                                        <div>
                                            <p className="text-sm font-medium text-warm-dark">
                                                {data.activeWarningStage === 30 && 'First warning: transfer in 30 days.'}
                                                {data.activeWarningStage === 7 && 'Urgent warning: transfer in 7 days.'}
                                                {data.activeWarningStage === 1 && 'Final warning: transfer tomorrow.'}
                                            </p>
                                            <p className="mt-1 text-sm text-warm-muted">
                                                Confirm activity to reset the countdown from today.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {data?.transferredAt && (
                                <div className="rounded-none border border-olive/20 bg-olive/10 p-5">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className="mt-0.5 text-olive" size={18} />
                                        <div>
                                            <p className="text-sm font-medium text-warm-dark">
                                                The Dead Man Switch transfer completed on {formatDateTime(data.transferredAt)}.
                                            </p>
                                            <p className="mt-1 text-sm text-warm-muted">
                                                The original account remains intact, but memorial ownership has already been reassigned.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                                <section className="rounded-none border border-warm-border/20 bg-white p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Status</p>
                                            <h2 className="mt-2 font-serif text-2xl text-warm-dark">Transfer timing</h2>
                                            <p className="mt-2 text-sm text-warm-muted">
                                                Successor: <span className="text-warm-dark">{data?.successor?.name}</span>
                                                {data?.successor?.relationship ? `, ${data.successor.relationship}` : ''}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={saving || Boolean(data?.transferredAt)}
                                            onClick={() => void updateSettings({ enabled: !data?.enabled })}
                                            className={`relative inline-flex h-7 w-12 items-center rounded-none transition-colors ${data?.enabled ? 'bg-olive' : 'bg-warm-border'} ${saving || data?.transferredAt ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <span className={`inline-block h-5 w-5 rounded-none bg-white transition-transform ${data?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <div className="mt-8">
                                        <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Choose inactivity delay</p>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                            {DEAD_MAN_SWITCH_DELAY_OPTIONS.map((months) => (
                                                <button
                                                    key={months}
                                                    type="button"
                                                    disabled={saving || Boolean(data?.transferredAt)}
                                                    onClick={() => void updateSettings({ delayMonths: months })}
                                                    className={`rounded-none border px-3 py-3 text-sm transition-colors ${data?.delayMonths === months ? 'border-olive bg-olive/10 text-warm-dark' : 'border-warm-border/30 text-warm-muted hover:border-warm-border/60'} ${saving || data?.transferredAt ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    {formatDeadManSwitchDelayLabel(months)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-none border border-warm-border/20 bg-surface-mid/35 p-4">
                                            <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Last activity</p>
                                            <p className="mt-2 text-sm text-warm-dark">{formatDateTime(data?.lastActiveAt || null)}</p>
                                        </div>
                                        <div className="rounded-none border border-warm-border/20 bg-surface-mid/35 p-4">
                                            <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Scheduled transfer</p>
                                            <p className="mt-2 text-sm text-warm-dark">
                                                {data?.enabled && data.transferDate ? formatDateTime(data.transferDate) : 'Disabled'}
                                            </p>
                                        </div>
                                    </div>

                                    {data?.confirmationVisible && data.enabled && !data.transferredAt && (
                                        <button
                                            type="button"
                                            onClick={() => void confirmActivity()}
                                            disabled={saving}
                                            className="mt-8 inline-flex items-center gap-2 rounded-none bg-warm-dark px-5 py-3 text-sm font-medium text-surface-low transition-colors hover:bg-warm-dark/90 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                            Confirm that I am still active
                                        </button>
                                    )}
                                </section>

                                <aside className="space-y-6">
                                    <section className="rounded-none border border-warm-border/20 bg-white p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-none bg-olive/10 text-olive">
                                                <Clock size={18} />
                                            </div>
                                            <div>
                                                <h2 className="font-serif text-2xl text-warm-dark">How this works</h2>
                                                <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Plan-aware</p>
                                            </div>
                                        </div>
                                        <div className="mt-5 space-y-3 text-sm text-warm-muted">
                                            <p>Any recorded activity keeps the timer fresh automatically.</p>
                                            <p>The confirmation button appears only during the last 30 days before transfer.</p>
                                            <p>Warnings are issued at 30 days, 7 days, and 1 day before the transfer date.</p>
                                        </div>
                                    </section>

                                    <section className="rounded-none border border-warm-border/20 bg-white p-6">
                                        <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Result at deadline</p>
                                        <div className="mt-4 space-y-3 text-sm text-warm-muted">
                                            <p>Your accepted successor becomes the new owner of every memorial tied to this account.</p>
                                            <p>You are kept as a reader so the full archive history remains intact.</p>
                                            <p>No memorial data is deleted during the transfer.</p>
                                        </div>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
