import { NextRequest, NextResponse } from 'next/server';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { MEMORIAL_STEP_IDS, PLAN_PRICES_USD } from '@/lib/constants';
import { getStripeServer, normalizeStripePlan } from '@/lib/stripeServer';
import { insertVersionSnapshot } from '@/lib/versioningServer';

interface FinalizeUpgradeBody {
  memorialId?: string;
  targetPlan?: string;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinalizeUpgradeBody;
    const memorialId = String(body.memorialId || '').trim();
    const targetPlan = normalizeStripePlan(body.targetPlan);
    const sessionId = String(body.sessionId || '').trim();

    if (!memorialId || !targetPlan) {
      return NextResponse.json({ error: 'Missing memorialId or targetPlan' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing verified Stripe checkout session.' }, { status: 400 });
    }

    const access = await requireMemorialAccess({ memorialId });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;

    if (!context.isOwner) {
      return NextResponse.json({ error: 'Only the archive owner can finalize an upgrade.' }, { status: 403 });
    }

    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Checkout session is not fully paid yet.' }, { status: 400 });
    }

    if (session.metadata?.memorialId !== memorialId) {
      return NextResponse.json({ error: 'Stripe session does not match this archive.' }, { status: 403 });
    }

    if (session.metadata?.userId && session.metadata.userId !== user.id) {
      return NextResponse.json({ error: 'Stripe session does not belong to this user.' }, { status: 403 });
    }

    const verifiedTargetPlan = normalizeStripePlan(session.metadata?.upgradeTo || session.metadata?.plan);
    if (verifiedTargetPlan !== targetPlan) {
      return NextResponse.json({ error: 'Upgrade target does not match the verified payment.' }, { status: 400 });
    }

    const { data: memorial, error: fetchError } = await admin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (fetchError || !memorial) {
      return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
    }

    const isValidUpgrade =
      (memorial.mode === 'personal' && targetPlan === 'family') ||
      (memorial.mode === 'family' && targetPlan === 'concierge');

    if (!isValidUpgrade) {
      return NextResponse.json(
        { error: `Cannot upgrade from ${memorial.mode} to ${targetPlan}.` },
        { status: 400 }
      );
    }

    if (memorial.mode === targetPlan) {
      return NextResponse.json({
        success: true,
        message: 'Upgrade already finalized.',
        previousMode: targetPlan,
        newMode: targetPlan,
      });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      mode: targetPlan,
      plan_type: targetPlan,
      amount_paid: PLAN_PRICES_USD[targetPlan],
      upgraded_from: memorial.mode,
      upgraded_at: now,
      paid: true,
      refund_eligible: true,
      payment_confirmed_at: memorial.payment_confirmed_at || now,
    };

    const { error: updateError } = await admin
      .from('memorials')
      .update(updatePayload)
      .eq('id', memorialId);

    if (updateError) {
      throw updateError;
    }

    const { data: updatedMemorial, error: refetchError } = await admin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (refetchError || !updatedMemorial) {
      return NextResponse.json({ error: 'Memorial not found after upgrade' }, { status: 404 });
    }

    try {
      await insertVersionSnapshot({
        supabaseAdmin: admin,
        memorialId,
        snapshotData: updatedMemorial,
        stepsModified: [...MEMORIAL_STEP_IDS],
        createdBy: user.id,
        createdByName: 'Owner',
        changeSummary: `Plan upgraded from ${memorial.mode} to ${targetPlan}.`,
        changeReason: 'plan_upgrade',
      });
    } catch (snapshotError) {
      console.error('[finalize-upgrade][snapshot]', snapshotError);
    }

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'plan_upgraded',
      summary: `Plan upgraded from ${memorial.mode} to ${targetPlan}.`,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      details: {
        previousMode: memorial.mode,
        targetPlan,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Upgrade complete: ${memorial.mode} to ${targetPlan}`,
      previousMode: memorial.mode,
      newMode: targetPlan,
    });
  } catch (error: any) {
    console.error('[finalize-upgrade]', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
