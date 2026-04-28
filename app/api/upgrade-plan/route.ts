// app/api/upgrade-plan/route.ts
// Handles plan upgrades: Personal → Family, Family → Concierge
// Calculates differential pricing so users only pay the difference.
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { PLAN_PRICES_USD } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { getStripeServer } from '@/lib/stripeServer';

const stripe = getStripeServer();

const PLAN_PRICES = PLAN_PRICES_USD;

const UPGRADE_PATHS: Record<string, string> = {
    personal: 'family',
    family: 'concierge',
};

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = user.id;

        const { targetPlan } = await request.json();

        if (!targetPlan) {
            return NextResponse.json({ error: 'Missing targetPlan' }, { status: 400 });
        }

        if (!PLAN_PRICES[targetPlan]) {
            return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 });
        }

        // Fetch user's current plan info from memorials
        const { data: memorials, error: fetchError } = await supabaseAdmin
            .from('memorials')
            .select('id, mode, paid, payment_confirmed_at')
            .eq('user_id', userId)
            .eq('paid', true)
            .order('payment_confirmed_at', { ascending: false })
            .limit(1);

        if (fetchError || !memorials || memorials.length === 0) {
            return NextResponse.json({ error: 'No paid plan found for this user' }, { status: 404 });
        }

        const currentMemorial = memorials[0];
        const currentPlan = currentMemorial.mode; // 'personal' or 'family'

        // Validate upgrade path
        if (UPGRADE_PATHS[currentPlan] !== targetPlan) {
            return NextResponse.json({
                error: `Cannot upgrade from ${currentPlan} to ${targetPlan}. Valid upgrade: ${currentPlan} → ${UPGRADE_PATHS[currentPlan]}`,
            }, { status: 400 });
        }

        // Calculate differential
        const currentPrice = PLAN_PRICES[currentPlan] || 0;
        const targetPrice = PLAN_PRICES[targetPlan];
        const differentialAmount = targetPrice - currentPrice;

        if (differentialAmount <= 0) {
            return NextResponse.json({ error: 'No payment required for this change' }, { status: 400 });
        }

        const origin = request.headers.get('origin') || 'http://localhost:3000';

        // For Concierge upgrade, we need a different flow
        if (targetPlan === 'concierge') {
            // Concierge uses 30/40/30 payment split on the differential
            // First payment: 30% of $3,360 = $1,008
            const firstPayment = Math.round(differentialAmount * 0.3);

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'ULUMAE — Family → Concierge Upgrade (30% deposit)',
                            description: `Upgrade deposit. Remaining payments: 40% at private preview delivery, 30% at final validation.`,
                        },
                        unit_amount: firstPayment * 100,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                metadata: {
                    userId,
                    memorialId: currentMemorial.id,
                    upgradeFrom: currentPlan,
                    upgradeTo: targetPlan,
                    totalDifferential: differentialAmount.toString(),
                    paymentPhase: 'deposit_30',
                },
                success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&id=${currentMemorial.id}&plan=${targetPlan}&upgrade=true`,
                cancel_url: `${origin}/dashboard/${currentPlan}/${userId}`,
            });

            return NextResponse.json({
                url: session.url,
                currentPlan,
                targetPlan,
                currentPrice,
                targetPrice,
                differentialAmount,
                firstPayment,
                paymentStructure: '30% now / 40% at private preview delivery / 30% at final validation',
            });
        }

        // Personal → Family: simple single payment of the difference
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `ULUMAE — ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} → ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} Upgrade`,
                        description: `Upgrade from ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} ($${currentPrice.toLocaleString()}) to ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} ($${targetPrice.toLocaleString()}). You pay only the difference.`,
                    },
                    unit_amount: differentialAmount * 100,
                },
                quantity: 1,
            }],
            mode: 'payment',
            metadata: {
                userId,
                memorialId: currentMemorial.id,
                upgradeFrom: currentPlan,
                upgradeTo: targetPlan,
                differentialAmount: differentialAmount.toString(),
            },
            success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&id=${currentMemorial.id}&plan=${targetPlan}&upgrade=true`,
            cancel_url: `${origin}/dashboard/${currentPlan}/${userId}`,
        });

        return NextResponse.json({
            url: session.url,
            currentPlan,
            targetPlan,
            currentPrice,
            targetPrice,
            differentialAmount,
        });
    } catch (error: any) {
        console.error('Upgrade error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: Calculate upgrade info without creating a payment session
export async function GET(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = user.id;

        const { data: memorials } = await supabaseAdmin
            .from('memorials')
            .select('id, mode, paid, payment_confirmed_at')
            .eq('user_id', userId)
            .eq('paid', true)
            .order('payment_confirmed_at', { ascending: false })
            .limit(1);

        if (!memorials || memorials.length === 0) {
            return NextResponse.json({ upgradeable: false, reason: 'No paid plan found' });
        }

        const currentPlan = memorials[0].mode;
        const nextPlan = UPGRADE_PATHS[currentPlan];

        if (!nextPlan) {
            return NextResponse.json({ upgradeable: false, reason: 'Already on highest plan' });
        }

        const currentPrice = PLAN_PRICES[currentPlan] || 0;
        const nextPrice = PLAN_PRICES[nextPlan];
        const differentialAmount = nextPrice - currentPrice;

        return NextResponse.json({
            upgradeable: true,
            currentPlan,
            nextPlan,
            currentPrice,
            nextPrice,
            differentialAmount,
            memorialId: memorials[0].id,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
