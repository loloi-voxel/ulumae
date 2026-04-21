import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSessionFingerprint } from '@/lib/sessionFingerprint';

export interface SessionDeviceRecord {
  id: string;
  user_id: string;
  session_id: string;
  fingerprint: string | null;
  device_label: string;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface SessionIntegrityState {
  sessionId: string | null;
  fingerprint: string | null;
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

function normalizeIpAddress(ipAddress?: string | null) {
  const normalized = String(ipAddress || '').trim().slice(0, 128);
  return normalized || null;
}

function mapSessionRecord(
  row: SessionDeviceRecord | null,
  sessionId: string | null,
  expiresAt: string | null
): SessionIntegrityState {
  return {
    sessionId,
    fingerprint: row?.fingerprint || null,
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
      'id,user_id,session_id,fingerprint,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
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

async function getReusableSessionDeviceRecord(
  supabaseAdmin: SupabaseClient,
  {
    userId,
    fingerprint,
    userAgent,
    ipAddress,
  }: {
    userId: string;
    fingerprint: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  }
) {
  if (!fingerprint) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('user_session_devices')
    .select(
      'id,user_id,session_id,fingerprint,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
    )
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint)
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false });

  if (error) {
    console.warn('[session-devices] fingerprint read failed:', error.message || error);
    return null;
  }

  return (
    (data as SessionDeviceRecord[] | null)?.find(
      (record) =>
        normalizeIpAddress(record.ip_address) === ipAddress &&
        (compactUserAgent(record.user_agent) || null) === userAgent
    ) || null
  );
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
    fingerprint,
    ipAddress,
    userAgent,
    expiresAt,
  }: {
    userId: string;
    sessionId: string | null;
    fingerprint?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt?: string | null;
  }
): Promise<SessionIntegrityState | null> {
  if (!sessionId) {
    return null;
  }

  const normalizedFingerprint = normalizeSessionFingerprint(fingerprint);
  const normalizedUserAgent = compactUserAgent(userAgent) || null;
  const normalizedIpAddress = normalizeIpAddress(ipAddress);

  const existingBySession = await getSessionDeviceRecord(supabaseAdmin, userId, sessionId);
  if (existingBySession?.revoked_at) {
    return mapSessionRecord(existingBySession, sessionId, expiresAt ?? null);
  }

  const reusableRecord =
    existingBySession ||
    (await getReusableSessionDeviceRecord(supabaseAdmin, {
      userId,
      fingerprint: normalizedFingerprint,
      userAgent: normalizedUserAgent,
      ipAddress: normalizedIpAddress,
    }));

  const now = new Date().toISOString();

  if (reusableRecord?.id) {
    const { data, error } = await supabaseAdmin
      .from('user_session_devices')
      .update({
        session_id: sessionId,
        fingerprint: normalizedFingerprint ?? reusableRecord.fingerprint ?? null,
        device_label: getDeviceLabelFromUserAgent(normalizedUserAgent),
        ip_address: normalizedIpAddress ?? reusableRecord.ip_address ?? null,
        user_agent: normalizedUserAgent ?? reusableRecord.user_agent ?? null,
        last_seen_at: now,
      })
      .eq('id', reusableRecord.id)
      .select(
        'id,user_id,session_id,fingerprint,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
      )
      .maybeSingle();

    if (error) {
      console.warn('[session-devices] reuse failed:', error.message || error);
      return mapSessionRecord(reusableRecord, sessionId, expiresAt ?? null);
    }

    return mapSessionRecord(
      (data as SessionDeviceRecord | null) ?? reusableRecord,
      sessionId,
      expiresAt ?? null
    );
  }

  const { data, error } = await supabaseAdmin
    .from('user_session_devices')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        fingerprint: normalizedFingerprint,
        device_label: getDeviceLabelFromUserAgent(normalizedUserAgent),
        ip_address: normalizedIpAddress,
        user_agent: normalizedUserAgent,
        last_seen_at: now,
      },
      {
        onConflict: 'user_id,session_id',
      }
    )
    .select(
      'id,user_id,session_id,fingerprint,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
    )
    .maybeSingle();

  if (error) {
    console.warn('[session-devices] tracking failed:', error.message || error);
    return existingBySession
      ? mapSessionRecord(existingBySession, sessionId, expiresAt ?? null)
      : null;
  }

  return mapSessionRecord(
    (data as SessionDeviceRecord | null) ?? existingBySession,
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
      'id,user_id,session_id,fingerprint,device_label,ip_address,user_agent,last_seen_at,revoked_at,created_at'
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
