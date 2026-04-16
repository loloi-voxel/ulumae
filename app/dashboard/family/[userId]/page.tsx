// app/dashboard/family/[userId]/page.tsx

'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, User, Loader2, Network, X, Search, Filter, RefreshCcw, AlertTriangle, Archive, Wifi, BellDot, History, MessageSquareText, ChevronDown } from 'lucide-react';
import { supabase, Memorial } from '@/lib/supabase';
import FamilyLinker from '@/components/FamilyLinker';
import AnchorPanel from '@/components/AnchorPanel';
import ManageWitnessesModal from '@/app/dashboard/[userId]/_components/ManageWitnessesModal';
import DashboardShell from '@/components/dashboard/DashboardShell';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import NotificationCenter from './_components/NotificationCenter';
import { SOFT_DELETE_RETENTION_DAYS } from '@/lib/constants';
import { useNotifications } from '@/hooks/useNotifications';
import { permanentlyDeleteMemorial, updateMemorialTrashState } from '@/lib/memorialClientActions';

interface PendingCreationRequest {
    id: string;
    sourceMemorialId: string;
    sourceMemorialName: string;
    requesterEmail: string;
    proposedName: string | null;
    requestMessage: string;
    createdAt: string;
}

interface PendingAccessRequest {
    id: string;
    memorialId: string;
    memorialName: string;
    requesterEmail: string;
    requestedRole: string;
    requestMessage: string;
    createdAt: string;
}

interface FamilyActivityItem {
    id: string;
    memorialId: string;
    memorialName: string;
    createdAt: string;
    createdByName: string | null;
    changeSummary: string;
}

interface ActivityPersonGroup {
    name: string;
    items: FamilyActivityItem[];
    latestCreatedAt: string;
}

interface ActivityDayGroup {
    dayKey: string;
    dayLabel: string;
    items: FamilyActivityItem[];
    people: ActivityPersonGroup[];
}

export default function FamilyDashboard({ params }: { params: Promise<{ userId: string }> }) {
    const unwrappedParams = use(params);
    const userId = unwrappedParams.userId;
    const auth = useAuth();
    const router = useRouter();
    const {
        data: notificationData,
        loading: notificationLoading,
        error: notificationError,
        refresh: refreshNotifications,
    } = useNotifications();
    const [memorials, setMemorials] = useState<Memorial[]>([]);
    const [deletedMemorials, setDeletedMemorials] = useState<Memorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [managingId, setManagingId] = useState<string | null>(null);
    const [memberManagerMemorial, setMemberManagerMemorial] = useState<Memorial | null>(null);
    const [showWelcome, setShowWelcome] = useState(false);
    const [pendingCreationRequests, setPendingCreationRequests] = useState<PendingCreationRequest[]>([]);
    const [pendingAccessRequests, setPendingAccessRequests] = useState<PendingAccessRequest[]>([]);
    const [recentActivity, setRecentActivity] = useState<FamilyActivityItem[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');

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
        } else {
            setPendingCreationRequests([]);
            setPendingAccessRequests([]);
            setRecentActivity([]);
        }
        setLoading(false);
    };

    const loadFamilySummary = async (activeMemorials: Memorial[]) => {
        if (!activeMemorials.length) {
            setPendingCreationRequests([]);
            setPendingAccessRequests([]);
            setRecentActivity([]);
            setSummaryLoading(false);
            setSummaryError(null);
            return;
        }

        setSummaryLoading(true);
        setSummaryError(null);

        try {
            const primaryMemorialId = activeMemorials[0].id;

            const creationPromise = fetch(`/api/archive/${primaryMemorialId}/creation-requests`, {
                cache: 'no-store',
            }).then(async (response) => {
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || 'Could not load memorial requests.');
                }
                return payload.requests || [];
            });

            const accessPromises = activeMemorials.map((memorial) =>
                fetch(`/api/memorials/${memorial.id}/access-request`, {
                    cache: 'no-store',
                }).then(async (response) => {
                    const payload = await response.json();
                    if (!response.ok) {
                        throw new Error(payload.error || 'Could not load access requests.');
                    }
                    return (payload.requests || []).map((request: any) => ({
                        ...request,
                        memorialId: memorial.id,
                        memorialName: memorial.full_name || 'Untitled',
                    }));
                })
            );

// ... (around line 202)
            const activityPromises = activeMemorials.map((memorial) =>
                fetch(`/api/memorials/${memorial.id}/activity?limit=10`, {
                    cache: 'no-store',
                }).then(async (response) => {
                    const payload = await response.json();
                    if (!response.ok) {
                        throw new Error(payload.error || 'Could not load activity.');
                    }
                    return (payload.activity || []).map((item: any) => ({
                        id: item.id,
                        memorialId: memorial.id,
                        memorialName: memorial.full_name || 'Untitled',
                        createdAt: item.createdAt,
                        createdByName: item.actorEmail || 'Someone',
                        changeSummary: item.summary || 'Archive updated',
                    }));
                })
            );
// ...

            const [creationRequests, accessRequestsGroups, activityGroups] = await Promise.all([
                creationPromise,
                Promise.all(accessPromises),
                Promise.all(activityPromises),
            ]);

            setPendingCreationRequests(
                creationRequests.map((request: any) => ({
                    id: request.id,
                    sourceMemorialId: request.sourceMemorialId,
                    sourceMemorialName: request.sourceMemorialName,
                    requesterEmail: request.email,
                    proposedName: request.proposedName,
                    requestMessage: request.requestMessage || '',
                    createdAt: request.createdAt,
                }))
            );

            setPendingAccessRequests(accessRequestsGroups.flat());
            setRecentActivity(
                activityGroups
                    .flat()
                    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
                    .slice(0, 8)
            );
        } catch (error: any) {
            console.error('[family-dashboard-summary]', error);
            setSummaryError(error.message || 'Could not load the steward summary.');
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleCreationRequestDecision = async (
        memorialId: string,
        requestId: string,
        decision: 'approved' | 'rejected'
    ) => {
        setProcessingRequestId(requestId);
        try {
            const response = await fetch(`/api/archive/${memorialId}/creation-requests/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Could not update the request.');
            }

            await loadMemorials();
        } catch (error: any) {
            alert(error.message || 'Could not update the request.');
        } finally {
            setProcessingRequestId(null);
        }
    };

    const handleAccessRequestDecision = async (
        memorialId: string,
        requestId: string,
        decision: 'approved' | 'denied'
    ) => {
        setProcessingRequestId(requestId);
        try {
            const response = await fetch(`/api/memorials/${memorialId}/access-request/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Could not update the access request.');
            }

            await loadMemorials();
        } catch (error: any) {
            alert(error.message || 'Could not update the access request.');
        } finally {
            setProcessingRequestId(null);
        }
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

        let confirmMessage = `Are you sure you want to delete this memorial? It will be moved to the trash for ${SOFT_DELETE_RETENTION_DAYS} days.`;

        if (count && count > 0) {
            confirmMessage = `WARNING: This archive contains contributions from ${count} other people.\n\nAre you sure you want to delete it? They will lose access to their contributions.`;
        }

        if (!confirm(confirmMessage)) return;

        try {
            await updateMemorialTrashState(id, 'delete');
            loadMemorials();
        } catch (error) {
            alert('Error deleting memorial');
            console.error(error);
        }
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

    const permanentDeleteMemorial = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this memorial? This action cannot be undone.')) return;
        if (!confirm('This is irreversible. The memorial and all its content will be lost forever. Continue?')) return;
        try {
            await permanentlyDeleteMemorial(id);
            loadMemorials();
        } catch {
            alert('Error permanently deleting memorial. Please try again.');
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
    const filteredMemorials = realMemorials.filter(m => {
        const matchesSearch = (m.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all'
            ? true
            : filterStatus === 'published'
                ? m.status === 'published'
                : m.status === 'draft';
        return matchesSearch && matchesFilter;
    });

    const deriveFamilyName = (): string => {
        if (memorials.length === 0) return 'Your';
        const firstName = memorials[0];
        const fullName = firstName?.full_name || '';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length > 1) {
            return parts[parts.length - 1];
        }
        return fullName || 'Your';
    };

    const familyName = deriveFamilyName();

    const firstPaidMemorial = memorials.find(m => m.paid);

    const pendingRequestCount = notificationData.pendingCount;
    const activityItems: FamilyActivityItem[] = (notificationData.recentActivity || []).map((item) => ({
        id: item.id,
        memorialId: item.memorialId,
        memorialName: item.memorialName,
        createdAt: item.createdAt,
        createdByName: item.actorEmail || 'Someone',
        changeSummary: item.summary || 'Archive updated',
    }));

    const formatActivityDayLabel = (value: string) =>
        new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(new Date(value));

    const getActivityDayKey = (value: string) => {
        const date = new Date(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const groupedRecentActivity: ActivityDayGroup[] = Object.values(
        activityItems.reduce<Record<string, ActivityDayGroup>>((groups, item) => {
            const dayKey = getActivityDayKey(item.createdAt);
            const existingDay = groups[dayKey];

            if (existingDay) {
                existingDay.items.push(item);
                return groups;
            }

            groups[dayKey] = {
                dayKey,
                dayLabel: formatActivityDayLabel(item.createdAt),
                items: [item],
                people: [],
            };

            return groups;
        }, {})
    )
        .sort((left, right) => right.dayKey.localeCompare(left.dayKey))
        .map((dayGroup) => ({
            ...dayGroup,
            people: Object.values(
                dayGroup.items.reduce<Record<string, ActivityPersonGroup>>((people, item) => {
                    const name = item.createdByName || 'Someone';
                    const existingPerson = people[name];

                    if (existingPerson) {
                        existingPerson.items.push(item);
                        if (new Date(item.createdAt).getTime() > new Date(existingPerson.latestCreatedAt).getTime()) {
                            existingPerson.latestCreatedAt = item.createdAt;
                        }
                        return people;
                    }

                    people[name] = {
                        name,
                        items: [item],
                        latestCreatedAt: item.createdAt,
                    };

                    return people;
                }, {})
            ).sort(
                (left, right) =>
                    new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime()
            ),
        }));

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
                            <div className="flex items-center gap-3 mb-3">
                                <h1 className="font-serif text-4xl text-warm-dark">
                                    The {familyName} Legacy Archive
                                </h1>
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
                            <p className="text-warm-muted font-sans text-sm tracking-wide ml-12">
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
                <NotificationCenter
                    pendingItems={notificationData.pendingItems}
                    loading={notificationLoading}
                    error={notificationError}
                />
                {/* SEARCH & FILTER TOOLBAR */}
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
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="pl-12 pr-8 py-3 glass-input rounded-none appearance-none cursor-pointer"
                            >
                                <option value="all">All Memorials</option>
                                <option value="draft">Preview Archives</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* IN-PAGE TABS — jump to sections on Overview */}
                {!loading && realMemorials.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-2 border-b border-warm-border/30 pb-3">
                        <a href="#members" className="inline-flex items-center gap-2 border border-warm-border/30 bg-white px-4 py-2 text-sm text-warm-dark transition-colors hover:bg-surface-mid rounded-none">
                            <User size={14} />
                            Members
                        </a>
                        <a href="#activity" className="inline-flex items-center gap-2 border border-warm-border/30 bg-white px-4 py-2 text-sm text-warm-dark transition-colors hover:bg-surface-mid rounded-none">
                            <History size={14} />
                            Activity
                            {pendingRequestCount > 0 && (
                                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold bg-warm-brown/15 text-warm-brown rounded-full">
                                    {pendingRequestCount}
                                </span>
                            )}
                        </a>
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-label="Loading memorials">
                        {[0, 1, 2, 3].map((i) => (
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

                {/* MEMBERS — Role Management per Memorial */}
                {firstPaidMemorial && (
                    <div id="members" className="mt-12 border border-warm-border/30 bg-white p-8 rounded-none">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <h3 className="font-serif text-2xl text-warm-dark mb-2">Member management</h3>
                                <p className="text-sm text-warm-muted font-sans leading-relaxed max-w-3xl">
                                    Open the member manager from any memorial card to invite people, change roles, cancel pending invitations, or review who has access to that specific archive.
                                </p>
                            </div>
                            <button
                                onClick={() => setMemberManagerMemorial(firstPaidMemorial)}
                                className="inline-flex items-center gap-2 border border-warm-border/30 px-5 py-3 text-sm font-sans font-semibold text-warm-dark transition-all hover:bg-surface-high rounded-none"
                            >
                                <User size={16} />
                                Open primary member manager
                            </button>
                        </div>
                    </div>
                )}

                <div id="activity" className="mt-12">
                    <section className="border border-warm-border/30 bg-white p-6 rounded-none">
                        <div className="mb-5">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Recent activity</p>
                            <h2 className="mt-2 font-serif text-2xl text-warm-dark">Who changed what</h2>
                            <p className="mt-2 text-sm text-warm-muted font-sans">
                                Family archives need visible history. This feed shows recent saved changes across the family workspace.
                            </p>
                        </div>

                        {notificationLoading ? (
                            <div className="py-10 text-center">
                                <Loader2 size={24} className="mx-auto text-olive animate-spin mb-3" />
                                <p className="text-sm text-warm-muted font-sans">Loading activity...</p>
                            </div>
                        ) : notificationError ? (
                            <div className="border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 rounded-none">
                                {notificationError}
                            </div>
                        ) : activityItems.length === 0 ? (
                            <div className="border-2 border-dashed border-warm-border/35 bg-surface-low/40 px-6 py-10 text-center rounded-none">
                                <History size={24} className="mx-auto mb-3 text-warm-muted" />
                                <p className="font-serif text-xl text-warm-dark">No activity yet</p>
                                <p className="mt-2 text-sm text-warm-muted font-sans">
                                    Once someone edits a family memorial, the change history will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {groupedRecentActivity.map((dayGroup) => (
                                    <details
                                        key={dayGroup.dayKey}
                                        open
                                        className="group border border-warm-border/20 bg-surface-low/20 rounded-none"
                                    >
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                            <div>
                                                <p className="text-sm font-semibold text-warm-dark font-sans">
                                                    {dayGroup.dayLabel}
                                                </p>
                                                <p className="mt-1 text-xs text-warm-outline font-sans">
                                                    {dayGroup.items.length} update{dayGroup.items.length !== 1 ? 's' : ''} by {dayGroup.people.length} contributor{dayGroup.people.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <ChevronDown
                                                size={16}
                                                className="text-warm-outline transition-transform group-open:rotate-180"
                                            />
                                        </summary>

                                        <div className="space-y-3 border-t border-warm-border/15 px-3 py-3">
                                            {dayGroup.people.map((personGroup) => (
                                                <details
                                                    key={`${dayGroup.dayKey}-${personGroup.name}`}
                                                    className="group/person border border-warm-border/20 bg-white rounded-none"
                                                >
                                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-warm-dark font-sans">
                                                                {personGroup.name}
                                                            </p>
                                                            <p className="mt-1 text-xs text-warm-outline font-sans">
                                                                {personGroup.items.length} change{personGroup.items.length !== 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                        <ChevronDown
                                                            size={16}
                                                            className="text-warm-outline transition-transform group-open/person:rotate-180"
                                                        />
                                                    </summary>

                                                    <div className="space-y-3 border-t border-warm-border/15 px-4 py-3">
                                                        {personGroup.items.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="border border-warm-border/20 bg-surface-low/25 px-4 py-3 rounded-none"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className="mt-1 flex h-9 w-9 items-center justify-center bg-olive/10 text-olive rounded-none">
                                                                        <MessageSquareText size={16} />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm text-warm-dark font-sans">
                                                                            Updated <span className="font-semibold">{item.memorialName}</span>
                                                                        </p>
                                                                        <p className="mt-1 text-sm text-warm-muted font-sans leading-relaxed">
                                                                            {item.changeSummary}
                                                                        </p>
                                                                        <p className="mt-2 text-xs text-warm-outline font-sans">
                                                                            {new Date(item.createdAt).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

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
        </DashboardShell>
    );
}
