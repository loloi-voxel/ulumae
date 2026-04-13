import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/sender';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { normalizeInviteEmail } from '@/lib/invitations';

/**
 * Loads the invitation and validates it is still pending and not expired.
 * Returns { memorialId, inviteeEmail } or null if the invitation is invalid.
 */
async function loadValidInvitation(token: string) {
    const admin = getSupabaseAdmin();
    const { data } = await admin
        .from('witness_invitations')
        .select('memorial_id, invitee_email, status, expires_at')
        .eq('id', token)
        .maybeSingle();

    if (!data) return null;

    if (data.status !== 'pending') return null;

    if (new Date(data.expires_at).getTime() < Date.now()) return null;

    return {
        memorialId: data.memorial_id as string,
        inviteeEmail: data.invitee_email as string,
    };
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const admin = getSupabaseAdmin();
        const { token } = await params;
        const { name, email } = await req.json();

        if (!name || !email) {
            return NextResponse.json(
                { error: 'Name and email are required' },
                { status: 400 }
            );
        }

        const invitation = await loadValidInvitation(token);
        if (!invitation) {
            return NextResponse.json(
                { error: 'This invitation is no longer valid.' },
                { status: 400 }
            );
        }

        // Verify the submitted email matches the invitation
        if (normalizeInviteEmail(email) !== normalizeInviteEmail(invitation.inviteeEmail)) {
            return NextResponse.json(
                { error: 'Please use the email address this invitation was sent to.' },
                { status: 400 }
            );
        }

        // Generate 6-digit code
        const code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const expires = new Date(
            Date.now() + 15 * 60 * 1000
        );

        // Store code in a temporary contribution record
        await admin
            .from('memorial_contributions')
            .insert({
                memorial_id: invitation.memorialId,
                witness_name: name,
                contributor_email: normalizeInviteEmail(email),
                contributor_verified: false,
                verification_code: code,
                verification_expires_at: expires.toISOString(),
                is_anonymous: true,
                type: 'memory',
                content: {},
                status: 'pending_approval'
            });

        // Send code via Brevo
        await sendEmail({
            to: email,
            subject: 'Your verification code — ULUMAE',
            html: `
                <div style="font-family: Georgia, serif;
                  max-width: 400px; margin: 0 auto;
                  padding: 40px;">
                  <p style="font-size: 16px;
                    color: #5a6b78;">
                    Your verification code is:
                  </p>
                  <p style="font-size: 48px;
                    font-weight: bold;
                    letter-spacing: 12px;
                    color: #1a1a1a;
                    margin: 20px 0;">
                    ${code}
                  </p>
                  <p style="font-size: 13px;
                    color: #9a9a9a;">
                    This code expires in 15 minutes.
                  </p>
                </div>
            `
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[AnonSendCode]', err);
        return NextResponse.json(
            { error: 'Failed to send code' },
            { status: 500 }
        );
    }
}