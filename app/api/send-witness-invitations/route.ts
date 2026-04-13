import { NextRequest, NextResponse } from 'next/server';
import { getWitnessInvitationEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/sender';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { normalizeInviteEmail, upsertMemorialInvitation } from '@/lib/invitations';

export async function POST(request: NextRequest) {
    try {
        const { memorialId, emails, personalMessage, deceasedName } = await request.json();

        if (!memorialId || !Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: memorialId or emails' },
                { status: 400 }
            );
        }

        const access = await requireMemorialAccess({
            memorialId,
            action: 'invite_member',
        });
        if (!access.ok) return access.response;

        const { user, admin, context } = access;
        const results: Array<{ email: string; status: string; invitationId?: string }> = [];

        for (const rawEmail of emails) {
            const email = normalizeInviteEmail(String(rawEmail || ''));

            if (!email || !email.includes('@')) {
                results.push({ email: String(rawEmail || ''), status: 'invalid_email' });
                continue;
            }

            try {
                const invitation = await upsertMemorialInvitation({
                    memorialId,
                    inviteeEmail: email,
                    role: 'witness',
                    personalMessage: personalMessage?.trim() || null,
                    inviterName: user.email || 'Archive owner',
                    inviterEmail: user.email || '',
                });

                const baseUrl =
                    process.env.NEXT_PUBLIC_BASE_URL
                    || `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${request.headers.get('host')}`;
                const inviteLink = `${baseUrl}/invite/${invitation.invitation.id}`;

                await sendEmail({
                    to: email,
                    subject: `An invitation to bear witness for ${deceasedName || invitation.memorial.fullName || 'a loved one'}`,
                    html: getWitnessInvitationEmail(
                        user.email || 'Archive owner',
                        deceasedName || invitation.memorial.fullName || 'a loved one',
                        inviteLink,
                        personalMessage?.trim() || null
                    ),
                });

                await safeLogMemorialActivity(admin, {
                    memorialId,
                    action: 'invite_sent',
                    summary: `Invitation sent to ${email} as witness.`,
                    actorUserId: user.id,
                    actorEmail: user.email ?? null,
                    subjectEmail: email,
                    details: {
                        invitationId: invitation.invitation.id,
                        refreshed: !invitation.created,
                    },
                });

                results.push({
                    email,
                    status: invitation.created ? 'sent' : 'refreshed',
                    invitationId: invitation.invitation.id,
                });
            } catch (error: any) {
                const message = error?.message || '';
                if (message.includes('already')) {
                    results.push({ email, status: 'already_member' });
                    continue;
                }

                console.error(`Invitation error for ${email}:`, error);
                results.push({ email, status: 'failed' });
            }
        }

        return NextResponse.json({
            success: true,
            dispatched: results.filter((item) => item.status === 'sent' || item.status === 'refreshed').length,
            results,
            plan: context.plan,
        });
    } catch (error: any) {
        console.error('Invitation API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
