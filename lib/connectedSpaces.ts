import type { WitnessRole } from '@/types/roles';

export interface ConnectedSpaceEntry {
    id: string;
    fullName: string | null;
    profilePhotoUrl: string | null;
    mode: string | null;
    role: Extract<WitnessRole, 'co_guardian' | 'witness' | 'reader'>;
    roleLabel: string;
    plan: string;
    href: string;
}

const CONNECTED_SPACE_ROLE_RANK: Record<ConnectedSpaceEntry['role'], number> = {
    co_guardian: 0,
    witness: 1,
    reader: 2,
};

export function sortConnectedSpaces(spaces: ConnectedSpaceEntry[]) {
    return [...spaces].sort((a, b) => {
        const roleDiff = CONNECTED_SPACE_ROLE_RANK[a.role] - CONNECTED_SPACE_ROLE_RANK[b.role];
        if (roleDiff !== 0) return roleDiff;

        const nameA = (a.fullName || '').trim().toLowerCase();
        const nameB = (b.fullName || '').trim().toLowerCase();
        return nameA.localeCompare(nameB);
    });
}
