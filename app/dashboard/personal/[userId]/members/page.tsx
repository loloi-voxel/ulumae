'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, UserPlus, Users } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import InviteComposer from '@/components/role/InviteComposer';
import RoleManagementTable from '@/components/role/RoleManagementTable';
import { isPersonalPlan, useAuth } from '@/components/providers/AuthProvider';
import { supabase, type Memorial } from '@/lib/supabase';

export default function PersonalMembersPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();

    const [memorials, setMemorials] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/personal/${auth.user.id}/members`);
            return;
        }
        if (auth.plan === 'family' || auth.plan === 'concierge') {
            router.replace(`/dashboard/family/${userId}`);
            return;
        }
        if (auth.plan === 'draft' || auth.plan === 'none') {
            router.replace(`/dashboard/draft/${userId}`);
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, userId, router]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const { data } = await supabase
                .from('memorials')
                .select('*, payment_confirmed_at')
                .eq('user_id', userId)
                .eq('mode', 'personal')
                .eq('deleted', false)
                .order('updated_at', { ascending: false });

            if (data) {
                setMemorials(data);
            }
            setLoading(false);
        })();
    }, [userId]);

    const archive = useMemo(() => memorials.find((memorial) => memorial.paid) || memorials[0] || null, [memorials]);
    const hasAccess = !auth.loading && auth.authenticated && isPersonalPlan(auth.plan);

    if (!hasAccess) {
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
                    <div className="mb-10">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Members</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Trusted access</h1>
                        <p className="mt-3 max-w-3xl text-sm text-warm-muted">
                            Personal archives can invite readers and witnesses. Witnesses can contribute stories and photos for your review, while readers can quietly view the archive.
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 size={24} className="mx-auto text-olive animate-spin mb-3" />
                            <p className="text-sm text-warm-muted font-sans">Loading your archive...</p>
                        </div>
                    ) : !archive ? (
                        <div className="border-2 border-dashed border-warm-border/35 bg-white px-6 py-16 text-center rounded-none">
                            <Users size={28} className="mx-auto mb-3 text-warm-muted" />
                            <p className="font-serif text-2xl text-warm-dark">No personal archive yet</p>
                            <p className="mt-2 text-sm text-warm-muted font-sans">
                                Create your personal archive first, then come back here to invite witnesses and readers.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white border border-warm-border/30 rounded-none overflow-hidden">
                                <div className="relative h-56 bg-surface-mid">
                                    {archive.profile_photo_url ? (
                                        <img src={archive.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User size={64} className="text-warm-border/30" />
                                        </div>
                                    )}
                                </div>

                                <div className="p-6">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Personal archive</p>
                                            <h2 className="mt-3 font-serif text-3xl text-warm-dark">{archive.full_name || 'Untitled archive'}</h2>
                                            <p className="mt-2 text-sm text-warm-muted">
                                                {archive.birth_date || '?'} &mdash; {archive.death_date || 'Present'}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => setShowInvite((value) => !value)}
                                            className="inline-flex items-center justify-center gap-2 border border-warm-border/30 px-4 py-2.5 text-sm font-semibold text-warm-dark transition-colors hover:bg-surface-high rounded-none"
                                        >
                                            <UserPlus size={16} />
                                            Invite Member
                                        </button>
                                    </div>

                                    {showInvite ? (
                                        <div className="mt-6 border border-warm-border/20 bg-surface-low/40 p-4 rounded-none">
                                            <InviteComposer memorialId={archive.id} planType="personal" allowedRoles={['witness', 'reader']} />
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <RoleManagementTable
                                memorialId={archive.id}
                                planType="personal"
                                allowedRoles={['witness', 'reader']}
                                title="Members"
                                emptyStateTitle="No members yet"
                                emptyStateDescription="Invite a witness or reader when you are ready to share this archive more intentionally."
                            />
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
