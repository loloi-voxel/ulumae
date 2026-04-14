import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
    const supabaseAdmin = getSupabaseAdmin();
    const memorialId = req.nextUrl.searchParams.get('memorialId');

    if (!memorialId) {
        return NextResponse.json({ error: 'Missing memorialId' }, { status: 400 });
    }

    try {
        const { user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (
            !hasPermission(permission.context, 'view_activity') &&
            !hasPermission(permission.context, 'export_archive')
        ) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: memorial } = await supabaseAdmin
            .from('memorials')
            .select('id, full_name, birth_date, death_date, plan_type, payment_confirmed_at')
            .eq('id', memorialId)
            .single();

        if (!memorial) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        // Try to get arweave transaction
        let txId = 'pending';
        let gatewayUrls: string[] = [];
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
        }

        const isPlaceholder = txId.startsWith('PLACEHOLDER_') || txId === 'pending';

        return NextResponse.json({
            fullName: memorial.full_name || 'Unknown',
            birthDate: memorial.birth_date || '',
            deathDate: memorial.death_date || null,
            preservationDate: memorial.payment_confirmed_at || null,
            transactionId: txId,
            isPlaceholder,
            gatewayUrls,
            memorialId,
            planType: memorial.plan_type || 'personal',
        });
    } catch (error: any) {
        console.error('Certificate data error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
