import { NextRequest, NextResponse } from 'next/server';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { uploadToArweave } from '@/lib/arweave/arweaveService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const memorialId = String(body?.memorialId || '').trim();

    if (!memorialId) {
      return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: 'export_archive',
    });
    if (!access.ok) return access.response;

    const { user, admin } = access;
    const { data: memorial, error: memorialError } = await admin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (memorialError || !memorial) {
      return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
    }

    if (!memorial.paid) {
      return NextResponse.json(
        { error: 'Memorial must be paid before preservation.' },
        { status: 400 }
      );
    }

    const transaction = await uploadToArweave(memorialId, memorial);

    const { error: txError } = await admin.from('arweave_transactions').insert({
      memorial_id: memorialId,
      tx_id: transaction.txId,
      status: transaction.status,
      gateway_urls: transaction.gatewayUrls,
      file_count: transaction.fileCount,
      total_bytes: transaction.totalBytes,
      confirmed_at: transaction.confirmedAt,
    });

    if (txError) {
      throw txError;
    }

    await admin
      .from('memorials')
      .update({
        arweave_tx_id: transaction.txId,
        preservation_state: transaction.status === 'confirmed' ? 'preserved' : 'preserving',
      })
      .eq('id', memorialId);

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'memorial_exported',
      summary: 'Preservation upload started for this memorial.',
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      details: {
        txId: transaction.txId,
        status: transaction.status,
      },
    });

    return NextResponse.json({
      txId: transaction.txId,
      status: transaction.status,
      gatewayUrls: transaction.gatewayUrls,
      fileCount: transaction.fileCount,
      totalBytes: transaction.totalBytes,
      confirmedAt: transaction.confirmedAt,
    });
  } catch (error: any) {
    console.error('[arweave-upload]', error);
    const message = error?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: message.includes('placeholder') ? 503 : 500 });
  }
}
