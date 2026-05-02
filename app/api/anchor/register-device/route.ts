import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { safeLogMemorialActivity } from '@/lib/activityLog';
import { requireMemorialAccess } from '@/lib/apiAuth';

type RegisterAnchorDeviceBody = {
  memorialId?: string;
  deviceId?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  syncProgressBytes?: number;
  totalBytes?: number;
  status?: 'syncing' | 'synced' | 'error' | 'stale';
  location?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterAnchorDeviceBody;
    const memorialId = body.memorialId || '';

    const access = await requireMemorialAccess({
      memorialId,
      action: 'manage_devices',
    });
    if (!access.ok) return access.response;

    if (access.context.plan !== 'family') {
      return NextResponse.json(
        { error: 'Anchor is only available for Family plan archives.' },
        { status: 403 }
      );
    }

    const { user, admin } = access;
    const now = new Date().toISOString();
    const deviceId = body.deviceId || `dev_${randomUUID()}`;

    const { data: existingDevice, error: existingError } = await admin
      .from('anchor_devices')
      .select('id')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .eq('memorial_id', memorialId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const payload = {
      id: deviceId,
      user_id: user.id,
      memorial_id: memorialId,
      device_name: body.deviceName || 'Legacy Vault',
      browser: body.browser || 'Unknown',
      os: body.os || 'Unknown',
      sync_progress_bytes: Math.max(0, body.syncProgressBytes || 0),
      total_bytes: Math.max(0, body.totalBytes || 0),
      status: body.status || 'syncing',
      location: body.location || null,
      last_sync_at: now,
      updated_at: now,
    };

    const { error } = await admin
      .from('anchor_devices')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    if (!existingDevice) {
      await safeLogMemorialActivity(admin, {
        memorialId,
        action: 'device_registered',
        summary: `${payload.device_name} was registered for local anchoring.`,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        details: {
          deviceId,
          browser: payload.browser,
          os: payload.os,
          location: payload.location,
        },
      });
    }

    return NextResponse.json({
      deviceId,
      status: payload.status,
      location: payload.location,
    });
  } catch (error: any) {
    console.error('[anchor-register-device]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
