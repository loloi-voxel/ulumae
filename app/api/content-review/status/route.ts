import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
    const supabaseAdmin = getSupabaseAdmin();
    const memorialId = req.nextUrl.searchParams.get('memorialId');

    if (!memorialId) {
        return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    try {
        const { user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'view_activity')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('content_reviews')
            .select('*')
            .eq('memorial_id', memorialId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!data) {
            return NextResponse.json({
                status: 'not_submitted',
                submittedAt: null,
                reviewedAt: null,
                flaggedItems: [],
            });
        }

        return NextResponse.json({
            status: data.status,
            submittedAt: data.submitted_at,
            reviewedAt: data.reviewed_at,
                flaggedItems: data.flagged_items || [],
        });
    } catch (error: any) {
        console.error('[content-review-status]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
