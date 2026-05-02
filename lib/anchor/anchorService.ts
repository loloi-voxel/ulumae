'use client';

import { fileSave, supported as browserFsAccessSupported } from 'browser-fs-access';

import {
  ANCHOR_ROTATING_PHRASES,
  type AnchorDeviceStatus,
  type AnchorManifest,
  type AnchorPersistedJob,
  type AnchorRuntimeFileState,
  type AnchorSessionSnapshot,
  type AnchorTarget,
  type BrowserCapabilities,
} from '@/lib/anchor/shared';
import { getAnchorJob, putAnchorJob } from '@/lib/anchor/db';

export type {
  AnchorDeviceStatus,
  AnchorRuntimeFileState,
  AnchorSessionSnapshot,
  BrowserCapabilities,
} from '@/lib/anchor/shared';

export interface AnchorDevice {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  syncProgressBytes: number;
  totalBytes: number;
  lastSyncAt: string | null;
  status: AnchorDeviceStatus;
  location?: string | null;
}

type WorkerSnapshotMessage = {
  type: 'snapshot';
  job: AnchorPersistedJob;
  currentFileId: string | null;
  currentFileName: string | null;
  currentMessage: string | null;
};

type WorkerMessage = WorkerSnapshotMessage | { type: 'fatal'; message: string };

interface WorkerStartMessage {
  type: 'start';
  payload: {
    jobKey: string;
    memorialId: string;
    memorialName: string;
    deviceId: string;
    target: AnchorTarget;
    manifest: AnchorManifest;
    directoryHandle?: FileSystemDirectoryHandle | null;
    rootDirectoryName?: string | null;
    vaultDirectoryName: string;
    vaultDisplayPath: string | null;
    serviceWorkerReady: boolean;
  };
}

type DirectoryPickerFn = (options?: {
  id?: string;
  mode?: 'read' | 'readwrite';
}) => Promise<FileSystemDirectoryHandle>;

type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  values?: () => AsyncIterableIterator<FileSystemHandle>;
};

const DEFAULT_SNAPSHOT: AnchorSessionSnapshot = {
  memorialId: null,
  memorialName: null,
  deviceId: null,
  target: null,
  phase: 'idle',
  capabilities: null,
  summary: null,
  totalBytes: 0,
  transferredBytes: 0,
  currentFileId: null,
  currentFileName: null,
  currentMessage: null,
  files: [],
  failedCount: 0,
  canResume: false,
  hasSavedHandle: false,
  folderDisplayPath: null,
  syncedAt: null,
  lastError: null,
  serviceWorkerReady: false,
  offlineGalleryUrl: null,
  fallbackDownloadUrl: null,
};

const ANCHOR_DEVICE_ID_KEY = 'ulumae-anchor-device-id';

function formatWorkerMessage(phase: AnchorSessionSnapshot['phase'], currentFileName: string | null) {
  if (phase === 'preparing') return 'Preparing your Legacy Vault...';
  if (phase === 'finalizing') return 'Finishing the offline gallery...';
  if (phase === 'complete') return 'This archive is now anchored to your device.';
  if (phase === 'needs-attention') return 'Anchoring finished with a few files that still need attention.';
  if (phase === 'unsupported') return 'Using the portable fallback for this browser...';
  if (phase === 'syncing' && currentFileName) {
    return `Anchoring ${currentFileName}...`;
  }
  return null;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function detectBrowserCapabilities(): BrowserCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      magicFolder: false,
      opfs: false,
      zipFallback: true,
      browserFsAccessSupported: false,
      browserName: 'Unknown',
      browserVersion: '0',
      isApplePlatform: false,
      preferredTarget: 'fallback-save',
      supportsWakeLock: false,
      supportsPersistentStorage: false,
      supportsStorageEstimate: false,
      supportsServiceWorker: false,
      supportsWebShare: false,
    };
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  const isEdge = ua.includes('Edg/');
  const isOpera = ua.includes('OPR/');
  const isChrome = ua.includes('Chrome/') && !isEdge && !isOpera;
  const isFirefox = ua.includes('Firefox/');
  const isSafari =
    ua.includes('Safari/') && !isChrome && !isEdge && !isOpera && !isFirefox;
  const isApplePlatform = /(Mac|iPhone|iPad|iPod)/i.test(platform) || /(iPhone|iPad|iPod)/i.test(ua);

  const browserName = isEdge
    ? 'Edge'
    : isOpera
      ? 'Opera'
      : isChrome
        ? 'Chrome'
        : isSafari
          ? 'Safari'
          : isFirefox
            ? 'Firefox'
            : 'Unknown';

  const browserVersion =
    ua.match(/(?:Edg|OPR|Chrome|Firefox|Version)\/(\d+)/)?.[1] || '0';

  const showDirectoryPickerFn = (
    window as typeof window & {
      showDirectoryPicker?: DirectoryPickerFn;
    }
  ).showDirectoryPicker;
  const magicFolder = typeof showDirectoryPickerFn === 'function';
  const opfs =
    typeof navigator.storage?.getDirectory === 'function';
  const preferredTarget: AnchorTarget = isApplePlatform && opfs
    ? 'opfs'
    : magicFolder
      ? 'file-system-access'
      : 'fallback-save';

  return {
    magicFolder,
    opfs,
    zipFallback: !magicFolder && !opfs,
    browserFsAccessSupported,
    browserName,
    browserVersion,
    isApplePlatform,
    preferredTarget,
    supportsWakeLock: typeof navigator.wakeLock?.request === 'function',
    supportsPersistentStorage: typeof navigator.storage?.persist === 'function',
    supportsStorageEstimate: typeof navigator.storage?.estimate === 'function',
    supportsServiceWorker: 'serviceWorker' in navigator,
    supportsWebShare: typeof navigator.share === 'function',
  };
}

export function getDeviceInfo() {
  const capabilities = detectBrowserCapabilities();
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'Unknown OS' : 'Unknown OS';

  return {
    name: `${capabilities.browserName} on ${platform}`,
    browser: `${capabilities.browserName} ${capabilities.browserVersion}`,
    os: platform,
  };
}

function getStoredDeviceId() {
  if (typeof window === 'undefined') return crypto.randomUUID();

  const existing = window.localStorage.getItem(ANCHOR_DEVICE_ID_KEY);
  if (existing) return existing;

  const next = `dev_${crypto.randomUUID()}`;
  window.localStorage.setItem(ANCHOR_DEVICE_ID_KEY, next);
  return next;
}

function snapshotFromJob(
  job: AnchorPersistedJob | null,
  capabilities: BrowserCapabilities | null,
  overrides?: Partial<AnchorSessionSnapshot>
): AnchorSessionSnapshot {
  if (!job) {
    return {
      ...DEFAULT_SNAPSHOT,
      capabilities,
      ...overrides,
    };
  }

  const files = Object.values(job.fileStates).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
  const transferredBytes = files.reduce((sum, file) => sum + file.bytesTransferred, 0);
  const failedCount = files.filter(
    (file) => file.status === 'failed' || file.status === 'skipped'
  ).length;
  const hasSavedHandle = Boolean(job.directoryHandle) || job.target === 'opfs';
  const canResume = hasSavedHandle && job.phase !== 'syncing';

  return {
    memorialId: job.memorialId,
    memorialName: job.memorialName,
    deviceId: job.deviceId,
    target: job.target,
    phase: job.phase,
    capabilities,
    summary: job.summary,
    totalBytes: job.summary?.totalBytes || files.reduce((sum, file) => sum + file.totalBytes, 0),
    transferredBytes,
    currentFileId: null,
    currentFileName: null,
    currentMessage: formatWorkerMessage(job.phase, null),
    files,
    failedCount,
    canResume,
    hasSavedHandle,
    folderDisplayPath: job.vaultDisplayPath || null,
    syncedAt: job.syncedAt,
    lastError: job.lastError,
    serviceWorkerReady: job.serviceWorkerReady,
    offlineGalleryUrl:
      job.target === 'opfs' && job.serviceWorkerReady
        ? `/anchor/offline/${job.memorialId}`
        : null,
    fallbackDownloadUrl: null,
    ...overrides,
  };
}

async function requestDirectoryHandle(memorialId: string) {
  const picker = (
    window as typeof window & {
      showDirectoryPicker?: DirectoryPickerFn;
    }
  ).showDirectoryPicker;

  if (!picker) {
    throw new Error('This browser cannot choose a visible Legacy Vault folder.');
  }

  return picker({
    id: `ulumae-anchor-${memorialId}`,
    mode: 'readwrite',
  });
}

async function ensureHandlePermission(handle: FileSystemDirectoryHandle) {
  const permissionHandle = handle as PermissionAwareDirectoryHandle;
  if (!permissionHandle.queryPermission || !permissionHandle.requestPermission) {
    return handle;
  }

  const current = await permissionHandle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return handle;

  const requested = await permissionHandle.requestPermission({ mode: 'readwrite' });
  if (requested !== 'granted') {
    throw new Error('The Legacy Vault folder permission was declined.');
  }

  return handle;
}

async function fetchAnchorManifest(memorialId: string): Promise<AnchorManifest> {
  const response = await fetch('/api/anchor/manifest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memorialId }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not prepare the Legacy Vault manifest.');
  }

  return payload as AnchorManifest;
}

async function registerAnchorDevice(args: {
  memorialId: string;
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  syncProgressBytes?: number;
  totalBytes?: number;
  status?: AnchorDeviceStatus;
  location?: string | null;
}) {
  const response = await fetch('/api/anchor/register-device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not register this device for anchoring.');
  }

  return payload as {
    deviceId: string;
    status: AnchorDeviceStatus;
    location: string | null;
  };
}

async function pushSyncStatus(args: {
  memorialId: string;
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  syncProgressBytes: number;
  totalBytes: number;
  status: AnchorDeviceStatus;
  location?: string | null;
}) {
  await fetch('/api/anchor/sync-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  }).catch(() => undefined);
}

async function prepareStorage(
  capabilities: BrowserCapabilities,
  target: AnchorTarget,
  totalBytes: number
) {
  if (capabilities.supportsPersistentStorage) {
    try {
      await navigator.storage.persist();
    } catch {
      // Best effort.
    }
  }

  if (capabilities.supportsStorageEstimate && target === 'opfs') {
    const estimate = await navigator.storage.estimate();
    const available = (estimate.quota || 0) - (estimate.usage || 0);

    if (available > 0 && available < totalBytes) {
      throw new Error(
        `This browser vault only has about ${formatBytes(available)} available, but this archive needs ${formatBytes(totalBytes)}.`
      );
    }
  }
}

async function runPortableFallback(memorialId: string, memorialName: string) {
  const response = await fetch('/api/arche/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memorialId }),
  });
  const payload = await response.json();

  if (!response.ok || !payload?.downloadUrl) {
    throw new Error(payload?.error || 'Could not create the portable anchor bundle.');
  }

  const archiveResponse = await fetch(payload.downloadUrl, {
    cache: 'no-store',
  });

  if (!archiveResponse.ok) {
    throw new Error('Could not fetch the portable anchor bundle.');
  }

  await fileSave(archiveResponse, {
    id: `ulumae-anchor-fallback-${memorialId}`,
    fileName: payload.filename || `${memorialName}-legacy-vault.zip`,
    description: 'ULUMAE Legacy Vault',
    extensions: ['.zip'],
    mimeTypes: ['application/zip'],
  });
}

async function getOpfsVaultDirectory(memorialId: string, vaultDirectoryName: string) {
  const root = await navigator.storage.getDirectory();
  const anchorRoot = await root.getDirectoryHandle('ulumae-anchor', { create: true });
  const memorialRoot = await anchorRoot.getDirectoryHandle(memorialId, { create: true });
  return memorialRoot.getDirectoryHandle(vaultDirectoryName, { create: true });
}

async function collectOpfsFiles(
  directoryHandle: FileSystemDirectoryHandle,
  files: File[] = []
): Promise<File[]> {
  const iterator = (directoryHandle as PermissionAwareDirectoryHandle).values?.();
  if (!iterator) {
    return files;
  }

  for await (const entry of iterator) {
    if (entry.kind === 'file') {
      files.push(await (entry as FileSystemFileHandle).getFile());
      continue;
    }

    await collectOpfsFiles(entry as FileSystemDirectoryHandle, files);
  }

  return files;
}

class AnchorController {
  private snapshot: AnchorSessionSnapshot = DEFAULT_SNAPSHOT;
  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private capabilities: BrowserCapabilities | null = null;
  private currentManifest: AnchorManifest | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private syncTimer: number | null = null;
  private syncIdentity:
    | {
        memorialId: string;
        deviceId: string;
        deviceName: string;
        browser: string;
        os: string;
      }
    | null = null;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private setSnapshot(next: AnchorSessionSnapshot) {
    this.snapshot = next;
    this.emit();
  }

  private async acquireWakeLock() {
    if (!this.capabilities?.supportsWakeLock) return;

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock() {
    try {
      await this.wakeLock?.release();
    } catch {
      // noop
    } finally {
      this.wakeLock = null;
    }
  }

  private ensureWorker() {
    if (this.worker) return this.worker;

    this.worker = new Worker(new URL('./anchor.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === 'fatal') {
        this.setSnapshot({
          ...this.snapshot,
          phase: 'needs-attention',
          lastError: message.message,
          currentMessage: message.message,
        });
        await this.releaseWakeLock();
        return;
      }

      const nextSnapshot = snapshotFromJob(message.job, this.capabilities, {
        currentFileId: message.currentFileId,
        currentFileName: message.currentFileName,
        currentMessage:
          message.currentMessage ||
          formatWorkerMessage(message.job.phase, message.currentFileName),
      });

      this.setSnapshot(nextSnapshot);
      this.scheduleServerSync();

      if (nextSnapshot.phase === 'complete' || nextSnapshot.phase === 'needs-attention') {
        await this.releaseWakeLock();

        if (nextSnapshot.target === 'opfs' && this.currentManifest) {
          await this.activateOfflineVault(message.job, this.currentManifest);
        }
      }
    };

    return this.worker;
  }

  private scheduleServerSync() {
    if (!this.syncIdentity) return;
    if (this.syncTimer) return;

    this.syncTimer = window.setTimeout(async () => {
      this.syncTimer = null;
      if (!this.syncIdentity) return;

      const serverStatus: AnchorDeviceStatus =
        this.snapshot.phase === 'complete'
          ? 'synced'
          : this.snapshot.phase === 'needs-attention'
            ? 'error'
            : 'syncing';

      await pushSyncStatus({
        memorialId: this.syncIdentity.memorialId,
        deviceId: this.syncIdentity.deviceId,
        deviceName: this.syncIdentity.deviceName,
        browser: this.syncIdentity.browser,
        os: this.syncIdentity.os,
        syncProgressBytes: this.snapshot.transferredBytes,
        totalBytes: this.snapshot.totalBytes,
        status: serverStatus,
        location: this.snapshot.folderDisplayPath,
      });
    }, 1200);
  }

  private async activateOfflineVault(job: AnchorPersistedJob, manifest: AnchorManifest) {
    if (!this.capabilities?.supportsServiceWorker) return;

    try {
      const registration = await navigator.serviceWorker.register('/anchor-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      const vaultRoute = `/anchor/offline/${job.memorialId}`;
      const swPayload = {
        type: 'configure-anchor-vault',
        payload: {
          memorialId: job.memorialId,
          routePath: manifest.offline.routePath || vaultRoute,
          vaultDirectoryName: job.vaultDirectoryName,
          remoteUrlMap: manifest.offline.remoteUrlMap,
        },
      };

      if (registration.active) {
        registration.active.postMessage(swPayload);
      } else if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(swPayload);
      }

      const refreshedJob = await getAnchorJob(job.jobKey);
      if (refreshedJob) {
        const nextJob = {
          ...refreshedJob,
          serviceWorkerReady: true,
          updatedAt: new Date().toISOString(),
        };
        await putAnchorJob(nextJob);

        this.setSnapshot(
          snapshotFromJob(
            nextJob,
            this.capabilities,
            {
              serviceWorkerReady: true,
              offlineGalleryUrl: vaultRoute,
            }
          )
        );
      }
    } catch (error) {
      console.error('[anchor-service-worker]', error);
    }
  }

  async hydrate(memorialId: string) {
    this.capabilities = detectBrowserCapabilities();
    this.setSnapshot({
      ...DEFAULT_SNAPSHOT,
      memorialId,
      capabilities: this.capabilities,
    });
    const job = await getAnchorJob(memorialId).catch(() => null);
    this.setSnapshot(snapshotFromJob(job, this.capabilities));
  }

  async start(memorialId: string, options?: { resume?: boolean }) {
    this.capabilities = detectBrowserCapabilities();

    if (this.snapshot.phase === 'syncing' || this.snapshot.phase === 'preparing') {
      return;
    }

    try {
      const manifest = await fetchAnchorManifest(memorialId);
      this.currentManifest = manifest;

      if (this.capabilities.preferredTarget === 'fallback-save') {
        this.setSnapshot({
          ...DEFAULT_SNAPSHOT,
          memorialId,
          memorialName: manifest.memorialName,
          capabilities: this.capabilities,
          phase: 'unsupported',
          currentMessage: 'Preparing the portable anchor bundle...',
        });
        await runPortableFallback(memorialId, manifest.memorialName);
        this.setSnapshot({
          ...DEFAULT_SNAPSHOT,
          memorialId,
          memorialName: manifest.memorialName,
          capabilities: this.capabilities,
          phase: 'complete',
          currentMessage: 'A portable Legacy Vault was saved for this browser.',
          summary: manifest.summary,
          totalBytes: manifest.summary.totalBytes,
          transferredBytes: manifest.summary.totalBytes,
        });
        return;
      }

      await prepareStorage(
        this.capabilities,
        this.capabilities.preferredTarget,
        manifest.summary.totalBytes
      );
      await this.acquireWakeLock();

      const existingJob = await getAnchorJob(memorialId).catch(() => null);
      let directoryHandle: FileSystemDirectoryHandle | null | undefined = null;
      let rootDirectoryName: string | null = null;

      if (this.capabilities.preferredTarget === 'file-system-access') {
        if (options?.resume && existingJob?.directoryHandle) {
          directoryHandle = await ensureHandlePermission(existingJob.directoryHandle);
        } else {
          directoryHandle = await requestDirectoryHandle(memorialId);
        }
        rootDirectoryName = directoryHandle.name;
      }

      const vaultDisplayPath =
        this.capabilities.preferredTarget === 'file-system-access'
          ? `${rootDirectoryName}/${manifest.suggestedVaultName}`
          : `Browser Vault/${manifest.suggestedVaultName}`;

      const deviceInfo = getDeviceInfo();
      const deviceId = existingJob?.deviceId || getStoredDeviceId();

      await registerAnchorDevice({
        memorialId,
        deviceId,
        deviceName: deviceInfo.name,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        syncProgressBytes: existingJob
          ? Object.values(existingJob.fileStates).reduce(
              (sum, file) => sum + file.bytesTransferred,
              0
            )
          : 0,
        totalBytes: manifest.summary.totalBytes,
        status: 'syncing',
        location: vaultDisplayPath,
      });

      this.syncIdentity = {
        memorialId,
        deviceId,
        deviceName: deviceInfo.name,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      };

      this.setSnapshot({
        ...snapshotFromJob(existingJob, this.capabilities, {
          memorialId,
          memorialName: manifest.memorialName,
          deviceId,
          target: this.capabilities.preferredTarget,
          phase: 'preparing',
          summary: manifest.summary,
          totalBytes: manifest.summary.totalBytes,
          folderDisplayPath: vaultDisplayPath,
          currentMessage: 'Preparing your Legacy Vault...',
        }),
      });

      const worker = this.ensureWorker();
      const message: WorkerStartMessage = {
        type: 'start',
        payload: {
          jobKey: memorialId,
          memorialId,
          memorialName: manifest.memorialName,
          deviceId,
          target: this.capabilities.preferredTarget,
          manifest,
          directoryHandle,
          rootDirectoryName,
          vaultDirectoryName: manifest.suggestedVaultName,
          vaultDisplayPath,
          serviceWorkerReady: existingJob?.serviceWorkerReady || false,
        },
      };
      worker.postMessage(message);
    } catch (error) {
      await this.releaseWakeLock();
      throw error;
    }
  }

  async shareToFiles(memorialId: string) {
    const job = await getAnchorJob(memorialId);
    if (!job || job.target !== 'opfs') {
      throw new Error('This Legacy Vault is not stored in the browser vault on this device.');
    }

    if (!navigator.share || !navigator.canShare) {
      throw new Error('This browser cannot hand the anchored files off to Files or Photos.');
    }

    const vaultDir = await getOpfsVaultDirectory(memorialId, job.vaultDirectoryName);
    const files = await collectOpfsFiles(vaultDir);

    if (files.length === 0) {
      throw new Error('There are no anchored files ready to share yet.');
    }

    const orderedFiles = [...files].sort((left, right) =>
      left.name === 'index.html' ? -1 : right.name === 'index.html' ? 1 : left.name.localeCompare(right.name)
    );

    if (!navigator.canShare({ files: orderedFiles })) {
      throw new Error(
        'This browser cannot share the full Legacy Vault in one step. Try fewer files or use the offline gallery directly.'
      );
    }

    await navigator.share({
      title: `${job.memorialName} Legacy Vault`,
      text: 'Anchored locally from ULUMAE.',
      files: orderedFiles,
    });
  }
}

const controller = new AnchorController();

export function subscribeToAnchorSession(listener: () => void) {
  return controller.subscribe(listener);
}

export function getAnchorSessionSnapshot() {
  return controller.getSnapshot();
}

export function hydrateAnchorSession(memorialId: string) {
  return controller.hydrate(memorialId);
}

export function startAnchor(memorialId: string, options?: { resume?: boolean }) {
  return controller.start(memorialId, options);
}

export function shareAnchorToFiles(memorialId: string) {
  return controller.shareToFiles(memorialId);
}

export { ANCHOR_ROTATING_PHRASES };
