import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import {
  getDeadManSwitchTransferEmail,
  getDeadManSwitchWarningEmail,
} from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/sender';
import {
  getDeadManSwitchComputedState,
  getDeadManSwitchWarningCopy,
  getMostUrgentDueDeadManSwitchWarning,
} from '@/lib/deadManSwitch';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string | null;
  last_active_at: string | null;
  dead_mans_switch_enabled: boolean | null;
  dead_mans_switch_delay_months: number | null;
  dead_mans_switch_warning_30_sent_at: string | null;
  dead_mans_switch_warning_7_sent_at: string | null;
  dead_mans_switch_warning_1_sent_at: string | null;
  dead_mans_switch_transferred_at: string | null;
};

type SuccessorRow = {
  id: string;
  successor_name: string;
  successor_email: string;
  relationship: string | null;
  status: string;
};

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

async function ensureSuccessorAccount(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  successor: SuccessorRow
) {
  const normalizedEmail = successor.successor_email.trim().toLowerCase();

  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUserError) {
    throw existingUserError;
  }

  if (existingUser?.id) {
    return {
      id: existingUser.id,
      email: existingUser.email,
    };
  }

  const baseUrl = getBaseUrl();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    normalizedEmail,
    baseUrl ? { redirectTo: `${baseUrl}/login` } : undefined
  );

  if (error) {
    throw error;
  }

  if (!data.user?.id) {
    throw new Error('Could not provision a successor account.');
  }

  return {
    id: data.user.id,
    email: normalizedEmail,
  };
}

async function transferDeadManSwitchOwnership(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  owner: UserRow,
  successor: SuccessorRow
) {
  const successorAccount = await ensureSuccessorAccount(supabaseAdmin, successor);

  const { data: memorials, error: memorialsError } = await supabaseAdmin
    .from('memorials')
    .select('id, full_name')
    .eq('user_id', owner.id);

  if (memorialsError) {
    throw memorialsError;
  }

  for (const memorial of memorials || []) {
    const { error: memorialUpdateError } = await supabaseAdmin
      .from('memorials')
      .update({ user_id: successorAccount.id })
      .eq('id', memorial.id);

    if (memorialUpdateError) {
      throw memorialUpdateError;
    }

    const { error: successorRoleError } = await supabaseAdmin
      .from('user_memorial_roles')
      .upsert(
        {
          user_id: successorAccount.id,
          memorial_id: memorial.id,
          role: 'owner',
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,memorial_id' }
      );

    if (successorRoleError) {
      throw successorRoleError;
    }

    const { error: originalOwnerRoleError } = await supabaseAdmin
      .from('user_memorial_roles')
      .upsert(
        {
          user_id: owner.id,
          memorial_id: memorial.id,
          role: 'reader',
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,memorial_id' }
      );

    if (originalOwnerRoleError) {
      throw originalOwnerRoleError;
    }

    await safeLogMemorialActivity(supabaseAdmin, {
      memorialId: memorial.id,
      action: 'member_role_updated',
      summary: `Ownership transferred to ${successor.successor_name} by the Dead Man Switch.`,
      actorUserId: owner.id,
      actorEmail: owner.email,
      subjectUserId: successorAccount.id,
      subjectEmail: successorAccount.email,
      details: {
        transferSource: 'dead_man_switch',
        newRole: 'owner',
        previousOwnerId: owner.id,
      },
    });
  }

  const { error: ownerUpdateError } = await supabaseAdmin
    .from('users')
    .update({
      dead_mans_switch_enabled: false,
      dead_mans_switch_transferred_at: new Date().toISOString(),
      dead_mans_switch_warning_30_sent_at: null,
      dead_mans_switch_warning_7_sent_at: null,
      dead_mans_switch_warning_1_sent_at: null,
    })
    .eq('id', owner.id);

  if (ownerUpdateError) {
    throw ownerUpdateError;
  }

  const baseUrl = getBaseUrl();
  if (baseUrl) {
    await sendEmail({
      to: successor.successor_email,
      subject: 'Stewardship transfer completed',
      html: getDeadManSwitchTransferEmail(
        successor.successor_name,
        owner.full_name || 'The account owner',
        `${baseUrl}/dashboard`
      ),
    });
  }
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/dead-man-switch] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const now = new Date();
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(
        [
          'id',
          'email',
          'full_name',
          'created_at',
          'last_active_at',
          'dead_mans_switch_enabled',
          'dead_mans_switch_delay_months',
          'dead_mans_switch_warning_30_sent_at',
          'dead_mans_switch_warning_7_sent_at',
          'dead_mans_switch_warning_1_sent_at',
          'dead_mans_switch_transferred_at',
        ].join(', ')
      )
      .eq('dead_mans_switch_enabled', true);

    if (error) throw error;

    const users = ((data || []) as unknown) as UserRow[];
    if (users.length === 0) {
      return NextResponse.json({ message: 'No users to process' });
    }

    const results = {
      warningsSent: 0,
      transfersCompleted: 0,
      skippedWithoutSuccessor: 0,
    };

    for (const user of users) {
      const { data: successor, error: successorError } = await supabaseAdmin
        .from('user_successors')
        .select('id, successor_name, successor_email, relationship, status')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (successorError) {
        throw successorError;
      }

      if (!successor) {
        results.skippedWithoutSuccessor += 1;
        continue;
      }

      const computed = getDeadManSwitchComputedState(
        {
          enabled: Boolean(user.dead_mans_switch_enabled),
          delayMonths: user.dead_mans_switch_delay_months ?? 12,
          lastActiveAt: user.last_active_at,
          createdAt: user.created_at,
          warning30SentAt: user.dead_mans_switch_warning_30_sent_at,
          warning7SentAt: user.dead_mans_switch_warning_7_sent_at,
          warning1SentAt: user.dead_mans_switch_warning_1_sent_at,
          transferredAt: user.dead_mans_switch_transferred_at,
        },
        now
      );

      if (computed.transferDue) {
        await transferDeadManSwitchOwnership(
          supabaseAdmin,
          user,
          successor as SuccessorRow
        );
        results.transfersCompleted += 1;
        continue;
      }

      const stage = getMostUrgentDueDeadManSwitchWarning(
        {
          enabled: Boolean(user.dead_mans_switch_enabled),
          delayMonths: user.dead_mans_switch_delay_months ?? 12,
          lastActiveAt: user.last_active_at,
          createdAt: user.created_at,
          warning30SentAt: user.dead_mans_switch_warning_30_sent_at,
          warning7SentAt: user.dead_mans_switch_warning_7_sent_at,
          warning1SentAt: user.dead_mans_switch_warning_1_sent_at,
          transferredAt: user.dead_mans_switch_transferred_at,
        },
        now
      );

      if (!stage) {
        continue;
      }

      const warningField =
        stage === 30
          ? 'dead_mans_switch_warning_30_sent_at'
          : stage === 7
            ? 'dead_mans_switch_warning_7_sent_at'
            : 'dead_mans_switch_warning_1_sent_at';

      const baseUrl = getBaseUrl();
      const confirmLink = baseUrl
        ? `${baseUrl}/dashboard/dead-man-switch/${user.id}`
        : '/dashboard';
      const warningCopy = getDeadManSwitchWarningCopy(stage);

      await sendEmail({
        to: user.email,
        subject: warningCopy.subject,
        html: getDeadManSwitchWarningEmail(
          user.full_name || 'Valued Member',
          confirmLink,
          stage
        ),
      });

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          [warningField]: now.toISOString(),
          verification_sent_at: now.toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      results.warningsSent += 1;
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    console.error('[cron/dead-man-switch]', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
