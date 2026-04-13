import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';

type ContributionType = 'memory' | 'photo';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memorialId: string }> }
) {
  try {
    const { memorialId } = await params;
    const access = await requireMemorialAccess({
      memorialId,
      action: 'contribute_content',
    });

    if (!access.ok) return access.response;

    const { user, admin, context } = access;
    const body = (await req.json()) as {
      type?: ContributionType;
      content?: Record<string, any>;
      witnessName?: string;
      revisionId?: string | null;
    };

    if (body.type !== 'memory' && body.type !== 'photo') {
      return NextResponse.json({ error: 'Invalid contribution type' }, { status: 400 });
    }

    const witnessName = String(body.witnessName || '').trim() || user.email || 'Contributor';
    const content = body.content || {};
    const nextStatus = context.role === 'owner' || context.role === 'co_guardian'
      ? 'approved'
      : 'pending_approval';

    if (body.revisionId) {
      const { data: existingContribution, error: existingError } = await admin
        .from('memorial_contributions')
        .select('id, memorial_id, user_id, status, revision_count')
        .eq('id', body.revisionId)
        .maybeSingle();

      if (existingError || !existingContribution || existingContribution.memorial_id !== memorialId) {
        return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
      }

      if (existingContribution.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (existingContribution.status !== 'needs_changes') {
        return NextResponse.json(
          { error: 'Only contributions marked for changes can be revised here.' },
          { status: 400 }
        );
      }

      const { error: updateError } = await admin
        .from('memorial_contributions')
        .update({
          witness_name: witnessName,
          content,
          status: nextStatus,
          admin_notes: null,
          revision_count: (existingContribution.revision_count || 0) + 1,
          notified_at: null,
        })
        .eq('id', body.revisionId);

      if (updateError) throw updateError;

      await safeLogMemorialActivity(admin, {
        memorialId,
        action: 'contribution_submitted',
        summary:
          nextStatus === 'pending_approval'
            ? 'A revised contribution was resubmitted for review.'
            : 'A revised contribution was updated.',
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        details: {
          contributionId: body.revisionId,
          revision: true,
          type: body.type,
        },
      });

      return NextResponse.json({ success: true, contributionId: body.revisionId });
    }

    const { data: createdContribution, error: insertError } = await admin
      .from('memorial_contributions')
      .insert({
        memorial_id: memorialId,
        user_id: user.id,
        witness_name: witnessName,
        contributor_email: user.email || null,
        contributor_verified: true,
        is_anonymous: false,
        type: body.type,
        content,
        status: nextStatus,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'contribution_submitted',
      summary:
        nextStatus === 'pending_approval'
          ? 'A contribution was submitted for review.'
          : 'A contribution was published.',
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      details: {
        contributionId: createdContribution.id,
        type: body.type,
      },
    });

    return NextResponse.json({
      success: true,
      contributionId: createdContribution.id,
    });
  } catch (error: any) {
    console.error('[archive-contributions][POST]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
