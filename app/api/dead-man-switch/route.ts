import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import {
  formatDeadManSwitchDelayLabel,
  getDeadManSwitchComputedState,
  isValidDeadManSwitchDelay,
} from '@/lib/deadManSwitch';
import { createAuthenticatedClient } from '@/utils/supabase/api';

function buildPayload(userRow: any, activeSuccessor: any, latestSuccessor: any) {
  const computed = getDeadManSwitchComputedState({
    enabled: Boolean(userRow?.dead_mans_switch_enabled),
    delayMonths: userRow?.dead_mans_switch_delay_months ?? 12,
    lastActiveAt: userRow?.last_active_at || null,
    createdAt: userRow?.created_at || null,
    warning30SentAt: userRow?.dead_mans_switch_warning_30_sent_at || null,
    warning7SentAt: userRow?.dead_mans_switch_warning_7_sent_at || null,
    warning1SentAt: userRow?.dead_mans_switch_warning_1_sent_at || null,
    transferredAt: userRow?.dead_mans_switch_transferred_at || null,
  });

  const successor = activeSuccessor || latestSuccessor || null;
  const delayMonths = userRow?.dead_mans_switch_delay_months ?? 12;

  return {
    enabled: Boolean(userRow?.dead_mans_switch_enabled),
    delayMonths,
    delayLabel: formatDeadManSwitchDelayLabel(delayMonths),
    hasActiveSuccessionPlan: Boolean(activeSuccessor),
    successor: successor
      ? {
          id: successor.id,
          name: successor.successor_name,
          email: successor.successor_email,
          relationship: successor.relationship || '',
          status: successor.status,
        }
      : null,
    lastActiveAt: userRow?.last_active_at || null,
    transferredAt: userRow?.dead_mans_switch_transferred_at || null,
    ...computed,
  };
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { user } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [userResult, latestSuccessorResult, activeSuccessorResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select(
          [
            'id',
            'created_at',
            'dead_mans_switch_enabled',
            'dead_mans_switch_delay_months',
            'last_active_at',
            'dead_mans_switch_warning_30_sent_at',
            'dead_mans_switch_warning_7_sent_at',
            'dead_mans_switch_warning_1_sent_at',
            'dead_mans_switch_transferred_at',
          ].join(', ')
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('user_successors')
        .select('id, successor_name, successor_email, relationship, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('user_successors')
        .select('id, successor_name, successor_email, relationship, status')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (userResult.error) throw userResult.error;
    if (latestSuccessorResult.error) throw latestSuccessorResult.error;
    if (activeSuccessorResult.error) throw activeSuccessorResult.error;

    const userRow = userResult.data as any;
    const latestSuccessor = latestSuccessorResult.data as any;
    const activeSuccessor = activeSuccessorResult.data as any;

    return NextResponse.json(
      buildPayload(
        userRow,
        activeSuccessor,
        latestSuccessor
      ),
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('[dead-man-switch:get]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { user } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const enabled = body?.enabled;
    const delayMonths = body?.delayMonths;

    if (enabled === undefined && delayMonths === undefined) {
      return NextResponse.json(
        { error: 'No Dead Man Switch changes were provided.' },
        { status: 400 }
      );
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled must be a boolean.' },
        { status: 400 }
      );
    }

    if (
      delayMonths !== undefined &&
      !isValidDeadManSwitchDelay(Number(delayMonths))
    ) {
      return NextResponse.json(
        { error: 'Delay must be one of 3, 6, 12, or 24 months.' },
        { status: 400 }
      );
    }

    const [userResult, activeSuccessorResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select(
          [
            'id',
            'created_at',
            'dead_mans_switch_enabled',
            'dead_mans_switch_delay_months',
            'last_active_at',
            'dead_mans_switch_warning_30_sent_at',
            'dead_mans_switch_warning_7_sent_at',
            'dead_mans_switch_warning_1_sent_at',
            'dead_mans_switch_transferred_at',
          ].join(', ')
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('user_successors')
        .select('id, successor_name, successor_email, relationship, status')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (userResult.error) throw userResult.error;
    if (activeSuccessorResult.error) throw activeSuccessorResult.error;

    const userRow = userResult.data as any;
    const activeSuccessor = activeSuccessorResult.data as any;
    const wantsEnabled =
      enabled === undefined
        ? Boolean(userRow?.dead_mans_switch_enabled)
        : enabled;

    if (wantsEnabled && !activeSuccessor) {
      return NextResponse.json(
        {
          error:
            'Dead Man Switch settings are only available after a successor has accepted stewardship.',
        },
        { status: 409 }
      );
    }

    const updates: Record<string, unknown> = {
      dead_mans_switch_warning_30_sent_at: null,
      dead_mans_switch_warning_7_sent_at: null,
      dead_mans_switch_warning_1_sent_at: null,
    };

    if (enabled !== undefined) {
      updates.dead_mans_switch_enabled = enabled;
    }

    if (delayMonths !== undefined) {
      updates.dead_mans_switch_delay_months = Number(delayMonths);
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select(
        [
          'id',
          'created_at',
          'dead_mans_switch_enabled',
          'dead_mans_switch_delay_months',
          'last_active_at',
          'dead_mans_switch_warning_30_sent_at',
          'dead_mans_switch_warning_7_sent_at',
          'dead_mans_switch_warning_1_sent_at',
          'dead_mans_switch_transferred_at',
        ].join(', ')
      )
      .maybeSingle();

    if (updateError) throw updateError;

    return NextResponse.json(
      buildPayload(updatedUser, activeSuccessor, activeSuccessor)
    );
  } catch (error: any) {
    console.error('[dead-man-switch:patch]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
