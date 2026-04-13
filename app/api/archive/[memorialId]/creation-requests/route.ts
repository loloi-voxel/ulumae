import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import {
    getPendingMemorialCreationRequest,
} from '@/lib/familyWorkspace';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId } = await params;
        const { proposedName, requestMessage } = await req.json() as {
            proposedName?: string;
            requestMessage?: string;
        };

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
            return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
        }

        const { data: memorial, error: memorialError } = await supabaseAdmin
            .from('memorials')
            .select('id, user_id, mode')
            .eq('id', memorialId)
            .single();

        if (memorialError || !memorial) {
            return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
        }

        if (memorial.mode !== 'family') {
            return NextResponse.json({ error: 'Only family archives support this request flow.' }, { status: 400 });
        }

        if (
            permission.context.role !== 'co_guardian' ||
            !hasPermission(permission.context, 'request_memorial_creation')
        ) {
            return NextResponse.json({ error: 'Only co-guardians can request a new family memorial.' }, { status: 403 });
        }

        const existingPending = await getPendingMemorialCreationRequest(
            supabaseAdmin,
            memorial.user_id,
            user.id
        );
        if (existingPending) {
            return NextResponse.json(
                { error: 'You already have a pending memorial creation request.' },
                { status: 400 }
            );
        }

        const { data: insertedRequest, error: insertError } = await supabaseAdmin
            .from('memorial_creation_requests')
            .insert({
                owner_user_id: memorial.user_id,
                requester_user_id: user.id,
                source_memorial_id: memorialId,
                proposed_name: proposedName?.trim() || null,
                request_message: requestMessage?.trim() || null,
                status: 'pending',
            })
            .select('id')
            .single();

        if (insertError) {
            throw insertError;
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'creation_request_created',
            summary: 'A co-guardian requested a new family memorial.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            details: {
                requestId: insertedRequest.id,
                proposedName: proposedName?.trim() || null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[creation-request][POST]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId } = await params;
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
            return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
        }

        if (permission.context.role !== 'owner') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: requests, error } = await supabaseAdmin
            .from('memorial_creation_requests')
            .select('id, requester_user_id, source_memorial_id, proposed_name, request_message, status, created_at')
            .eq('owner_user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        const enriched = await Promise.all(
            (requests || []).map(async (request) => {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(request.requester_user_id);
                const { data: sourceMemorial } = await supabaseAdmin
                    .from('memorials')
                    .select('id, full_name')
                    .eq('id', request.source_memorial_id)
                    .maybeSingle();

                return {
                    id: request.id,
                    requesterUserId: request.requester_user_id,
                    email: authUser.user?.email || 'Unknown',
                    sourceMemorialId: request.source_memorial_id,
                    sourceMemorialName: sourceMemorial?.full_name || 'Untitled',
                    proposedName: request.proposed_name || null,
                    requestMessage: request.request_message || '',
                    status: request.status,
                    createdAt: request.created_at,
                };
            })
        );

        return NextResponse.json({ requests: enriched });
    } catch (error: any) {
        console.error('[creation-request][GET]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
