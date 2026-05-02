'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationGroup, NotificationItem } from '@/lib/notifications';

export interface NotificationsState {
  unreadCount: number;
  badgeCount: number;
  pendingCount: number;
  notifications: NotificationItem[];
  pendingItems: NotificationItem[];
  groups: NotificationGroup[];
  recentActivity: Array<{
    id: string;
    action: string;
    summary: string;
    actorEmail: string | null;
    subjectEmail: string | null;
    memorialId: string;
    memorialName: string;
    createdAt: string;
    href: string;
  }>;
}

const EMPTY_STATE: NotificationsState = {
  unreadCount: 0,
  badgeCount: 0,
  pendingCount: 0,
  notifications: [],
  pendingItems: [],
  groups: [],
  recentActivity: [],
};

// Poll every 2 minutes instead of 30s — the API is too heavy for frequent polls
const REFRESH_INTERVAL_MS = 120_000;

export function useNotifications() {
  const [data, setData] = useState<NotificationsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guard: prevent overlapping requests
  const isFetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    // Skip if a request is already in flight
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const controller = new AbortController();
      // Abort if it takes more than 15s
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401) {
        setData(EMPTY_STATE);
        setError(null);
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Notifications request failed (${response.status})`);
      }

      setData({
        unreadCount: payload.unreadCount || 0,
        badgeCount: payload.badgeCount || 0,
        pendingCount: payload.pendingCount || 0,
        notifications: payload.notifications || [],
        pendingItems: payload.pendingItems || [],
        groups: payload.groups || [],
        recentActivity: payload.recentActivity || [],
      });
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Timed out — silently skip
      console.error('[useNotifications] refresh failed', err);
      setError(err.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const markRead = useCallback(async (notificationIds: string[], unread = false) => {
    if (!notificationIds.length) return;

    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds, unread }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Could not update notification state.');
    }

    setData((current) => {
      const notifications = current.notifications.map((item) =>
        notificationIds.includes(item.id)
          ? { ...item, unread: unread ? true : item.requiresAction ? true : false }
          : item
      );
      return {
        ...current,
        notifications,
        unreadCount: notifications.filter((item) => item.unread).length,
        badgeCount: notifications.filter((item) => item.unread).length,
      };
    });
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = data.notifications
      .filter((item) => item.unread && !item.requiresAction)
      .map((item) => item.id);

    if (!ids.length) return;

    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ids, markAllRead: true }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Could not mark notifications as read.');
    }

    setData((current) => {
      const notifications = current.notifications.map((item) =>
        item.requiresAction ? item : { ...item, unread: false }
      );
      return {
        ...current,
        notifications,
        unreadCount: notifications.filter((item) => item.unread).length,
        badgeCount: notifications.filter((item) => item.unread).length,
      };
    });
  }, [data.notifications]);

  useEffect(() => {
    refresh();

    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    // Don't refresh on every focus — too aggressive
    // window.addEventListener('focus', handleFocus); ← removed

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { data, loading, error, refresh, markRead, markAllRead };
}