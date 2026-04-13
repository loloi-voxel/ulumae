'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Inbox,
  Loader2,
  MessageSquareText,
  Shield,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationItem } from '@/lib/notifications';
import { getDashboardPath, useAuth } from '@/components/providers/AuthProvider';

function iconForNotification(type: NotificationItem['type']) {
  switch (type) {
    case 'pending_access_request':
    case 'access_request_submitted':
    case 'access_request_approved':
    case 'access_request_denied':
      return UserPlus;
    case 'pending_creation_request':
    case 'creation_request_submitted':
    case 'creation_request_approved':
    case 'creation_request_rejected':
      return Sparkles;
    case 'invite_accepted':
    case 'role_changed':
      return Shield;
    default:
      return MessageSquareText;
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleString();
}

export default function NotificationCenter() {
  const auth = useAuth();
  const { data, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <Link
        href={getDashboardPath(auth)}
        className="hidden rounded-full border border-warm-border/30 bg-white px-3 py-2 text-xs font-semibold text-warm-dark/70 transition-colors hover:bg-surface-mid/60 sm:inline-flex"
      >
        {data.pendingCount > 0 ? `${data.pendingCount} pending` : 'No pending'}
      </Link>

      <button
        type="button"
        aria-label={data.unreadCount > 0 ? `${data.unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) refresh();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-warm-border/30 bg-white text-warm-dark transition-colors hover:bg-surface-mid/60"
      >
        <Bell size={16} />
        {data.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-warm-brown px-1 text-[10px] font-semibold leading-[18px] text-white shadow-sm">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[92vw] rounded-2xl border border-warm-border/40 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-warm-border/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-warm-dark">Notifications</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">
                {data.pendingCount > 0 ? `${data.pendingCount} pending` : 'All caught up'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => markAllRead().catch((err) => console.error(err))}
                className="text-xs text-warm-outline hover:text-warm-dark"
              >
                Mark read
              </button>
              <button
                type="button"
                onClick={refresh}
                className="text-xs text-warm-outline hover:text-warm-dark"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-warm-outline">
                <Loader2 size={14} className="animate-spin" />
                Loading notifications...
              </div>
            )}

            {!loading && error && (
              <div className="px-4 py-6 text-sm text-red-600">{error}</div>
            )}

            {!loading && !error && data.notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Inbox size={20} className="mx-auto mb-3 text-warm-outline" />
                <p className="text-sm font-medium text-warm-dark">No notifications yet</p>
                <p className="mt-1 text-xs text-warm-outline">
                  Requests, approvals, and invite updates will appear here.
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              data.groups.map((group) => {
                const items = data.notifications.filter((item) => item.groupKey === group.key);

                return (
                  <section key={group.key} className="border-t border-warm-border/20 first:border-t-0">
                    <div className="flex items-center justify-between px-4 pt-4">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-outline">
                        {group.label}
                      </h3>
                      <p className="text-[11px] text-warm-outline">
                        {group.unreadCount > 0
                          ? `${group.unreadCount} unread`
                          : `${group.totalCount} total`}
                      </p>
                    </div>

                    <ul className="space-y-1 px-2 py-3">
                      {items.map((item) => {
                        const Icon = iconForNotification(item.type);
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              onClick={() => {
                                setOpen(false);
                                if (item.unread && !item.requiresAction) {
                                  markRead([item.id]).catch((err) => console.error(err));
                                }
                              }}
                              className={`flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-mid/60 ${
                                item.unread ? 'bg-warm-brown/5' : ''
                              }`}
                            >
                              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-warm-brown/10 text-warm-brown">
                                <Icon size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium text-warm-dark">
                                    {item.title}
                                  </p>
                                  {item.unread && (
                                    <span className="h-2 w-2 rounded-full bg-warm-brown" />
                                  )}
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-xs text-warm-outline">
                                  {item.body}
                                </p>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <p className="text-[11px] text-warm-outline">
                                    {item.memorialName}
                                  </p>
                                  <p className="text-[11px] text-warm-outline">
                                    {formatTimestamp(item.createdAt)}
                                  </p>
                                </div>
                                {item.requiresAction && item.actionLabel && (
                                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-warm-brown">
                                    {item.actionLabel}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
