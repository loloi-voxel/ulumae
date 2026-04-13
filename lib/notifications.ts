export type NotificationType =
  | 'pending_contribution'
  | 'pending_access_request'
  | 'pending_creation_request'
  | 'contribution_submitted'
  | 'contribution_approved'
  | 'contribution_rejected'
  | 'contribution_needs_changes'
  | 'access_request_submitted'
  | 'access_request_approved'
  | 'access_request_denied'
  | 'creation_request_submitted'
  | 'creation_request_approved'
  | 'creation_request_rejected'
  | 'invite_accepted'
  | 'role_changed';

export type NotificationGroupKey =
  | 'pending'
  | 'contributions'
  | 'access'
  | 'invites'
  | 'membership';

export interface NotificationItem {
  id: string;
  sourceId: string;
  type: NotificationType;
  groupKey: NotificationGroupKey;
  groupLabel: string;
  title: string;
  body: string;
  href: string;
  memorialId: string;
  memorialName: string;
  createdAt: string;
  unread: boolean;
  requiresAction: boolean;
  actionLabel?: string;
  actorEmail?: string | null;
  subjectEmail?: string | null;
}

export interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  totalCount: number;
  unreadCount: number;
}

type ActivityLike = {
  id: string;
  action: string;
  summary: string;
  created_at: string;
  actor_email?: string | null;
  subject_email?: string | null;
  details?: Record<string, any> | null;
};

const GROUP_LABELS: Record<NotificationGroupKey, string> = {
  pending: 'Pending',
  contributions: 'Contributions',
  access: 'Access requests',
  invites: 'Invites',
  membership: 'Membership',
};

export function getNotificationId(prefix: string, sourceId: string) {
  return `${prefix}:${sourceId}`;
}

export function getNotificationGroupLabel(key: NotificationGroupKey) {
  return GROUP_LABELS[key];
}

export function getNotificationHref(options: {
  type: NotificationType;
  memorialId: string;
  userId: string;
  sourceId: string;
  details?: Record<string, any> | null;
}) {
  const { type, memorialId, userId, sourceId, details } = options;

  switch (type) {
    case 'pending_contribution':
    case 'contribution_submitted':
      return `/archive/${memorialId}/steward?tab=contributions&item=${sourceId}`;
    case 'pending_access_request':
    case 'access_request_submitted':
      return `/archive/${memorialId}/steward?tab=requests&item=${sourceId}`;
    case 'pending_creation_request':
    case 'creation_request_submitted':
      return `/archive/${memorialId}/steward?tab=creation&item=${sourceId}`;
    case 'contribution_needs_changes':
      return `/archive/${memorialId}/contribute?revise=${details?.contributionId || sourceId}`;
    case 'contribution_approved':
    case 'contribution_rejected':
      return `/archive/${memorialId}?section=contributions&item=${details?.contributionId || sourceId}`;
    case 'access_request_approved':
      return `/archive/${memorialId}`;
    case 'access_request_denied':
      return `/dashboard/family/${userId}?section=activity&notification=${sourceId}`;
    case 'creation_request_approved':
      return details?.createdMemorialId
        ? `/archive/${details.createdMemorialId}`
        : `/archive/${memorialId}/steward?tab=creation&item=${sourceId}`;
    case 'creation_request_rejected':
      return `/archive/${memorialId}/steward?tab=creation&item=${sourceId}`;
    case 'invite_accepted':
      return `/dashboard/family/${userId}?members=${memorialId}`;
    case 'role_changed':
      return `/archive/${memorialId}`;
    default:
      return `/archive/${memorialId}`;
  }
}

export function getNotificationTypeFromActivity(
  action: string,
  details?: Record<string, any> | null
): NotificationType | null {
  switch (action) {
    case 'contribution_submitted':
      return 'contribution_submitted';
    case 'contribution_reviewed':
      if (details?.decision === 'approved') return 'contribution_approved';
      if (details?.decision === 'rejected') return 'contribution_rejected';
      if (details?.decision === 'needs_changes') return 'contribution_needs_changes';
      return null;
    case 'access_request_created':
      return 'access_request_submitted';
    case 'access_request_decided':
      return details?.decision === 'approved'
        ? 'access_request_approved'
        : 'access_request_denied';
    case 'creation_request_created':
      return 'creation_request_submitted';
    case 'creation_request_decided':
      return details?.decision === 'approved'
        ? 'creation_request_approved'
        : 'creation_request_rejected';
    case 'invite_accepted':
      return 'invite_accepted';
    case 'member_role_updated':
      return 'role_changed';
    default:
      return null;
  }
}

export function getNotificationGroupKey(type: NotificationType): NotificationGroupKey {
  switch (type) {
    case 'pending_contribution':
    case 'pending_access_request':
    case 'pending_creation_request':
      return 'pending';
    case 'contribution_submitted':
    case 'contribution_approved':
    case 'contribution_rejected':
    case 'contribution_needs_changes':
      return 'contributions';
    case 'access_request_submitted':
    case 'access_request_approved':
    case 'access_request_denied':
    case 'creation_request_submitted':
    case 'creation_request_approved':
    case 'creation_request_rejected':
      return 'access';
    case 'invite_accepted':
      return 'invites';
    case 'role_changed':
      return 'membership';
    default:
      return 'membership';
  }
}

export function buildActivityNotification(options: {
  activity: ActivityLike;
  memorialId: string;
  memorialName: string;
  userId: string;
  unread: boolean;
}): NotificationItem | null {
  const type = getNotificationTypeFromActivity(
    options.activity.action,
    options.activity.details
  );

  if (!type) {
    return null;
  }

  return {
    id: getNotificationId('activity', options.activity.id),
    sourceId: options.activity.id,
    type,
    groupKey: getNotificationGroupKey(type),
    groupLabel: getNotificationGroupLabel(getNotificationGroupKey(type)),
    title: getNotificationTitle(type, options.activity.details, options.activity.summary),
    body: getNotificationBody(type, options.activity),
    href: getNotificationHref({
      type,
      memorialId: options.memorialId,
      userId: options.userId,
      sourceId: options.activity.id,
      details: options.activity.details,
    }),
    memorialId: options.memorialId,
    memorialName: options.memorialName,
    createdAt: options.activity.created_at,
    unread: options.unread,
    requiresAction: false,
    actorEmail: options.activity.actor_email ?? null,
    subjectEmail: options.activity.subject_email ?? null,
  };
}

function getNotificationTitle(
  type: NotificationType,
  details?: Record<string, any> | null,
  fallback?: string
) {
  switch (type) {
    case 'pending_contribution':
    case 'contribution_submitted':
      return 'Contribution submitted';
    case 'contribution_approved':
      return 'Contribution approved';
    case 'contribution_rejected':
      return 'Contribution rejected';
    case 'contribution_needs_changes':
      return 'Changes requested';
    case 'pending_access_request':
    case 'access_request_submitted':
      return 'New access request';
    case 'access_request_approved':
      return 'Access granted';
    case 'access_request_denied':
      return 'Access request declined';
    case 'pending_creation_request':
    case 'creation_request_submitted':
      return 'New memorial request';
    case 'creation_request_approved':
      return 'Memorial request approved';
    case 'creation_request_rejected':
      return 'Memorial request rejected';
    case 'invite_accepted':
      return 'Invitation accepted';
    case 'role_changed':
      return details?.newRole ? `Role changed to ${formatRole(details.newRole)}` : 'Role updated';
    default:
      return fallback || 'Update';
  }
}

function getNotificationBody(type: NotificationType, activity: ActivityLike) {
  switch (type) {
    case 'contribution_approved':
    case 'contribution_rejected':
    case 'contribution_needs_changes':
    case 'access_request_approved':
    case 'access_request_denied':
    case 'creation_request_approved':
    case 'creation_request_rejected':
    case 'invite_accepted':
    case 'role_changed':
      return activity.summary;
    default:
      return activity.summary;
  }
}

export function formatRole(role?: string | null) {
  switch (role) {
    case 'co_guardian':
      return 'Co-Guardian';
    case 'witness':
      return 'Witness';
    case 'reader':
      return 'Reader';
    case 'owner':
      return 'Owner';
    default:
      return role || 'Member';
  }
}

export function groupNotifications(
  notifications: NotificationItem[]
): NotificationGroup[] {
  const counts = new Map<NotificationGroupKey, NotificationGroup>();

  for (const item of notifications) {
    const existing = counts.get(item.groupKey) || {
      key: item.groupKey,
      label: item.groupLabel,
      totalCount: 0,
      unreadCount: 0,
    };

    existing.totalCount += 1;
    if (item.unread) {
      existing.unreadCount += 1;
    }
    counts.set(item.groupKey, existing);
  }

  return Array.from(counts.values());
}

export function isMissingNotificationReadsTable(error: any) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}
