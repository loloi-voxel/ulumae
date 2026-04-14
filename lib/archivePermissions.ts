import type { SupabaseClient } from '@supabase/supabase-js';
import { WitnessRole } from '@/types/roles';

export type ArchivePlan = 'personal' | 'family';

export type ArchiveAction =
  | 'view_archive'
  | 'view_members'
  | 'edit_archive'
  | 'invite_member'
  | 'manage_members'
  | 'review_contributions'
  | 'contribute_content'
  | 'view_family_map'
  | 'request_memorial_creation'
  | 'export_archive'
  | 'delete_archive'
  | 'view_activity'
  | 'manage_succession'
  | 'approve_access_requests'
  | 'manage_devices';

export interface ArchiveCapabilities {
  canViewArchive: boolean;
  canContribute: boolean;
  canReview: boolean;
  canInvite: boolean;
  canManageMembers: boolean;
  canViewFamilyMap: boolean;
  canRequestAccess: boolean;
  contributionsRequireReview: boolean;
  canEditArchive: boolean;
  canExportArchive: boolean;
  canDeleteArchive: boolean;
  canViewActivity: boolean;
  canManageSuccession: boolean;
  canApproveAccessRequests: boolean;
  canManageDevices: boolean;
}

export interface ArchivePermissionContext {
  memorialId: string;
  userId: string;
  ownerUserId: string;
  plan: ArchivePlan;
  role: WitnessRole;
  isOwner: boolean;
}

export interface ArchivePermissionResolution {
  memorialExists: boolean;
  context: ArchivePermissionContext | null;
}

export interface ArchiveRoleSnapshot {
  currentUserId: string;
  userRole: WitnessRole;
  plan: ArchivePlan;
  roleLabel: string;
  permissionSignature: string;
  capabilities: ArchiveCapabilities;
  memorial: {
    id: string;
    fullName: string;
    birthDate: string | null;
    deathDate: string | null;
    profilePhotoUrl: string | null;
    userId: string;
  };
  myContributions: {
    id: string;
    type: 'memory' | 'photo' | 'video';
    status: 'pending_approval' | 'approved' | 'rejected' | 'needs_changes';
    title: string;
    createdAt: string;
    adminNotes: string | null;
    revisionCount: number;
  }[];
  pendingCount: number;
  pendingContributionCount: number;
  pendingAccessRequestCount: number;
  pendingCreationRequestCount: number;
  resolvedAt: string;
}

export const ARCHIVE_ROLE_LABELS: Record<WitnessRole, string> = {
  owner: 'Owner',
  co_guardian: 'Co-Guardian',
  witness: 'Witness',
  reader: 'Reader',
};

const PERSONAL_ROLE_PERMISSIONS: Record<WitnessRole, readonly ArchiveAction[]> = {
  owner: [
    'view_archive',
    'edit_archive',
    'export_archive',
    'delete_archive',
    'view_activity',
    'manage_succession',
    'manage_devices',
  ],
  // Personal plan: No collaboration roles allowed
  co_guardian: [], // NEVER assign this role on personal plans
  witness: [],
  reader: [],
};

const FAMILY_ROLE_PERMISSIONS: Record<WitnessRole, readonly ArchiveAction[]> = {
  owner: [
    'view_archive',
    'view_members',
    'edit_archive',
    'invite_member',
    'manage_members',
    'review_contributions',
    'contribute_content',
    'view_family_map',
    'request_memorial_creation',
    'export_archive',
    'delete_archive',
    'view_activity',
    'manage_succession',
    'approve_access_requests',
    'manage_devices',
  ],
  co_guardian: [
    'view_archive',
    'view_members',
    'edit_archive',
    'invite_member',
    'manage_members',
    'review_contributions',
    'contribute_content',
    'view_family_map',
    'request_memorial_creation',
    'view_activity',
    'manage_succession',
    'approve_access_requests',
    'manage_devices',
  ],
  witness: [
    'view_archive',
    'contribute_content',
    'view_family_map',
  ],
  reader: [
    'view_archive',
  ],
};

const PLAN_PERMISSIONS: Record<
  ArchivePlan,
  Record<WitnessRole, readonly ArchiveAction[]>
> = {
  personal: PERSONAL_ROLE_PERMISSIONS,
  family: FAMILY_ROLE_PERMISSIONS,
};

const ASSIGNABLE_ROLES: Record<ArchivePlan, WitnessRole[]> = {
  personal: [],
  family: ['co_guardian', 'witness', 'reader'],
};

export function getArchivePlan(mode?: string | null): ArchivePlan {
  return mode === 'family' ? 'family' : 'personal';
}

export function getRoleLabel(role: WitnessRole): string {
  return ARCHIVE_ROLE_LABELS[role] ?? 'Member';
}

export function getAssignableRolesForPlan(plan: ArchivePlan): WitnessRole[] {
  return [...ASSIGNABLE_ROLES[plan]];
}

export function getPermissionsForRole(
  roleOrContext: WitnessRole | ArchivePermissionContext,
  planOverride?: ArchivePlan
): readonly ArchiveAction[] {
  const role =
    typeof roleOrContext === 'string' ? roleOrContext : roleOrContext.role;
  const plan =
    typeof roleOrContext === 'string'
      ? (planOverride ?? 'personal')
      : roleOrContext.plan;

  return PLAN_PERMISSIONS[plan][role];
}

export function getPermissionSignature(
  roleOrContext: WitnessRole | ArchivePermissionContext,
  planOverride?: ArchivePlan
): string {
  const role =
    typeof roleOrContext === 'string' ? roleOrContext : roleOrContext.role;
  const plan =
    typeof roleOrContext === 'string'
      ? (planOverride ?? 'personal')
      : roleOrContext.plan;

  return [plan, role, ...getPermissionsForRole(roleOrContext, planOverride)].join(
    ':'
  );
}

export function hasPermission(
  roleOrContext: WitnessRole | ArchivePermissionContext,
  action: ArchiveAction,
  planOverride?: ArchivePlan
): boolean {
  return getPermissionsForRole(roleOrContext, planOverride).includes(action);
}

export function hasArchivePermission(
  context: ArchivePermissionContext,
  action: ArchiveAction
): boolean {
  return hasPermission(context, action);
}

export function getArchiveCapabilities(
  role: WitnessRole,
  plan: ArchivePlan
): ArchiveCapabilities {
  const canReview = hasPermission(role, 'review_contributions', plan);
  const canContribute = hasPermission(role, 'contribute_content', plan);

  return {
    canViewArchive: hasPermission(role, 'view_archive', plan),
    canContribute,
    canReview,
    canInvite: hasPermission(role, 'invite_member', plan),
    canManageMembers: hasPermission(role, 'manage_members', plan),
    canViewFamilyMap: hasPermission(role, 'view_family_map', plan),
    canRequestAccess: plan === 'family' && role === 'witness',
    contributionsRequireReview: canContribute && !canReview,
    canEditArchive: hasPermission(role, 'edit_archive', plan),
    canExportArchive: hasPermission(role, 'export_archive', plan),
    canDeleteArchive: hasPermission(role, 'delete_archive', plan),
    canViewActivity: hasPermission(role, 'view_activity', plan),
    canManageSuccession: hasPermission(role, 'manage_succession', plan),
    canApproveAccessRequests: hasPermission(role, 'approve_access_requests', plan),
    canManageDevices: hasPermission(role, 'manage_devices', plan),
  };
}

async function resolveFromMemorial(
  supabaseAdmin: SupabaseClient,
  memorial: {
    id: string;
    user_id: string;
    mode: string | null;
  },
  userId: string
): Promise<ArchivePermissionContext | null> {
  const plan = getArchivePlan(memorial.mode);

  if (memorial.user_id === userId) {
    return {
      memorialId: memorial.id,
      userId,
      ownerUserId: memorial.user_id,
      plan,
      role: 'owner',
      isOwner: true,
    };
  }

  if (plan === 'personal') {
    return null;
  }

  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from('user_memorial_roles')
    .select('role')
    .eq('memorial_id', memorial.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (roleError || !roleRow?.role) {
    return null;
  }

  return {
    memorialId: memorial.id,
    userId,
    ownerUserId: memorial.user_id,
    plan,
    role: roleRow.role as WitnessRole,
    isOwner: false,
  };
}

export async function getUserRole(
  supabaseAdmin: SupabaseClient,
  userId: string,
  memorialId: string
) {
  const { data: memorial, error } = await supabaseAdmin
    .from('memorials')
    .select('id, user_id, mode')
    .eq('id', memorialId)
    .maybeSingle();

  if (error || !memorial) {
    return null;
  }

  return resolveFromMemorial(supabaseAdmin, memorial, userId);
}

export async function resolveArchivePermissionContext(
  supabaseAdmin: SupabaseClient,
  memorialId: string,
  userId: string
): Promise<ArchivePermissionResolution> {
  const { data: memorial, error: memorialError } = await supabaseAdmin
    .from('memorials')
    .select('id, user_id, mode')
    .eq('id', memorialId)
    .maybeSingle();

  if (memorialError || !memorial) {
    return {
      memorialExists: false,
      context: null,
    };
  }

  return {
    memorialExists: true,
    context: await resolveFromMemorial(supabaseAdmin, memorial, userId),
  };
}
