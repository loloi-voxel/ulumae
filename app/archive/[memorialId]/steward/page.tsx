'use client';

import { useEffect, useMemo, useState, use, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Shield, Check, X, MessageCircle,
    ImageIcon, ArrowLeft, Loader2,
    AlertTriangle, Clock, Lock,
    Mail, RefreshCw
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useArchiveRole } from '../_hooks/useArchiveRole';
import { useRoleSync } from '../_hooks/useRoleSync';

interface PendingContribution {
    id: string;
    type: 'memory' | 'photo' | 'video';
    witness_name: string;
    contributor_email: string | null;
    content: {
        title?: string;
        content?: string;
        caption?: string;
        url?: string;
        relationship?: string;
        year?: string;
    };
    created_at: string;
    is_anonymous: boolean;
}

interface AccessRequestRecord {
    id: string;
    requesterUserId: string;
    email: string;
    requestedRole: string;
    requestMessage: string;
    status: 'pending';
    createdAt: string;
}

interface CreationRequestRecord {
    id: string;
    requesterUserId: string;
    email: string;
    sourceMemorialId: string;
    sourceMemorialName: string;
    proposedName: string | null;
    requestMessage: string;
    status: 'pending';
    createdAt: string;
}

type ReviewDecision = 'approved' | 'rejected' | 'needs_changes';
type AccessDecision = 'approved' | 'denied';
type CreationDecision = 'approved' | 'rejected';
type StewardTab = 'contributions' | 'requests' | 'creation';

export default function StewardPage({
    params
}: {
    params: Promise<{ memorialId: string }>
}) {
    const { memorialId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [contributions, setContributions] = useState<PendingContribution[]>([]);
    const [accessRequests, setAccessRequests] = useState<AccessRequestRecord[]>([]);
    const [creationRequests, setCreationRequests] = useState<CreationRequestRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [creationLoading, setCreationLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [requestProcessing, setRequestProcessing] = useState<string | null>(null);
    const [creationProcessing, setCreationProcessing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<StewardTab>(
        (searchParams.get('tab') as StewardTab) || 'contributions'
    );
    const highlightedItemId = searchParams.get('item');

    const { data: roleData, loading: roleLoading } = useArchiveRole(memorialId);
    useRoleSync(memorialId, roleData?.currentUserId || '', roleData?.userRole || 'witness');

    useEffect(() => {
        if (roleLoading || !roleData) return;
        if (!roleData.capabilities.canReview) {
            router.push(`/archive/${memorialId}`);
        }
    }, [roleData, roleLoading, memorialId, router]);

    useEffect(() => {
        const nextTab = searchParams.get('tab') as StewardTab | null;
        if (nextTab === 'contributions' || nextTab === 'requests' || nextTab === 'creation') {
            setTab(nextTab);
        }
    }, [searchParams]);

    const loadPending = async () => {
        setLoading(true);
        const { data, error: loadError } = await supabase
            .from('memorial_contributions')
            .select('*')
            .eq('memorial_id', memorialId)
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: true });

        if (loadError) setError(loadError.message);
        else setContributions(data || []);
        setLoading(false);
    };

    const loadAccessRequests = async () => {
        setRequestsLoading(true);
        try {
            const res = await fetch(`/api/memorials/${memorialId}/access-request`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load requests');
            setAccessRequests(data.requests || []);
        } catch (requestError: any) {
            setError(requestError.message);
        } finally {
            setRequestsLoading(false);
        }
    };

    const loadCreationRequests = async () => {
        if (roleData?.userRole !== 'owner') {
            setCreationRequests([]);
            setCreationLoading(false);
            return;
        }

        setCreationLoading(true);
        try {
            const res = await fetch(`/api/archive/${memorialId}/creation-requests`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load memorial requests');
            setCreationRequests(data.requests || []);
        } catch (requestError: any) {
            setError(requestError.message);
        } finally {
            setCreationLoading(false);
        }
    };

    useEffect(() => {
        loadPending();
        loadAccessRequests();
        loadCreationRequests();

        const contributionsChannel = supabase
            .channel(`steward-contributions-${memorialId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'memorial_contributions',
                    filter: `memorial_id=eq.${memorialId}`,
                },
                loadPending
            )
            .subscribe();

        const requestsChannel = supabase
            .channel(`steward-requests-${memorialId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'memorial_access_requests',
                    filter: `memorial_id=eq.${memorialId}`,
                },
                loadAccessRequests
            )
            .subscribe();

        let creationChannel: any = null;
        if (roleData?.userRole === 'owner' && roleData.currentUserId) {
            creationChannel = supabase
                .channel(`steward-creation-${memorialId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'memorial_creation_requests',
                        filter: `owner_user_id=eq.${roleData.currentUserId}`,
                    },
                    loadCreationRequests
                )
                .subscribe();
        }

        return () => {
            supabase.removeChannel(contributionsChannel);
            supabase.removeChannel(requestsChannel);
            if (creationChannel) {
                supabase.removeChannel(creationChannel);
            }
        };
    }, [memorialId, roleData?.currentUserId, roleData?.userRole, supabase]);

    const handleDecision = async (
        id: string,
        decision: ReviewDecision,
        adminNotes = ''
    ) => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/archive/${memorialId}/contributions/${id}/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision, adminNotes }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Review failed');

            setContributions(prev => prev.filter((c) => c.id !== id));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleAccessDecision = async (
        requestId: string,
        decision: AccessDecision
    ) => {
        setRequestProcessing(requestId);
        try {
            const res = await fetch(`/api/memorials/${memorialId}/access-request/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update request');

            setAccessRequests(prev => prev.filter((request) => request.id !== requestId));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRequestProcessing(null);
        }
    };

    const handleCreationDecision = async (
        requestId: string,
        decision: CreationDecision
    ) => {
        setCreationProcessing(requestId);
        try {
            const res = await fetch(`/api/archive/${memorialId}/creation-requests/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update memorial request');

            setCreationRequests(prev => prev.filter((request) => request.id !== requestId));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreationProcessing(null);
        }
    };

    const totalItems = useMemo(
        () => contributions.length + accessRequests.length + creationRequests.length,
        [contributions.length, accessRequests.length, creationRequests.length]
    );

    return (
        <div className="min-h-screen bg-surface-low">
            <div className="border-b border-warm-border/20 bg-white sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.push(`/archive/${memorialId}`)}
                        className="p-2 hover:bg-warm-border/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} className="text-warm-dark/60" />
                    </button>
                    <div className="flex-1">
                        <h1 className="font-serif text-xl text-warm-dark">Steward queue</h1>
                        {!(loading || requestsLoading || creationLoading) && (
                            <p className="text-xs text-warm-dark/40 font-sans">
                                {totalItems === 0
                                    ? 'All clear'
                                    : `${contributions.length} contribution${contributions.length !== 1 ? 's' : ''}, ${accessRequests.length} access request${accessRequests.length !== 1 ? 's' : ''}, and ${creationRequests.length} memorial request${creationRequests.length !== 1 ? 's' : ''} waiting`}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            loadPending();
                            loadAccessRequests();
                            loadCreationRequests();
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-warm-border/30 text-xs text-warm-dark/60 hover:bg-warm-border/10 transition-colors"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
                <div className="flex gap-2 p-1 bg-warm-border/20 rounded-xl w-full sm:w-fit">
                    <TabButton
                        active={tab === 'contributions'}
                        label={`Contributions (${contributions.length})`}
                        onClick={() => setTab('contributions')}
                    />
                    <TabButton
                        active={tab === 'requests'}
                        label={`Access requests (${accessRequests.length})`}
                        onClick={() => setTab('requests')}
                    />
                    {roleData?.userRole === 'owner' && (
                        <TabButton
                            active={tab === 'creation'}
                            label={`Memorial requests (${creationRequests.length})`}
                            onClick={() => setTab('creation')}
                        />
                    )}
                </div>

                {(loading || requestsLoading || creationLoading || roleLoading) ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="text-olive animate-spin" />
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-700 font-sans">{error}</p>
                    </div>
                ) : tab === 'contributions' ? (
                    contributions.length === 0 ? (
                        <EmptyState
                            icon={<Check size={32} className="text-olive" />}
                            title="No contributions waiting"
                            description="Witness contributions will appear here when they need your review."
                        />
                    ) : (
                        <div className="space-y-6">
                            {contributions.map((contribution) => (
                                <ContributionCard
                                    key={contribution.id}
                                    contribution={contribution}
                                    highlighted={highlightedItemId === contribution.id}
                                    processing={processing === contribution.id}
                                    onApprove={() => handleDecision(contribution.id, 'approved')}
                                    onReject={(notes) => handleDecision(contribution.id, 'rejected', notes)}
                                    onNeedsChanges={(notes) => handleDecision(contribution.id, 'needs_changes', notes)}
                                />
                            ))}
                        </div>
                    )
                ) : tab === 'requests' ? accessRequests.length === 0 ? (
                    <EmptyState
                        icon={<Lock size={32} className="text-olive" />}
                        title="No access requests waiting"
                        description="Family access requests will appear here when witnesses ask to join a linked archive."
                    />
                ) : (
                    <div className="space-y-4">
                        {accessRequests.map((request) => (
                            <AccessRequestCard
                                key={request.id}
                                request={request}
                                highlighted={highlightedItemId === request.id}
                                processing={requestProcessing === request.id}
                                onApprove={() => handleAccessDecision(request.id, 'approved')}
                                onDeny={() => handleAccessDecision(request.id, 'denied')}
                            />
                        ))}
                    </div>
                ) : creationRequests.length === 0 ? (
                    <EmptyState
                        icon={<Shield size={32} className="text-olive" />}
                        title="No memorial requests waiting"
                        description="Co-guardian requests for new family memorials will appear here."
                    />
                ) : (
                    <div className="space-y-4">
                        {creationRequests.map((request) => (
                            <CreationRequestCard
                                key={request.id}
                                request={request}
                                highlighted={highlightedItemId === request.id}
                                processing={creationProcessing === request.id}
                                onApprove={() => handleCreationDecision(request.id, 'approved')}
                                onReject={() => handleCreationDecision(request.id, 'rejected')}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({
    active,
    label,
    onClick
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all font-sans ${
                active ? 'bg-white shadow-sm text-warm-dark' : 'text-warm-dark/50 hover:text-warm-dark'
            }`}
        >
            {label}
        </button>
    );
}

function EmptyState({
    icon,
    title,
    description
}: {
    icon: ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="text-center py-20">
            <div className="w-16 h-16 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                {icon}
            </div>
            <h2 className="font-serif text-2xl text-warm-dark mb-2">{title}</h2>
            <p className="text-sm text-warm-dark/40 font-sans">{description}</p>
        </div>
    );
}

function ContributionCard({
    contribution: c,
    highlighted,
    processing,
    onApprove,
    onReject,
    onNeedsChanges
}: {
    contribution: PendingContribution;
    highlighted: boolean;
    processing: boolean;
    onApprove: () => void;
    onReject: (notes: string) => void;
    onNeedsChanges: (notes: string) => void;
}) {
    const [mode, setMode] = useState<'actions' | 'reject' | 'changes'>('actions');
    const [notes, setNotes] = useState('');

    const timeAgo = (() => {
        const diff = Date.now() - new Date(c.created_at).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
    })();

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${
            highlighted ? 'border-warm-brown shadow-[0_0_0_2px_rgba(140,95,70,0.12)]' : 'border-warm-border/30'
        }`}>
            <div className="px-6 pt-6 pb-4 border-b border-warm-border/20">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {c.type === 'memory'
                                ? <MessageCircle size={14} className="text-warm-dark/40" />
                                : <ImageIcon size={14} className="text-warm-dark/40" />
                            }
                            <span className="text-xs text-warm-dark/40 uppercase tracking-wider font-sans">
                                {c.type}
                            </span>
                        </div>
                        <h3 className="font-serif text-lg text-warm-dark">
                            {c.content.title || 'Untitled'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-warm-dark/30 flex-shrink-0 font-sans">
                        <Clock size={12} />
                        {timeAgo}
                    </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <div className="w-6 h-6 bg-warm-border/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-warm-dark/50 font-serif">
                            {c.witness_name.charAt(0)}
                        </span>
                    </div>
                    <p className="text-xs text-warm-dark/50 font-sans">
                        <strong>{c.witness_name}</strong>
                        {c.contributor_email && <span className="text-warm-dark/30">{` • ${c.contributor_email}`}</span>}
                        {c.content.relationship && (
                            <span className="text-warm-dark/30">{` • ${c.content.relationship}`}</span>
                        )}
                        {c.is_anonymous && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-warm-border/30 text-warm-dark/30 rounded text-[10px]">
                                no account
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="px-6 py-5">
                {c.type === 'memory' && c.content.content && (
                    <p className="font-serif text-warm-dark/70 text-base leading-relaxed line-clamp-5">
                        {c.content.content}
                    </p>
                )}

                {c.type === 'photo' && c.content.url && (
                    <div className="space-y-3">
                        <img
                            src={c.content.url}
                            alt={c.content.caption || 'Photo'}
                            className="w-full max-h-64 object-cover rounded-xl border border-warm-border/30"
                        />
                        {c.content.caption && (
                            <p className="text-sm text-warm-dark/60 font-sans italic">
                                "{c.content.caption}"
                                {c.content.year && (
                                    <span className="not-italic text-warm-dark/30 ml-2">
                                        {c.content.year}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="px-6 pb-6">
                {mode === 'actions' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            onClick={onApprove}
                            disabled={processing}
                            className="py-3 bg-olive hover:bg-olive/90 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 font-sans disabled:opacity-50"
                        >
                            {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Approve
                        </button>
                        <button
                            onClick={() => setMode('changes')}
                            disabled={processing}
                            className="py-3 border border-amber-200 text-amber-800 rounded-xl text-sm transition-all hover:bg-amber-50 font-sans disabled:opacity-50"
                        >
                            Request changes
                        </button>
                        <button
                            onClick={() => setMode('reject')}
                            disabled={processing}
                            className="py-3 border border-warm-border/40 text-warm-dark/50 rounded-xl text-sm transition-all hover:bg-warm-border/10 font-sans disabled:opacity-50"
                        >
                            Reject
                        </button>
                    </div>
                ) : (
                    <div className="bg-warm-border/10 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={14} className="text-warm-muted mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-warm-dark/60 font-sans leading-relaxed">
                                {mode === 'changes'
                                    ? 'Explain what needs to be adjusted so the contributor can revise and send it back.'
                                    : 'Explain why this will not appear in the archive. Clear feedback avoids confusion later.'}
                            </p>
                        </div>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={3}
                            placeholder={mode === 'changes' ? 'What should they revise?' : 'Why is this not the right fit for the archive?'}
                            className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all resize-none text-sm font-sans"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setMode('actions');
                                    setNotes('');
                                }}
                                className="flex-1 py-2.5 border border-warm-border/40 rounded-lg text-sm text-warm-dark/50 hover:bg-warm-border/10 transition-all font-sans"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => mode === 'changes' ? onNeedsChanges(notes) : onReject(notes)}
                                disabled={processing || notes.trim().length < 8}
                                className="flex-1 py-2.5 bg-warm-dark/10 rounded-lg text-sm text-warm-dark/60 hover:bg-warm-dark/20 transition-all font-sans disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                {mode === 'changes' ? 'Send back for revision' : 'Confirm rejection'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AccessRequestCard({
    request,
    highlighted,
    processing,
    onApprove,
    onDeny
}: {
    request: AccessRequestRecord;
    highlighted: boolean;
    processing: boolean;
    onApprove: () => void;
    onDeny: () => void;
}) {
    return (
        <div className={`bg-white border rounded-2xl p-6 shadow-sm ${
            highlighted ? 'border-warm-brown shadow-[0_0_0_2px_rgba(140,95,70,0.12)]' : 'border-warm-border/30'
        }`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Mail size={14} className="text-warm-dark/35" />
                        <p className="text-sm font-medium text-warm-dark font-sans">{request.email}</p>
                    </div>
                    <p className="text-xs text-warm-dark/40 font-sans uppercase tracking-wider mb-3">
                        Requests witness access
                    </p>
                    <p className="text-sm text-warm-dark/60 font-sans leading-relaxed">
                        {request.requestMessage || 'No message was included with this request.'}
                    </p>
                </div>
                <div className="text-xs text-warm-dark/30 font-sans">
                    {new Date(request.createdAt).toLocaleDateString()}
                </div>
            </div>

            <div className="mt-5 flex gap-3">
                <button
                    onClick={onApprove}
                    disabled={processing}
                    className="flex-1 py-3 bg-olive hover:bg-olive/90 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 font-sans disabled:opacity-50"
                >
                    {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Grant access
                </button>
                <button
                    onClick={onDeny}
                    disabled={processing}
                    className="flex-1 py-3 border border-warm-border/40 text-warm-dark/50 rounded-xl text-sm transition-all hover:bg-warm-border/10 font-sans disabled:opacity-50"
                >
                    Decline request
                </button>
            </div>
        </div>
    );
}

function CreationRequestCard({
    request,
    highlighted,
    processing,
    onApprove,
    onReject
}: {
    request: CreationRequestRecord;
    highlighted: boolean;
    processing: boolean;
    onApprove: () => void;
    onReject: () => void;
}) {
    return (
        <div className={`bg-white border rounded-2xl p-6 shadow-sm ${
            highlighted ? 'border-warm-brown shadow-[0_0_0_2px_rgba(140,95,70,0.12)]' : 'border-warm-border/30'
        }`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Shield size={14} className="text-warm-dark/35" />
                        <p className="text-sm font-medium text-warm-dark font-sans">{request.email}</p>
                    </div>
                    <p className="text-xs text-warm-dark/40 font-sans uppercase tracking-wider mb-3">
                        Requests a new family memorial
                    </p>
                    <div className="space-y-2 text-sm text-warm-dark/60 font-sans leading-relaxed">
                        <p>
                            Requested from: <strong>{request.sourceMemorialName}</strong>
                        </p>
                        {request.proposedName && (
                            <p>
                                Proposed memorial: <strong>{request.proposedName}</strong>
                            </p>
                        )}
                        <p>
                            {request.requestMessage || 'No extra context was included with this request.'}
                        </p>
                    </div>
                </div>
                <div className="text-xs text-warm-dark/30 font-sans">
                    {new Date(request.createdAt).toLocaleDateString()}
                </div>
            </div>

            <div className="mt-5 flex gap-3">
                <button
                    onClick={onApprove}
                    disabled={processing}
                    className="flex-1 py-3 bg-olive hover:bg-olive/90 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 font-sans disabled:opacity-50"
                >
                    {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Create memorial
                </button>
                <button
                    onClick={onReject}
                    disabled={processing}
                    className="flex-1 py-3 border border-warm-border/40 text-warm-dark/50 rounded-xl text-sm transition-all hover:bg-warm-border/10 font-sans disabled:opacity-50"
                >
                    Reject request
                </button>
            </div>
        </div>
    );
}
