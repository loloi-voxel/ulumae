import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SessionDeviceRecord {
  id: string;
  user_id: string;
  session_id: string;
  device_label: string;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface SessionIntegrityState {
  sessionId: string | null;
  exists: boolean;
  revoked: boolean;
  revokedAt: string | null;
  expired: boolean;
  expiresAt: string | null;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
}

function compactUserAgent(userAgent?: string | null) {
  return String(userAgent || '').trim().slice(0, 1024);
}

function mapSessionRecord(
  row: SessionDeviceRecord | null,
  sessionId: string | null,
  expiresAt: string | null
): SessionIntegrityState {
  return {
    sessionId,
    exists: Boolean(row),
    revoked: Boolean(row?.revoked_at),
    revokedAt: row?.revoked_at || null,
    expired: Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now()),
    expiresAt,
    deviceLabel: row?.device_label || null,
    ipAddress: row?.ip_address || null,
    userAgent: row?.user_agent || null,
    lastSeenAt: row?.last_seen_at || null,
    createdAt: row?.created_at || null,
  };
}

export function getRequestIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }

  return forwardedFor.split(',')[0]?.trim() || null;
}

export function getDeviceLabelFromUserAgent(userAgent?: string | null) {
  const normalized = compactUserAgent(userAgent);

  if (!normalized) {
    return 'Unknown device';
  }

  if (normalized.includes('iPhone')) return 'iPhone';
  if (normalized.includes('iPad')) return 'iPad';
  if (normalized.includes('Android')) return 'Android device';
  if (normalized.includes('Mac OS X')) return 'Mac';
  if (normalized.includes('Windows')) return 'Windows device';
  if (normalized.includes('Linux')) return 'Linux device';

  return 'Browser session';
}

export async function getSessionDeviceRecord(
  supabaseAdmin: SupabaseClient,
  userId: string,
  sessionId: string | null
): Promise<SessionDeviceRecord | null> {
  if (!sessionId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('user_session_devices')
    .select(
      'id,user_id,session_id,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
    )
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.warn('[session-devices] read failed:', error.message || error);
    return null;
  }

  return (data as SessionDeviceRecord | null) ?? null;
}

export async function getSessionIntegrityState(
  supabaseAdmin: SupabaseClient,
  {
    userId,
    sessionId,
    expiresAt,
  }: {
    userId: string;
    sessionId: string | null;
    expiresAt?: string | null;
  }
): Promise<SessionIntegrityState> {
  const sessionRecord = await getSessionDeviceRecord(
    supabaseAdmin,
    userId,
    sessionId
  );

  return mapSessionRecord(sessionRecord, sessionId, expiresAt ?? null);
}

export async function trackUserSessionDevice(
  supabaseAdmin: SupabaseClient,
  {
    userId,
    sessionId,
    ipAddress,
    userAgent,
    expiresAt,
  }: {
    userId: string;
    sessionId: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt?: string | null;
  }
): Promise<SessionIntegrityState | null> {
  if (!sessionId) {
    return null;
  }

  const existing = await getSessionDeviceRecord(supabaseAdmin, userId, sessionId);
  if (existing?.revoked_at) {
    return mapSessionRecord(existing, sessionId, expiresAt ?? null);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('user_session_devices')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        device_label: getDeviceLabelFromUserAgent(userAgent),
        ip_address: ipAddress ?? existing?.ip_address ?? null,
        user_agent: compactUserAgent(userAgent) || existing?.user_agent || null,
        last_seen_at: now,
      },
      {
        onConflict: 'user_id,session_id',
      }
    )
    .select(
      'id,user_id,session_id,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
    )
    .maybeSingle();

  if (error) {
    console.warn('[session-devices] tracking failed:', error.message || error);
    return existing ? mapSessionRecord(existing, sessionId, expiresAt ?? null) : null;
  }

  return mapSessionRecord(
    (data as SessionDeviceRecord | null) ?? existing,
    sessionId,
    expiresAt ?? null
  );
}

export async function revokeTrackedSession(
  supabaseAdmin: SupabaseClient,
  {
    userId,
    sessionId,
  }: {
    userId: string;
    sessionId: string | null;
  }
) {
  if (!sessionId) {
    return null;
  }

  const revokedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('user_session_devices')
    .update({ revoked_at: revokedAt })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .select(
      'id,user_id,session_id,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SessionDeviceRecord | null) ?? null;
}

export async function revokeTrackedSessionsByScope(
  supabaseAdmin: SupabaseClient,
  {
    userId,
    currentSessionId,
    scope,
  }: {
    userId: string;
    currentSessionId: string | null;
    scope: 'others' | 'global';
  }
) {
  const revokedAt = new Date().toISOString();
  let query = supabaseAdmin
    .from('user_session_devices')
    .update({ revoked_at: revokedAt })
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (scope === 'others' && currentSessionId) {
    query = query.neq('session_id', currentSessionId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}
