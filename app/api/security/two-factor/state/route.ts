import { NextResponse } from 'next/server';
import {
    createAdminClient,
    getTwoFactorState,
} from '@/lib/security/twoFactor';
import { getAuthenticatedTwoFactorContext } from '@/lib/security/twoFactorServer';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { user, sessionId } = await getAuthenticatedTwoFactorContext();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient();
        const state = await getTwoFactorState(supabaseAdmin, user.id, sessionId);

        return NextResponse.json(state, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: any) {
        console.error('[two-factor-state]', error);
        return NextResponse.json(
            { error: error.message || 'Could not load two-factor state.' },
            { status: 500 }
        );
    }
}
