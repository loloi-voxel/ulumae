import { NextRequest, NextResponse } from 'next/server';
import { getGatewayUrls } from '@/lib/arweave/arweaveService';
import { requireMemorialAccess } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
    const memorialId = req.nextUrl.searchParams.get('memorialId');

    if (!memorialId) {
        return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    try {
        const access = await requireMemorialAccess({
            memorialId,
            action: 'view_archive',
        });
        if (!access.ok) return access.response;

        const { admin: supabaseAdmin } = access;

        const { data: memorial, error: memorialError } = await supabaseAdmin
            .from('memorials')
            .select('id, full_name, birth_date, death_date, mode, preservation_date, sealed_at, arweave_tx_id, seal_status')
            .eq('id', memorialId)
            .single();

        if (memorialError || !memorial) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        // Try to get arweave transaction
        let txId = memorial.arweave_tx_id || 'pending';
        let gatewayUrls: string[] = [];
        let confirmedAt: string | null = memorial.preservation_date || memorial.sealed_at || null;
        const { data: tx, error: txError } = await supabaseAdmin
            .from('arweave_transactions')
            .select('tx_id, gateway_urls, confirmed_at')
            .eq('memorial_id', memorialId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (txError) {
            throw txError;
        }

        if (tx) {
            txId = tx.tx_id;
            gatewayUrls = tx.gateway_urls || [];
            confirmedAt = tx.confirmed_at || confirmedAt;
        }

        const isPlaceholder = txId.startsWith('PLACEHOLDER_') || txId === 'pending';

        return NextResponse.json({
            fullName: memorial.full_name || 'Unknown',
            birthDate: memorial.birth_date || '',
            deathDate: memorial.death_date || null,
            preservationDate: confirmedAt,
            transactionId: txId,
            isPlaceholder,
            gatewayUrls: gatewayUrls.length > 0 ? gatewayUrls : (txId && txId !== 'pending' ? getGatewayUrls(txId) : []),
            memorialId,
            planType: memorial.mode || 'personal',
            sealStatus: memorial.seal_status || null,
        });
    } catch (error: any) {
        console.error('Certificate data error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
