import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const email = String(body?.email || '').trim().toLowerCase();
        const deathCertificateUrl = String(body?.deathCertificateUrl || '').trim();
        const idProofUrl = String(body?.idProofUrl || '').trim();
        const requestNote = String(body?.requestNote || '').trim();

        if (!email || !deathCertificateUrl || !idProofUrl) {
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data: successors, error: successorError } = await supabaseAdmin
            .from('user_successors')
            .select('id')
            .eq('successor_email', email)
            .eq('status', 'accepted')
            .limit(2);

        if (successorError) throw successorError;

        if (!successors || successors.length === 0) {
            return NextResponse.json(
                { error: 'We could not find an active stewardship associated with this email.' },
                { status: 404 }
            );
        }

        if (successors.length > 1) {
            return NextResponse.json(
                {
                    error:
                        'Multiple stewardship designations were found for this email. Please contact support so we can verify the correct account.',
                },
                { status: 409 }
            );
        }

        const successorId = successors[0].id;
        const { data: existingActivation, error: activationLookupError } = await supabaseAdmin
            .from('succession_activations')
            .select('id')
            .eq('successor_id', successorId)
            .eq('status', 'under_review')
            .maybeSingle();

        if (activationLookupError) throw activationLookupError;

        if (existingActivation) {
            return NextResponse.json(
                { error: 'A succession request for this steward is already under review.' },
                { status: 409 }
            );
        }

        const { error: insertError } = await supabaseAdmin
            .from('succession_activations')
            .insert([
                {
                    successor_id: successorId,
                    death_certificate_url: deathCertificateUrl,
                    id_proof_url: idProofUrl,
                    request_note: requestNote || null,
                    status: 'under_review',
                },
            ]);

        if (insertError) throw insertError;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[succession-request]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
