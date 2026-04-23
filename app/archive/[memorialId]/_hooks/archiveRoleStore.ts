'use client';

import { useSyncExternalStore } from 'react';
import type { ArchiveRoleSnapshot } from '@/lib/archivePermissions';
import { ARCHIVE_ROLE_REFETCH_GUARD_MS } from '@/lib/constants';

const POLL_INTERVAL_MS = 30_000;
const BROADCAST_KEY = 'ulumae:archive-role-sync';
const BROADCAST_CHANNEL = 'ulumae:archive-role-sync';

type ArchiveRoleStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'error';

export interface ArchiveRoleStoreState {
  data: ArchiveRoleSnapshot | null;
  error: string | null;
  status: ArchiveRoleStatus;
  loading: boolean;
  hasAccess: boolean;
  isRevoked: boolean;
  lastFetchedAt: number | null;
}

interface FetchOptions {
  force?: boolean;
  reason?: string;
  broadcast?: boolean;
}

interface RoleNoticeDetail {
  memorialId: string;
  type: 'role_changed' | 'permissions_changed' | 'access_revoked' | 'account_switched';
  previousRole?: string;
  nextRole?: string;
  previousPlan?: string;
  nextPlan?: string;
  message: string;
}

interface BroadcastMessage {
  memorialId: string;
  reason?: string;
  sourceId: string;
}

const sourceId = `archive-role-${Math.random().toString(36).slice(2)}`;
const stores = new Map<string, ArchiveRoleStore>();
let broadcastChannel: BroadcastChannel | null = null;
let globalListenersAttached = false;

function areArchiveRoleSnapshotsEqual(
  left: ArchiveRoleSnapshot | null,
  right: ArchiveRoleSnapshot | null
) {
  if (left === right) return true;
  if (!left || !right) return false;

  const { resolvedAt: _l, ...leftRest } = left;
  const { resolvedAt: _r, ...rightRest } = right;
  return JSON.stringify(leftRest) === JSON.stringify(rightRest);
}

function createDefaultState(): ArchiveRoleStoreState {
  return {
    data: null,
    error: null,
    status: 'idle',
    loading: false,
    hasAccess: false,
    isRevoked: false,
    lastFetchedAt: null,
  };
}

function emitWindowEvent<T>(name: string, detail: T) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function emitRoleNotice(detail: RoleNoticeDetail) {
  emitWindowEvent('ulumae:archive-role-notice', detail);
}

function broadcastInvalidation(memorialId: string, reason?: string) {
  if (typeof window === 'undefined') return;

  const payload: BroadcastMessage = {
    memorialId,
    reason,
    sourceId,
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL);
      broadcastChannel.postMessage(payload);
    }
  } catch {
    // Ignore channel support issues and fall back to storage below.
  }

  try {
    window.localStorage.setItem(BROADCAST_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

function applyDerivedState(
  next: Partial<ArchiveRoleStoreState>
): ArchiveRoleStoreState {
  const data = next.data ?? null;
  const status = next.status ?? 'idle';

  return {
    data,
    error: next.error ?? null,
    status,
    loading: next.loading ?? false,
    hasAccess: status === 'ready' && Boolean(data),
    isRevoked: status === 'forbidden',
    lastFetchedAt: next.lastFetchedAt ?? null,
  };
}

function describeRole(role?: string) {
  return role ? role.replace('_', ' ') : 'member';
}

function maybeEmitChangeNotice(
  memorialId: string,
  previous: ArchiveRoleStoreState,
  next: ArchiveRoleStoreState
) {
  const previousData = previous.data;
  const nextData = next.data;

  if (previousData && next.status === 'forbidden') {
    emitWindowEvent('ulumae:access-revoked', { memorialId });
    emitRoleNotice({
      memorialId,
      type: 'access_revoked',
      previousRole: previousData.userRole,
      previousPlan: previousData.plan,
      message: 'Your access to this archive was revoked.',
    });
    return;
  }

  if (previousData && nextData && previousData.currentUserId !== nextData.currentUserId) {
    emitRoleNotice({
      memorialId,
      type: 'account_switched',
      previousRole: previousData.userRole,
      nextRole: nextData.userRole,
      message: 'This archive is now being viewed under a different account.',
    });
    return;
  }

  if (!previousData || !nextData) {
    return;
  }

  const roleChanged = previousData.userRole !== nextData.userRole;
  const permissionsChanged =
    previousData.permissionSignature !== nextData.permissionSignature ||
    previousData.plan !== nextData.plan;

  if (!roleChanged && !permissionsChanged) {
    return;
  }

  emitWindowEvent('ulumae:role-changed', {
    memorialId,
    oldRole: previousData.userRole,
    newRole: nextData.userRole,
  });

  emitRoleNotice({
    memorialId,
    type: roleChanged ? 'role_changed' : 'permissions_changed',
    previousRole: previousData.userRole,
    nextRole: nextData.userRole,
    previousPlan: previousData.plan,
    nextPlan: nextData.plan,
    message: roleChanged
      ? `Your role changed from ${describeRole(previousData.userRole)} to ${describeRole(nextData.userRole)}.`
      : 'Your archive permissions changed during this session.',
  });
}

class ArchiveRoleStore {
  private state = createDefaultState();
  private readonly listeners = new Set<() => void>();
  private inflight: Promise<ArchiveRoleSnapshot | null> | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private subscriberCount = 0;

  constructor(private readonly memorialId: string) { }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.subscriberCount += 1;

    if (this.subscriberCount === 1) {
      this.ensurePolling();
      void this.fetch({ force: true, reason: 'subscribe' });
    }

    return () => {
      this.listeners.delete(listener);
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);

      if (this.subscriberCount === 0 && this.pollHandle) {
        clearInterval(this.pollHandle);
        this.pollHandle = null;
      }
    };
  };

  fetch = async (options: FetchOptions = {}): Promise<ArchiveRoleSnapshot | null> => {
    const { force = false, reason = 'manual', broadcast = false } = options;

    if (!this.memorialId) {
      this.setState(
        applyDerivedState({
          ...this.state,
          status: 'error',
          error: 'Missing memorialId.',
          loading: false,
        })
      );
      return null;
    }

    if (this.inflight && !force) {
      return this.inflight;
    }

    const previous = this.state;
    if (!previous.loading) {
      this.setState(
        applyDerivedState({
          ...previous,
          status: previous.lastFetchedAt ? previous.status : 'loading',
          loading: true,
          error: previous.status === 'error' ? null : previous.error,
        })
      );
    }

    const request = fetch(`/api/archive/${this.memorialId}/role-data`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMessage =
            payload?.error ||
            (response.status === 403
              ? 'You no longer have access to this archive.'
              : 'Could not load archive access.');

          const status: ArchiveRoleStatus =
            response.status === 401
              ? 'unauthorized'
              : response.status === 403
                ? 'forbidden'
                : response.status === 404
                  ? 'not_found'
                  : 'error';

          const nextState = applyDerivedState({
            data: null,
            error: errorMessage,
            status,
            loading: false,
            lastFetchedAt: Date.now(),
          });

          this.setState(nextState);
          maybeEmitChangeNotice(this.memorialId, previous, nextState);
          return null;
        }

        const nextPayload = payload as ArchiveRoleSnapshot;
        const stableData = areArchiveRoleSnapshotsEqual(previous.data, nextPayload)
          ? previous.data
          : nextPayload;

        const nextState = applyDerivedState({
          data: stableData,
          error: null,
          status: 'ready',
          loading: false,
          lastFetchedAt: Date.now(),
        });

        this.setState(nextState);
        maybeEmitChangeNotice(this.memorialId, previous, nextState);

        if (broadcast) {
          broadcastInvalidation(this.memorialId, reason);
        }

        return payload as ArchiveRoleSnapshot;
      })
      .catch((error: unknown) => {
        const nextState = applyDerivedState({
          data: previous.data,
          error: error instanceof Error ? error.message : 'Could not load archive access.',
          status: previous.data ? 'ready' : 'error',
          loading: false,
          lastFetchedAt: previous.lastFetchedAt,
        });

        this.setState(nextState);
        return previous.data;
      })
      .finally(() => {
        if (this.inflight === request) {
          this.inflight = null;
        }
      });

    this.inflight = request;
    return request;
  };

  private ensurePolling() {
    if (this.pollHandle) return;

    this.pollHandle = setInterval(() => {
      void this.fetch({ reason: 'poll' });
    }, POLL_INTERVAL_MS);
  }

  private setState(next: ArchiveRoleStoreState) {
    if (
      this.state.status === next.status &&
      this.state.data === next.data &&
      this.state.error === next.error &&
      this.state.loading === next.loading &&
      this.state.hasAccess === next.hasAccess &&
      this.state.isRevoked === next.isRevoked &&
      this.state.lastFetchedAt === next.lastFetchedAt
    ) {
      return;
    }

    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}

function getStore(memorialId: string) {
  let store = stores.get(memorialId);
  if (!store) {
    store = new ArchiveRoleStore(memorialId);
    stores.set(memorialId, store);
  }
  return store;
}

function attachGlobalListeners() {
  if (globalListenersAttached || typeof window === 'undefined') {
    return;
  }

  globalListenersAttached = true;

  const refetchActiveStores = (reason: string) => {
    stores.forEach((store) => {
      const snapshot = store.getSnapshot();
      if (
        snapshot.lastFetchedAt &&
        Date.now() - snapshot.lastFetchedAt < ARCHIVE_ROLE_REFETCH_GUARD_MS
      ) {
        return;
      }
      void store.fetch({ reason });
    });
  };

  window.addEventListener('focus', () => refetchActiveStores('focus'));
  window.addEventListener('online', () => refetchActiveStores('online'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refetchActiveStores('visible');
    }
  });
  window.addEventListener('ulumae:archive-role-invalidate', (event: Event) => {
    const detail = (event as CustomEvent<{ memorialId?: string; reason?: string }>).detail;
    if (!detail?.memorialId) return;
    const snapshot = getStore(detail.memorialId).getSnapshot();
    if (
      snapshot.lastFetchedAt &&
      Date.now() - snapshot.lastFetchedAt < ARCHIVE_ROLE_REFETCH_GUARD_MS
    ) return;
    void getStore(detail.memorialId).fetch({
      force: true,
      reason: detail.reason ?? 'event',
    });
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== BROADCAST_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as BroadcastMessage;
      if (!payload.memorialId || payload.sourceId === sourceId) return;
      void getStore(payload.memorialId).fetch({
        force: true,
        reason: payload.reason ?? 'storage',
      });
    } catch {
      // Ignore malformed sync payloads.
    }
  });

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL);
      broadcastChannel.addEventListener('message', (event: MessageEvent<BroadcastMessage>) => {
        const payload = event.data;
        if (!payload?.memorialId || payload.sourceId === sourceId) return;
        void getStore(payload.memorialId).fetch({
          force: true,
          reason: payload.reason ?? 'broadcast',
        });
      });
    }
  } catch {
    // Ignore unsupported BroadcastChannel implementations.
  }
}

export function useArchiveRoleStore(memorialId: string): ArchiveRoleStoreState {
  attachGlobalListeners();
  const store = getStore(memorialId);

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export async function refetchArchiveRole(
  memorialId: string,
  options: FetchOptions = {}
) {
  return getStore(memorialId).fetch({
    force: true,
    ...options,
  });
}

export function invalidateArchiveRole(
  memorialId: string,
  options: { reason?: string; broadcast?: boolean } = {}
) {
  const { reason = 'invalidate', broadcast = true } = options;

  emitWindowEvent('ulumae:archive-role-invalidate', {
    memorialId,
    reason,
  });

  if (broadcast) {
    broadcastInvalidation(memorialId, reason);
  }
}
