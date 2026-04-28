'use client';

import { useEffect, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Briefcase,
    Clock,
    Eye,
    FileText,
    Heart,
    History,
    Home,
    Image as ImageIcon,
    Loader2,
    MessageCircle,
    RotateCcw,
    Shield,
    Sparkles,
    User,
    X,
    Film,
} from 'lucide-react';
import { getVersionHistory, restoreVersion, MemorialVersion } from '@/lib/versionService';
import { applyVersionSnapshot } from '@/lib/versioning';
import { MemorialData } from '@/types/memorial';
import MemorialRenderer from '@/components/MemorialRenderer';
import toast from 'react-hot-toast';

interface VersionHistoryProps {
    memorialId: string;
    currentData: MemorialData;
    userId?: string;
    userName?: string;
    onRestore: (restoredData: MemorialData) => void;
    onClose: () => void;
}

interface RestoreAction {
    targetVersion: MemorialVersion;
    title: string;
    description: string;
    actionLabel: string;
}

const STEP_ICONS: Record<number, any> = {
    1: User,
    2: Home,
    3: Briefcase,
    4: Heart,
    5: Sparkles,
    6: BookOpen,
    7: MessageCircle,
    8: ImageIcon,
    9: Film,
};

const STEP_NAMES: Record<number, string> = {
    1: 'Basic Info',
    2: 'Childhood',
    3: 'Career',
    4: 'Family',
    5: 'Personality',
    6: 'Biography',
    7: 'Memories',
    8: 'Photos',
    9: 'Videos',
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    manual: { label: 'Saved Change', color: 'bg-olive/10 text-olive' },
    auto_save: { label: 'Auto-saved', color: 'bg-warm-border/20 text-warm-outline' },
    witness_contribution: { label: 'Witness', color: 'bg-warm-brown/10 text-warm-brown' },
    restore: { label: 'Restored', color: 'bg-warm-dark/15 text-warm-dark' },
};

const SYSTEM_REASON_LABELS: Record<string, { label: string; color: string }> = {
    co_guardian_edit: { label: 'Co-Guardian Edit', color: 'bg-warm-brown/10 text-warm-brown' },
    owner_edit: { label: 'Owner Edit', color: 'bg-olive/10 text-olive' },
    archive_seal: { label: 'Archive Sealed', color: 'bg-warm-dark/15 text-warm-dark' },
    plan_upgrade: { label: 'Plan Upgrade', color: 'bg-surface-low/10 text-surface-low/70' },
    restore_action: { label: 'Restored', color: 'bg-warm-dark/15 text-warm-dark' },
};

function getTypeInfo(version: MemorialVersion) {
    if (version.change_reason && SYSTEM_REASON_LABELS[version.change_reason]) {
        return SYSTEM_REASON_LABELS[version.change_reason];
    }
    return TYPE_LABELS[version.change_type] || TYPE_LABELS.manual;
}

function isSystemReason(reason?: string | null) {
    return !!reason && reason in SYSTEM_REASON_LABELS;
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRelativeTime(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
}

export default function VersionHistory({
    memorialId,
    currentData,
    userId,
    userName,
    onRestore,
    onClose,
}: VersionHistoryProps) {
    const [versions, setVersions] = useState<MemorialVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewingVersion, setViewingVersion] = useState<MemorialVersion | null>(null);
    const [viewingData, setViewingData] = useState<MemorialData | null>(null);
    const [loadingView, setLoadingView] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<RestoreAction | null>(null);

    useEffect(() => {
        loadHistory();
    }, [memorialId]);

    const loadHistory = async () => {
        setLoading(true);
        setError(null);

        const result = await getVersionHistory(memorialId);
        if (result.error) {
            setError(result.error);
            setVersions([]);
        } else {
            setVersions(result.versions);
        }

        setLoading(false);
    };

    const handleViewVersion = async (version: MemorialVersion) => {
        setLoadingView(true);
        setViewingVersion(version);
        setViewingData(applyVersionSnapshot(currentData, version.snapshot_data || {}));
        setLoadingView(false);
    };

    const handleRestore = async (version: MemorialVersion) => {
        setRestoringId(version.id);

        const result = await restoreVersion(
            memorialId,
            version.id,
            currentData,
            userId,
            userName,
        );

        if (result.success && result.restoredData) {
            setRestoringId(null);
            setPendingAction(null);
            onRestore(result.restoredData);
        } else {
            toast.error(`Restore failed: ${result.error}`);
            setRestoringId(null);
        }
    };

    if (viewingVersion && viewingData) {
        return (
            <div className="fixed inset-0 z-[100] bg-warm-dark/90 backdrop-blur-sm overflow-y-auto">
                <div className="min-h-screen">
                    <div className="sticky top-0 z-10 bg-warm-dark/95 backdrop-blur-md border-b border-surface-low/10 px-6 py-4">
                        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <button
                                        onClick={() => {
                                            setViewingVersion(null);
                                            setViewingData(null);
                                        }}
                                        className="p-2 hover:bg-surface-low/10 rounded-lg transition-all"
                                    >
                                        <ArrowLeft size={20} className="text-surface-low" />
                                    </button>
                                    <h2 className="text-surface-low font-semibold">
                                        Version #{viewingVersion.version_number}
                                    </h2>
                                    <span className="text-surface-low/50 text-sm">
                                        {formatDate(viewingVersion.created_at)} at {formatTime(viewingVersion.created_at)}
                                    </span>
                                </div>
                                <p className="text-surface-low/60 text-sm ml-12">
                                    {viewingVersion.change_summary}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() =>
                                        setPendingAction({
                                            targetVersion: viewingVersion,
                                            title: `Restore version #${viewingVersion.version_number}?`,
                                            description: 'This will bring the memorial back to this exact saved state and add a new restore entry to the history.',
                                            actionLabel: 'Restore this version',
                                        })
                                    }
                                    className="px-4 py-2 bg-warm-brown hover:bg-warm-brown/90 text-surface-low rounded-lg font-medium transition-all flex items-center gap-2 text-sm"
                                >
                                    <RotateCcw size={16} />
                                    Restore This Version
                                </button>
                                <button
                                    onClick={() => {
                                        setViewingVersion(null);
                                        setViewingData(null);
                                    }}
                                    className="p-2 hover:bg-surface-low/10 rounded-lg transition-all"
                                >
                                    <X size={20} className="text-surface-low" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-5xl mx-auto py-8 px-6">
                        <div className="rounded-2xl overflow-hidden shadow-2xl">
                            <MemorialRenderer data={viewingData} isPreview={true} compact={false} />
                        </div>
                    </div>
                </div>

                {pendingAction && (
                    <RestoreConfirmModal
                        title={pendingAction.title}
                        description={pendingAction.description}
                        version={pendingAction.targetVersion}
                        actionLabel={pendingAction.actionLabel}
                        isRestoring={restoringId === pendingAction.targetVersion.id}
                        onConfirm={() => handleRestore(pendingAction.targetVersion)}
                        onCancel={() => setPendingAction(null)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-warm-dark/80 backdrop-blur-sm overflow-y-auto">
            <div className="min-h-screen py-8 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-olive/20 rounded-xl flex items-center justify-center">
                                <History size={24} className="text-olive" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif text-surface-low">Version History</h2>
                                <p className="text-surface-low/50 text-sm">
                                    {versions.length} saved change{versions.length !== 1 ? 's' : ''} in this memorial
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-surface-low/10 rounded-xl transition-all"
                        >
                            <X size={24} className="text-surface-low" />
                        </button>
                    </div>

                    {loading && (
                        <div className="text-center py-20">
                            <Loader2 size={32} className="text-olive animate-spin mx-auto mb-4" />
                            <p className="text-surface-low/60">Loading history...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm mb-6">
                            {error}
                        </div>
                    )}

                    {!loading && versions.length === 0 && (
                        <div className="text-center py-20">
                            <Clock size={48} className="text-surface-low/20 mx-auto mb-4" />
                            <p className="text-surface-low/50 text-lg mb-2">No recorded changes yet</p>
                            <p className="text-surface-low/30 text-sm">
                                Owner and co-guardian edits will appear here as restorable checkpoints.
                            </p>
                        </div>
                    )}

                    {!loading && versions.length > 0 && (
                        <div className="relative">
                            <div className="absolute left-6 top-0 bottom-0 w-px bg-surface-low/10" />

                            <div className="space-y-4">
                                {versions.map((version, index) => {
                                    const typeInfo = getTypeInfo(version);
                                    const previousVersion = versions[index + 1] || null;

                                    return (
                                        <div key={version.id} className="relative pl-14">
                                            <div
                                                className={`absolute left-4 top-5 w-5 h-5 rounded-full border-2 border-surface-low/20 ${
                                                    index === 0
                                                        ? 'bg-olive'
                                                        : version.change_type === 'restore'
                                                            ? 'bg-warm-brown'
                                                            : 'bg-warm-dark'
                                                }`}
                                            />

                                            <div className="bg-surface-low/5 hover:bg-surface-low/8 border border-surface-low/10 rounded-xl p-5 transition-all">
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="text-surface-low font-medium text-sm">
                                                                v{version.version_number}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeInfo.color}`}>
                                                                {typeInfo.label}
                                                            </span>
                                                            {index === 0 && (
                                                                <span className="px-2 py-0.5 bg-surface-low/10 text-surface-low/70 rounded-full text-[10px] font-medium">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-surface-low/80 text-sm leading-relaxed">
                                                            {version.change_summary}
                                                        </p>
                                                    </div>
                                                    <span className="text-surface-low/40 text-xs whitespace-nowrap flex-shrink-0">
                                                        {formatRelativeTime(version.created_at)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-4 text-xs text-surface-low/40 mb-3 flex-wrap">
                                                    {version.created_by_name && (
                                                        <span className="flex items-center gap-1">
                                                            <User size={12} />
                                                            {version.created_by_name}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatDate(version.created_at)} {formatTime(version.created_at)}
                                                    </span>
                                                </div>

                                                {version.steps_modified.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {version.steps_modified.map((step) => {
                                                            const Icon = STEP_ICONS[step] || FileText;
                                                            return (
                                                                <span
                                                                    key={`${version.id}-${step}`}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-surface-low/5 border border-surface-low/10 rounded-lg text-[10px] text-surface-low/50"
                                                                >
                                                                    <Icon size={10} />
                                                                    {STEP_NAMES[step] || `Step ${step}`}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {version.change_reason && !isSystemReason(version.change_reason) && (
                                                    <div className="mb-3 pl-3 border-l-2 border-olive/30">
                                                        <p className="text-surface-low/50 text-xs italic">
                                                            "{version.change_reason}"
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 pt-2 border-t border-surface-low/5 flex-wrap">
                                                    <button
                                                        onClick={() => handleViewVersion(version)}
                                                        disabled={loadingView}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low/5 hover:bg-surface-low/10 text-surface-low/70 rounded-lg text-xs transition-all"
                                                    >
                                                        <Eye size={14} />
                                                        View
                                                    </button>

                                                    {index !== 0 && (
                                                        <button
                                                            onClick={() =>
                                                                setPendingAction({
                                                                    targetVersion: version,
                                                                    title: `Restore version #${version.version_number}?`,
                                                                    description: 'This will bring the memorial back to this saved point and add a new restore entry to the history.',
                                                                    actionLabel: 'Restore this version',
                                                                })
                                                            }
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-warm-brown/10 hover:bg-warm-brown/20 text-warm-brown rounded-lg text-xs transition-all"
                                                        >
                                                            <RotateCcw size={14} />
                                                            Restore This Point
                                                        </button>
                                                    )}

                                                    {previousVersion && (
                                                        <button
                                                            onClick={() =>
                                                                setPendingAction({
                                                                    targetVersion: previousVersion,
                                                                    title: index === 0
                                                                        ? 'Undo the latest change?'
                                                                        : `Revert the changes from version #${version.version_number}?`,
                                                                    description: index === 0
                                                                        ? `This will restore version #${previousVersion.version_number}, the state immediately before the latest saved change.`
                                                                        : `This will restore version #${previousVersion.version_number}, the state immediately before "${version.change_summary}".`,
                                                                    actionLabel: index === 0 ? 'Undo latest change' : 'Revert this change',
                                                                })
                                                            }
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low/10 hover:bg-surface-low/15 text-surface-low/70 rounded-lg text-xs transition-all"
                                                        >
                                                            <RotateCcw size={14} />
                                                            {index === 0 ? 'Undo Latest Change' : 'Revert This Change'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {pendingAction && (
                <RestoreConfirmModal
                    title={pendingAction.title}
                    description={pendingAction.description}
                    version={pendingAction.targetVersion}
                    actionLabel={pendingAction.actionLabel}
                    isRestoring={restoringId === pendingAction.targetVersion.id}
                    onConfirm={() => handleRestore(pendingAction.targetVersion)}
                    onCancel={() => setPendingAction(null)}
                />
            )}
        </div>
    );
}

function RestoreConfirmModal({
    title,
    description,
    version,
    actionLabel,
    isRestoring,
    onConfirm,
    onCancel,
}: {
    title: string;
    description: string;
    version: MemorialVersion;
    actionLabel: string;
    isRestoring: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-warm-dark/70">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="w-14 h-14 bg-warm-brown/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <RotateCcw size={28} className="text-warm-brown" />
                </div>

                <h3 className="font-serif text-2xl text-warm-dark text-center mb-2">
                    {title}
                </h3>

                <p className="text-warm-muted text-sm text-center mb-2">
                    Version #{version.version_number} from {new Date(version.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>

                <p className="text-warm-outline text-xs text-center mb-6 leading-relaxed">
                    {description}
                </p>

                <div className="p-4 bg-olive/5 rounded-xl border border-olive/20 mb-6">
                    <div className="flex items-start gap-2">
                        <Shield size={16} className="text-olive mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-warm-muted leading-relaxed">
                            The current memorial state will not disappear. This action adds a new restore entry so the full audit trail stays intact.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isRestoring}
                        className="flex-1 py-3 border border-warm-border/40 rounded-xl hover:bg-warm-border/10 transition-all font-medium text-warm-dark text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isRestoring}
                        className="flex-1 py-3 bg-warm-brown hover:bg-warm-brown/90 text-surface-low rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        {isRestoring ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Restoring...
                            </>
                        ) : (
                            <>
                                <RotateCcw size={16} />
                                {actionLabel}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
