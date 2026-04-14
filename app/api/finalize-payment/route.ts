import { NextRequest, NextResponse } from 'next/server';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { MEMORIAL_STEP_IDS, PLAN_PRICES_USD } from '@/lib/constants';
import { getStripeServer, normalizeStripePlan } from '@/lib/stripeServer';
import { insertVersionSnapshot } from '@/lib/versioningServer';

interface FinalizePaymentBody {
  memorialId?: string;
  sessionId?: string;
  paymentIntentId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinalizePaymentBody;
    const memorialId = String(body.memorialId || '').trim();
    const sessionId = String(body.sessionId || '').trim();
    const paymentIntentId = String(body.paymentIntentId || '').trim();

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    if (!sessionId && !paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing verified Stripe session or payment intent.' },
        { status: 400 }
      );
    }

    const access = await requireMemorialAccess({ memorialId });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;

    if (!context.isOwner) {
      return NextResponse.json({ error: 'Only the archive owner can finalize payment.' }, { status: 403 });
    }

    const stripe = getStripeServer();
    let verifiedPlan: 'personal' | 'family' | 'concierge' | null = null;

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Checkout session is not fully paid yet.' }, { status: 400 });
      }
      if (session.metadata?.memorialId !== memorialId) {
        return NextResponse.json({ error: 'Stripe session does not match this archive.' }, { status: 403 });
      }
      verifiedPlan = normalizeStripePlan(session.metadata?.plan);
    } else {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment intent has not succeeded yet.' }, { status: 400 });
      }
      if (paymentIntent.metadata?.memorialId !== memorialId) {
        return NextResponse.json({ error: 'Stripe payment does not match this archive.' }, { status: 403 });
      }
      verifiedPlan = normalizeStripePlan(paymentIntent.metadata?.plan);
    }

    if (!verifiedPlan) {
      return NextResponse.json({ error: 'Could not resolve a valid paid plan.' }, { status: 400 });
    }

    const { data: currentMemorial, error: fetchError } = await admin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (fetchError || !currentMemorial) {
      return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
    }

    if (verifiedPlan === 'family' && currentMemorial.mode !== 'family') {
      return NextResponse.json({ error: 'Family payment must be finalized from a Family workspace.' }, { status: 400 });
    }

    if (verifiedPlan === 'personal' && currentMemorial.mode === 'family') {
      return NextResponse.json({ error: 'Use the upgrade flow for Family workspaces.' }, { status: 400 });
    }

    if (
      currentMemorial.paid &&
      currentMemorial.plan_type === verifiedPlan &&
      !(currentMemorial.mode === 'draft' && verifiedPlan === 'personal')
    ) {
      return NextResponse.json({
        success: true,
        message: 'Payment already finalized.',
        newMode: currentMemorial.mode,
        plan: verifiedPlan,
        upgradedFromDraft: false,
      });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      paid: true,
      payment_confirmed_at: currentMemorial.payment_confirmed_at || now,
      refund_eligible: true,
      plan_type: verifiedPlan,
      amount_paid: PLAN_PRICES_USD[verifiedPlan],
    };

    if (currentMemorial.mode === 'draft' && verifiedPlan === 'personal') {
      updatePayload.mode = 'personal';
    }

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
      return NextResponse.json({ error: 'Memorial not found after update' }, { status: 404 });
    }

    try {
      await insertVersionSnapshot({
        supabaseAdmin: admin,
        memorialId,
        snapshotData: updatedMemorial,
        stepsModified: [...MEMORIAL_STEP_IDS],
        createdBy: user.id,
        createdByName: 'Owner',
        changeSummary:
          currentMemorial.mode === 'draft'
            ? 'Archive activated and moved from Draft to Personal.'
            : 'Archive payment was confirmed and access was activated.',
        changeReason: 'stripe_payment_success',
      });
    } catch (snapshotError) {
      console.error('[finalize-payment][snapshot]', snapshotError);
    }

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'plan_upgraded',
      summary:
        currentMemorial.mode === 'draft'
          ? 'Archive activated and upgraded from Draft to Personal.'
          : `Archive payment was confirmed for the ${verifiedPlan} plan.`,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      details: {
        previousMode: currentMemorial.mode,
        verifiedPlan,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment finalized successfully.',
      newMode: updatedMemorial.mode,
      plan: verifiedPlan,
      upgradedFromDraft: currentMemorial.mode === 'draft' && updatedMemorial.mode === 'personal',
    });
  } catch (error: any) {
    console.error('[finalize-payment]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
