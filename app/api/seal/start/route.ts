import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import { inngest } from '@/lib/inngest/client';
import { startMemorialSealRequest } from '@/lib/sealService';

export async function POST(request: NextRequest) {
  try {
    const access = await requireMemorialAccess({
      memorialId: String((await request.clone().json())?.memorialId || '').trim(),
      action: 'edit_archive',
    });
    if (!access.ok) return access.response;

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
      { status: message.includes('cannot') || message.includes('already') ? 409 : 500 }
    );
  }
}
