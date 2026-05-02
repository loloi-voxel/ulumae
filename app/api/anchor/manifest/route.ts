import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import { buildAnchorManifest } from '@/lib/anchor/manifestBuilder';
import { getMemorialRenderData } from '@/lib/memorialRenderData';

export async function POST(request: NextRequest) {
  try {
    const { memorialId } = (await request.json()) as { memorialId?: string };

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

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

    const renderData = await getMemorialRenderData(access.admin, memorialId);
    const manifest = buildAnchorManifest(renderData);

    return NextResponse.json(manifest, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[anchor-manifest]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
