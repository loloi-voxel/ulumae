import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import { mergeMemorialMediaAssetMetadata } from '@/lib/mediaManager';
import { assertMemorialWritable } from '@/lib/sealService';
import type { MediaMetadataUpdateResponse } from '@/types/media';

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false
) {
  const payload: MediaMetadataUpdateResponse = {
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
      assetId?: string;
      metadata?: Record<string, unknown>;
    };

    const memorialId = String(body.memorialId || '').trim();
    const assetId = String(body.assetId || '').trim();
    const metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : null;

    if (!memorialId) {
      return buildErrorResponse(400, 'missing_memorial', 'A memorial is required.');
    }

    if (!assetId) {
      return buildErrorResponse(400, 'missing_asset', 'A media asset is required.');
    }

    if (!metadata) {
      return buildErrorResponse(400, 'invalid_metadata', 'Metadata must be a JSON object.');
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: 'edit_archive',
    });
    if (!access.ok) return access.response;

    const { admin } = access;
    try {
      await assertMemorialWritable(admin, memorialId);
    } catch (error: any) {
      return buildErrorResponse(
        409,
        'memorial_locked',
        error?.message || 'This memorial cannot be modified.'
      );
    }

    const asset = await mergeMemorialMediaAssetMetadata(
      admin,
      memorialId,
      assetId,
      metadata
    );

    const response: MediaMetadataUpdateResponse = {
      success: true,
      data: {
        assetId: asset.id,
        metadata: asset.metadata,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[media-metadata]', error);
    return buildErrorResponse(
      500,
      'metadata_update_failed',
      error?.message || 'The media metadata could not be saved.',
      true
    );
  }
}
