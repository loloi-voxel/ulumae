import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { MEMORIAL_STEP_IDS, PLAN_PRICES_USD } from '@/lib/constants';
import { getStripeServer, normalizeStripePlan } from '@/lib/stripeServer';
import { insertVersionSnapshot } from '@/lib/versioningServer';

const stripe = getStripeServer();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing stripe signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error('[stripe-webhook][signature]', error);
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const source = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent;
    const memorialId = source.metadata?.memorialId;
    const targetPlan = normalizeStripePlan(source.metadata?.upgradeTo || source.metadata?.plan);

    if (!memorialId || !targetPlan) {
      console.warn('[stripe-webhook] skipped event without memorial metadata', event.id);
      return NextResponse.json({ received: true });
    }

    const { data: currentMemorial, error: memorialError } = await supabaseAdmin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (memorialError || !currentMemorial) {
      console.error('[stripe-webhook] memorial not found', memorialId, memorialError);
      return NextResponse.json({ received: true });
    }

    const isUpgrade = Boolean(source.metadata?.upgradeTo);
    const alreadyApplied =
      currentMemorial.paid &&
      currentMemorial.plan_type === targetPlan &&
      currentMemorial.mode === targetPlan;

    if (alreadyApplied) {
      return NextResponse.json({ received: true });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      paid: true,
      payment_confirmed_at: currentMemorial.payment_confirmed_at || now,
      refund_eligible: true,
      plan_type: targetPlan,
      amount_paid: PLAN_PRICES_USD[targetPlan],
    };

    if (isUpgrade) {
      updatePayload.mode = targetPlan;
      updatePayload.upgraded_from = currentMemorial.mode;
      updatePayload.upgraded_at = now;
    } else if (targetPlan === 'family') {
      updatePayload.mode = 'family';
      if (currentMemorial.mode === 'personal') {
        updatePayload.upgraded_from = 'personal';
        updatePayload.upgraded_at = now;
      }
    } else if (currentMemorial.mode === 'draft') {
      updatePayload.mode = 'personal';
    } else {
      updatePayload.mode = 'personal';
    }

    const { error: updateError } = await supabaseAdmin
      .from('memorials')
      .update(updatePayload)
      .eq('id', memorialId);

    if (updateError) {
      throw updateError;
    }

    const { data: updatedMemorial, error: refetchError } = await supabaseAdmin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (refetchError || !updatedMemorial) {
      throw refetchError || new Error('Memorial not found after webhook update.');
    }

    try {
      await insertVersionSnapshot({
        supabaseAdmin,
        memorialId,
        snapshotData: updatedMemorial,
        stepsModified: [...MEMORIAL_STEP_IDS],
        createdBy: currentMemorial.user_id || null,
        createdByName: 'System (Stripe)',
        changeSummary: isUpgrade
          ? `Plan upgraded from ${currentMemorial.mode} to ${targetPlan}.`
          : currentMemorial.mode === 'draft'
            ? 'Archive activated and moved from Draft to Personal.'
            : `Archive payment was confirmed for the ${targetPlan} plan.`,
        changeReason: 'stripe_payment_success',
      });
    } catch (snapshotError) {
      console.error('[stripe-webhook][snapshot]', snapshotError);
    }

    await safeLogMemorialActivity(supabaseAdmin, {
      memorialId,
      action: 'plan_upgraded',
      summary: isUpgrade
        ? `Stripe confirmed an upgrade from ${currentMemorial.mode} to ${targetPlan}.`
        : `Stripe confirmed payment for the ${targetPlan} plan.`,
      actorUserId: currentMemorial.user_id || null,
      actorEmail: null,
      details: {
        stripeEventId: event.id,
        previousMode: currentMemorial.mode,
        targetPlan,
      },
    });
  } catch (error: any) {
    console.error('[stripe-webhook]', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
