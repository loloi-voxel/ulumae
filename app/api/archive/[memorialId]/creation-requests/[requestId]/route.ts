import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { syncAllCoGuardiansToMemorial } from '@/lib/familyWorkspace';
import { resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';

type CreationDecision = 'approved' | 'rejected';

function createDraftSlug(proposedName?: string | null) {
    const base = (proposedName || 'family-memorial')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${base || 'family-memorial'}-${Date.now()}`;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string; requestId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId, requestId } = await params;
        const { decision } = await req.json() as { decision?: CreationDecision };
        const { user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (decision !== 'approved' && decision !== 'rejected') {
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

        if (permission.context.role !== 'owner') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: requestRecord } = await supabaseAdmin
            .from('memorial_creation_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (!requestRecord || requestRecord.owner_user_id !== user.id) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (requestRecord.status !== 'pending') {
            return NextResponse.json({ error: 'This request has already been handled.' }, { status: 400 });
        }

        let createdMemorialId: string | null = null;
        const requesterUser = await supabaseAdmin.auth.admin.getUserById(
            requestRecord.requester_user_id
        );

        if (decision === 'approved') {
            const step1 = requestRecord.proposed_name
                ? { fullName: requestRecord.proposed_name }
                : {};

            const { data: createdMemorial, error: createError } = await supabaseAdmin
                .from('memorials')
                .insert({
                    user_id: user.id,
                    mode: 'family',
                    status: 'draft',
                    slug: createDraftSlug(requestRecord.proposed_name),
                    full_name: requestRecord.proposed_name || null,
                    step1,
                    paid: false,
                })
                .select('id')
                .single();

            if (createError) {
                throw createError;
            }

            if (!createdMemorial?.id) {
                throw new Error('Could not create the new memorial.');
            }

            const newMemorialId = createdMemorial.id;
            createdMemorialId = newMemorialId;
            await syncAllCoGuardiansToMemorial(
                supabaseAdmin,
                user.id,
                newMemorialId
            );
        }

        const { error: updateError } = await supabaseAdmin
            .from('memorial_creation_requests')
            .update({
                status: decision,
                created_memorial_id: createdMemorialId,
                decided_at: new Date().toISOString(),
                decided_by: user.id,
            })
            .eq('id', requestId);

        if (updateError) {
            throw updateError;
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'creation_request_decided',
            summary: `A memorial creation request was ${decision}.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: requestRecord.requester_user_id,
            subjectEmail: requesterUser.data.user?.email ?? null,
            details: {
                requestId,
                decision,
                createdMemorialId,
            },
        });

        return NextResponse.json({
            success: true,
            createdMemorialId,
        });
    } catch (error: any) {
        console.error('[creation-request][PATCH]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
