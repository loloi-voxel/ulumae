import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { DEFAULT_ACTIVITY_LIMIT } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import {
  buildActivityNotification,
  formatRole,
  getNotificationGroupKey,
  getNotificationGroupLabel,
  getNotificationHref,
  getNotificationId,
  groupNotifications,
  isMissingNotificationReadsTable,
  type NotificationItem,
} from '@/lib/notifications';

interface MemorialSummary {
  id: string;
  full_name: string | null;
  mode: string | null;
  user_id?: string;
}

type NotificationReadRow = {
  notification_id: string;
  read_at: string;
};

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { user } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [ownedMemorialsResult, membershipResult, targetedActivityResult] =
      await Promise.all([
        supabaseAdmin
          .from('memorials')
          .select('id, full_name, mode, user_id')
          .eq('user_id', user.id)
          .eq('deleted', false),
        supabaseAdmin
          .from('user_memorial_roles')
          .select('memorial_id, role, memorials!inner(id, full_name, mode, user_id)')
          .eq('user_id', user.id),
        supabaseAdmin
          .from('memorial_activity_log')
          .select(
            'id, memorial_id, action, summary, actor_user_id, actor_email, subject_user_id, subject_email, details, created_at'
          )
          .eq('subject_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(DEFAULT_ACTIVITY_LIMIT)
          .then((res) =>
            isMissingNotificationReadsTable(res.error) ? { data: [], error: null } : res
          ),
      ]);

    if (ownedMemorialsResult.error) throw ownedMemorialsResult.error;
    if (membershipResult.error) throw membershipResult.error;
    if (targetedActivityResult.error) throw targetedActivityResult.error;

    const memorialMap = new Map<string, MemorialSummary>();
    const ownedMemorialIds = new Set<string>();
    const ownedFamilyMemorialIds = new Set<string>();
    const stewardMemorialIds = new Set<string>();
    const accessibleMemorialIds = new Set<string>();

    for (const memorial of ownedMemorialsResult.data || []) {
      memorialMap.set(memorial.id, memorial);
      ownedMemorialIds.add(memorial.id);
      accessibleMemorialIds.add(memorial.id);
      stewardMemorialIds.add(memorial.id);

      if (memorial.mode === 'family') {
        ownedFamilyMemorialIds.add(memorial.id);
      }
    }

    for (const membership of membershipResult.data || []) {
      const memorial = membership.memorials as unknown as MemorialSummary;
      if (memorial?.id) {
        memorialMap.set(memorial.id, memorial);
        accessibleMemorialIds.add(memorial.id);
      }

      if (
        membership.memorial_id &&
        (membership.role === 'owner' || membership.role === 'co_guardian')
      ) {
        stewardMemorialIds.add(membership.memorial_id);
      }
    }

    const accessibleIds = Array.from(accessibleMemorialIds);
    const stewardIds = Array.from(stewardMemorialIds);
    const ownedIds = Array.from(ownedMemorialIds);

    const [
      contributionResult,
      accessRequestResult,
      creationRequestResult,
      memorialActivityResult,
    ] = await Promise.all([
      stewardIds.length > 0
        ? supabaseAdmin
            .from('memorial_contributions')
            .select(
              'id, memorial_id, user_id, contributor_email, witness_name, type, content, created_at'
            )
            .in('memorial_id', stewardIds)
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: false })
            .limit(DEFAULT_ACTIVITY_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      stewardIds.length > 0
        ? supabaseAdmin
            .from('memorial_access_requests')
            .select(
              'id, memorial_id, requester_user_id, requested_role, request_message, created_at'
            )
            .in('memorial_id', stewardIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(DEFAULT_ACTIVITY_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      ownedFamilyMemorialIds.size > 0
        ? supabaseAdmin
            .from('memorial_creation_requests')
            .select(
              'id, source_memorial_id, requester_user_id, proposed_name, request_message, created_at'
            )
            .eq('owner_user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(DEFAULT_ACTIVITY_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      accessibleIds.length > 0
        ? supabaseAdmin
            .from('memorial_activity_log')
            .select(
              'id, memorial_id, action, summary, actor_user_id, actor_email, subject_user_id, subject_email, details, created_at'
            )
            .in('memorial_id', accessibleIds)
            .order('created_at', { ascending: false })
            .limit(DEFAULT_ACTIVITY_LIMIT * 2)
            .then((res) =>
              isMissingNotificationReadsTable(res.error) ? { data: [], error: null } : res
            )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (contributionResult.error) throw contributionResult.error;
    if (accessRequestResult.error) throw accessRequestResult.error;
    if (creationRequestResult.error) throw creationRequestResult.error;
    if (memorialActivityResult.error) throw memorialActivityResult.error;

    const userIdsToResolve = [
      ...new Set(
        [
          ...(contributionResult.data || []).map((item: any) => item.user_id),
          ...(accessRequestResult.data || []).map((item: any) => item.requester_user_id),
          ...(creationRequestResult.data || []).map((item: any) => item.requester_user_id),
          ...(targetedActivityResult.data || []).flatMap((item: any) => [
            item.actor_user_id,
            item.subject_user_id,
          ]),
          ...(memorialActivityResult.data || []).flatMap((item: any) => [
            item.actor_user_id,
            item.subject_user_id,
          ]),
        ].filter(Boolean)
      ),
    ];

    const userEmailMap = new Map<string, string>();
    if (userIdsToResolve.length > 0) {
      await Promise.all(
        userIdsToResolve.map(async (resolvedUserId) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);
          if (data.user?.email) {
            userEmailMap.set(resolvedUserId, data.user.email);
          }
        })
      );
    }

    const pendingNotifications: NotificationItem[] = [
      ...(contributionResult.data || []).map((item: any) => ({
        id: getNotificationId('pending_contribution', item.id),
        sourceId: item.id,
        type: 'pending_contribution' as const,
        groupKey: getNotificationGroupKey('pending_contribution'),
        groupLabel: getNotificationGroupLabel(getNotificationGroupKey('pending_contribution')),
        title: item.content?.title || 'Contribution awaiting review',
        body: item.witness_name
          ? `${item.witness_name} submitted a ${item.type || 'contribution'} for review.`
          : 'A contribution is waiting for review.',
        href: getNotificationHref({
          type: 'pending_contribution',
          memorialId: item.memorial_id,
          userId: user.id,
          sourceId: item.id,
          details: { contributionId: item.id },
        }),
        memorialId: item.memorial_id,
        memorialName: memorialMap.get(item.memorial_id)?.full_name || 'Untitled memorial',
        createdAt: item.created_at,
        unread: true,
        requiresAction: true,
        actionLabel: 'Review contribution',
        actorEmail:
          userEmailMap.get(item.user_id) || item.contributor_email || null,
        subjectEmail: null,
      })),
      ...(accessRequestResult.data || []).map((item: any) => ({
        id: getNotificationId('pending_access_request', item.id),
        sourceId: item.id,
        type: 'pending_access_request' as const,
        groupKey: getNotificationGroupKey('pending_access_request'),
        groupLabel: getNotificationGroupLabel(getNotificationGroupKey('pending_access_request')),
        title: 'New access request',
        body: userEmailMap.get(item.requester_user_id)
          ? `${userEmailMap.get(item.requester_user_id)} requested ${formatRole(
              item.requested_role
            ).toLowerCase()} access.`
          : 'A user requested access to this archive.',
        href: getNotificationHref({
          type: 'pending_access_request',
          memorialId: item.memorial_id,
          userId: user.id,
          sourceId: item.id,
          details: { requestId: item.id },
        }),
        memorialId: item.memorial_id,
        memorialName: memorialMap.get(item.memorial_id)?.full_name || 'Untitled memorial',
        createdAt: item.created_at,
        unread: true,
        requiresAction: true,
        actionLabel: 'Review request',
        actorEmail: userEmailMap.get(item.requester_user_id) || null,
        subjectEmail: null,
      })),
      ...(creationRequestResult.data || []).map((item: any) => ({
        id: getNotificationId('pending_creation_request', item.id),
        sourceId: item.id,
        type: 'pending_creation_request' as const,
        groupKey: getNotificationGroupKey('pending_creation_request'),
        groupLabel: getNotificationGroupLabel(getNotificationGroupKey('pending_creation_request')),
        title: item.proposed_name || 'New memorial request',
        body: userEmailMap.get(item.requester_user_id)
          ? `${userEmailMap.get(item.requester_user_id)} asked to create another family memorial.`
          : 'A co-guardian asked to create another family memorial.',
        href: getNotificationHref({
          type: 'pending_creation_request',
          memorialId: item.source_memorial_id,
          userId: user.id,
          sourceId: item.id,
          details: { requestId: item.id },
        }),
        memorialId: item.source_memorial_id,
        memorialName:
          memorialMap.get(item.source_memorial_id)?.full_name || 'Untitled memorial',
        createdAt: item.created_at,
        unread: true,
        requiresAction: true,
        actionLabel: 'Review request',
        actorEmail: userEmailMap.get(item.requester_user_id) || null,
        subjectEmail: null,
      })),
    ];

    const readIds = new Set<string>();
    const allNotificationIds = [
      ...pendingNotifications.map((item) => item.id),
    ];

    const activityRows = [
      ...(memorialActivityResult.data || []),
      ...(targetedActivityResult.data || []),
    ].filter(
      (item: any, index: number, arr: any[]) =>
        arr.findIndex((candidate) => candidate.id === item.id) === index
    );

    const activityNotificationSeeds = activityRows
      .map((item: any) => {
        const memorialId = item.memorial_id;
        const memorialName = memorialMap.get(memorialId)?.full_name || 'Untitled memorial';
        const notification = buildActivityNotification({
          activity: item,
          memorialId,
          memorialName,
          userId: user.id,
          unread: false,
        });

        if (!notification) {
          return null;
        }

        const isPendingDuplicate =
          (notification.type === 'contribution_submitted' &&
            pendingNotifications.some(
              (pendingItem) =>
                pendingItem.type === 'pending_contribution' &&
                pendingItem.sourceId === item.details?.contributionId
            )) ||
          (notification.type === 'access_request_submitted' &&
            pendingNotifications.some(
              (pendingItem) =>
                pendingItem.type === 'pending_access_request' &&
                pendingItem.sourceId === item.details?.requestId
            )) ||
          (notification.type === 'creation_request_submitted' &&
            pendingNotifications.some(
              (pendingItem) =>
                pendingItem.type === 'pending_creation_request' &&
                pendingItem.sourceId === item.details?.requestId
            ));

        if (isPendingDuplicate) {
          return null;
        }

        return notification;
      })
      .filter(Boolean) as NotificationItem[];

    allNotificationIds.push(...activityNotificationSeeds.map((item) => item.id));

    if (allNotificationIds.length > 0) {
      const readResult = await supabaseAdmin
        .from('notification_reads')
        .select('notification_id, read_at')
        .eq('user_id', user.id)
        .in('notification_id', allNotificationIds);

      if (!readResult.error) {
        for (const row of (readResult.data || []) as NotificationReadRow[]) {
          readIds.add(row.notification_id);
        }
      } else if (!isMissingNotificationReadsTable(readResult.error)) {
        throw readResult.error;
      }
    }

    const notifications = [...pendingNotifications, ...activityNotificationSeeds]
      .map((item) => ({
        ...item,
        unread: item.requiresAction ? true : !readIds.has(item.id),
      }))
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );

    const groups = groupNotifications(notifications);
    const recentActivity = activityRows
      .map((item: any) => ({
        id: item.id,
        action: item.action,
        summary: item.summary,
        actorEmail: item.actor_email || null,
        subjectEmail: item.subject_email || null,
        memorialId: item.memorial_id,
        memorialName: memorialMap.get(item.memorial_id)?.full_name || 'Untitled memorial',
        createdAt: item.created_at,
        href:
          buildActivityNotification({
            activity: item,
            memorialId: item.memorial_id,
            memorialName:
              memorialMap.get(item.memorial_id)?.full_name || 'Untitled memorial',
            userId: user.id,
            unread: false,
          })?.href || `/archive/${item.memorial_id}`,
      }))
      .slice(0, DEFAULT_ACTIVITY_LIMIT);

    const unreadCount = notifications.filter((item) => item.unread).length;
    const pendingCount = notifications.filter((item) => item.requiresAction).length;

    return NextResponse.json(
      {
        unreadCount,
        badgeCount: unreadCount,
        pendingCount,
        notifications,
        pendingItems: notifications.filter((item) => item.requiresAction),
        groups,
        recentActivity,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('[notifications]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { user } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as {
      notificationIds?: string[];
      markAllRead?: boolean;
      unread?: boolean;
    };

    if (body.markAllRead) {
      const notificationIds = Array.isArray(body.notificationIds)
        ? body.notificationIds.filter(Boolean)
        : [];

      if (notificationIds.length === 0) {
        return NextResponse.json({ success: true });
      }

      const payload = notificationIds.map((notificationId) => ({
        user_id: user.id,
        notification_id: notificationId,
        read_at: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin
        .from('notification_reads')
        .upsert(payload, { onConflict: 'user_id,notification_id' });

      if (error && !isMissingNotificationReadsTable(error)) {
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    const notificationIds = Array.isArray(body.notificationIds)
      ? body.notificationIds.filter(Boolean)
      : [];

    if (notificationIds.length === 0) {
      return NextResponse.json(
        { error: 'No notification ids provided' },
        { status: 400 }
      );
    }

    if (body.unread) {
      const { error } = await supabaseAdmin
        .from('notification_reads')
        .delete()
        .eq('user_id', user.id)
        .in('notification_id', notificationIds);

      if (error && !isMissingNotificationReadsTable(error)) {
        throw error;
      }
    } else {
      const payload = notificationIds.map((notificationId) => ({
        user_id: user.id,
        notification_id: notificationId,
        read_at: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin
        .from('notification_reads')
        .upsert(payload, { onConflict: 'user_id,notification_id' });

      if (error && !isMissingNotificationReadsTable(error)) {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[notifications][PATCH]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
