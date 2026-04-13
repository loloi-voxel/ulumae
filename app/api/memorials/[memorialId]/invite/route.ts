import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { sendEmail } from '@/lib/email/sender';
import { getWitnessInvitationEmail } from '@/lib/email/templates';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import {
    isValidInviteRole,
    normalizeInviteEmail,
    upsertMemorialInvitation,
} from '@/lib/invitations';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const { memorialId } = await params;
        const { email, role, personalMessage } = await req.json();
        const normalizedEmail = normalizeInviteEmail(String(email || ''));

        if (!isValidInviteRole(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        if (!normalizedEmail || !normalizedEmail.includes('@')) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const access = await requireMemorialAccess({
            memorialId,
            action: 'invite_member',
        });

        if (!access.ok) return access.response;

        const { user, admin, context } = access;

        const invitation = await upsertMemorialInvitation({
            memorialId,
            inviteeEmail: normalizedEmail,
            role,
            personalMessage: personalMessage?.trim() || null,
            inviterName: user.email || 'Archive owner',
            inviterEmail: user.email || '',
        });

        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL
            || `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${req.headers.get('host')}`;
        const inviteLink = `${baseUrl}/invite/${invitation.invitation.id}`;

        await sendEmail({
            to: normalizedEmail,
            subject: `An invitation to join the archive of ${invitation.memorial.fullName || 'a loved one'}`,
            html: getWitnessInvitationEmail(
                user.email || 'Archive owner',
                invitation.memorial.fullName || 'their loved one',
                inviteLink,
                personalMessage?.trim() || null
            ),
        });

        await safeLogMemorialActivity(admin, {
            memorialId,
            action: 'invite_sent',
            summary: `Invitation sent to ${normalizedEmail} as ${role}.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectEmail: normalizedEmail,
            details: {
                role,
                invitationId: invitation.invitation.id,
                refreshed: !invitation.created,
            },
        });

        return NextResponse.json({
            success: true,
            invitationId: invitation.invitation.id,
            created: invitation.created,
            refreshed: !invitation.created,
            plan: context.plan,
        });
    } catch (error: any) {
        console.error('[INVITE_API_ERROR]', error);

        const status =
            error.message === 'Memorial not found' ? 404
                : error.message === 'Invalid role' ? 400
                    : error.message?.includes('already')
                        || error.message?.includes('access')
                        || error.message?.includes('Co-Guardian')
                        ? 409
                        : 500;

        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status }
        );
    }
}
