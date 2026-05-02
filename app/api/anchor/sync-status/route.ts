import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';

type AnchorSyncUpdateBody = {
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

export async function GET(req: NextRequest) {
  const memorialId = req.nextUrl.searchParams.get('memorialId') || '';

  try {
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
    const { data, error } = await admin
      .from('anchor_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('memorial_id', memorialId)
      .order('last_sync_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      devices: (data || []).map((device) => ({
        id: device.id,
        deviceName: device.device_name,
        browser: device.browser,
        os: device.os,
        syncProgressBytes: device.sync_progress_bytes,
        totalBytes: device.total_bytes,
        lastSyncAt: device.last_sync_at,
        status: device.status,
        location: device.location || null,
      })),
    });
  } catch (error: any) {
    console.error('[anchor-sync-status][GET]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnchorSyncUpdateBody;
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
    const deviceId = body.deviceId || '';

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }

    const now = new Date().toISOString();
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[anchor-sync-status][POST]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
