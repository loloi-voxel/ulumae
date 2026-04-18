import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { getArchivePlan, getRoleLabel } from '@/lib/archivePermissions';
import { getPlanDashboardPath } from '@/components/providers/AuthProvider';
import type { WitnessRole } from '@/types/roles';

interface SpaceEntry {
    id: string;
    fullName: string | null;
    profilePhotoUrl: string | null;
    mode: string | null;
    role: WitnessRole;
    roleLabel: string;
    plan: string;
    href: string;
}

export async function GET(_request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { user, error } = await createAuthenticatedClient();

        if (error || !user) {
            return NextResponse.json(
                { authenticated: false, spaces: [] },
                { status: 401 }
            );
        }

        const [ownedResult, rolesResult] = await Promise.all([
            supabaseAdmin
                .from('memorials')
                .select('id, full_name, profile_photo_url, mode')
                .eq('user_id', user.id)
                .eq('deleted', false)
                .order('updated_at', { ascending: false }),
            supabaseAdmin
                .from('user_memorial_roles')
                .select('role, memorial_id')
                .eq('user_id', user.id),
        ]);

        const spaces: SpaceEntry[] = [];

        const ownedIds = new Set<string>();
        for (const row of ownedResult.data || []) {
            const plan = getArchivePlan(row.mode);
            ownedIds.add(row.id);
            spaces.push({
                id: row.id,
                fullName: row.full_name,
                profilePhotoUrl: row.profile_photo_url,
                mode: row.mode,
                role: 'owner',
                roleLabel: getRoleLabel('owner'),
                plan,
                href: getPlanDashboardPath(plan, user.id),
            });
        }

        const roleRows = (rolesResult.data || []) as Array<{ role: string; memorial_id: string }>;
        const invitedIds = Array.from(
            new Set(
                roleRows
                    .map((row) => row.memorial_id)
                    .filter((id): id is string => typeof id === 'string' && !ownedIds.has(id))
            )
        );

        if (invitedIds.length > 0) {
            const { data: invitedMemorials } = await supabaseAdmin
                .from('memorials')
                .select('id, full_name, profile_photo_url, mode, user_id, deleted')
                .in('id', invitedIds)
                .eq('deleted', false);

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

            const seenPairs = new Set<string>();
            for (const row of roleRows) {
                const memorial = memorialById.get(row.memorial_id);
                if (!memorial) continue;
                if (memorial.user_id === user.id) continue;

                const role = row.role as WitnessRole;
                const dedupeKey = `${memorial.id}:${role}`;
                if (seenPairs.has(dedupeKey)) continue;
                seenPairs.add(dedupeKey);

                const plan = getArchivePlan(memorial.mode);
                spaces.push({
                    id: memorial.id,
                    fullName: memorial.full_name,
                    profilePhotoUrl: memorial.profile_photo_url,
                    mode: memorial.mode,
                    role,
                    roleLabel: getRoleLabel(role),
                    plan,
                    href: `/archive/${memorial.id}`,
                });
            }
        }

        return NextResponse.json(
            { authenticated: true, spaces },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (err: any) {
        console.error('[UserSpaces] Unexpected error:', err);
        return NextResponse.json(
            { authenticated: false, spaces: [], error: err?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
