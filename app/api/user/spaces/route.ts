import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { getArchiveExitPath } from '@/lib/archiveNavigation';
import { getArchivePlan, getRoleLabel } from '@/lib/archivePermissions';
import type { ConnectedSpaceEntry } from '@/lib/connectedSpaces';
import type { WitnessRole } from '@/types/roles';

const INVITED_SPACE_ROLES: WitnessRole[] = ['co_guardian', 'witness', 'reader'];
const INVITED_SPACE_ROLE_RANK: Record<ConnectedSpaceEntry['role'], number> = {
    co_guardian: 0,
    witness: 1,
    reader: 2,
};

export async function GET(_request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { user, error } = await createAuthenticatedClient();

        if (error || !user) {
            return NextResponse.json(
                { authenticated: false, invitedSpaces: [], spaces: [] },
                { status: 401 }
            );
        }

        const [ownedResult, rolesResult] = await Promise.all([
            supabaseAdmin
                .from('memorials')
                .select('id')
                .eq('user_id', user.id)
                .eq('deleted', false),
            supabaseAdmin
                .from('user_memorial_roles')
                .select('role, memorial_id')
                .eq('user_id', user.id)
                .in('role', INVITED_SPACE_ROLES),
        ]);

        if (ownedResult.error) {
            throw ownedResult.error;
        }

        if (rolesResult.error) {
            throw rolesResult.error;
        }

        const ownedIds = new Set<string>((ownedResult.data || []).map((row) => row.id));
        const roleRows = (rolesResult.data || []) as Array<{ role: string; memorial_id: string }>;
        const invitedIds = Array.from(
            new Set(
                roleRows
                    .map((row) => row.memorial_id)
                    .filter((id): id is string => typeof id === 'string' && !ownedIds.has(id))
            )
        );

        const invitedSpaces: ConnectedSpaceEntry[] = [];

        if (invitedIds.length > 0) {
            const { data: invitedMemorials, error: invitedMemorialsError } = await supabaseAdmin
                .from('memorials')
                .select('id, full_name, profile_photo_url, mode, user_id, deleted')
                .in('id', invitedIds)
                .eq('deleted', false);

            if (invitedMemorialsError) {
                throw invitedMemorialsError;
            }

            const memorialById = new Map<string, {
                id: string;
                full_name: string | null;
                profile_photo_url: string | null;
                mode: string | null;
                user_id: string;
            }>();

            for (const memorial of invitedMemorials || []) {
                memorialById.set(memorial.id, memorial);
            }

            const bestRoleByMemorialId = new Map<string, ConnectedSpaceEntry['role']>();
            for (const row of roleRows) {
                const memorial = memorialById.get(row.memorial_id);
                if (!memorial) continue;
                if (memorial.user_id === user.id) continue;

                const role = row.role as ConnectedSpaceEntry['role'];
                if (!INVITED_SPACE_ROLES.includes(role)) continue;

                const currentBest = bestRoleByMemorialId.get(memorial.id);
                if (
                    currentBest &&
                    INVITED_SPACE_ROLE_RANK[currentBest] <= INVITED_SPACE_ROLE_RANK[role]
                ) {
                    continue;
                }

                bestRoleByMemorialId.set(memorial.id, role);
            }

            for (const [memorialId, role] of bestRoleByMemorialId) {
                const memorial = memorialById.get(memorialId);
                if (!memorial) continue;

                const plan = getArchivePlan(memorial.mode);
                invitedSpaces.push({
                    id: memorial.id,
                    fullName: memorial.full_name,
                    profilePhotoUrl: memorial.profile_photo_url,
                    mode: memorial.mode,
                    role,
                    roleLabel: getRoleLabel(role),
                    plan,
                    href: getArchiveExitPath({
                        role,
                        plan,
                        userId: user.id,
                        memorialId: memorial.id,
                    }),
                });
            }
        }

        return NextResponse.json(
            {
                authenticated: true,
                invitedSpaces,
                spaces: invitedSpaces,
            },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (err: any) {
        console.error('[UserSpaces] Unexpected error:', err);
        return NextResponse.json(
            {
                authenticated: false,
                invitedSpaces: [],
                spaces: [],
                error: err?.message || 'Unknown error',
            },
            { status: 500 }
        );
    }
}
