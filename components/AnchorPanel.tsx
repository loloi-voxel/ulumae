'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Monitor,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import {
  ANCHOR_ROTATING_PHRASES,
  detectBrowserCapabilities,
  formatBytes,
  getAnchorSessionSnapshot,
  hydrateAnchorSession,
  shareAnchorToFiles,
  startAnchor,
  subscribeToAnchorSession,
  type AnchorDevice,
} from '@/lib/anchor/anchorService';
import { isFamilyPlan, useAuth } from '@/components/providers/AuthProvider';

interface AnchorPanelProps {
  memorialId: string;
  onDeviceCountChange?: (count: number) => void;
}

async function fetchAnchorDevices(memorialId: string): Promise<AnchorDevice[]> {
  const response = await fetch(
    `/api/anchor/sync-status?memorialId=${encodeURIComponent(memorialId)}`,
    { cache: 'no-store' }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || 'Could not load anchored devices.');
  }

  return (payload.devices || []) as AnchorDevice[];
}

function deviceIcon(browser: string) {
  return /safari|iphone|ipad/i.test(browser) ? (
    <Smartphone size={16} className="text-warm-muted" />
  ) : (
    <Monitor size={16} className="text-warm-muted" />
  );
}

function statusBadge(status: AnchorDevice['status']) {
  const variants = {
    synced: 'bg-emerald-500/10 text-emerald-300',
    syncing: 'bg-blue-500/10 text-blue-300',
    error: 'bg-red-500/10 text-red-300',
    stale: 'bg-amber-500/10 text-amber-300',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${variants[status]}`}
    >
      {status}
    </span>
  );
}

function fileStatusTone(status: AnchorDevice['status'] | 'pending' | 'completed' | 'failed' | 'skipped') {
  switch (status) {
    case 'completed':
    case 'synced':
      return 'text-emerald-300';
    case 'failed':
    case 'error':
      return 'text-red-300';
    case 'skipped':
    case 'stale':
      return 'text-amber-300';
    case 'syncing':
      return 'text-blue-300';
    default:
      return 'text-warm-muted';
  }
}

export default function AnchorPanel({
  memorialId,
  onDeviceCountChange,
}: AnchorPanelProps) {
  const auth = useAuth();
  const snapshot = useSyncExternalStore(
    subscribeToAnchorSession,
    getAnchorSessionSnapshot,
    getAnchorSessionSnapshot
  );
  const capabilities = useMemo(() => detectBrowserCapabilities(), []);
  const [devices, setDevices] = useState<AnchorDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isFamilyPlan(auth.plan)) {
      return;
    }

    void hydrateAnchorSession(memorialId);
  }, [auth.plan, memorialId]);

  useEffect(() => {
    let cancelled = false;

    async function loadDevices() {
      setDevicesLoading(true);
      setDevicesError(null);

      try {
        const nextDevices = await fetchAnchorDevices(memorialId);
        if (cancelled) return;
        setDevices(nextDevices);
        onDeviceCountChange?.(nextDevices.length);
      } catch (error: any) {
        if (cancelled) return;
        setDevicesError(error.message || 'Could not load anchored devices.');
      } finally {
        if (!cancelled) {
          setDevicesLoading(false);
        }
      }
    }

    void loadDevices();

    return () => {
      cancelled = true;
    };
  }, [memorialId, onDeviceCountChange]);

  useEffect(() => {
    if (!['preparing', 'syncing', 'finalizing'].includes(snapshot.phase)) {
      setPhraseIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setPhraseIndex((value) => (value + 1) % ANCHOR_ROTATING_PHRASES.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [snapshot.phase]);

  useEffect(() => {
    if (snapshot.phase !== 'complete' && snapshot.phase !== 'needs-attention') {
      return;
    }

    void fetchAnchorDevices(memorialId)
      .then((nextDevices) => {
        setDevices(nextDevices);
        onDeviceCountChange?.(nextDevices.length);
      })
      .catch(() => undefined);
  }, [memorialId, onDeviceCountChange, snapshot.phase]);

  if (!isFamilyPlan(auth.plan)) {
    return null;
  }

  const summary = snapshot.summary;
  const progressPercent =
    snapshot.totalBytes > 0
      ? Math.min(100, Math.round((snapshot.transferredBytes / snapshot.totalBytes) * 100))
      : 0;
  const tierLabel =
    capabilities.preferredTarget === 'file-system-access'
      ? 'Legacy Vault folder'
      : capabilities.preferredTarget === 'opfs'
        ? 'Hidden browser vault'
        : 'Portable fallback';
  const progressLabel =
    summary &&
    `Securing ${summary.photoCount} photos and ${summary.videoCount} videos... (${formatBytes(snapshot.transferredBytes)} of ${formatBytes(snapshot.totalBytes)})`;
  const successSummary =
    summary &&
    `${summary.photoCount} photos, ${summary.videoCount} videos, and ${summary.galleryCount} offline gallery saved.`;
  const mainCta =
    snapshot.canResume && snapshot.target === 'file-system-access'
      ? 'Resume syncing to your Legacy Vault folder'
      : snapshot.canResume
        ? 'Resume anchoring'
        : 'Anchor this archive';

  const busy = ['preparing', 'syncing', 'finalizing'].includes(snapshot.phase);

  const handleAnchor = async () => {
    setActionError(null);

    try {
      await startAnchor(memorialId, {
        resume: snapshot.canResume,
      });
    } catch (error: any) {
      setActionError(error.message || 'Could not start anchoring.');
    }
  };

  const handleShare = async () => {
    setActionError(null);
    setSharing(true);

    try {
      await shareAnchorToFiles(memorialId);
    } catch (error: any) {
      setActionError(error.message || 'Could not hand this vault off to Files.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-warm-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,238,229,0.94))] p-6 shadow-[0_24px_60px_rgba(47,34,24,0.08)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive/10 text-olive">
              <HardDrive size={20} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-serif text-2xl text-warm-dark">Anchor this archive</h3>
                <span className="rounded-full bg-surface-high/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-warm-muted">
                  {tierLabel}
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-warm-muted">
                Save this legacy permanently to your device. Access it forever, even without internet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnchor}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-olive px-5 py-3 text-sm font-semibold text-white transition hover:bg-olive/90 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {busy ? 'Anchoring in progress...' : mainCta}
          </button>
        </div>

        {snapshot.canResume && snapshot.phase !== 'syncing' && snapshot.target === 'file-system-access' && (
          <div className="rounded-2xl border border-olive/20 bg-olive/5 p-4">
            <p className="text-sm font-medium text-warm-dark">
              Resume syncing to your Legacy Vault folder?
            </p>
            <p className="mt-1 text-sm text-warm-muted">
              We found a saved folder handle for {snapshot.folderDisplayPath || 'your last Legacy Vault'}.
              One click resumes and only new files are secured.
            </p>
          </div>
        )}

        {(busy || snapshot.phase === 'complete' || snapshot.phase === 'needs-attention') && (
          <div className="rounded-[24px] border border-warm-border/50 bg-white/70 p-5">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                {busy && (
                  <>
                    <p className="text-sm font-medium text-warm-dark">
                      {ANCHOR_ROTATING_PHRASES[phraseIndex]}
                    </p>
                    <p className="text-sm text-warm-muted">
                      You can navigate freely. Anchoring continues quietly in the background.
                    </p>
                  </>
                )}

                {!busy && snapshot.phase === 'complete' && (
                  <>
                    <p className="text-sm font-medium text-emerald-700">
                      This archive is now anchored to your device.
                    </p>
                    {successSummary && (
                      <p className="text-sm text-warm-muted">{successSummary}</p>
                    )}
                  </>
                )}

                {!busy && snapshot.phase === 'needs-attention' && (
                  <>
                    <p className="text-sm font-medium text-amber-700">
                      Anchoring finished, but a few files still need attention.
                    </p>
                    <p className="text-sm text-warm-muted">
                      Nothing starts from zero on the next run. We will only retry the files that were not secured yet.
                    </p>
                  </>
                )}
              </div>

              {summary && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-warm-dark">{progressLabel}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-warm-muted">
                      {progressPercent}%
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-warm-border/50">
                    <div
                      className="h-full rounded-full bg-olive transition-[width] duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {snapshot.folderDisplayPath && (
                <div className="rounded-2xl bg-surface-mid/70 px-4 py-3 text-sm text-warm-dark">
                  <span className="font-medium">Legacy Vault:</span>{' '}
                  <span className="text-warm-muted">{snapshot.folderDisplayPath}</span>
                </div>
              )}

              {snapshot.files.length > 0 && (
                <div className="max-h-[360px] overflow-auto rounded-2xl border border-warm-border/40 bg-surface-low/70">
                  <div className="divide-y divide-warm-border/30">
                    {snapshot.files.map((file) => {
                      const filePercent =
                        file.totalBytes > 0
                          ? Math.min(100, Math.round((file.bytesTransferred / file.totalBytes) * 100))
                          : 0;

                      return (
                        <div key={`${file.fileId}:${file.signature}`} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-warm-dark">
                                {file.displayName}
                              </p>
                              <p className="text-xs text-warm-muted">
                                {formatBytes(file.bytesTransferred)} of {formatBytes(file.totalBytes)}
                              </p>
                            </div>
                            <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${fileStatusTone(file.status)}`}>
                              {file.status}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-warm-border/40">
                              <div
                                className="h-full rounded-full bg-olive transition-[width] duration-500"
                                style={{ width: `${filePercent}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs text-warm-muted">
                              {filePercent}%
                            </span>
                          </div>
                          {file.errorMessage && (
                            <p className="mt-2 text-xs text-red-500">{file.errorMessage}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {snapshot.target === 'opfs' && (snapshot.phase === 'complete' || snapshot.phase === 'needs-attention') && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={sharing}
                    className="inline-flex items-center gap-2 rounded-full border border-warm-border/60 bg-white px-4 py-2 text-sm font-medium text-warm-dark transition hover:bg-surface-mid disabled:cursor-wait disabled:opacity-60"
                  >
                    {sharing ? <RefreshCw size={15} className="animate-spin" /> : <Share2 size={15} />}
                    Save to Files / Camera Roll
                  </button>

                  {snapshot.offlineGalleryUrl && (
                    <a
                      href={snapshot.offlineGalleryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-warm-border/60 bg-white px-4 py-2 text-sm font-medium text-warm-dark transition hover:bg-surface-mid"
                    >
                      <ExternalLink size={15} />
                      View offline gallery
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {(actionError || snapshot.lastError || devicesError) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              <p>{actionError || snapshot.lastError || devicesError}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-warm-border/50 bg-white/80 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-warm-muted">
                  Anchored devices
                </p>
                <p className="mt-1 text-lg font-semibold text-warm-dark">
                  {devicesLoading ? 'Loading...' : `${devices.length} device${devices.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="rounded-full bg-surface-mid/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-warm-muted">
                Family only
              </div>
            </div>

            {devicesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-2xl border border-warm-border/30 bg-surface-low/70 p-4">
                    <div className="h-4 w-40 rounded bg-warm-border/40" />
                    <div className="mt-3 h-2 rounded bg-warm-border/30" />
                  </div>
                ))}
              </div>
            ) : devices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-warm-border/50 bg-surface-low/70 p-5 text-sm leading-7 text-warm-muted">
                No Legacy Vault has been anchored from this memorial yet. When a family member anchors it,
                their device will appear here with live sync progress.
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => {
                  const devicePercent =
                    device.totalBytes > 0
                      ? Math.min(
                          100,
                          Math.round((device.syncProgressBytes / device.totalBytes) * 100)
                        )
                      : 0;

                  return (
                    <div
                      key={device.id}
                      className="rounded-2xl border border-warm-border/40 bg-surface-low/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {deviceIcon(device.browser)}
                            <p className="truncate text-sm font-medium text-warm-dark">
                              {device.deviceName}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-warm-muted">
                            {device.location || `${device.browser} • ${device.os}`}
                          </p>
                        </div>
                        {statusBadge(device.status)}
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-warm-border/40">
                          <div
                            className="h-full rounded-full bg-olive transition-[width] duration-500"
                            style={{ width: `${devicePercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-warm-muted">{devicePercent}%</span>
                      </div>

                      <p className="mt-2 text-xs text-warm-muted">
                        {formatBytes(device.syncProgressBytes)} of {formatBytes(device.totalBytes)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-warm-border/50 bg-white/80 p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-olive/10 text-olive">
                <FolderOpen size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-warm-muted">
                  What Anchor does
                </p>
                <p className="mt-2 text-sm leading-7 text-warm-muted">
                  Chrome, Edge, and Opera save into a visible Legacy Vault folder you choose once and can resume later.
                  Apple devices anchor into a hidden local vault, then can hand it off to Files or Photos without
                  re-downloading anything.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-surface-low/70 p-4 text-sm leading-7 text-warm-muted">
              Every anchored device holds a complete local copy of this memorial.
              When new photos or videos are added, the next anchor only secures the files that changed.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
