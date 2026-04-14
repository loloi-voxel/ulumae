import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import {
  getMediaPermissionForKind,
  uploadMemorialMediaAsset,
} from '@/lib/mediaManager';
import type { MediaKind, MediaUploadResponse } from '@/types/media';

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false
) {
  const payload: MediaUploadResponse = {
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
    const formData = await request.formData();
    const file = formData.get('file');
    const memorialId = String(formData.get('memorialId') || '').trim();
    const kind = String(formData.get('kind') || '').trim() as MediaKind;
    const metadataRaw = String(formData.get('metadata') || '').trim();
    const contributionId = String(formData.get('contributionId') || '').trim() || null;

    if (!(file instanceof File)) {
      return buildErrorResponse(400, 'missing_file', 'No file was provided.');
    }

    if (!memorialId) {
      return buildErrorResponse(400, 'missing_memorial', 'A memorial is required.');
    }

    if (!kind) {
      return buildErrorResponse(400, 'missing_kind', 'A media kind is required.');
    }

    let metadata: Record<string, unknown> = {};
    if (metadataRaw) {
      try {
        metadata = JSON.parse(metadataRaw);
      } catch {
        return buildErrorResponse(400, 'invalid_metadata', 'Media metadata must be valid JSON.');
      }
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: getMediaPermissionForKind(kind),
    });
    if (!access.ok) return access.response;

    const { admin, user } = access;
    const asset = await uploadMemorialMediaAsset({
      admin,
      memorialId,
      createdBy: user.id,
      kind,
      file,
      metadata,
      contributionId,
    });

    const response: MediaUploadResponse = {
      success: true,
      data: {
        asset,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[media-upload]', error);
    return buildErrorResponse(
      500,
      'upload_failed',
      error?.message || 'The upload could not be completed.',
      true
    );
  }
}
