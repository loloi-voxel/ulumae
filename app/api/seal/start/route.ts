import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import { inngest } from '@/lib/inngest/client';
import { startMemorialSealRequest } from '@/lib/sealService';

function getSealStartStatus(message: string) {
  if (
    message.includes('Missing memorialId') ||
    message.includes('required') ||
    message.includes('available only') ||
    message.includes('Create the memorial')
  ) {
    return 400;
  }

  if (message.includes('Unauthorized')) {
    return 401;
  }

  if (message.includes('Forbidden')) {
    return 403;
  }

  if (message.includes('Only the memorial owner')) {
    return 403;
  }

  if (message.includes('not found')) {
    return 404;
  }

  if (
    message.includes('already') ||
    message.includes('currently') ||
    message.includes('cannot be modified') ||
    message.includes('exceeds')
  ) {
    return 409;
  }

  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const memorialId = String(body?.memorialId || '').trim();
    const selectedAssetIds = Array.isArray(body?.selectedAssetIds)
      ? body.selectedAssetIds.filter((value: unknown): value is string =>
          typeof value === 'string' && value.trim().length > 0
        )
      : [];
    const certificatePassword = String(body?.certificatePassword || '').trim();

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId.' }, { status: 400 });
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: 'edit_archive',
    });
    if (!access.ok) return access.response;

    if (!certificatePassword) {
      return NextResponse.json(
        { error: 'A certificate password is required to seal this memorial.' },
        { status: 400 }
      );
    }

    const { admin, user } = access;
    const result = await startMemorialSealRequest({
      admin,
      memorialId,
      user,
      selectedAssetIds,
      certificatePassword,
      sendEvent: async (payload) => {
        const response = await inngest.send({
          name: 'memorial/seal.requested',
          data: payload,
        });

        const ids = Array.isArray((response as any)?.ids)
          ? ((response as any).ids as string[])
          : [];

        return {
          id: ids[0] || (response as any)?.id || null,
        };
      },
    });

    return NextResponse.json({
      success: true,
      sealState: result.sealState,
      assets: result.assets,
    });
  } catch (error: any) {
    console.error('[seal-start]', error);
    const message = error?.message || 'Could not start the seal process.';
    return NextResponse.json(
      { error: message },
      { status: getSealStartStatus(message) }
    );
  }
}
