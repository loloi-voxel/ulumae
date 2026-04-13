import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireMemorialAccess, requireUser } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const { memorialId } = await params;
        const { requestMessage } = await req.json();
        const auth = await requireUser();
        if (!auth.ok) return auth.response;

        const { user } = auth;
        const admin = getSupabaseAdmin();

        const { data: memorial, error: memorialError } = await admin
            .from('memorials')
            .select('id, mode, user_id, full_name')
            .eq('id', memorialId)
            .maybeSingle();

        if (memorialError || !memorial) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (memorial.mode !== 'family') {
            return NextResponse.json({ error: 'Access requests are only available for Family Plan archives' }, { status: 400 });
        }

        if (memorial.user_id === user.id) {
            return NextResponse.json({ error: 'You already own this archive' }, { status: 400 });
        }

        // 3. CHECK IF ALREADY A MEMBER
        const { data: existingRole } = await admin
            .from('user_memorial_roles')
            .select('id')
            .eq('memorial_id', memorialId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingRole) {
            return NextResponse.json({ error: 'You are already a member of this archive' }, { status: 400 });
        }

        // 4. CHECK FOR EXISTING PENDING REQUEST
        const { data: existingRequest } = await admin
            .from('memorial_access_requests')
            .select('id')
            .eq('memorial_id', memorialId)
            .eq('requester_user_id', user.id)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingRequest) {
            return NextResponse.json({ error: 'You already have a pending request for this archive' }, { status: 400 });
        }

        // 5. CREATE THE REQUEST
        const { data: insertedRequest, error: insertError } = await admin
            .from('memorial_access_requests')
            .insert({
                memorial_id: memorialId,
                requester_user_id: user.id,
                requested_role: 'witness', // Default requested role
                request_message: requestMessage || '',
                status: 'pending'
            })
            .select('id')
            .single();

        if (insertError) throw insertError;
        await safeLogMemorialActivity(admin, {
            memorialId,
            action: 'access_request_created',
            summary: 'A family access request was submitted.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            details: {
                requestId: insertedRequest.id,
                requestMessage: requestMessage || '',
                requestedRole: 'witness',
            },
        });

        return NextResponse.json({ success: true, message: 'Request submitted successfully' });

    } catch (error: any) {
        console.error('[ACCESS_REQUEST_ERROR]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const { memorialId } = await params;

        const access = await requireMemorialAccess({
            memorialId,
            action: 'approve_access_requests',
        });
        if (!access.ok) return access.response;

        const { admin } = access;

        const { data: requests, error } = await admin
            .from('memorial_access_requests')
            .select('id, requester_user_id, requested_role, request_message, status, created_at')
            .eq('memorial_id', memorialId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        const enriched = await Promise.all(
            (requests || []).map(async (request) => {
                const { data: authUser } = await admin.auth.admin.getUserById(request.requester_user_id);
                return {
                    id: request.id,
                    requesterUserId: request.requester_user_id,
                    email: authUser.user?.email || 'Unknown',
                    requestedRole: request.requested_role,
                    requestMessage: request.request_message || '',
                    status: request.status,
                    createdAt: request.created_at,
                };
            })
        );

        return NextResponse.json({ requests: enriched });
    } catch (error: any) {
        console.error('[ACCESS_REQUEST_LIST_ERROR]', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
