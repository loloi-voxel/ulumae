import { NextRequest, NextResponse } from 'next/server';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin, requireMemorialAccess, requireUser } from '@/lib/apiAuth';

type ReviewDecision = 'approved' | 'rejected' | 'needs_changes';

const VALID_DECISIONS: ReviewDecision[] = ['approved', 'rejected', 'needs_changes'];

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string; contributionId: string }> }
) {
    try {
        const { memorialId, contributionId } = await params;
        const auth = await requireUser();
        if (!auth.ok) return auth.response;

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

        const supabaseAdmin = getSupabaseAdmin();
        const { data: contribution, error: contributionError } = await supabaseAdmin
            .from('memorial_contributions')
            .select('id, memorial_id, user_id, contributor_email, status')
            .eq('id', contributionId)
            .maybeSingle();

        if (contributionError) {
            throw contributionError;
        }

        if (!contribution) {
            return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
        }

        const effectiveMemorialId = contribution.memorial_id || memorialId;
        const access = await requireMemorialAccess({
            memorialId: effectiveMemorialId,
            action: 'review_contributions',
        });

        if (!access.ok) return access.response;

        const { user, admin } = access;

        if (contribution.status !== 'pending_approval') {
            return NextResponse.json(
                { error: 'Only contributions awaiting review can be updated from this queue.' },
                { status: 400 }
            );
        }

        const { error } = await admin
            .from('memorial_contributions')
            .update({
                status: decision,
                admin_notes: adminNotes || null,
                notified_at: new Date().toISOString(),
            })
            .eq('id', contributionId)
            .eq('memorial_id', effectiveMemorialId);

        if (error) {
            throw error;
        }

        const contributorUser = contribution.user_id
            ? await admin.auth.admin.getUserById(contribution.user_id)
            : null;

        await safeLogMemorialActivity(admin, {
            memorialId: effectiveMemorialId,
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
                requestedMemorialId: memorialId,
                resolvedMemorialId: effectiveMemorialId,
            },
        });

        return NextResponse.json({
            success: true,
            contributionId,
            memorialId: effectiveMemorialId,
            status: decision,
        });
    } catch (error: any) {
        console.error('[contribution-review]', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
