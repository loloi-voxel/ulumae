import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { getRequestIpAddress, trackUserSessionDevice } from '@/lib/sessionDevices';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const {
            user,
            error,
            session,
            sessionId,
            sessionState,
        } = await createAuthenticatedClient();

        if (error || !user) {
            return NextResponse.json({
                error: error?.message || 'Unauthorized',
                session: sessionState,
            }, {
                status: 401,
                headers: {
                    'Cache-Control': 'no-store',
                },
            });
        }

        const trackedSession = await trackUserSessionDevice(supabaseAdmin, {
            userId: user.id,
            sessionId,
            ipAddress: getRequestIpAddress(request),
            userAgent: request.headers.get('user-agent'),
            expiresAt: session?.expires_at
                ? new Date(session.expires_at * 1000).toISOString()
                : null,
        });

        if (trackedSession?.revoked) {
            return NextResponse.json({
                error: 'Session revoked',
                session: trackedSession,
            }, {
                status: 401,
                headers: {
                    'Cache-Control': 'no-store',
                },
            });
        }

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                last_active_at: new Date().toISOString(),
                verification_sent_at: null,
            })
            .eq('id', user.id);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            session: trackedSession || sessionState,
        }, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: any) {
        console.error('Heartbeat error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
