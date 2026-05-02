import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import {
  getSealStateFromMemorial,
  getSealableMemorialAssets,
} from '@/lib/sealService';

export async function GET(request: NextRequest) {
  try {
    const memorialId = String(request.nextUrl.searchParams.get('memorialId') || '').trim();

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId.' }, { status: 400 });
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: 'view_archive',
    });
    if (!access.ok) return access.response;

    const { admin, context } = access;
    const { memorial, assets } = await getSealableMemorialAssets(admin, memorialId);
    const sealState = getSealStateFromMemorial(memorial);
    const selectedIds = new Set(sealState.selectedAssetIds);
    const selectedBytes = assets
      .filter((asset) => selectedIds.has(asset.id))
      .reduce((sum, asset) => sum + asset.fileSize, 0);

    return NextResponse.json({
      success: true,
      memorial: {
        id: memorial.id,
        userId: memorial.user_id,
        fullName: memorial.full_name,
        mode: memorial.mode,
        deleted: memorial.deleted,
        deletedAt: memorial.deleted_at,
        preservationState: memorial.preservation_state || null,
        preservationDate: memorial.preservation_date || null,
      },
      isOwner: context.role === 'owner',
      sealState,
      selectedBytes,
      assets,
    });
  } catch (error: any) {
    console.error('[seal-state]', error);
    return NextResponse.json(
      { error: error?.message || 'Could not load the seal state.' },
      { status: 500 }
    );
  }
}
