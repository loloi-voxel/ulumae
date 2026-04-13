import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { syncCoGuardianAcrossOwnerFamily } from '@/lib/familyWorkspace';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { acceptInvitationForUser } from '@/lib/invitations';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        await req.json().catch(() => null);

        const supabaseAdmin = getSupabaseAdmin();
        const { token } = await params;
        const { user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const result = await acceptInvitationForUser(token, user);

        if (!result.success || !result.memorialId || !result.role || !result.plan) {
            const status =
                result.code === 'INVITATION_NOT_FOUND' ? 404
                    : result.code === 'MEMORIAL_DELETED' ? 410
                        : result.code === 'USED_BY_OTHER' ? 409
                            : result.code === 'EMAIL_MISMATCH' ? 409
                                : 400;

            return NextResponse.json(
                {
                    error: result.error || 'Could not join this archive.',
                    code: result.code || 'UNKNOWN_INVITE_ERROR',
                },
                { status }
            );
        }

        if (result.role === 'co_guardian' && result.plan === 'family') {
            const { data: memorial } = await supabaseAdmin
                .from('memorials')
                .select('user_id')
                .eq('id', result.memorialId)
                .single();

            if (memorial?.user_id) {
                await syncCoGuardianAcrossOwnerFamily(
                    supabaseAdmin,
                    memorial.user_id,
                    user.id
                );
            }
        }

        await supabaseAdmin
            .from('user_memorial_roles')
            .update({ last_visited_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('memorial_id', result.memorialId);

        if (result.joinedNow) {
            const { data: invitationData } = await supabaseAdmin
                .from('witness_invitations')
                .select('inviter_name, invitee_email, role')
                .eq('id', token)
                .single();

            await safeLogMemorialActivity(supabaseAdmin, {
                memorialId: result.memorialId,
                action: 'invite_accepted',
                summary: `${user.email || 'A member'} accepted an invitation.`,
                actorUserId: user.id,
                actorEmail: user.email ?? null,
                subjectEmail: invitationData?.invitee_email || user.email || null,
                details: {
                    invitationId: token,
                    inviterName: invitationData?.inviter_name || null,
                    role: invitationData?.role || result.role,
                },
            });
        }

        return NextResponse.json({
            success: true,
            memorialId: result.memorialId,
            role: result.role,
            plan: result.plan,
            joinedNow: result.joinedNow ?? false,
            alreadyMember: result.alreadyMember ?? false,
        });
    } catch (err: any) {
        console.error('[join/route] Exception:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
