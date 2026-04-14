import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const verificationToken = String(token || '').trim();

        if (!verificationToken) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('user_successors')
            .select('id, status, successor_name, relationship')
            .eq('verification_token', verificationToken)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: 'Stewardship invitation not found or expired.' }, { status: 404 });
        }

        return NextResponse.json({
            successorName: data.successor_name,
            relationship: data.relationship,
            status: data.status,
            alreadyAccepted: data.status === 'accepted',
        });
    } catch (error: any) {
        console.error('[succession-accept:get]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const verificationToken = String(token || '').trim();

        if (!verificationToken) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data: successor, error } = await supabaseAdmin
            .from('user_successors')
            .select('id, status')
            .eq('verification_token', verificationToken)
            .maybeSingle();

        if (error) throw error;
        if (!successor) {
            return NextResponse.json({ error: 'Stewardship invitation not found or expired.' }, { status: 404 });
        }

        if (successor.status === 'accepted') {
            return NextResponse.json({ success: true, alreadyAccepted: true });
        }

        const { error: updateError } = await supabaseAdmin
            .from('user_successors')
            .update({ status: 'accepted' })
            .eq('id', successor.id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, alreadyAccepted: false });
    } catch (error: any) {
        console.error('[succession-accept:post]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
