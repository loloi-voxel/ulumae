import { NextRequest, NextResponse } from 'next/server';
import { PLAN_PRICES_USD } from '@/lib/constants';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { getStripeServer, normalizeStripePlan } from '@/lib/stripeServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const memorialId = String(body?.memorialId || '').trim();
    const plan = normalizeStripePlan(body?.plan);

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    if (plan === 'concierge') {
      return NextResponse.json(
        {
          error: 'Concierge is handled through the request flow, not direct self-checkout.',
          redirectUrl: '/concierge/request',
        },
        { status: 400 }
      );
    }

    const access = await requireMemorialAccess({ memorialId });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;

    if (!context.isOwner) {
      return NextResponse.json({ error: 'Only the archive owner can start checkout.' }, { status: 403 });
    }

    const { data: memorial, error: memorialError } = await admin
      .from('memorials')
      .select('id, mode, paid')
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

    const memorialMode = memorial.mode === 'family' ? 'family' : memorial.mode === 'draft' ? 'draft' : 'personal';
    const isDraftUpgrade = memorialMode === 'draft' && plan === 'personal';

    if ((plan === 'family' && memorialMode !== 'family') || (plan === 'personal' && memorialMode === 'family')) {
      return NextResponse.json({ error: 'Plan does not match the memorial workspace.' }, { status: 400 });
    }

    const expectedType = plan === 'family' ? 'account' : 'individual';
    const { data: authorization, error: authError } = await admin
      .from('memorial_authorizations')
      .select('id, authorization_type')
      .eq('memorial_id', memorialId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (authError || !authorization || authorization.authorization_type !== expectedType) {
      return NextResponse.json(
        {
          error: 'Authorization required',
          code: 'LEGAL_AUTH_REQUIRED',
          redirectUrl: `/authorization/${memorialId}`,
        },
        { status: 403 }
      );
    }

    const stripe = getStripeServer();
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name:
                plan === 'family'
                  ? 'ULUMAE - Family Plan'
                  : isDraftUpgrade
                    ? 'ULUMAE - Draft to Personal Upgrade'
                    : 'ULUMAE - Personal Plan',
              description:
                plan === 'family'
                  ? 'Permanent family archive activation'
                  : isDraftUpgrade
                    ? 'Activate your draft memorial with permanent access'
                    : 'Permanent archival for your memorial',
            },
            unit_amount: PLAN_PRICES_USD[plan] * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        memorialId,
        userId: user.id,
        plan,
        isDraftUpgrade: isDraftUpgrade ? 'true' : 'false',
      },
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&id=${memorialId}&plan=${plan}`,
      cancel_url: isDraftUpgrade
        ? `${origin}/dashboard/draft/${user.id}`
        : `${origin}/create?id=${memorialId}&mode=${memorialMode}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[create-checkout]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
