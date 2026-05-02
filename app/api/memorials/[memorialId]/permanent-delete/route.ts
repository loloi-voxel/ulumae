import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { isMemorialSealLocked } from '@/types/memorial';

// DELETE /api/memorials/[memorialId]/permanent-delete
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId } = await params;

        if (!memorialId) {
            return NextResponse.json({ error: 'Missing memorial id' }, { status: 400 });
        }

        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id,
            { includeDeleted: true }
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'delete_archive')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: memorial, error: fetchError } = await supabaseAdmin
            .from('memorials')
            .select('deleted, paid, mode, preservation_state, seal_status')
            .eq('id', memorialId)
            .single();

        if (fetchError || !memorial) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (
            memorial.preservation_state === 'preserved' ||
            isMemorialSealLocked(memorial.seal_status)
        ) {
            const sealingInProgress =
                memorial.seal_status === 'pending' || memorial.seal_status === 'in_progress';
            return NextResponse.json(
                {
                    error: sealingInProgress
                        ? 'This archive is currently being sealed and cannot be permanently deleted.'
                        : 'Sealed or otherwise locked memorials cannot be permanently deleted.',
                },
                { status: 403 }
            );
        }

        if (!memorial.deleted) {
            return NextResponse.json(
                { error: 'Memorial must be in trash before permanent deletion' },
                { status: 400 }
            );
        }

        if (memorial.paid && memorial.mode) {
            const planRank: Record<string, number> = { draft: 0, personal: 1, family: 2, concierge: 3 };
            const memorialPlanRank = planRank[memorial.mode] ?? 0;

            const { data: userRow } = await supabaseAdmin
                .from('users')
                .select('highest_plan')
                .eq('id', user.id)
                .single();

            const currentRank = planRank[userRow?.highest_plan ?? 'draft'] ?? 0;
            if (memorialPlanRank > currentRank) {
                await supabaseAdmin
                    .from('users')
                    .update({ highest_plan: memorial.mode })
                    .eq('id', user.id);
            } else if (!userRow?.highest_plan && memorial.paid) {
                await supabaseAdmin
                    .from('users')
                    .update({ highest_plan: memorial.mode })
                    .eq('id', user.id);
            }
        }

        const { error } = await supabaseAdmin
            .from('memorials')
            .delete()
            .eq('id', memorialId);

        if (error) {
            console.error('permanent-delete error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'memorial_permanently_deleted',
            summary: 'The memorial was permanently deleted.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Permanent delete execution error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
