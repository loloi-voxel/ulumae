'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, Lock, Mail, Shield, UserCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/components/providers/AuthProvider';
import SecurityCenter from '@/components/SecurityCenter';

export default function DashboardSettingsPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();

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

                    <div className="grid gap-6 lg:grid-cols-3">
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
                                    {auth.plan === 'family' || auth.plan === 'concierge'
                                        ? 'Your workspace already includes the family archive layer.'
                                        : auth.plan === 'personal'
                                            ? 'You have permanent preservation for one personal archive.'
                                            : 'You are still in the build phase. Upgrade when you are ready to preserve.'}
                                </p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link
                                    href="/choice-pricing"
                                    className="glass-btn inline-flex items-center rounded-none px-4 py-2 text-sm font-medium text-warm-dark"
                                >
                                    Review Plans
                                </Link>
                                <Link
                                    href="/contact"
                                    className="inline-flex items-center rounded-none border border-warm-border/30 px-4 py-2 text-sm text-warm-muted transition-colors hover:bg-surface-mid/50 hover:text-warm-dark"
                                >
                                    Billing Help
                                </Link>
                            </div>
                        </section>

                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-warm-dark/10 text-warm-dark">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Security</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Access protection</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Lock size={14} className="text-olive" />
                                        Supabase sessions with app-owned 2FA
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        Password sign-in still uses Supabase sessions, while second-factor verification is now handled by ULUMAE with authenticator apps and recovery codes.
                                    </p>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Shield size={14} className="text-olive" />
                                        Plan-aware route protection
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        Family, Personal, and Draft workspaces redirect to the correct dashboard when the user does not match the required plan.
                                    </p>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Shield size={14} className="text-olive" />
                                        Sensitive actions require owner-only confirmation
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        Archive deletion, restoration, member role changes, and preservation actions now stay behind server-validated ownership checks instead of trusting client input.
                                    </p>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Shield size={14} className="text-olive" />
                                        Sessions, recovery, and trusted devices
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        This is the right home for password change, email change, trusted session control, authenticator setup, and recovery codes.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="mt-6">
                        <SecurityCenter userId={userId} />
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
