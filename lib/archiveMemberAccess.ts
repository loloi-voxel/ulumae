import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArchivePermissionContext } from '@/lib/archivePermissions';
import { WitnessRole } from '@/types/roles';
import {
  removeFamilyCoGuardianAccess,
  syncCoGuardianAcrossOwnerFamily,
  updateFamilyCoGuardianRole,
} from '@/lib/familyWorkspace';

export const ASSIGNABLE_ARCHIVE_MEMBER_ROLES = [
  'co_guardian',
  'witness',
  'reader',
] as const;

export type AssignableArchiveMemberRole =
  (typeof ASSIGNABLE_ARCHIVE_MEMBER_ROLES)[number];

export function isAssignableArchiveMemberRole(
  value: string
): value is AssignableArchiveMemberRole {
  return ASSIGNABLE_ARCHIVE_MEMBER_ROLES.includes(
    value as AssignableArchiveMemberRole
  );
}

export async function updateArchiveMemberRole(
  admin: SupabaseClient,
  context: ArchivePermissionContext,
  {
    targetUserId,
    newRole,
  }: {
    targetUserId: string;
    newRole: AssignableArchiveMemberRole;
  }
) {
  if (targetUserId === context.userId || targetUserId === context.ownerUserId) {
    throw new Error("Cannot change the owner's role");
  }

  if (newRole === 'co_guardian' && context.plan !== 'family') {
    throw new Error('Co-Guardian role is only available for Family plan archives');
  }

  if (context.plan === 'personal') {
    throw new Error('Personal archives cannot have members. Upgrade to Family plan.');
  }

  const { data: currentRoleRow } = await admin
    .from('user_memorial_roles')
    .select('role')
    .eq('memorial_id', context.memorialId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!currentRoleRow?.role) {
    throw new Error('Member not found');
  }

  const oldRole = currentRoleRow.role as WitnessRole;

  if (oldRole === 'owner') {
    throw new Error("Cannot change the owner's role");
  }

  if (oldRole === newRole) {
    return { oldRole, newRole, changed: false };
  }

  const isFamilyWideCoGuardianChange =
    context.plan === 'family' &&
    (newRole === 'co_guardian' || oldRole === 'co_guardian');

  if (isFamilyWideCoGuardianChange) {
    if (newRole === 'co_guardian') {
      await syncCoGuardianAcrossOwnerFamily(
        admin,
        context.ownerUserId,
        targetUserId
      );
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
      .eq('memorial_id', context.memorialId)
      .eq('user_id', targetUserId);

    if (error) throw error;
  }

  return { oldRole, newRole, changed: true };
}

export async function removeArchiveMemberAccess(
  admin: SupabaseClient,
  context: ArchivePermissionContext,
  {
    targetUserId,
  }: {
    targetUserId: string;
  }
) {
  if (targetUserId === context.userId || targetUserId === context.ownerUserId) {
    throw new Error('You cannot remove yourself as owner');
  }

  const { data: targetRole } = await admin
    .from('user_memorial_roles')
    .select('role')
    .eq('memorial_id', context.memorialId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetRole?.role) {
    throw new Error('Member not found');
  }

  if (context.plan === 'family' && targetRole.role === 'co_guardian') {
    await removeFamilyCoGuardianAccess(admin, context.ownerUserId, targetUserId);
  } else {
    const { error } = await admin
      .from('user_memorial_roles')
      .delete()
      .eq('memorial_id', context.memorialId)
      .eq('user_id', targetUserId);

    if (error) throw error;
  }

  return { removedRole: targetRole.role as WitnessRole };
}
