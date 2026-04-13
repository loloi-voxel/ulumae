import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';

type AccessDecision = 'approved' | 'denied';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string; requestId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId, requestId } = await params;
        const { decision } = await req.json() as { decision?: AccessDecision };
        const { user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (decision !== 'approved' && decision !== 'denied') {
            return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'approve_access_requests')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: requestRecord } = await supabaseAdmin
            .from('memorial_access_requests')
            .select('id, requester_user_id, memorial_id, requested_role, status')
            .eq('id', requestId)
            .maybeSingle();

        if (!requestRecord || requestRecord.memorial_id !== memorialId) {
            return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
        }

        if (requestRecord.status !== 'pending') {
            return NextResponse.json({ error: 'This request has already been handled' }, { status: 400 });
        }

        const requesterUser = await supabaseAdmin.auth.admin.getUserById(
            requestRecord.requester_user_id
        );

        if (decision === 'approved') {
            const { error: roleError } = await supabaseAdmin
                .from('user_memorial_roles')
                .upsert({
                    user_id: requestRecord.requester_user_id,
                    memorial_id: memorialId,
                    role: requestRecord.requested_role || 'witness',
                    joined_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,memorial_id',
                });

            if (roleError) {
                throw roleError;
            }
        }

        const { error: requestError } = await supabaseAdmin
            .from('memorial_access_requests')
            .update({
                status: decision,
                decided_at: new Date().toISOString(),
                decided_by: user.id,
            })
            .eq('id', requestId);

        if (requestError) {
            throw requestError;
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'access_request_decided',
            summary: `An access request was ${decision}.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: requestRecord.requester_user_id,
            subjectEmail: requesterUser.data.user?.email ?? null,
            details: {
                requestId,
                decision,
                requestedRole: requestRecord.requested_role || 'witness',
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[ACCESS_REQUEST_DECISION_ERROR]', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
