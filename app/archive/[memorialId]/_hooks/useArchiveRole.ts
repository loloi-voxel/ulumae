'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArchiveCapabilities } from '@/lib/archivePermissions';

const PERIODIC_REFRESH_MS = 30_000; // Re-validate role every 30 seconds

export interface ArchiveRoleData {
    currentUserId: string;
    userRole: 'witness' | 'co_guardian' | 'owner' | 'reader';
    plan: 'personal' | 'family';
    roleLabel: string;
    capabilities: ArchiveCapabilities;
    memorial: {
        id: string;
        fullName: string;
        birthDate: string | null;
        deathDate: string | null;
        profilePhotoUrl: string | null;
        userId: string;
    };
    myContributions: {
        id: string;
        type: 'memory' | 'photo' | 'video';
        status: 'pending_approval' | 'approved' | 'rejected' | 'needs_changes';
        title: string;
        createdAt: string;
        adminNotes: string | null;
        revisionCount: number;
    }[];
    pendingCount: number;
    pendingContributionCount: number;
    pendingAccessRequestCount: number;
    pendingCreationRequestCount: number;
}

export function useArchiveRole(memorialId: string) {
    const [data, setData] = useState<ArchiveRoleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchRoleData = useCallback(() => {
        return fetch(`/api/archive/${memorialId}/role-data`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setData(d);
                setError(null);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [memorialId]);

    useEffect(() => {
        if (!memorialId) return;

        fetchRoleData();

        // Periodic re-fetch to prevent stale role state
        intervalRef.current = setInterval(() => {
            fetchRoleData();
        }, PERIODIC_REFRESH_MS);

        const handleRoleChanged = (event: Event) => {
            const detail = (event as CustomEvent<{ memorialId: string }>).detail;
            if (detail?.memorialId === memorialId) {
                setLoading(true);
                fetchRoleData();
            }
        };

        window.addEventListener('ulumae:role-changed', handleRoleChanged);
        return () => {
            window.removeEventListener('ulumae:role-changed', handleRoleChanged);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [memorialId, fetchRoleData]);

    const refetch = useCallback(() => {
        setLoading(true);
        return fetchRoleData();
    }, [fetchRoleData]);

    return { data, loading, error, refetch };
}
