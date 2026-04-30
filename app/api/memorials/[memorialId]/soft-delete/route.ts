import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { isMemorialSealLocked } from '@/types/memorial';

// PATCH /api/memorials/[memorialId]/soft-delete
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId } = await params;
        const { action } = await request.json(); // 'delete' | 'restore'

        if (!memorialId) {
            return NextResponse.json({ error: 'Missing memorial id' }, { status: 400 });
        }
        if (action !== 'delete' && action !== 'restore') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
            .select('preservation_state, seal_status')
            .eq('id', memorialId)
            .single();

        if (fetchError || !memorial) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (
            action === 'delete' &&
            (memorial.preservation_state === 'preserved' || isMemorialSealLocked(memorial.seal_status))
        ) {
            return NextResponse.json(
                { error: 'This archive has been permanently preserved on the blockchain and cannot be deleted.' },
                { status: 403 }
            );
        }

        const updates =
            action === 'restore'
                ? { deleted: false, deleted_at: null }
                : { deleted: true, deleted_at: new Date().toISOString() };

        const { error } = await supabaseAdmin
            .from('memorials')
            .update(updates)
            .eq('id', memorialId);

        if (error) {
            console.error('soft-delete error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: action === 'restore' ? 'memorial_restored' : 'memorial_soft_deleted',
            summary: action === 'restore'
                ? 'The memorial was restored from removed archives.'
                : 'The memorial was moved to removed archives.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Soft delete execution error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
