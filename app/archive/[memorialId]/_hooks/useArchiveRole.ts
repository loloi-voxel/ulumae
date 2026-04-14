'use client';

import type { ArchiveRoleSnapshot } from '@/lib/archivePermissions';
import {
    refetchArchiveRole,
    useArchiveRoleStore,
} from './archiveRoleStore';

export type ArchiveRoleData = ArchiveRoleSnapshot;

export function useArchiveRole(memorialId: string) {
    const state = useArchiveRoleStore(memorialId);

    return {
        data: state.data,
        loading: state.loading,
        error: state.error,
        status: state.status,
        hasAccess: state.hasAccess,
        isRevoked: state.isRevoked,
        refetch: () => refetchArchiveRole(memorialId, { reason: 'hook-refetch' }),
    };
}
