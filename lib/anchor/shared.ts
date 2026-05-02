import type { MediaKind } from '@/types/media';

export const ANCHOR_DB_NAME = 'ulumae-anchor';
export const ANCHOR_DB_VERSION = 1;
export const ANCHOR_JOBS_STORE = 'jobs';
export const MAX_ANCHOR_CHUNK_BYTES = 8 * 1024 * 1024;

export const ANCHOR_ROTATING_PHRASES = [
  'Bringing their memory home to your device...',
  'Securing a legacy that will outlast any server...',
  'Their story is now finding a home on your hard drive...',
  'Quietly weaving their memory into your device...',
] as const;

export type AnchorTarget = 'file-system-access' | 'opfs' | 'fallback-save';
export type AnchorDeviceStatus = 'syncing' | 'synced' | 'error' | 'stale';
export type AnchorJobPhase =
  | 'idle'
  | 'prompt'
  | 'preparing'
  | 'syncing'
  | 'finalizing'
  | 'complete'
  | 'needs-attention'
  | 'unsupported';
export type AnchorFileStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'skipped';
export type AnchorFileCategory =
  | 'photo'
  | 'video'
  | 'audio'
  | 'metadata'
  | 'thumbnail';

export interface BrowserCapabilities {
  magicFolder: boolean;
  opfs: boolean;
  zipFallback: boolean;
  browserFsAccessSupported: boolean;
  browserName: string;
  browserVersion: string;
  isApplePlatform: boolean;
  preferredTarget: AnchorTarget;
  supportsWakeLock: boolean;
  supportsPersistentStorage: boolean;
  supportsStorageEstimate: boolean;
  supportsServiceWorker: boolean;
  supportsWebShare: boolean;
}

export interface AnchorManifestRemoteSource {
  type: 'remote';
  url: string;
}

export interface AnchorManifestInlineSource {
  type: 'inline';
  content: string;
  encoding: 'utf-8';
}

export interface AnchorManifestFile {
  id: string;
  kind: MediaKind | 'offline_gallery' | 'memorial_json' | 'manifest_json' | 'readme';
  category: AnchorFileCategory;
  relativePath: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  size: number;
  signature: string;
  source: AnchorManifestRemoteSource | AnchorManifestInlineSource;
}

export interface AnchorManifestSummary {
  totalBytes: number;
  totalFiles: number;
  photoCount: number;
  videoCount: number;
  audioCount: number;
  metadataCount: number;
  galleryCount: number;
}

export interface AnchorManifest {
  memorialId: string;
  memorialName: string;
  generatedAt: string;
  updatedAt: string;
  plan: 'family';
  suggestedVaultName: string;
  manifestFingerprint: string;
  files: AnchorManifestFile[];
  summary: AnchorManifestSummary;
  offline: {
    routePath: string;
    relativeIndexPath: string;
    remoteUrlMap: Array<{
      url: string;
      relativePath: string;
      mimeType: string;
    }>;
  };
}

export interface AnchorPersistedFileState {
  fileId: string;
  displayName: string;
  category: AnchorFileCategory;
  mimeType: string;
  relativePath: string;
  signature: string;
  status: AnchorFileStatus;
  bytesTransferred: number;
  totalBytes: number;
  attempts: number;
  errorMessage: string | null;
  updatedAt: string;
}

export interface AnchorPersistedJob {
  jobKey: string;
  memorialId: string;
  memorialName: string;
  deviceId: string;
  target: AnchorTarget;
  phase: AnchorJobPhase;
  directoryHandle?: FileSystemDirectoryHandle | null;
  rootDirectoryName?: string | null;
  vaultDirectoryName: string;
  vaultDisplayPath?: string | null;
  lastManifestFingerprint?: string | null;
  summary: AnchorManifestSummary | null;
  fileStates: Record<string, AnchorPersistedFileState>;
  failedFileIds: string[];
  syncedAt: string | null;
  updatedAt: string;
  createdAt: string;
  lastError: string | null;
  serviceWorkerReady: boolean;
}

export type AnchorRuntimeFileState = AnchorPersistedFileState;

export interface AnchorSessionSnapshot {
  memorialId: string | null;
  memorialName: string | null;
  deviceId: string | null;
  target: AnchorTarget | null;
  phase: AnchorJobPhase;
  capabilities: BrowserCapabilities | null;
  summary: AnchorManifestSummary | null;
  totalBytes: number;
  transferredBytes: number;
  currentFileId: string | null;
  currentFileName: string | null;
  currentMessage: string | null;
  files: AnchorRuntimeFileState[];
  failedCount: number;
  canResume: boolean;
  hasSavedHandle: boolean;
  folderDisplayPath: string | null;
  syncedAt: string | null;
  lastError: string | null;
  serviceWorkerReady: boolean;
  offlineGalleryUrl: string | null;
  fallbackDownloadUrl: string | null;
}
