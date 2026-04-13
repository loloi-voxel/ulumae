import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';

type ReviewDecision = 'approved' | 'rejected' | 'needs_changes';

const VALID_DECISIONS: ReviewDecision[] = ['approved', 'rejected', 'needs_changes'];

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string; contributionId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId, contributionId } = await params;
        const { user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const decision = body?.decision as ReviewDecision;
        const adminNotes = String(body?.adminNotes || '').trim();

        if (!VALID_DECISIONS.includes(decision)) {
            return NextResponse.json({ error: 'Invalid review decision' }, { status: 400 });
        }

        if ((decision === 'rejected' || decision === 'needs_changes') && adminNotes.length < 8) {
            return NextResponse.json(
                { error: 'Please include a short explanation so the contributor understands the decision.' },
                { status: 400 }
            );
        }

        const [{ data: contribution }, permission] = await Promise.all([
            supabaseAdmin
                .from('memorial_contributions')
                .select('id, memorial_id, user_id, contributor_email, status')
                .eq('id', contributionId)
                .maybeSingle(),
            resolveArchivePermissionContext(supabaseAdmin, memorialId, user.id),
        ]);

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'review_contributions')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!contribution || contribution.memorial_id !== memorialId) {
            return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
        }

        if (contribution.status !== 'pending_approval') {
            return NextResponse.json(
                { error: 'Only contributions awaiting review can be updated from this queue.' },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from('memorial_contributions')
            .update({
                status: decision,
                admin_notes: adminNotes || null,
                notified_at: new Date().toISOString(),
            })
            .eq('id', contributionId);

        if (error) {
            throw error;
        }

        const contributorUser = contribution.user_id
            ? await supabaseAdmin.auth.admin.getUserById(contribution.user_id)
            : null;

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'contribution_reviewed',
            summary: `A contribution was marked ${decision}.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: contribution.user_id || null,
            subjectEmail:
                contributorUser?.data.user?.email || contribution.contributor_email || null,
            details: {
                contributionId,
                decision,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[contribution-review]', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
