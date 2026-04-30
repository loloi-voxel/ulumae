import { NextRequest, NextResponse } from 'next/server';
import { PLAN_PRICES_USD } from '@/lib/constants';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { getStripeServer, normalizeStripePlan } from '@/lib/stripeServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const memorialId = String(body?.memorialId || '').trim();
    const plan = normalizeStripePlan(body?.plan) ?? 'personal';

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    const access = await requireMemorialAccess({ memorialId });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;

    if (!context.isOwner) {
      return NextResponse.json({ error: 'Only the archive owner can start payment.' }, { status: 403 });
    }

    const { data: memorial, error: memorialError } = await admin
      .from('memorials')
      .select('id, full_name, mode, paid')
      .eq('id', memorialId)
      .single();

    if (memorialError || !memorial) {
      return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
    }

    if (memorial.paid) {
      return NextResponse.json(
        { error: 'This archive has already been activated.', code: 'ALREADY_PAID' },
        { status: 409 }
      );
    }

    if ((plan === 'family' && memorial.mode !== 'family') || (plan === 'personal' && memorial.mode === 'family')) {
      return NextResponse.json({ error: 'Plan does not match the memorial workspace.' }, { status: 400 });
    }

    const expectedAuthType = plan === 'family' ? 'account' : 'individual';
    const { data: authorization } = await admin
      .from('memorial_authorizations')
      .select('id, authorization_type')
      .eq('memorial_id', memorialId)
      .eq('user_id', user.id)
      .eq('authorization_type', expectedAuthType)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (!authorization) {
      return NextResponse.json(
        {
          error: 'Authorization required before payment',
          code: 'LEGAL_AUTH_REQUIRED',
        },
        { status: 403 }
      );
    }

    const amount = PLAN_PRICES_USD[plan];
    if (!amount) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const stripe = getStripeServer();
    const isDraft = memorial.mode === 'draft';
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      description:
        plan === 'family'
          ? `ULUMAE - Family Plan for ${memorial.full_name || 'Memorial Archive'}`
          : isDraft
            ? `ULUMAE - Private Preview to Personal Upgrade for ${memorial.full_name || 'Memorial Archive'}`
            : `ULUMAE - Permanent Archive for ${memorial.full_name || 'Memorial Archive'}`,
      metadata: {
        memorialId,
        userId: user.id,
        plan,
        isDraftUpgrade: isDraft ? 'true' : 'false',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      fullName: memorial.full_name || 'Memorial Archive',
    });
  } catch (error: any) {
    console.error('[create-payment-intent]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
