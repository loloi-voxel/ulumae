'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Loader2, Mail, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/components/providers/AuthProvider';
import SecurityCenter from '@/components/SecurityCenter';

export default function DashboardSettingsPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();

    const [refundSubmitting, setRefundSubmitting] = useState(false);
    const [refundRequested, setRefundRequested] = useState(false);
    const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/settings/${auth.user.id}`);
        }
    }, [auth.loading, auth.authenticated, auth.user, userId, router]);

    if (auth.loading || !auth.authenticated || auth.user?.id !== userId) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-warm-border/30 border-t-olive rounded-full animate-spin" />
            </div>
        );
    }

    const planLabel =
        auth.plan === 'family'
            ? 'Family'
            : auth.plan === 'personal'
                ? 'Personal'
                : auth.plan === 'draft'
                    ? 'Draft'
                    : auth.plan === 'concierge'
                        ? 'Concierge'
                        : 'No active plan';

    const handleRefund = async () => {
        setRefundSubmitting(true);
        try {
            const res = await fetch('/api/billing/refund-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to send refund request');
            }
            setRefundRequested(true);
            toast.success('Refund request sent');
        } catch (err: any) {
            toast.error(err.message || 'Failed to send refund request');
        } finally {
            setRefundSubmitting(false);
        }
    };

    const handleUpgradeToFamily = async () => {
        setUpgradeSubmitting(true);
        try {
            const res = await fetch('/api/upgrade-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetPlan: 'family' }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to start upgrade');
            }
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            toast.error('Could not start upgrade session');
        } catch (err: any) {
            toast.error(err.message || 'Failed to start upgrade');
        } finally {
            setUpgradeSubmitting(false);
        }
    };

    const isDraft = auth.plan === 'draft' || auth.plan === 'none';
    const isPersonal = auth.plan === 'personal';
    const isFamily = auth.plan === 'family' || auth.plan === 'concierge';

    return (
        <DashboardShell userId={userId}>
            <div className="min-h-screen bg-surface-low">
                <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Settings</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Profile, Billing, Security</h1>
                        <p className="mt-3 max-w-2xl text-sm text-warm-muted">
                            A single place to review your account identity, current plan, and the security rules that protect access to your archives.
                        </p>
                    </div>

                    <SecurityCenter userId={userId} />

                    <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-olive/10 text-olive">
                                    <UserCircle2 size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Profile</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Account identity</p>
                                </div>
                            </div>
                            <div className="space-y-4 text-sm text-warm-muted">
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">Email</p>
                                    <div className="mt-2 flex items-center gap-2 text-warm-dark">
                                        <Mail size={14} className="text-warm-outline" />
                                        <span>{auth.user?.email}</span>
                                    </div>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">User ID</p>
                                    <p className="mt-2 break-all font-mono text-xs text-warm-dark/70">{userId}</p>
                                </div>
                            </div>
                        </section>

                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-warm-brown/10 text-warm-brown">
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Billing</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Plan and upgrades</p>
                                </div>
                            </div>
                            <div className="rounded-none border border-warm-border/30 bg-white px-4 py-4">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">Current Plan</p>
                                <p className="mt-2 font-serif text-2xl text-warm-dark">{planLabel}</p>
                                <p className="mt-2 text-sm text-warm-muted">
                                    {isFamily
                                        ? 'Your workspace already includes the family archive layer.'
                                        : isPersonal
                                            ? 'You have permanent preservation for one personal archive.'
                                            : 'You are still in the build phase. Upgrade when you are ready to preserve.'}
                                </p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                {isDraft && (
                                    <>
                                        <Link
                                            href="/choice-pricing?target=personal"
                                            className="glass-btn-primary inline-flex items-center rounded-none px-4 py-2 text-sm font-medium"
                                        >
                                            Upgrade to Personal
                                        </Link>
                                        <Link
                                            href="/choice-pricing?target=family"
                                            className="inline-flex items-center rounded-none border border-warm-border/30 bg-white px-4 py-2 text-sm font-medium text-warm-dark transition-colors hover:bg-surface-mid/50"
                                        >
                                            Upgrade to Family
                                        </Link>
                                    </>
                                )}

                                {isPersonal && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleUpgradeToFamily}
                                            disabled={upgradeSubmitting}
                                            className="glass-btn-primary inline-flex items-center gap-2 rounded-none px-4 py-2 text-sm font-medium disabled:opacity-60"
                                        >
                                            {upgradeSubmitting && <Loader2 size={14} className="animate-spin" />}
                                            Upgrade to Family
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRefund}
                                            disabled={refundSubmitting || refundRequested}
                                            className="inline-flex items-center gap-2 rounded-none border border-warm-border/30 bg-white px-4 py-2 text-sm font-medium text-warm-dark transition-colors hover:bg-surface-mid/50 disabled:opacity-60"
                                        >
                                            {refundSubmitting && <Loader2 size={14} className="animate-spin" />}
                                            {refundRequested ? 'Refund request sent' : 'Request refund'}
                                        </button>
                                    </>
                                )}

                                {isFamily && (
                                    <button
                                        type="button"
                                        onClick={handleRefund}
                                        disabled={refundSubmitting || refundRequested}
                                        className="inline-flex items-center gap-2 rounded-none border border-warm-border/30 bg-white px-4 py-2 text-sm font-medium text-warm-dark transition-colors hover:bg-surface-mid/50 disabled:opacity-60"
                                    >
                                        {refundSubmitting && <Loader2 size={14} className="animate-spin" />}
                                        {refundRequested ? 'Refund request sent' : 'Request refund'}
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
