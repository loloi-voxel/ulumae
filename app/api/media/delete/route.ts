import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import {
  hardDeleteMemorialMediaAssets,
  restoreMemorialMediaAssets,
  softDeleteMemorialMediaAssets,
} from '@/lib/mediaManager';
import { assertMemorialWritable } from '@/lib/sealService';
import type { MediaDeleteResponse } from '@/types/media';

type DeleteMode = 'soft' | 'restore' | 'hard';

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false
) {
  const payload: MediaDeleteResponse = {
    success: false,
    error: {
      code,
      message,
      retryable,
    },
  };

  return NextResponse.json(payload, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      memorialId?: string;
      assetIds?: string[];
      mode?: DeleteMode;
    };

    const memorialId = String(body.memorialId || '').trim();
    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((value) => typeof value === 'string' && value.trim())
      : [];
    const mode: DeleteMode = body.mode === 'restore' || body.mode === 'hard'
      ? body.mode
      : 'soft';

    if (!memorialId) {
      return buildErrorResponse(400, 'missing_memorial', 'A memorial is required.');
    }

    if (assetIds.length === 0) {
      return buildErrorResponse(400, 'missing_assets', 'Select at least one media item.');
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: 'edit_archive',
    });
    if (!access.ok) return access.response;

    const { admin, user } = access;
    try {
      await assertMemorialWritable(admin, memorialId);
    } catch (error: any) {
      return buildErrorResponse(
        409,
        'memorial_locked',
        error?.message || 'This memorial cannot be modified.'
      );
    }

    if (mode === 'restore') {
      await restoreMemorialMediaAssets(admin, memorialId, assetIds);
    } else if (mode === 'hard') {
      await hardDeleteMemorialMediaAssets(admin, memorialId, assetIds);
    } else {
      await softDeleteMemorialMediaAssets(admin, memorialId, assetIds, user.id);
    }

    const response: MediaDeleteResponse = {
      success: true,
      data: {
        assetIds,
        mode,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[media-delete]', error);
    return buildErrorResponse(
      500,
      'delete_failed',
      error?.message || 'The media change could not be saved.',
      true
    );
  }
}
