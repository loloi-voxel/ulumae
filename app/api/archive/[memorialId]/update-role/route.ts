import { NextRequest, NextResponse } from 'next/server';
import { WitnessRole } from '@/types/roles';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import {
  isAssignableArchiveMemberRole,
  updateArchiveMemberRole,
} from '@/lib/archiveMemberAccess';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memorialId: string }> }
) {
  try {
    const { memorialId } = await params;
    const body = (await req.json()) as { targetUserId?: string; newRole?: string };
    const { targetUserId, newRole } = body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        { error: 'Missing targetUserId' },
        { status: 400 }
      );
    }

    if (!newRole || !isAssignableArchiveMemberRole(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: co_guardian, witness, reader' },
        { status: 400 }
      );
    }

    const access = await requireMemorialAccess({
      memorialId,
      action: 'manage_members',
    });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;
    const result = await updateArchiveMemberRole(admin, context, {
      targetUserId,
      newRole,
    });

    if (result.changed) {
      const targetUser = await admin.auth.admin.getUserById(targetUserId);

      await safeLogMemorialActivity(admin, {
        memorialId,
        action: 'member_role_updated',
        summary: `A member role was changed to ${result.newRole}.`,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        subjectUserId: targetUserId,
        subjectEmail: targetUser.data.user?.email ?? null,
        details: {
          oldRole: result.oldRole,
          newRole: result.newRole,
        },
      });
    }

    return NextResponse.json({
      success: true,
      changed: result.changed,
      oldRole: result.oldRole,
      newRole: result.newRole as WitnessRole,
    });
  } catch (err: any) {
    console.error('Update role error:', err);

    const message = err.message || 'Internal server error';
    const status =
      message === 'Member not found'
        ? 404
        : message.includes('owner')
          ? 400
          : message.includes('Family plan') || message.includes('Personal archives')
            ? 403
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
