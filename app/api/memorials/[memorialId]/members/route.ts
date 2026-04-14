import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const { memorialId } = await params;
        const access = await requireMemorialAccess({
            memorialId,
            action: 'view_members',
        });
        if (!access.ok) return access.response;

        const { admin, context } = access;

        const { data: roles, error: rolesError } = await admin
            .from('user_memorial_roles')
            .select('user_id, role, joined_at')
            .eq('memorial_id', memorialId);

        if (rolesError) throw rolesError;

        const members = [];

        const { data: ownerData } = await admin.auth.admin.getUserById(context.ownerUserId);
        members.push({
            userId: context.ownerUserId,
            email: ownerData?.user?.email || 'Owner',
            role: 'owner',
            status: 'active',
            joinedAt: null,
        });

        for (const member of roles || []) {
            if (member.user_id === context.ownerUserId) continue;
            const { data: authUser } = await admin.auth.admin.getUserById(member.user_id);
            members.push({
                userId: member.user_id,
                email: authUser?.user?.email || 'Unknown',
                role: member.role,
                status: 'active',
                joinedAt: member.joined_at,
            });
        }

        const { data: pending, error: pendingError } = await admin
            .from('witness_invitations')
            .select('id, invitee_email, role, created_at')
            .eq('memorial_id', memorialId)
            .eq('status', 'pending');

        if (pendingError) throw pendingError;

        for (const invite of pending || []) {
            members.push({
                invitationId: invite.id,
                userId: null,
                email: invite.invitee_email,
                role: invite.role,
                status: 'pending',
                joinedAt: invite.created_at,
            });
        }

        return NextResponse.json({
            members,
            callerRole: context.role,
            planType: context.plan,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
