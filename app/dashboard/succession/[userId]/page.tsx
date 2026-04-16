'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { Shield, UserCheck, Clock, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { isFamilyPlan, isPersonalPlan, useAuth } from '@/components/providers/AuthProvider';
import SuccessorSettings from '@/components/SuccessorSettings';

export default function DashboardSuccessionPage({ params }: { params: Promise<{ userId: string }> }) {
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
            router.replace(`/dashboard/succession/${auth.user.id}`);
            return;
        }
        if (!isFamilyPlan(auth.plan) && !isPersonalPlan(auth.plan) && auth.user) {
            router.replace(`/dashboard/draft/${auth.user.id}`);
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, userId, router]);

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
                <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Succession</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Plan who takes over your archive</h1>
                        <p className="mt-3 max-w-3xl text-sm text-warm-muted">
                            Designate a trusted successor and set the dead man&apos;s switch that decides when outreach begins. Stewardship stays separate from day-to-day editing.
                        </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-olive/10 text-olive">
                                    <UserCheck size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">How it works</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Clear and account-level</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-4">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <UserCheck size={14} className="text-olive" />
                                        Pick one trusted successor
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        This is the person we reach out to when it is time to transfer stewardship of your archive.
                                    </p>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-4">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Clock size={14} className="text-olive" />
                                        Set the dead man&apos;s switch
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        We periodically confirm you are still managing the account. Outreach to your successor only begins if you stop responding.
                                    </p>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-4">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Shield size={14} className="text-olive" />
                                        Stewardship is account-level
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        One successor covers every archive you own, so your succession plan stays consistent across Personal and Family workspaces.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 rounded-none border border-warm-border/30 bg-surface-mid/40 px-4 py-4 text-sm text-warm-muted">
                                Need to edit a memorial right now? Go back to{' '}
                                <Link href={auth.plan === 'family' || auth.plan === 'concierge' ? `/dashboard/family/${userId}` : auth.plan === 'personal' ? `/dashboard/personal/${userId}` : `/dashboard/draft/${userId}`} className="text-warm-dark underline underline-offset-2">
                                    My Archives
                                </Link>{' '}
                                <ArrowRight size={14} className="inline ml-1" />
                            </div>
                        </section>

                        <section className="glass-card rounded-none p-0 overflow-hidden">
                            <SuccessorSettings userId={userId} />
                        </section>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
