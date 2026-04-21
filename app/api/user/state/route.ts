import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { getRequestIpAddress, trackUserSessionDevice } from '@/lib/sessionDevices';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { getSessionFingerprintFromRequest } from '@/lib/sessionFingerprint';

export async function GET(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            console.error('[UserState] Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL env vars');
            return NextResponse.json({
                authenticated: false,
                user: null,
                plan: null,
                archives: [],
                error: 'Server configuration error',
            }, { status: 500 });
        }

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
                authenticated: false,
                user: null,
                plan: null,
                archives: [],
                session: sessionState,
                error: error?.message || null,
            }, {
                status: sessionState.revoked || sessionState.expired ? 401 : 200,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Pragma': 'no-cache',
                },
            });
        }

        let trackedSession = sessionState;
        try {
            trackedSession = (await trackUserSessionDevice(supabaseAdmin, {
                userId: user.id,
                sessionId,
                fingerprint: getSessionFingerprintFromRequest(request),
                ipAddress: getRequestIpAddress(request),
                userAgent: request.headers.get('user-agent'),
                expiresAt: session?.expires_at
                    ? new Date(session.expires_at * 1000).toISOString()
                    : null,
            })) || sessionState;
        } catch (trackErr: any) {
            console.warn('[UserState] session device tracking skipped:', trackErr.message || trackErr);
        }

        const { data: memorials, error: memError } = await supabaseAdmin
            .from('memorials')
            .select('id, mode, paid, payment_confirmed_at, status, full_name, profile_photo_url, deleted, deleted_at, updated_at, created_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (memError) {
            console.error('[UserState] Memorial fetch error:', memError);
        }

        const allMemorials = memorials || [];
        const activeMemorials = allMemorials.filter(m => !m.deleted);
        const allPaidMemorials = allMemorials.filter(m => m.paid);

        let currentPlan: 'none' | 'draft' | 'personal' | 'family' | 'concierge' = 'none';
        if (allPaidMemorials.some(m => m.mode === 'concierge')) {
            currentPlan = 'concierge';
        } else if (allPaidMemorials.some(m => m.mode === 'family')) {
            currentPlan = 'family';
        } else if (allPaidMemorials.some(m => m.mode === 'personal')) {
            currentPlan = 'personal';
        } else if (activeMemorials.length > 0) {
            currentPlan = 'draft';
        }

        if (currentPlan === 'none' || currentPlan === 'draft') {
            const { data: userRow } = await supabaseAdmin
                .from('users')
                .select('highest_plan')
                .eq('id', user.id)
                .single();

            if (userRow?.highest_plan) {
                const planRank: Record<string, number> = { none: 0, draft: 1, personal: 2, family: 3, concierge: 4 };
                const savedRank = planRank[userRow.highest_plan] ?? 0;
                const currentRank = planRank[currentPlan] ?? 0;
                if (savedRank > currentRank) {
                    currentPlan = userRow.highest_plan as typeof currentPlan;
                }
            }
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
            },
            plan: currentPlan,
            hasPaid: allPaidMemorials.length > 0 || (currentPlan !== 'none' && currentPlan !== 'draft'),
            archives: activeMemorials.map(m => ({
                id: m.id,
                mode: m.mode,
                paid: m.paid,
                status: m.status,
                fullName: m.full_name,
                profilePhotoUrl: m.profile_photo_url,
                updatedAt: m.updated_at,
                paymentConfirmedAt: m.payment_confirmed_at,
            })),
            deletedArchives: allMemorials.filter(m => m.deleted).map(m => ({
                id: m.id,
                fullName: m.full_name,
                deletedAt: m.deleted_at,
            })),
            session: trackedSession,
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
            },
        });
    } catch (err: any) {
        console.error('[UserState] Error:', err);
        return NextResponse.json({
            authenticated: false,
            user: null,
            plan: null,
            archives: [],
            error: 'Internal error',
        }, { status: 500 });
    }
}
