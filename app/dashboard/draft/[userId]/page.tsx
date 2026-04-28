'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, FileEdit, RefreshCcw, AlertTriangle, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Memorial } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/client';
import { getPlanDashboardPath, useAuth } from '@/components/providers/AuthProvider';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';
import { permanentlyDeleteMemorial, updateMemorialTrashState } from '@/lib/memorialClientActions';
import { SOFT_DELETE_RETENTION_DAYS, PLAN_PRICES_USD } from '@/lib/constants';

type PendingConfirm =
    | { kind: 'soft-delete'; id: string }
    | { kind: 'permanent-delete'; id: string; stage: 1 | 2 };

export default function DraftDashboard({ params }: { params: Promise<{ userId: string }> }) {
    const unwrappedParams = use(params);
    const userId = unwrappedParams.userId;
    const router = useRouter();
    const auth = useAuth();
    const [memorials, setMemorials] = useState<Memorial[]>([]);
    const [deletedMemorials, setDeletedMemorials] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [skeletonCount, setSkeletonCount] = useState(2);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    // Auth guard: verify user identity and redirect if they have a paid plan
    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/draft/${auth.user.id}`);
            return;
        }
        // If user has upgraded to a paid plan, redirect to the correct dashboard
        if (auth.hasPaid && auth.user) {
            router.replace(getPlanDashboardPath(auth.plan, auth.user.id));
            return;
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.hasPaid, auth.plan, userId, router]);

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(`draft-count-${userId}`);
            if (stored) setSkeletonCount(Math.max(1, Math.min(parseInt(stored, 10) || 2, 6)));
        } catch { /* sessionStorage unavailable */ }
        loadMemorials();
    }, [userId]);

    const loadMemorials = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from('memorials')
            .select('*')
            .eq('user_id', userId)
            .eq('mode', 'draft')
            .order('updated_at', { ascending: false });

        if (error) console.error('Error:', error);

        if (data) {
            const active = data.filter(m => !m.deleted);
            setMemorials(active);
            setDeletedMemorials(data.filter(m => m.deleted));
            try { sessionStorage.setItem(`draft-count-${userId}`, String(active.length || 1)); } catch { /* noop */ }
        }
        setLoading(false);
    };

    // Refetch when user navigates back via browser back button or tab switch
    useEffect(() => {
        const handlePopState = () => loadMemorials();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') loadMemorials();
        };
        window.addEventListener('popstate', handlePopState);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [userId]);

    const handleCreate = () => {
        window.location.href = '/create?mode=draft';
    };

    const softDeleteMemorial = (id: string) => {
        setPendingConfirm({ kind: 'soft-delete', id });
    };

    const restoreMemorial = async (id: string) => {
        try {
            await updateMemorialTrashState(id, 'restore');
            loadMemorials();
        } catch (error) {
            alert('Error restoring archive');
            console.error(error);
        }
    };

    const permanentDeleteMemorial = (id: string) => {
        setPendingConfirm({ kind: 'permanent-delete', id, stage: 1 });
    };

    const handleConfirm = async () => {
        if (!pendingConfirm) return;
        if (pendingConfirm.kind === 'soft-delete') {
            const id = pendingConfirm.id;
            setPendingConfirm(null);
            try {
                await updateMemorialTrashState(id, 'delete');
                loadMemorials();
            } catch (error) {
                alert('Error deleting archive');
                console.error(error);
            }
            return;
        }
        if (pendingConfirm.kind === 'permanent-delete' && pendingConfirm.stage === 1) {
            setPendingConfirm({ kind: 'permanent-delete', id: pendingConfirm.id, stage: 2 });
            return;
        }
        if (pendingConfirm.kind === 'permanent-delete' && pendingConfirm.stage === 2) {
            const id = pendingConfirm.id;
            setPendingConfirm(null);
            try {
                await permanentlyDeleteMemorial(id);
                loadMemorials();
            } catch {
                alert('Error permanently deleting archive. Please try again.');
            }
        }
    };

    const getDaysRemaining = (deletedAt: string) => {
        const deleteDate = new Date(deletedAt);
        const expiryDate = new Date(deleteDate.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diff = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        return diff > 0 ? diff : 0;
    };

    // BLOCK RENDERING until auth checks pass — prevents flash of dashboard content
    // for paid users who don't belong on the draft dashboard
    const hasDraftAccess = !auth.loading && auth.authenticated && !auth.hasPaid;
    if (!hasDraftAccess) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-none animate-spin mx-auto mb-4" />
                    <p className="text-warm-dark/50 text-sm">Verifying access...</p>
                </div>
            </div>
        );
    }

    const personalPrice = PLAN_PRICES_USD.personal.toLocaleString();

    return (
        <DashboardShell userId={userId}>
        <div className="min-h-screen bg-surface-low">
            <div className="bg-white border-b border-warm-border/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                                <h1 className="font-serif text-3xl sm:text-4xl text-warm-dark">My Archives</h1>
                                <span className="px-3 py-1 bg-warm-dark/10 text-warm-dark/60 text-xs font-semibold rounded-none uppercase tracking-wide">
                                    Private Preview
                                </span>
                            </div>
                            <p className="text-sm sm:text-base text-warm-dark/60">Your private preview archives &mdash; preserve one when you are ready to make it permanent</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {memorials.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (memorials.length === 1) {
                                            router.push(`/seal-confirmation?memorialId=${memorials[0].id}`);
                                        } else {
                                            router.push('/seal-confirmation');
                                        }
                                    }}
                                    className="px-4 sm:px-5 py-2.5 rounded-none flex items-center gap-2 sm:gap-3 border border-olive/40 bg-white text-olive hover:bg-olive/5 transition-all text-sm"
                                >
                                    <Shield size={18} />
                                    <span className="flex flex-col items-start leading-tight">
                                        <span className="font-semibold">Preserve an archive</span>
                                        <span className="hidden sm:inline text-[10px] tracking-wide text-olive/70">From ${personalPrice} &middot; one-time</span>
                                    </span>
                                </button>
                            )}

                            <button
                                onClick={handleCreate}
                                className="glass-btn-dark px-4 sm:px-6 py-3 rounded-none font-semibold flex items-center gap-2 bg-warm-dark hover:bg-warm-dark/90 text-surface-low text-sm sm:text-base"
                            >
                                <Plus size={20} />
                                <span className="whitespace-nowrap">New Archive</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Loading archives">
                        {Array.from({ length: skeletonCount }).map((_, i) => (
                            <div key={i} className="bg-white border border-warm-border/30 rounded-none overflow-hidden animate-pulse">
                                <div className="h-48 bg-surface-mid" />
                                <div className="p-6">
                                    <div className="h-6 w-3/4 bg-surface-mid mb-3 rounded-none" />
                                    <div className="h-3 w-1/2 bg-surface-mid/70 mb-6 rounded-none" />
                                    <div className="h-9 bg-surface-mid rounded-none" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : memorials.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 bg-warm-dark/5 rounded-none flex items-center justify-center mx-auto mb-6">
                            <FileEdit size={48} className="text-warm-dark/30" />
                        </div>
                        <h2 className="font-serif text-3xl text-warm-dark mb-3">Start Your First Archive</h2>
                        <p className="text-warm-dark/50 mb-6 max-w-sm mx-auto">
                            Build your memorial at your own pace. No payment required to get started.
                        </p>
                        <button onClick={handleCreate} className="glass-btn-dark inline-flex items-center gap-2 px-6 py-3 bg-warm-dark/80 hover:bg-warm-dark text-surface-low rounded-none font-semibold">
                            <Plus size={20} />
                            Create Archive
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {memorials.map((memorial) => (
                            <div key={memorial.id} className="bg-white rounded-none border border-warm-border/30 overflow-hidden">
                                {/* Preview watermark overlay on thumbnail */}
                                <div className="relative h-48 bg-surface-mid">
                                    {memorial.profile_photo_url ? (
                                        <>
                                            <img src={memorial.profile_photo_url} alt="" className="w-full h-full object-cover opacity-60" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-warm-dark/40 font-bold text-xl tracking-widest rotate-[-20deg] select-none pointer-events-none">
                                                    PRIVATE PREVIEW
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileEdit size={64} className="text-warm-dark/20" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-6">
                                    <h3 className="font-serif text-2xl text-warm-dark mb-2">{memorial.full_name || 'Untitled Archive'}</h3>
                                    <p className="text-xs text-warm-dark/40 mb-4">
                                        Last edited: {new Date(memorial.updated_at).toLocaleDateString()}
                                    </p>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/create?id=${memorial.id}&mode=draft`}
                                            className="flex-1 py-2 px-3 bg-warm-dark/10 hover:bg-warm-dark/20 text-warm-dark rounded-none font-medium text-center text-sm"
                                        >
                                            <Edit size={16} className="inline mr-1" />Edit
                                        </Link>
                                        <button
                                            onClick={() => softDeleteMemorial(memorial.id)}
                                            aria-label="Delete archive"
                                            className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-none"
                                            title="Delete archive"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Removed Archives */}
                {deletedMemorials.length > 0 && (
                    <div className="mt-16 pt-10 border-t border-warm-border/30">
                        <h3 className="text-xl font-serif text-warm-dark mb-2 flex items-center gap-2">
                            <Trash2 size={20} className="text-warm-dark/40" />
                            Removed Archives
                        </h3>
                        <p className="text-sm text-warm-dark/40 mb-6">
                            Archives are kept for {SOFT_DELETE_RETENTION_DAYS} days before permanent deletion.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                            {deletedMemorials.map((memorial) => (
                                <div key={memorial.id} className="bg-warm-border/10 rounded-none border border-warm-border/30 p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-warm-dark">{memorial.full_name || 'Untitled Archive'}</p>
                                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {getDaysRemaining(memorial.deleted_at!)} days until permanent deletion
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => restoreMemorial(memorial.id)}
                                            aria-label="Restore archive"
                                            className="p-2 bg-white border border-warm-dark/20 text-warm-dark/60 rounded-none hover:bg-warm-dark/10 transition-colors"
                                            title="Restore"
                                        >
                                            <RefreshCcw size={18} />
                                        </button>
                                        <button
                                            onClick={() => permanentDeleteMemorial(memorial.id)}
                                            aria-label="Delete permanently"
                                            className="p-2 bg-red-50 border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-none transition-colors"
                                            title="Delete permanently"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
        <ConfirmDialog
            open={pendingConfirm !== null}
            variant="danger"
            title={
                pendingConfirm?.kind === 'soft-delete'
                    ? 'Move this archive to the trash?'
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'Permanently delete this archive?'
                        : 'This is irreversible'
            }
            description={
                pendingConfirm?.kind === 'soft-delete'
                    ? `It will be moved to the trash for ${SOFT_DELETE_RETENTION_DAYS} days. You can restore it until then.`
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'This action cannot be undone. The archive and all its content will be lost forever.'
                        : 'Last chance. Once confirmed, the archive and all its content are gone forever.'
            }
            confirmLabel={
                pendingConfirm?.kind === 'soft-delete'
                    ? 'Move to trash'
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'Continue'
                        : 'Delete forever'
            }
            onConfirm={handleConfirm}
            onCancel={() => setPendingConfirm(null)}
        />
        </DashboardShell>
    );
}
