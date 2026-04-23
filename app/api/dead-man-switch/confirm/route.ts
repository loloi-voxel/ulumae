import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { createAuthenticatedClient } from '@/utils/supabase/api';

export async function POST() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { user } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: activeSuccessor, error: successorError }, { data: userRow, error: userError }] =
      await Promise.all([
        supabaseAdmin
          .from('user_successors')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('users')
          .select('dead_mans_switch_enabled')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

    if (successorError) throw successorError;
    if (userError) throw userError;

    if (!activeSuccessor || !userRow?.dead_mans_switch_enabled) {
      return NextResponse.json(
        {
          error:
            'Dead Man Switch confirmation is only available when the feature is active and a successor has accepted.',
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        last_active_at: new Date().toISOString(),
        verification_sent_at: null,
        dead_mans_switch_warning_30_sent_at: null,
        dead_mans_switch_warning_7_sent_at: null,
        dead_mans_switch_warning_1_sent_at: null,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[dead-man-switch:confirm]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
