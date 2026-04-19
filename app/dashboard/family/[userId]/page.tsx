// app/dashboard/family/[userId]/page.tsx

'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, User, Network, X, Search, Filter, RefreshCcw, AlertTriangle, Archive, Wifi, BellDot } from 'lucide-react';
import { supabase, Memorial } from '@/lib/supabase';
import FamilyLinker from '@/components/FamilyLinker';
import AnchorPanel from '@/components/AnchorPanel';
import ManageWitnessesModal from '@/app/dashboard/[userId]/_components/ManageWitnessesModal';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';
import EditableFamilyTitle from '@/components/dashboard/EditableFamilyTitle';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { SOFT_DELETE_RETENTION_DAYS } from '@/lib/constants';
import { useNotifications } from '@/hooks/useNotifications';
import { permanentlyDeleteMemorial, updateMemorialTrashState } from '@/lib/memorialClientActions';

type FamilySortOption = 'birth' | 'created_asc' | 'created_desc';

export default function FamilyDashboard({ params }: { params: Promise<{ userId: string }> }) {
    const unwrappedParams = use(params);
    const userId = unwrappedParams.userId;
    const auth = useAuth();
    const router = useRouter();
    const { data: notificationData } = useNotifications();
    const [memorials, setMemorials] = useState<Memorial[]>([]);
    const [deletedMemorials, setDeletedMemorials] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [skeletonCount, setSkeletonCount] = useState(3);
    const [pendingConfirm, setPendingConfirm] = useState<
        | { kind: 'soft-delete'; id: string; sharedCount: number }
        | { kind: 'permanent-delete'; id: string; stage: 1 | 2 }
        | null
    >(null);
    const [managingId, setManagingId] = useState<string | null>(null);
    const [memberManagerMemorial, setMemberManagerMemorial] = useState<Memorial | null>(null);
    const [showWelcome, setShowWelcome] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<FamilySortOption>('created_desc');

    const searchParams = useSearchParams();

    // Auth guard: verify the URL userId matches the authenticated user + plan enforcement
    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/family/${auth.user.id}`);
            return;
        }
        // PLAN ENFORCEMENT: Personal-only users cannot access family dashboard
        if (auth.plan === 'personal') {
            console.log('[Plan Guard] User attempted Family access with Personal plan. Redirecting.');
            router.replace(`/dashboard/personal/${userId}`);
            return;
        }
        // Draft users go to draft dashboard
        if (auth.plan === 'draft' || auth.plan === 'none') {
            router.replace(`/dashboard/draft/${userId}`);
            return;
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, userId, router]);

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(`family-count-${userId}`);
            if (stored) setSkeletonCount(Math.max(1, Math.min(parseInt(stored, 10) || 3, 8)));
        } catch { /* sessionStorage unavailable */ }
        loadMemorials();
        if (searchParams.get('welcome') === 'true') {
            setShowWelcome(true);
            window.history.replaceState({}, '', `/dashboard/family/${userId}`);
            setTimeout(() => setShowWelcome(false), 5000);
        }
    }, [userId, searchParams]);

    useEffect(() => {
        const section = searchParams.get('section');
        if (!section) return;

        const target = document.getElementById(section);
        if (!target) return;

        window.requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [searchParams, notificationData.pendingCount, memorials.length]);

    useEffect(() => {
        const memberMemorialId = searchParams.get('members');
        if (!memberMemorialId || memorials.length === 0) return;

        const target = memorials.find((memorial) => memorial.id === memberMemorialId);
        if (target) {
            setMemberManagerMemorial(target);
        }
    }, [searchParams, memorials]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            loadMemorials();
        }, 30000);

        return () => window.clearInterval(interval);
    }, [userId]);

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

    const loadMemorials = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('memorials')
            .select('*, payment_confirmed_at')
            .eq('user_id', userId)
            .eq('mode', 'family')
            .order('updated_at', { ascending: false });

        if (error) console.error('Error:', error);

        if (data) {
            const activeMemorials = data.filter(m => !m.deleted);
            setMemorials(activeMemorials);
            setDeletedMemorials(data.filter(m => m.deleted));
            try { sessionStorage.setItem(`family-count-${userId}`, String(activeMemorials.length || 1)); } catch { /* noop */ }
        }
        setLoading(false);
    };

    const handleCreate = () => {
        // Reuse an existing empty paid memorial (plan marker) if available
        const emptyPaid = memorials.find(m => !m.full_name && m.paid);
        if (emptyPaid) {
            window.location.href = `/create?id=${emptyPaid.id}&mode=family`;
        } else {
            window.location.href = '/create?mode=family';
        }
    };

    // Soft Delete with Contributor Check — blocks preserved archives
    const softDeleteMemorial = async (id: string) => {
        const target = memorials.find(m => m.id === id);
        if (target && (target as any).preservation_state === 'preserved') {
            alert('This archive has been permanently preserved on the blockchain and cannot be removed.');
            return;
        }
        const { count } = await supabase
            .from('memorial_contributions')
            .select('*', { count: 'exact', head: true })
            .eq('memorial_id', id)
            .neq('user_id', userId);

        setPendingConfirm({ kind: 'soft-delete', id, sharedCount: count || 0 });
    };

    const restoreMemorial = async (id: string) => {
        try {
            await updateMemorialTrashState(id, 'restore');
            loadMemorials();
        } catch (error) {
            alert('Error restoring memorial');
            console.error(error);
        }
    };

    const permanentDeleteMemorial = (id: string) => {
        setPendingConfirm({ kind: 'permanent-delete', id, stage: 1 });
    };

    const handleConfirmDestructive = async () => {
        if (!pendingConfirm) return;
        if (pendingConfirm.kind === 'soft-delete') {
            const id = pendingConfirm.id;
            setPendingConfirm(null);
            try {
                await updateMemorialTrashState(id, 'delete');
                loadMemorials();
            } catch (error) {
                alert('Error deleting memorial');
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
                alert('Error permanently deleting memorial. Please try again.');
            }
        }
    };

    const getDaysRemaining = (deletedAt: string) => {
        const deleteDate = new Date(deletedAt);
        const expiryDate = new Date(deleteDate.getTime() + (SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000));
        const now = new Date();
        const diff = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        return diff > 0 ? diff : 0;
    };

    // Filter Active Memorials — exclude empty plan markers (no full_name)
    const realMemorials = memorials.filter(m => m.full_name);
    const searchedMemorials = realMemorials.filter((m) =>
        (m.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const parseTime = (value?: string | null) => {
        if (!value) return Number.NaN;
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    const filteredMemorials = [...searchedMemorials].sort((a, b) => {
        if (sortOption === 'birth') {
            const aTime = parseTime(a.birth_date);
            const bTime = parseTime(b.birth_date);
            if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
            if (Number.isNaN(aTime)) return 1;
            if (Number.isNaN(bTime)) return -1;
            return aTime - bTime;
        }

        const aCreated = parseTime(a.created_at);
        const bCreated = parseTime(b.created_at);
        const aSafe = Number.isNaN(aCreated) ? 0 : aCreated;
        const bSafe = Number.isNaN(bCreated) ? 0 : bCreated;

        return sortOption === 'created_asc' ? aSafe - bSafe : bSafe - aSafe;
    });

    const firstPaidMemorial = memorials.find(m => m.paid);

    const pendingRequestCount = notificationData.pendingCount;

    // BLOCK RENDERING until auth checks pass
    const hasAccess = auth.plan === 'family' || auth.plan === 'concierge';
    if (auth.loading || !auth.authenticated || !hasAccess) {
        return (
            <div className="bg-surface-low min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-warm-border/30 border-t-olive rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-warm-muted text-sm font-sans">Verifying access...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardShell userId={userId}>
        <div className="bg-surface-low min-h-screen">
            {/* Welcome banner */}
            {showWelcome && (
                <div className="animate-fadeIn bg-surface-mid border-b border-warm-border/30">
                    <div className="max-w-7xl mx-auto px-6 py-4 text-center">
                        <p className="text-sm font-sans text-warm-muted tracking-wide">
                            When you are ready, everything is here.
                        </p>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-surface-mid/50 border-b border-warm-border/30">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                <EditableFamilyTitle />
                                <span className="live-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-semibold bg-olive/10 text-olive border border-olive/20">
                                    Live
                                </span>
                                {pendingRequestCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-warm-brown/20 bg-warm-brown/10 px-3 py-1 text-xs font-semibold text-warm-brown">
                                        <BellDot size={12} />
                                        {pendingRequestCount} pending item{pendingRequestCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            <p className="text-warm-muted font-sans text-sm tracking-wide">
                                {memorials.length} memorial{memorials.length !== 1 ? 's' : ''} &bull; {pendingRequestCount} pending item{pendingRequestCount !== 1 ? 's' : ''} &bull; 0 devices anchored
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCreate}
                                className="px-5 py-3 rounded-none font-sans font-semibold flex items-center gap-2 glass-btn-primary text-sm"
                            >
                                <Plus size={18} />
                                Create Memorial
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* SEARCH & SORT TOOLBAR */}
                {!loading && realMemorials.length > 0 && (
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 glass-input rounded-none"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                            <select
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as FamilySortOption)}
                                className="pl-12 pr-8 py-3 glass-input rounded-none appearance-none cursor-pointer"
                            >
                                <option value="birth">Date of birth</option>
                                <option value="created_asc">Creation date (ascending)</option>
                                <option value="created_desc">Creation date (descending)</option>
                            </select>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-label="Loading memorials">
                        {Array.from({ length: skeletonCount }).map((_, i) => (
                            <div key={i} className="bg-white border border-warm-border/30 rounded-none overflow-hidden animate-pulse">
                                <div className="h-48 bg-surface-mid" />
                                <div className="p-5">
                                    <div className="h-5 w-2/3 bg-surface-mid mb-2 rounded-none" />
                                    <div className="h-3 w-1/2 bg-surface-mid/70 mb-4 rounded-none" />
                                    <div className="h-8 bg-surface-mid rounded-none" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : realMemorials.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 bg-surface-mid rounded-none flex items-center justify-center mx-auto mb-6">
                            <User size={48} className="text-warm-muted" />
                        </div>
                        <h2 className="font-serif text-3xl text-warm-dark mb-3">Create Your First Memorial</h2>
                        <p className="text-warm-muted font-sans mb-6">Begin preserving your family&apos;s legacy</p>
                        <button onClick={handleCreate} className="inline-flex items-center gap-2 px-6 py-3 glass-btn-primary rounded-none font-sans font-semibold text-sm">
                            <Plus size={20} />
                            Create
                        </button>
                    </div>
                ) : (
                    <>
                        {/* FAMILY ROW: Visual Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredMemorials.map((memorial) => (
                                <div key={memorial.id} className="bg-white border border-warm-border/30 rounded-none overflow-hidden transition-all group hover:border-warm-border/50">
                                    {/* Profile Photo */}
                                    <div className="relative h-48 bg-surface-mid">
                                        {memorial.profile_photo_url ? (
                                            <img src={memorial.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User size={64} className="text-warm-border/30" />
                                            </div>
                                        )}
                                        {/* Status Badge */}
                                        <div className="absolute top-3 right-3">
                                            {memorial.paid ? (
                                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-olive border border-olive/20 font-sans">
                                                    <Archive size={10} />
                                                    Active
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

                                    {/* Card Body */}
                                    <div className="p-5">
                                        <h3 className="font-serif text-xl text-warm-dark mb-1">{memorial.full_name || 'Untitled'}</h3>
                                        <p className="text-xs text-warm-muted font-sans mb-4">
                                            {memorial.birth_date || '?'} &mdash; {memorial.death_date || 'Present'}
                                        </p>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <Link href={`/person/${memorial.id}`} className="flex-1 py-2 px-3 bg-surface-mid rounded-none font-sans font-medium text-center text-sm flex items-center justify-center gap-1 text-warm-dark hover:bg-surface-high transition-colors">
                                                <Eye size={14} /> View
                                            </Link>
                                            <Link href={`/create?id=${memorial.id}&mode=family`} className="flex-1 py-2 px-3 bg-surface-mid rounded-none font-sans font-medium text-center text-sm flex items-center justify-center gap-1 text-warm-dark hover:bg-surface-high transition-colors">
                                                <Edit size={14} /> Edit
                                            </Link>
                                            <button
                                                onClick={() => setMemberManagerMemorial(memorial)}
                                                aria-label="Manage members"
                                                className="py-2 px-3 bg-surface-mid rounded-none text-warm-muted hover:bg-surface-high transition-colors"
                                                title="Manage members"
                                            >
                                                <User size={14} />
                                            </button>
                                            <button
                                                onClick={() => setManagingId(memorial.id)}
                                                aria-label="Manage family connections"
                                                className="py-2 px-3 bg-surface-mid rounded-none text-warm-muted hover:bg-surface-high transition-colors"
                                                title="Manage family connections"
                                            >
                                                <Network size={14} />
                                            </button>
                                            {(memorial as any).preservation_state !== 'preserved' && (
                                                <button
                                                    onClick={() => softDeleteMemorial(memorial.id)}
                                                    aria-label="Delete memorial"
                                                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-none transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* + Add Memorial Card */}
                            <button
                                onClick={handleCreate}
                                className="group flex min-h-[320px] cursor-pointer flex-col items-center justify-center overflow-hidden border border-dashed border-warm-border/30 bg-white transition-all hover:border-olive/30 hover:shadow-lg rounded-none"
                            >
                                <div className="mb-4 flex h-16 w-16 items-center justify-center bg-surface-mid transition-colors group-hover:bg-olive/10 rounded-none">
                                    <Plus size={28} className="text-warm-muted group-hover:text-olive transition-colors" />
                                </div>
                                <p className="font-sans font-semibold text-warm-muted group-hover:text-warm-dark text-sm transition-colors">Add Memorial</p>
                            </button>
                        </div>
                    </>
                )}

                {/* ANCHOR PANEL — Family Sync Status */}
                {firstPaidMemorial && (
                    <div className="mt-12">
                        <AnchorPanel memorialId={firstPaidMemorial.id} />
                    </div>
                )}

                {/* OFFLINE ACCESS GUARANTEE */}
                <div className="mt-8">
                    <div className="border border-warm-border/30 bg-white p-6 rounded-none">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center bg-olive/10 rounded-none">
                                <Wifi size={16} className="text-olive" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-warm-dark font-sans mb-1">Offline Access Guarantee</h3>
                                <p className="text-sm text-warm-muted font-sans leading-relaxed">
                                    Every anchored device holds a complete, verified copy of your family&apos;s memorial data.
                                    Your legacy remains accessible even without an internet connection &mdash; no subscription,
                                    no server dependency. Once anchored, it&apos;s yours forever.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* REMOVED ARCHIVES */}
                {deletedMemorials.length > 0 && (
                    <div className="mt-16 pt-10 border-t border-warm-border/30 animate-fadeIn">
                        <h3 className="text-xl font-serif text-warm-dark mb-2 flex items-center gap-2">
                            <Archive size={20} className="text-warm-muted" />
                            Removed Archives
                        </h3>
                        <p className="text-sm text-warm-muted font-sans mb-6">
                            Archives are kept for {SOFT_DELETE_RETENTION_DAYS} days before permanent deletion.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                            {deletedMemorials.map((memorial) => (
                                <div key={memorial.id} className="flex items-center justify-between border border-warm-border/30 bg-white p-4 rounded-none">
                                    <div>
                                        <p className="font-sans font-medium text-warm-dark">{memorial.full_name || 'Untitled'}</p>
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-sans">
                                            <AlertTriangle size={12} />
                                            {getDaysRemaining(memorial.deleted_at!)} days until permanent deletion
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => restoreMemorial(memorial.id)}
                                            className="border border-warm-border/30 bg-surface-mid p-2 text-warm-dark transition-colors hover:bg-surface-high rounded-none"
                                            title="Restore"
                                        >
                                            <RefreshCcw size={18} />
                                        </button>
                                        <button
                                            onClick={() => permanentDeleteMemorial(memorial.id)}
                                            className="border border-red-200 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 rounded-none"
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

            {/* CONNECTION MANAGER MODAL */}
            {managingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-modal-overlay">
                        <div className="glass-modal w-full max-w-lg overflow-hidden shadow-2xl animate-fadeIn rounded-none">
                        <div className="p-4 border-b border-warm-border/30 flex justify-between items-center bg-surface-mid/50">
                            <h3 className="font-serif text-lg text-warm-dark">Manage Family Connections</h3>
                            <button
                                onClick={() => setManagingId(null)}
                                aria-label="Close"
                                className="p-2 hover:bg-surface-high transition-colors rounded-none"
                            >
                                <X size={20} className="text-warm-muted" />
                            </button>
                        </div>
                        <div className="p-6">
                            <FamilyLinker
                                currentMemorialId={managingId}
                                userId={userId}
                            />
                        </div>
                    </div>
                </div>
            )}

            {memberManagerMemorial && (
                <ManageWitnessesModal
                    isOpen={true}
                    onClose={() => setMemberManagerMemorial(null)}
                    memorialId={memberManagerMemorial.id}
                    memorialName={memberManagerMemorial.full_name || 'Untitled'}
                    planType="family"
                />
            )}
        </div>
        <ConfirmDialog
            open={pendingConfirm !== null}
            variant="danger"
            title={
                pendingConfirm?.kind === 'soft-delete'
                    ? pendingConfirm.sharedCount > 0
                        ? 'Delete this shared memorial?'
                        : 'Move this memorial to the trash?'
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'Permanently delete this memorial?'
                        : 'This is irreversible'
            }
            description={
                pendingConfirm?.kind === 'soft-delete'
                    ? pendingConfirm.sharedCount > 0
                        ? `This archive contains contributions from ${pendingConfirm.sharedCount} other ${pendingConfirm.sharedCount === 1 ? 'person' : 'people'}. They will lose access to their contributions.`
                        : `It will be moved to the trash for ${SOFT_DELETE_RETENTION_DAYS} days. You can restore it until then.`
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'This action cannot be undone. The memorial and all its content will be lost forever.'
                        : 'Last chance. Once confirmed, the memorial and all its content are gone forever.'
            }
            confirmLabel={
                pendingConfirm?.kind === 'soft-delete'
                    ? 'Move to trash'
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'Continue'
                        : 'Delete forever'
            }
            onConfirm={handleConfirmDestructive}
            onCancel={() => setPendingConfirm(null)}
        />
        </DashboardShell>
    );
}
