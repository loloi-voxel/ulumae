import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';

const MAX_LENGTH = 80;

export async function GET() {
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('users')
        .select('family_display_name')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ name: data?.family_display_name ?? null });
}

export async function PATCH(request: NextRequest) {
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: { name?: unknown };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const raw = typeof payload.name === 'string' ? payload.name.trim() : '';
    const next = raw.length === 0 ? null : raw.slice(0, MAX_LENGTH);

    const { error } = await supabase
        .from('users')
        .update({ family_display_name: next })
        .eq('id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ name: next });
}
