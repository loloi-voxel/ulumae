'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, User, UserPlus, Users } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import InviteComposer from '@/components/role/InviteComposer';
import RoleManagementTable from '@/components/role/RoleManagementTable';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase, type Memorial } from '@/lib/supabase';

function MemorialCard({ memorial }: { memorial: Memorial }) {
    return (
        <div className="bg-white border border-warm-border/30 rounded-none overflow-hidden">
            <div className="relative h-48 bg-surface-mid">
                {memorial.profile_photo_url ? (
                    <img src={memorial.profile_photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <User size={64} className="text-warm-border/30" />
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    {memorial.paid ? (
                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-olive border border-olive/20 font-sans">
                            Live
                        </span>
                    ) : memorial.status === 'published' ? (
                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-olive/10 backdrop-blur-sm text-olive border border-olive/20 font-sans">
                            Published
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-warm-muted border border-warm-border/30 font-sans">
                            Preview
                        </span>
                    )}
                </div>
            </div>

            <div className="p-5">
                <h3 className="font-serif text-xl text-warm-dark mb-1">{memorial.full_name || 'Untitled'}</h3>
                <p className="text-xs text-warm-muted font-sans">
                    {memorial.birth_date || '?'} &mdash; {memorial.death_date || 'Present'}
                </p>
            </div>
        </div>
    );
}

export default function FamilyMembersPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();

    const [memorials, setMemorials] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [openInviteMemorialId, setOpenInviteMemorialId] = useState<string | null>(null);
    const [showCoGuardianInvite, setShowCoGuardianInvite] = useState(false);

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/family/${auth.user.id}/members`);
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

    useEffect(() => {
        (async () => {
            setLoading(true);
            const { data } = await supabase
                .from('memorials')
                .select('*, payment_confirmed_at')
                .eq('user_id', userId)
                .eq('mode', 'family')
                .eq('deleted', false)
                .order('updated_at', { ascending: false });

            if (data) {
                setMemorials(data.filter((memorial) => memorial.full_name));
            }
            setLoading(false);
        })();
    }, [userId]);

    const primaryMemorial = useMemo(() => memorials[0] || null, [memorials]);
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
                <div className="mx-auto max-w-6xl px-6 py-12">
                    <div className="mb-10">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Members</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Family plan access</h1>
                        <p className="mt-3 max-w-3xl text-sm text-warm-muted">
                            Invite readers and witnesses archive by archive, then manage co-guardians separately for the family workspace as a whole.
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 size={24} className="mx-auto text-olive animate-spin mb-3" />
                            <p className="text-sm text-warm-muted font-sans">Loading memorials...</p>
                        </div>
                    ) : memorials.length === 0 ? (
                        <div className="border-2 border-dashed border-warm-border/35 bg-white px-6 py-16 text-center rounded-none">
                            <Users size={28} className="mx-auto mb-3 text-warm-muted" />
                            <p className="font-serif text-2xl text-warm-dark">No memorials yet</p>
                            <p className="mt-2 text-sm text-warm-muted font-sans">
                                Create a family memorial first, then return here to invite witnesses, readers, and co-guardians.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            <section className="space-y-6">
                                <div className="border border-warm-border/25 bg-white px-5 py-5 rounded-none">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Archives</p>
                                    <h2 className="mt-3 font-serif text-2xl text-warm-dark">Witnesses and Readers</h2>
                                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-warm-muted">
                                        Witnesses can submit memories and photos for review. Readers can quietly view the archive without contributing or changing anything.
                                    </p>
                                </div>

                                <div className="grid gap-8 lg:grid-cols-2">
                                    {memorials.map((memorial) => {
                                        const inviteOpen = openInviteMemorialId === memorial.id;

                                        return (
                                            <div key={memorial.id} className="space-y-4">
                                                <MemorialCard memorial={memorial} />

                                                <div className="border border-warm-border/25 bg-white p-5 rounded-none">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Archive members</p>
                                                            <p className="mt-2 text-sm text-warm-muted">
                                                                Manage only Witness and Reader access for {memorial.full_name || 'this archive'}.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setOpenInviteMemorialId(inviteOpen ? null : memorial.id)}
                                                            className="inline-flex items-center justify-center gap-2 border border-warm-border/30 px-4 py-2.5 text-sm font-semibold text-warm-dark transition-colors hover:bg-surface-high rounded-none"
                                                        >
                                                            <UserPlus size={16} />
                                                            Add Members
                                                        </button>
                                                    </div>

                                                    {inviteOpen ? (
                                                        <div className="mt-5 border border-warm-border/20 bg-surface-low/40 p-4 rounded-none">
                                                            <InviteComposer memorialId={memorial.id} planType="family" allowedRoles={['witness', 'reader']} />
                                                        </div>
                                                    ) : null}

                                                    <div className="mt-5">
                                                        <RoleManagementTable
                                                            memorialId={memorial.id}
                                                            planType="family"
                                                            allowedRoles={['witness', 'reader']}
                                                            title="Archive members"
                                                            emptyStateTitle="No witnesses or readers yet"
                                                            emptyStateDescription="Invite a witness or reader to this archive when you are ready."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="border border-warm-brown/20 bg-warm-brown/5 p-6 rounded-none">
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Co-Guardian</p>
                                        <h2 className="mt-3 font-serif text-2xl text-warm-dark">Family-wide stewardship</h2>
                                        <p className="mt-3 text-sm leading-relaxed text-warm-muted">
                                            A co-guardian shares full management of this family plan. They can edit archives, invite members, and manage settings.
                                        </p>
                                    </div>

                                    {primaryMemorial ? (
                                        <button
                                            onClick={() => setShowCoGuardianInvite((value) => !value)}
                                            className="inline-flex items-center justify-center gap-2 border border-warm-border/30 bg-white px-4 py-2.5 text-sm font-semibold text-warm-dark transition-colors hover:bg-surface-high rounded-none"
                                        >
                                            <ShieldCheck size={16} />
                                            Invite Co-Guardian
                                        </button>
                                    ) : null}
                                </div>

                                {primaryMemorial ? (
                                    <>
                                        {showCoGuardianInvite ? (
                                            <div className="mt-6 border border-warm-border/20 bg-white p-4 rounded-none">
                                                <InviteComposer memorialId={primaryMemorial.id} planType="family" allowedRoles={['co_guardian']} />
                                            </div>
                                        ) : null}

                                        <div className="mt-6">
                                            <RoleManagementTable
                                                memorialId={primaryMemorial.id}
                                                planType="family"
                                                allowedRoles={['co_guardian']}
                                                title="Co-guardians"
                                                emptyStateTitle="No co-guardians yet"
                                                emptyStateDescription="Invite a co-guardian when you want another person to share full stewardship of the family workspace."
                                            />
                                        </div>
                                    </>
                                ) : null}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
