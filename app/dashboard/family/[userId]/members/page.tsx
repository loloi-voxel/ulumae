'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, Users } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ManageWitnessesModal from '@/app/dashboard/[userId]/_components/ManageWitnessesModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase, Memorial } from '@/lib/supabase';

export default function FamilyMembersPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();

    const [memorials, setMemorials] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMemorial, setActiveMemorial] = useState<Memorial | null>(null);

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
                .order('updated_at', { ascending: false });
            if (data) {
                setMemorials(data.filter((m) => !m.deleted && m.full_name));
            }
            setLoading(false);
        })();
    }, [userId]);

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
                <div className="mx-auto max-w-5xl px-6 py-12">
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Members</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">Member management</h1>
                        <p className="mt-3 max-w-2xl text-sm text-warm-muted font-sans">
                            Invite co-guardians, witnesses, and readers for each family memorial. Changes affect only the selected archive.
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
                                Create a memorial first, then come back here to invite members.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {memorials.map((memorial) => (
                                <div
                                    key={memorial.id}
                                    className="flex flex-col gap-4 border border-warm-border/30 bg-white p-6 rounded-none sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center bg-surface-mid rounded-none">
                                            {memorial.profile_photo_url ? (
                                                <img
                                                    src={memorial.profile_photo_url}
                                                    alt=""
                                                    className="h-12 w-12 object-cover"
                                                />
                                            ) : (
                                                <User size={20} className="text-warm-muted" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-serif text-xl text-warm-dark">
                                                {memorial.full_name || 'Untitled'}
                                            </h3>
                                            <p className="text-xs text-warm-muted font-sans">
                                                {memorial.birth_date || '?'} &mdash; {memorial.death_date || 'Present'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveMemorial(memorial)}
                                        className="inline-flex items-center justify-center gap-2 border border-warm-border/30 px-5 py-2.5 text-sm font-sans font-semibold text-warm-dark transition-colors hover:bg-surface-high rounded-none"
                                    >
                                        <Users size={16} />
                                        Manage members
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {activeMemorial && (
                <ManageWitnessesModal
                    isOpen={true}
                    onClose={() => setActiveMemorial(null)}
                    memorialId={activeMemorial.id}
                    memorialName={activeMemorial.full_name || 'Untitled'}
                    planType="family"
                />
            )}
        </DashboardShell>
    );
}
