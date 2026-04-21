'use client';
import { useState, useEffect, useRef, use, type ReactNode } from 'react';
import Link from 'next/link';
import {
    Plus, Eye, Edit, Trash2, User, Loader2, RefreshCcw,
    AlertTriangle, CheckCircle,
    Clock, Shield,
    Archive, Download, Copy, Mail, QrCode,
    ChevronRight
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, Memorial } from '@/lib/supabase';
import { isPersonalPlan, useAuth } from '@/components/providers/AuthProvider';
import PreservationStatus from '@/components/PreservationStatus';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';
import { SOFT_DELETE_RETENTION_DAYS } from '@/lib/constants';
import {
    getOrCreateSessionFingerprint,
    SESSION_FINGERPRINT_HEADER,
} from '@/lib/sessionFingerprint';

type PendingConfirm =
    | { kind: 'soft-delete'; id: string }
    | { kind: 'permanent-delete'; id: string; stage: 1 | 2 };

function computeStats(memorial: Memorial) {
    const step7 = memorial.step7 as any;
    const step8 = memorial.step8 as any;
    const step9 = memorial.step9 as any;
    const step6 = memorial.step6 as any;
    return {
        photos: (step8?.gallery?.length || 0) + (step8?.interactiveGallery?.length || 0),
        videos: step9?.videos?.length || 0,
        memories: (step7?.sharedMemories?.length || 0) + (step7?.impactStories?.length || 0),
        chapters: step6?.lifeChapters?.length || 0,
    };
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

async function apiSoftDelete(id: string, action: 'delete' | 'restore') {
    const res = await fetch(`/api/memorials/${id}/soft-delete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error('Operation failed');
}

export default function PersonalDashboard({ params }: { params: Promise<{ userId: string }> }) {
    const unwrappedParams = use(params);
    const userId = unwrappedParams.userId;
    const auth = useAuth();
    const router = useRouter();

    const [activeArchive, setActiveArchive] = useState<Memorial | null>(null);
    const [deletedArchives, setDeletedArchives] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    const searchParams = useSearchParams();

    const [planVerified, setPlanVerified] = useState(false);
    const verifyRef = useRef(false);

    useEffect(() => {
        if (verifyRef.current) return;
        verifyRef.current = true;
        auth.revalidate().then(() => setPlanVerified(true));
    }, []);

    useEffect(() => {
        if (auth.loading || !planVerified) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/personal/${auth.user.id}`);
            return;
        }
        if ((auth.plan === 'draft' || auth.plan === 'none') && auth.user) {
            router.replace(`/dashboard/draft/${auth.user.id}`);
            return;
        }
        if (!isPersonalPlan(auth.plan) && auth.user && auth.plan !== 'draft' && auth.plan !== 'none') {
            router.replace(`/dashboard/family/${auth.user.id}`);
            return;
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, userId, router, planVerified]);

    useEffect(() => {
        const fingerprint = getOrCreateSessionFingerprint();
        fetch('/api/user/heartbeat', {
            method: 'POST',
            headers: fingerprint
                ? { 'Content-Type': 'application/json', [SESSION_FINGERPRINT_HEADER]: fingerprint }
                : { 'Content-Type': 'application/json' },
        });
        if (searchParams.get('checkin') === 'true') {
            setShowCheckinSuccess(true);
            window.history.replaceState({}, '', `/dashboard/personal/${userId}`);
            setTimeout(() => setShowCheckinSuccess(false), 5000);
        }
        if (searchParams.get('welcome') === 'true') {
            setShowWelcome(true);
            window.history.replaceState({}, '', `/dashboard/personal/${userId}`);
            setTimeout(() => setShowWelcome(false), 5000);
        }
        loadMemorials();
    }, [userId, searchParams]);

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
            .eq('mode', 'personal')
            .order('updated_at', { ascending: false });

        if (error) console.error('Error:', error);
        if (data) {
            const active = data.filter(m => !m.deleted);
            const deleted = data.filter(m => m.deleted);
            setActiveArchive(active.find(m => m.paid) || active[0] || null);
            setDeletedArchives(deleted);
        }
        setLoading(false);
    };

    const handleCreate = () => {
        if (auth.plan === 'family') {
            router.replace(`/dashboard/family/${userId}`);
            return;
        }
        if (activeArchive) {
            alert('You already have an active Personal Archive. Each account supports one personal archive.');
            return;
        }
        window.location.href = '/create?mode=personal';
    };

    const softDelete = (id: string) => {
        if (activeArchive?.id === id && (activeArchive as any).preservation_state === 'preserved') {
            alert('This archive has been permanently preserved on the blockchain and cannot be removed.');
            return;
        }
        setPendingConfirm({ kind: 'soft-delete', id });
    };

    const restore = async (id: string) => {
        if (activeArchive) {
            alert('You already have an active archive. Remove it first before restoring another.');
            return;
        }
        try {
            await apiSoftDelete(id, 'restore');
            loadMemorials();
        } catch {
            alert('Error restoring archive. Please try again.');
        }
    };

    const permanentDelete = (id: string) => {
        setPendingConfirm({ kind: 'permanent-delete', id, stage: 1 });
    };

    const handleConfirm = async () => {
        if (!pendingConfirm) return;
        if (pendingConfirm.kind === 'soft-delete') {
            const id = pendingConfirm.id;
            setPendingConfirm(null);
            try {
                await apiSoftDelete(id, 'delete');
                loadMemorials();
            } catch {
                alert('Error removing archive. Please try again.');
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
                const res = await fetch(`/api/memorials/${id}/permanent-delete`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Operation failed');
                loadMemorials();
            } catch {
                alert('Error permanently deleting archive. Please try again.');
            }
        }
    };

    const getDaysRemaining = (deletedAt: string) => {
        const expiry = new Date(new Date(deletedAt).getTime() + SOFT_DELETE_RETENTION_DAYS * 86400000);
        return Math.max(Math.ceil((expiry.getTime() - Date.now()) / 86400000), 0);
    };

    const hasPersonalAccess = planVerified && !auth.loading && auth.authenticated && isPersonalPlan(auth.plan);
    const restoreBlocked = Boolean(activeArchive);
    if (!hasPersonalAccess) {
        return (
            <div className="bg-surface-low min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={28} className="text-warm-muted/50 animate-spin mx-auto mb-4" />
                    <p className="text-warm-muted text-xs tracking-widest uppercase font-serif">Verifying access</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardShell userId={userId}>
        <div className="bg-surface-low text-warm-dark font-serif min-h-screen">
            {/* Toast notifications */}
            {showCheckinSuccess && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-card px-6 py-4 flex items-center gap-3 animate-fade-in-up">
                    <CheckCircle size={16} className="text-olive flex-shrink-0" />
                    <div>
                        <p className="text-sm text-warm-dark font-serif">Dead Man&apos;s Switch reset</p>
                        <p className="text-xs text-warm-muted font-serif">Timer renewed for another year.</p>
                    </div>
                </div>
            )}
            {showWelcome && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-card px-6 py-4 animate-fade-in-up">
                    <p className="text-base text-warm-muted font-serif">When you are ready, everything is here.</p>
                </div>
            )}

            <div className="mx-auto max-w-6xl px-6 py-8 pb-24">
                <div className="mb-8">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Personal Dashboard</p>
                    <h1 className="mt-3 font-serif text-4xl text-warm-dark">Your Personal Archive</h1>
                    <p className="mt-3 max-w-3xl text-sm text-warm-muted">
                        A clear home for viewing your memorial, editing its content, checking preservation, and keeping everything ready for the future.
                    </p>
                </div>

                {loading ? (
                    <div className="space-y-6 animate-pulse" aria-label="Loading archive">
                        <div className="glass-card p-8 rounded-none">
                            <div className="flex gap-6">
                                <div className="h-28 w-28 bg-surface-mid rounded-none flex-shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-8 w-2/3 bg-surface-mid rounded-none" />
                                    <div className="h-4 w-1/3 bg-surface-mid/70 rounded-none" />
                                    <div className="h-4 w-1/4 bg-surface-mid/70 rounded-none" />
                                    <div className="pt-4 flex gap-2">
                                        <div className="h-10 w-36 bg-surface-mid rounded-none" />
                                        <div className="h-10 w-36 bg-surface-mid/70 rounded-none" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-8 border border-warm-border/30 bg-white px-6 py-4 rounded-none">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-6 w-24 bg-surface-mid/70 rounded-none" />
                            ))}
                        </div>
                    </div>
                ) : activeArchive && activeArchive.full_name ? (
                    <ActiveArchiveView
                        archive={activeArchive}
                        onDelete={softDelete}
                        userId={userId}
                        paymentConfirmedAt={activeArchive.payment_confirmed_at ?? null}
                    />
                ) : (
                    /* Empty state — either no archive or paid but unfilled archive */
                    <div className="text-center py-32">
                        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center border border-warm-border/30 bg-surface-mid rounded-none">
                            <User size={32} className="text-warm-muted/40" />
                        </div>
                        <h2 className="font-serif text-5xl text-warm-dark mb-4">
                            {activeArchive ? 'Create your memorial' : 'Begin your archive'}
                        </h2>
                        <p className="font-serif text-lg text-warm-muted mb-10 max-w-2xl mx-auto">
                            {activeArchive
                                ? 'Your plan is active. Open the editor and start building the memorial.'
                                : 'You can keep one personal archive here, then manage preservation and succession from the navigation when you are ready.'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={() => {
                                    if (activeArchive) {
                                        window.location.href = `/create?id=${activeArchive.id}&mode=personal`;
                                    } else {
                                        handleCreate();
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-8 py-3.5 glass-btn-primary text-sm font-serif tracking-wide rounded-none"
                            >
                                <Plus size={16} />
                                {activeArchive ? 'Open editor' : 'Create memorial'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Removed Archives */}
                {deletedArchives.length > 0 && (
                    <div className="mt-20">
                        <div className="separator-warm mb-10" />
                        <h3 className="text-xs uppercase tracking-widest text-warm-outline mb-6 font-serif flex items-center gap-2">
                            <Archive size={13} />
                            Removed Archives
                        </h3>
                        {restoreBlocked && (
                            <p className="mb-4 max-w-2xl text-sm text-warm-dark">
                                Personal plans can only have one active archive at a time. Delete the current active archive before restoring another one.
                            </p>
                        )}
                        <div className="space-y-3">
                            {deletedArchives.map(m => (
                                <div
                                    key={m.id}
                                    className="glass-card px-5 py-4 flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-sm text-warm-dark font-serif">{m.full_name || 'Untitled'}</p>
                                        <p className="text-xs text-red-600/60 mt-0.5 flex items-center gap-1 font-serif">
                                            <AlertTriangle size={11} />
                                            {getDaysRemaining(m.deleted_at!)} days remaining
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => restore(m.id)}
                                            aria-label="Restore archive"
                                            disabled={restoreBlocked}
                                            className={`rounded-none p-2 transition-colors ${
                                                restoreBlocked
                                                    ? 'cursor-not-allowed text-warm-outline/60'
                                                    : 'text-warm-muted hover:bg-surface-mid hover:text-warm-dark'
                                            }`}
                                            title={restoreBlocked ? 'Delete the active archive before restoring another one' : 'Restore'}
                                        >
                                            <RefreshCcw size={15} />
                                        </button>
                                        <button
                                            onClick={() => permanentDelete(m.id)}
                                            aria-label="Delete permanently"
                                            className="p-2 text-red-400/50 hover:text-red-600 hover:bg-red-50 transition-colors rounded-none"
                                            title="Delete permanently"
                                        >
                                            <Trash2 size={15} />
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
                    ? 'Move this archive to Removed Archives?'
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'Permanently delete this archive?'
                        : 'This is irreversible'
            }
            description={
                pendingConfirm?.kind === 'soft-delete'
                    ? `It will be permanently deleted after ${SOFT_DELETE_RETENTION_DAYS} days. You can restore it until then.`
                    : pendingConfirm?.kind === 'permanent-delete' && pendingConfirm.stage === 1
                        ? 'This action cannot be undone. The archive and all its content will be lost forever.'
                        : 'Last chance. Once confirmed, the archive and all its content are gone forever.'
            }
            confirmLabel={
                pendingConfirm?.kind === 'soft-delete'
                    ? 'Move to Removed'
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

/* ─────────────────────────────────────────────────────────────── */
/*  Active Archive                                                  */
/* ─────────────────────────────────────────────────────────────── */

function ActiveArchiveView({
    archive,
    onDelete,
    userId,
    paymentConfirmedAt,
}: {
    archive: Memorial;
    onDelete: (id: string) => void;
    userId: string;
    paymentConfirmedAt: string | null;
}) {
    const stats = computeStats(archive);
    const [linkCopied, setLinkCopied] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const birthYear = archive.birth_date ? new Date(archive.birth_date).getFullYear() : null;
    const deathYear = archive.death_date ? new Date(archive.death_date).getFullYear() : null;
    const dates = birthYear
        ? deathYear ? `${birthYear} — ${deathYear}` : `b. ${birthYear}`
        : null;
    const sealedDate = paymentConfirmedAt
        ? new Date(paymentConfirmedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null;

    const arweaveTxId = (archive as any).arweave_tx_id || null;
    const isPreserved = (archive as any).preservation_state === 'preserved';

    const handleCopyLink = () => {
        const url = `${window.location.origin}/person/${archive.id}`;
        navigator.clipboard.writeText(url).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    const handleEmailFamily = () => {
        const url = `${window.location.origin}/person/${archive.id}`;
        const subject = encodeURIComponent(`${archive.full_name || 'Memorial'} - Personal Archive`);
        const body = encodeURIComponent(`I wanted to share this memorial with you: ${url}`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    const handlePrintQR = () => {
        const url = `${window.location.origin}/person/${archive.id}`;
        window.open(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`, '_blank');
    };

    const [showExportConfirm, setShowExportConfirm] = useState(false);

    const handleExportArchive = () => {
        setShowExportConfirm(true);
    };

    const runExport = async () => {
        setShowExportConfirm(false);
        try {
            setIsExporting(true);

            const res = await fetch('/api/arche/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memorialId: archive.id }),
            });

            const result = await res.json();

            if (result.success && result.downloadUrl) {
                window.location.href = result.downloadUrl;
                return;
            }

            alert('Export failed: ' + (result.error || 'Unknown error'));
        } catch (error) {
            console.error('Error generating export:', error);
            alert('Error generating portable archive.');
        } finally {
            setIsExporting(false);
        }
    };

    const totalContent = stats.photos + stats.videos + stats.memories + stats.chapters;

    return (
        <>
        <div className="space-y-14">

            {/* ── Hero ── */}
            <div className="glass-card-hero">
                <div className="flex flex-col md:flex-row">
                    {/* Photo */}
                    <div className="md:w-72 lg:w-80 h-64 md:h-auto bg-surface-mid flex-shrink-0 relative">
                        {archive.profile_photo_url ? (
                            <img
                                src={archive.profile_photo_url}
                                alt={archive.full_name || ''}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface-mid">
                                <User size={48} className="text-warm-muted/20" />
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent md:hidden" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-10 md:p-14 flex flex-col justify-between min-h-[320px]">
                        <div>
                            <div className="flex items-start justify-between gap-6 mb-2">
                                <div>
                                    <h1 className="font-serif text-4xl md:text-5xl text-warm-dark leading-[1.1] tracking-tight">
                                        {archive.full_name || 'Unnamed Archive'}
                                    </h1>
                                    {dates && (
                                        <p className="text-warm-muted text-base font-serif mt-3 tracking-wide">{dates}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 mt-2">
                                    <span className="flex items-center gap-1.5 border border-olive/20 bg-olive/10 px-3 py-1.5 text-[11px] font-serif text-olive rounded-none">
                                        <span className="h-1.5 w-1.5 rounded-none bg-olive badge-live" />
                                        Live
                                    </span>
                                    {isPreserved && (
                                        <span className="flex items-center gap-1.5 border border-warm-brown/20 bg-warm-brown/10 px-3 py-1.5 text-[11px] font-serif text-warm-brown badge-glow rounded-none">
                                            <Shield size={11} />
                                            Preserved
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-4 text-[11px] text-warm-outline font-serif mt-3">
                                {sealedDate && (
                                    <span className="flex items-center gap-1">
                                        <Clock size={11} />
                                        {sealedDate}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Edit size={11} />
                                    Edited {timeAgo(archive.updated_at)}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2.5 mt-10">
                            <Link
                                href={`/create?id=${archive.id}&mode=personal`}
                                className="flex items-center gap-2 px-6 py-2.5 glass-btn-primary text-sm font-serif tracking-wide rounded-none"
                            >
                                <Edit size={14} />
                                Open editor
                            </Link>
                            <Link
                                href={`/person/${archive.id}`}
                                className="flex items-center gap-2 border border-warm-border/30 px-6 py-2.5 text-sm font-serif text-warm-dark transition-colors hover:bg-surface-mid rounded-none"
                            >
                                <Eye size={14} />
                                View memorial
                            </Link>
                            {!isPreserved && (
                                <button
                                    onClick={() => onDelete(archive.id)}
                                    aria-label="Remove archive"
                                    className="ml-auto p-2.5 text-warm-muted/40 hover:text-red-500 hover:bg-red-50 transition-colors rounded-none"
                                    title="Remove archive"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border border-warm-border/30 bg-white px-6 py-4 rounded-none">
                <MetricInline label="Photos" value={stats.photos} />
                <MetricInline label="Videos" value={stats.videos} />
                <MetricInline label="Stories" value={stats.memories} />
                <MetricInline label="Chapters" value={stats.chapters} />
            </div>

            {/* ── Witnesses ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-8">
                <div className="glass-card p-8 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-warm-dark mb-2">
                                Archive care
                            </h3>
                            <p className="text-sm text-warm-muted font-sans leading-relaxed max-w-2xl">
                                Everything related to the long-term state of this memorial lives here: preservation, continuity, visibility, and export.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border border-warm-border/25 bg-white p-6 rounded-none">
                            <h4 className="font-serif text-base text-warm-dark mb-4">Current state</h4>
                            <div className="space-y-4">
                                <StatusRow label="State" value={isPreserved ? 'Preserved on Arweave' : 'Active'} />
                                {sealedDate && <StatusRow label="Activated" value={sealedDate} />}
                                <StatusRow label="Last edit" value={timeAgo(archive.updated_at)} />
                                <StatusRow label="Content" value={`${totalContent} item${totalContent !== 1 ? 's' : ''}`} />
                                <StatusRow label="Visibility" value="Shared by direct link" />
                            </div>
                        </div>

                        <div className="border border-warm-border/25 bg-white p-6 rounded-none">
                            <h4 className="font-serif text-base text-warm-dark mb-4">Export this archive</h4>
                            <p className="text-xs text-warm-muted mb-4 leading-relaxed">
                                Download a complete offline copy. Useful for backups and sharing with people who do not have an account.
                            </p>
                            <button
                                onClick={handleExportArchive}
                                disabled={isExporting}
                                className="w-full flex items-center justify-between gap-3 border border-warm-border/20 px-4 py-3 text-left text-sm text-warm-dark transition-colors hover:bg-surface-mid/50 disabled:opacity-60 disabled:cursor-wait rounded-none"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center bg-surface-mid rounded-none">
                                        {isExporting ? <Loader2 size={14} className="text-warm-muted animate-spin" /> : <Download size={14} className="text-warm-muted" />}
                                    </div>
                                    <div>
                                        <p className="font-serif">{isExporting ? 'Generating portable archive...' : 'Portable archive export'}</p>
                                        <p className="text-xs text-warm-outline">Full offline ZIP copy of this memorial</p>
                                    </div>
                                </div>
                                <ChevronRight size={15} className="text-warm-outline flex-shrink-0" />
                            </button>
                        </div>
                    </div>

                    <PreservationStatus
                        memorialId={archive.id}
                        arweaveTxId={arweaveTxId}
                        fullName={archive.full_name || ''}
                        birthDate={archive.birth_date || ''}
                        deathDate={archive.death_date || null}
                        planType="personal"
                    />
                </div>

                <div className="glass-card p-8 space-y-6">
                    <div>
                        <h3 className="font-serif text-lg text-warm-brown mb-2">
                            Share the memorial
                        </h3>
                        <p className="text-sm text-warm-muted font-sans leading-relaxed">
                            Personal archives stay single-owner. Use these actions to share the memorial itself without exposing invites, member roles, or collaboration tools.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <ShareButton
                            onClick={handleCopyLink}
                            icon={Copy}
                            label={linkCopied ? 'Copied!' : 'Copy link'}
                            sublabel="Share the direct URL"
                        />
                        <ShareButton
                            onClick={handleEmailFamily}
                            icon={Mail}
                            label="Email family"
                            sublabel="Send via email"
                        />
                        <ShareButton
                            onClick={handlePrintQR}
                            icon={QrCode}
                            label="QR Code"
                            sublabel="Print for physical display"
                        />
                    </div>

                </div>
            </div>
        </div>
        <ConfirmDialog
            open={showExportConfirm}
            title="Generate the portable archive export?"
            description="This can take a minute to package your text, metadata, and included media into a downloadable archive."
            confirmLabel="Generate export"
            onConfirm={runExport}
            onCancel={() => setShowExportConfirm(false)}
        />
        </>
    );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Small components                                               */
/* ─────────────────────────────────────────────────────────────── */

function MetricInline({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl text-warm-dark">{value}</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">{label}</span>
        </div>
    );
}

function ShareButton({
    onClick,
    icon: Icon,
    label,
    sublabel,
}: {
    onClick: () => void;
    icon: any;
    label: string;
    sublabel: string;
}) {
    return (
        <button
            onClick={onClick}
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-mid rounded-none"
        >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-surface-mid transition-colors group-hover:bg-surface-high rounded-none">
                <Icon size={14} className="text-warm-muted" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-warm-dark font-serif">{label}</p>
                <p className="text-[11px] text-warm-outline font-serif">{sublabel}</p>
            </div>
            <ChevronRight size={14} className="text-warm-border group-hover:text-warm-muted transition-colors" />
        </button>
    );
}

function StatusRow({
    label,
    value,
    action,
}: {
    label: string;
    value: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-warm-outline font-serif">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-xs text-warm-dark/80 font-serif">{value}</span>
                {action}
            </div>
        </div>
    );
}
