import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { normalizeInviteEmail } from '@/lib/invitations';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const admin = getSupabaseAdmin();
        const { token } = await params;
        const { email, code, name } = await req.json();

        // Resolve memorial from the invitation token so the verification
        // is scoped to the correct memorial (prevents cross-memorial confusion).
        const { data: invitation } = await admin
            .from('witness_invitations')
            .select('memorial_id, status')
            .eq('id', token)
            .maybeSingle();

        if (!invitation || invitation.status !== 'pending') {
            return NextResponse.json(
                { error: 'This invitation is no longer valid.' },
                { status: 400 }
            );
        }

        const normalizedEmail = normalizeInviteEmail(email);

        // Find the pending anonymous contribution scoped to this memorial
        const { data: contribution, error } = await admin
            .from('memorial_contributions')
            .select('*')
            .eq('memorial_id', invitation.memorial_id)
            .eq('contributor_email', normalizedEmail)
            .eq('verification_code', code)
            .eq('contributor_verified', false)
            .eq('is_anonymous', true)
            .gt('verification_expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !contribution) {
            return NextResponse.json(
                { error: 'Invalid or expired code. Please try again.' },
                { status: 400 }
            );
        }

        // Mark as verified
        await admin
            .from('memorial_contributions')
            .update({
                contributor_verified: true,
                verification_code: null,
                witness_name: name,
            })
            .eq('id', contribution.id);

        return NextResponse.json({
            success: true,
            contributionId: contribution.id,
            memorialId: contribution.memorial_id,
        });
    } catch (err: any) {
        console.error('[AnonVerify]', err);
        return NextResponse.json(
            { error: 'Verification failed' },
            { status: 500 }
        );
    }
}
