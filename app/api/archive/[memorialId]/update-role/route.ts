import { NextRequest, NextResponse } from 'next/server';
import { WitnessRole } from '@/types/roles';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import {
  syncCoGuardianAcrossOwnerFamily,
  updateFamilyCoGuardianRole,
} from '@/lib/familyWorkspace';

const VALID_ROLES = ['co_guardian', 'witness', 'reader'] as const;
type AssignableRole = (typeof VALID_ROLES)[number];

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

    if (!VALID_ROLES.includes(newRole as AssignableRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // 1. AUTH + AUTHORIZATION (centralized).
    const access = await requireMemorialAccess({
      memorialId,
      action: 'manage_members',
    });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;

    // 2. Owner identity invariants.
    if (targetUserId === user.id || targetUserId === context.ownerUserId) {
      return NextResponse.json(
        { error: "Cannot change the owner's role" },
        { status: 400 }
      );
    }

    // 3. Plan constraint: co_guardian only exists on family plans.
    if (newRole === 'co_guardian' && context.plan !== 'family') {
      return NextResponse.json(
        { error: 'Co-Guardian role is only available for Family plan archives' },
        { status: 403 }
      );
    }

    // NEW: Personal plan cannot accept ANY collaboration roles
    if (context.plan === 'personal' && ['co_guardian', 'witness', 'reader'].includes(newRole as string)) {
      return NextResponse.json(
        { error: 'Personal archives cannot have members. Upgrade to Family plan.' },
        { status: 403 }
      );
    }

    // 4. Apply the change.
    const { data: currentRoleRow } = await admin
      .from('user_memorial_roles')
      .select('role')
      .eq('memorial_id', memorialId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    const isFamilyMemorial = context.plan === 'family';
    const isFamilyWideCoGuardianChange =
      isFamilyMemorial &&
      (newRole === 'co_guardian' || currentRoleRow?.role === 'co_guardian');

    if (isFamilyWideCoGuardianChange) {
      if (newRole === 'co_guardian') {
        await syncCoGuardianAcrossOwnerFamily(admin, context.ownerUserId, targetUserId);
      } else {
        await updateFamilyCoGuardianRole(
          admin,
          context.ownerUserId,
          targetUserId,
          newRole as 'witness' | 'reader'
        );
      }
    } else {
      const { error } = await admin
        .from('user_memorial_roles')
        .update({ role: newRole })
        .eq('memorial_id', memorialId)
        .eq('user_id', targetUserId);

      if (error) throw error;
    }

    const targetUser = await admin.auth.admin.getUserById(targetUserId);

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'member_role_updated',
      summary: `A member role was changed to ${newRole}.`,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      subjectUserId: targetUserId,
      subjectEmail: targetUser.data.user?.email ?? null,
      details: { newRole },
    });

    return NextResponse.json({ success: true, newRole: newRole as WitnessRole });
  } catch (err: any) {
    console.error('Update role error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
