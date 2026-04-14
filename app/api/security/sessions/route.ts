import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import {
  getRequestIpAddress,
  revokeTrackedSession,
  revokeTrackedSessionsByScope,
  trackUserSessionDevice,
} from '@/lib/sessionDevices';
import { SESSION_ACTIVITY_STALE_HOURS } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/apiAuth';

type SessionActionType = 'session' | 'anchor' | 'scope';

export async function GET(request: NextRequest) {
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
      return NextResponse.json(
        { error: error?.message || 'Unauthorized', session: sessionState },
        { status: 401 }
      );
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

    const [sessionRowsResult, anchorRowsResult] = await Promise.all([
      supabaseAdmin
        .from('user_session_devices')
        .select('id, session_id, device_label, ip_address, user_agent, last_seen_at, created_at, revoked_at')
        .eq('user_id', user.id)
        .order('last_seen_at', { ascending: false }),
      supabaseAdmin
        .from('anchor_devices')
        .select('id, memorial_id, device_name, browser, os, last_sync_at, status, created_at')
        .eq('user_id', user.id)
        .order('last_sync_at', { ascending: false }),
    ]);

    if (sessionRowsResult.error) {
      throw sessionRowsResult.error;
    }

    if (anchorRowsResult.error) {
      throw anchorRowsResult.error;
    }

    const staleThreshold = Date.now() - SESSION_ACTIVITY_STALE_HOURS * 60 * 60 * 1000;

    return NextResponse.json(
      {
        currentSessionId: sessionId,
        currentSession: trackedSession || sessionState,
        sessions: (sessionRowsResult.data || []).map((tracked) => ({
          id: tracked.id,
          sessionId: tracked.session_id,
          deviceLabel: tracked.device_label,
          ipAddress: tracked.ip_address,
          userAgent: tracked.user_agent,
          lastSeenAt: tracked.last_seen_at,
          createdAt: tracked.created_at,
          revokedAt: tracked.revoked_at,
          isCurrent: tracked.session_id === sessionId,
          isStale:
            !!tracked.last_seen_at &&
            new Date(tracked.last_seen_at).getTime() < staleThreshold,
        })),
        devices: (anchorRowsResult.data || []).map((device) => ({
          id: device.id,
          memorialId: device.memorial_id,
          deviceName: device.device_name,
          browser: device.browser,
          os: device.os,
          lastSyncAt: device.last_sync_at,
          status: device.status,
          createdAt: device.created_at,
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('[security-sessions]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const {
      supabase,
      user,
      error,
      session,
      sessionId,
      sessionState,
    } = await createAuthenticatedClient();

    if (error || !user) {
      return NextResponse.json(
        { error: error?.message || 'Unauthorized', session: sessionState },
        { status: 401 }
      );
    }

    const {
      targetId,
      type,
      scope,
    } = (await request.json()) as {
      targetId?: string;
      type?: SessionActionType;
      scope?: 'others' | 'global';
    };

    if (type === 'scope') {
      if (scope !== 'others' && scope !== 'global') {
        return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
      }

      await revokeTrackedSessionsByScope(supabaseAdmin, {
        userId: user.id,
        currentSessionId: sessionId,
        scope,
      });

      let trustedSessionsQuery = supabaseAdmin
        .from('user_two_factor_trusted_sessions')
        .delete()
        .eq('user_id', user.id);

      if (scope === 'others' && sessionId) {
        trustedSessionsQuery = trustedSessionsQuery.neq('session_id', sessionId);
      }

      await trustedSessionsQuery;

      return NextResponse.json({ success: true });
    }

    if (!targetId || !type || !['session', 'anchor'].includes(type)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (type === 'session') {
      await revokeTrackedSession(supabaseAdmin, {
        userId: user.id,
        sessionId: targetId,
      });

      await supabaseAdmin
        .from('user_two_factor_trusted_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', targetId);

      const isCurrentSession = targetId === sessionId;
      if (isCurrentSession) {
        if (session?.access_token) {
          await supabase.auth.admin.signOut(session.access_token, 'local');
        }
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }

      return NextResponse.json({
        success: true,
        signedOutCurrentSession: isCurrentSession,
      });
    }

    const { error: revokeError } = await supabaseAdmin
      .from('anchor_devices')
      .update({ status: 'revoked' })
      .eq('user_id', user.id)
      .eq('id', targetId);

    if (revokeError) throw revokeError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[security-sessions-revoke]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
