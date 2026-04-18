'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    Edit,
    Eye,
    Loader2,
    MessageSquareText,
    Plus,
    Search,
    Shield,
    User,
} from 'lucide-react';

interface WorkspaceMemorial {
    id: string;
    fullName: string | null;
    birthDate: string | null;
    deathDate: string | null;
    profilePhotoUrl: string | null;
    status: string | null;
    pendingCount: number;
}

interface PendingCreationRequest {
    id: string;
    proposedName: string | null;
    requestMessage: string | null;
    createdAt: string;
}

interface Props {
    memorialId: string;
    familyName: string;
    memorials: WorkspaceMemorial[];
    pendingCreationRequest: PendingCreationRequest | null;
}

function formatYears(birthDate: string | null, deathDate: string | null) {
    const birthYear = birthDate ? new Date(birthDate).getFullYear() : null;
    const deathYear = deathDate ? new Date(deathDate).getFullYear() : null;

    if (birthYear && deathYear) {
        return `${birthYear} - ${deathYear}`;
    }

    if (birthYear) {
        return `Born ${birthYear}`;
    }

    return null;
}

export default function CoGuardianFamilyWorkspace({
    memorialId,
    familyName,
    memorials,
    pendingCreationRequest,
}: Props) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [pendingRequest, setPendingRequest] = useState<PendingCreationRequest | null>(pendingCreationRequest);
    const [proposedName, setProposedName] = useState('');
    const [requestMessage, setRequestMessage] = useState('');

    const filteredMemorials = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return memorials;
        }

        return memorials.filter((memorial) =>
            (memorial.fullName || 'untitled').toLowerCase().includes(normalized)
        );
    }, [memorials, query]);

    const handleSubmitRequest = async () => {
        setSubmitting(true);
        setRequestError(null);

        try {
            const res = await fetch(`/api/archive/${memorialId}/creation-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    proposedName,
                    requestMessage,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Could not send request.');
            }

            setPendingRequest({
                id: data.id || `pending-${Date.now()}`,
                proposedName: proposedName.trim() || null,
                requestMessage: requestMessage.trim() || null,
                createdAt: new Date().toISOString(),
            });
            setProposedName('');
            setRequestMessage('');
            setShowRequestModal(false);
        } catch (error: any) {
            setRequestError(error.message || 'Could not send request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-low">
            <div className="border-b border-warm-border/20 bg-white sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-warm-dark/30 font-sans mb-2">
                            Co-Guardian Workspace
                        </p>
                        <h1 className="font-serif text-3xl text-warm-dark">
                            {familyName} Family Archives
                        </h1>
                        <p className="text-sm text-warm-dark/45 font-sans mt-2">
                            You can edit memorials and review contributions. Only the owner can invite people, delete memorials, or manage account stewardship.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={`/person/${memorialId}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-4 py-3 text-sm text-warm-dark/65 hover:bg-white transition-all font-sans"
                        >
                            <Eye size={16} />
                            View current archive
                        </Link>
                        <button
                            onClick={() => setShowRequestModal(true)}
                            disabled={!!pendingRequest}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-sans transition-all ${
                                pendingRequest
                                    ? 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed'
                                    : 'glass-btn-dark'
                            }`}
                        >
                            <Plus size={16} />
                            {pendingRequest ? 'Memorial request pending' : 'Request new memorial'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
                <div className="rounded-2xl border border-olive/20 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive/10 text-olive">
                            <Shield size={22} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="font-serif text-2xl text-warm-dark">
                                Your stewardship lane
                            </h2>
                            <p className="text-sm leading-relaxed text-warm-dark/55 font-sans max-w-3xl">
                                This workspace keeps your responsibilities clear: you can move between family memorials, edit them in the creation studio, and handle review work. Ownership actions stay with the archive owner so the account remains stable.
                            </p>
                        </div>
                    </div>
                </div>

                {pendingRequest && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                        <div className="flex items-start gap-3">
                            <Clock3 size={18} className="text-amber-700 mt-0.5" />
                            <div>
                                <h2 className="text-sm font-semibold text-amber-900 font-sans">
                                    New memorial request awaiting owner approval
                                </h2>
                                <p className="text-sm text-amber-800/90 font-sans mt-1 leading-relaxed">
                                    {pendingRequest.proposedName
                                        ? `Requested for ${pendingRequest.proposedName}.`
                                        : 'A new memorial has been requested.'}{' '}
                                    The owner will be able to approve or reject it from the steward queue.
                                </p>
                                {pendingRequest.requestMessage && (
                                    <p className="mt-3 text-sm text-amber-900/80 font-sans italic">
                                        "{pendingRequest.requestMessage}"
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="rounded-2xl border border-warm-border/30 bg-white p-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-dark/30" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search family memorials..."
                            className="w-full rounded-xl border border-warm-border/30 bg-surface-low/40 py-3 pl-11 pr-4 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15 focus:border-olive/40"
                        />
                    </div>
                </div>

                {filteredMemorials.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-warm-border/40 bg-white p-12 text-center">
                        <AlertCircle size={24} className="mx-auto mb-4 text-warm-dark/20" />
                        <h2 className="font-serif text-2xl text-warm-dark">
                            No memorials match that search
                        </h2>
                        <p className="mt-2 text-sm text-warm-dark/45 font-sans">
                            Try another name or clear the filter to see the full family workspace.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {filteredMemorials.map((memorial) => {
                            const years = formatYears(memorial.birthDate, memorial.deathDate);

                            return (
                                <div
                                    key={memorial.id}
                                    className="overflow-hidden rounded-2xl border border-warm-border/30 bg-white shadow-sm transition-all hover:shadow-md"
                                >
                                    <div className="relative h-52 bg-gradient-to-br from-surface-mid to-surface-high">
                                        {memorial.profilePhotoUrl ? (
                                            <img
                                                src={memorial.profilePhotoUrl}
                                                alt={memorial.fullName || 'Memorial'}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <User size={54} className="text-warm-dark/15" />
                                            </div>
                                        )}
                                        {memorial.pendingCount > 0 && (
                                            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-warm-muted/20 bg-white/90 px-2.5 py-1 text-xs font-semibold text-warm-muted">
                                                <MessageSquareText size={12} />
                                                {memorial.pendingCount} waiting
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 p-5">
                                        <div>
                                            <h3 className="font-serif text-xl text-warm-dark">
                                                {memorial.fullName || 'Untitled memorial'}
                                            </h3>
                                            <p className="mt-1 text-xs text-warm-dark/40 font-sans">
                                                {years || 'Details will appear once the memorial is filled in.'}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => router.push(`/archive/${memorial.id}`)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2.5 text-sm text-warm-dark hover:bg-surface-low transition-all font-sans"
                                            >
                                                <ArrowRight size={15} />
                                                Open
                                            </button>
                                            <button
                                                onClick={() => router.push(`/create?id=${memorial.id}&mode=family`)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2.5 text-sm text-warm-dark hover:bg-surface-low transition-all font-sans"
                                            >
                                                <Edit size={15} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => router.push(`/person/${memorial.id}`)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2.5 text-sm text-warm-dark hover:bg-surface-low transition-all font-sans"
                                            >
                                                <Eye size={15} />
                                                View
                                            </button>
                                            <button
                                                onClick={() => router.push(`/archive/${memorial.id}/steward`)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2.5 text-sm text-warm-dark hover:bg-surface-low transition-all font-sans"
                                            >
                                                <Shield size={15} />
                                                Review
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="rounded-2xl border border-warm-border/30 bg-white p-6">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-olive mt-0.5" />
                        <div>
                            <h2 className="text-sm font-semibold text-warm-dark font-sans">
                                What stays with the owner
                            </h2>
                            <p className="mt-1 text-sm leading-relaxed text-warm-dark/55 font-sans">
                                Invitations, account stewardship, and memorial deletion remain owner-only controls. That keeps the family archive secure while still giving you a strong editing workspace.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {showRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-dark/55 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-3xl border border-warm-border/30 bg-white p-6 shadow-2xl">
                        <div className="mb-5">
                            <h2 className="font-serif text-2xl text-warm-dark">
                                Request a new memorial
                            </h2>
                            <p className="mt-2 text-sm text-warm-dark/50 font-sans leading-relaxed">
                                This does not create the memorial immediately. It sends a request to the owner so they can approve or reject it first.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-warm-dark/35 font-sans">
                                    Proposed memorial name
                                </label>
                                <input
                                    value={proposedName}
                                    onChange={(event) => setProposedName(event.target.value)}
                                    placeholder="Optional, but helpful for the owner"
                                    className="w-full rounded-xl border border-warm-border/30 px-4 py-3 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15 focus:border-olive/40"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-warm-dark/35 font-sans">
                                    Why this memorial should be added
                                </label>
                                <textarea
                                    value={requestMessage}
                                    onChange={(event) => setRequestMessage(event.target.value)}
                                    rows={4}
                                    placeholder="Add context for the owner. For example: whose memorial this is, why now, or what material is ready."
                                    className="w-full resize-none rounded-xl border border-warm-border/30 px-4 py-3 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15 focus:border-olive/40"
                                />
                            </div>

                            {requestError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-sans">
                                    {requestError}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRequestModal(false);
                                    setRequestError(null);
                                }}
                                className="flex-1 rounded-xl border border-warm-border/30 px-4 py-3 text-sm text-warm-dark/60 hover:bg-surface-low transition-all font-sans"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitRequest}
                                disabled={submitting}
                                className="flex-1 rounded-xl glass-btn-dark px-4 py-3 text-sm font-sans disabled:opacity-60"
                            >
                                {submitting ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 size={15} className="animate-spin" />
                                        Sending request
                                    </span>
                                ) : (
                                    'Send to owner'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
