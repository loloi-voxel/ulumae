import { NextRequest, NextResponse } from 'next/server';

import { requireMemorialAccess } from '@/lib/apiAuth';
import { normalizeMemorialMediaData } from '@/lib/mediaManager';
import type { MemorialData } from '@/types/memorial';

export const dynamic = 'force-dynamic';

function buildMemorialData(record: any): MemorialData {
  return {
    step1: record.step1 || {},
    step2: record.step2 || {},
    step3: record.step3 || {},
    step4: record.step4 || {},
    step5: record.step5 || {},
    step6: record.step6 || {},
    step7: record.step7 || {},
    step8: record.step8 || {},
    step9: record.step9 || { videos: [] },
    currentStep: 1,
    paid: record.paid ?? false,
    lastSaved: record.updated_at || null,
    completedSteps: record.completed_steps || [],
  } as MemorialData;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memorialId: string }> }
) {
  try {
    const { memorialId } = await params;
    const access = await requireMemorialAccess({
      memorialId,
      action: 'view_archive',
    });
    if (!access.ok) return access.response;

    const { admin } = access;

    const { data: memorial, error } = await admin
      .from('memorials')
      .select(
        'id, user_id, mode, paid, updated_at, completed_steps, preservation_state, preservation_date, sealed_at, seal_status, arweave_tx_id, seal_job_id, seal_selected_asset_ids, step1, step2, step3, step4, step5, step6, step7, step8, step9'
      )
      .eq('id', memorialId)
      .single();

    if (error || !memorial) {
      return NextResponse.json({ error: 'Memorial not found.' }, { status: 404 });
    }

    const memorialData = await normalizeMemorialMediaData({
      admin,
      memorialId,
      userId: memorial.user_id,
      data: buildMemorialData(memorial),
    });

    return NextResponse.json({
      success: true,
      memorial: {
        id: memorial.id,
        userId: memorial.user_id,
        mode: memorial.mode,
        paid: memorial.paid ?? false,
        updatedAt: memorial.updated_at,
        completedSteps: memorial.completed_steps || [],
        preservationState: memorial.preservation_state || null,
        preservationDate: memorial.preservation_date || null,
        sealedAt: memorial.sealed_at || null,
        sealStatus: memorial.seal_status || null,
        arweaveTxId: memorial.arweave_tx_id || null,
        sealJobId: memorial.seal_job_id || null,
        sealSelectedAssetIds: Array.isArray(memorial.seal_selected_asset_ids)
          ? memorial.seal_selected_asset_ids
          : [],
      },
      memorialData,
    });
  } catch (error: any) {
    console.error('[memorial-state]', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
