/// <reference lib="webworker" />

import { getAnchorJob, putAnchorJob } from '@/lib/anchor/db';
import {
  MAX_ANCHOR_CHUNK_BYTES,
  type AnchorManifest,
  type AnchorPersistedFileState,
  type AnchorPersistedJob,
  type AnchorTarget,
} from '@/lib/anchor/shared';

type WorkerStartPayload = {
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

type WorkerStartMessage = {
  type: 'start';
  payload: WorkerStartPayload;
};

function nowIso() {
  return new Date().toISOString();
}

function buildFileState(file: AnchorManifest['files'][number]): AnchorPersistedFileState {
  return {
    fileId: file.id,
    displayName: file.displayName,
    category: file.category,
    mimeType: file.mimeType,
    relativePath: file.relativePath,
    signature: file.signature,
    status: 'pending',
    bytesTransferred: 0,
    totalBytes: file.size,
    attempts: 0,
    errorMessage: null,
    updatedAt: nowIso(),
  };
}

function mergeFileStates(
  manifest: AnchorManifest,
  existingJob: AnchorPersistedJob | null
) {
  return Object.fromEntries(
    manifest.files.map((file) => {
      const existing = existingJob?.fileStates[file.id];
      const isSameVersion =
        existing &&
        existing.signature === file.signature &&
        existing.relativePath === file.relativePath;

      if (isSameVersion && existing.status === 'completed') {
        return [
          file.id,
          {
            ...existing,
            displayName: file.displayName,
            category: file.category,
            mimeType: file.mimeType,
            totalBytes: file.size,
          },
        ];
      }

      return [file.id, buildFileState(file)];
    })
  ) as Record<string, AnchorPersistedFileState>;
}

function buildJob(
  payload: WorkerStartPayload,
  existingJob: AnchorPersistedJob | null
): AnchorPersistedJob {
  const createdAt = existingJob?.createdAt || nowIso();

  return {
    jobKey: payload.jobKey,
    memorialId: payload.memorialId,
    memorialName: payload.memorialName,
    deviceId: payload.deviceId,
    target: payload.target,
    phase: 'preparing',
    directoryHandle:
      payload.target === 'file-system-access'
        ? payload.directoryHandle || null
        : null,
    rootDirectoryName: payload.rootDirectoryName || null,
    vaultDirectoryName: payload.vaultDirectoryName,
    vaultDisplayPath: payload.vaultDisplayPath,
    lastManifestFingerprint: payload.manifest.manifestFingerprint,
    summary: payload.manifest.summary,
    fileStates: mergeFileStates(payload.manifest, existingJob),
    failedFileIds: [],
    syncedAt: null,
    updatedAt: nowIso(),
    createdAt,
    lastError: null,
    serviceWorkerReady: payload.serviceWorkerReady,
  };
}

function postSnapshot(
  job: AnchorPersistedJob,
  currentFileId: string | null,
  currentFileName: string | null,
  currentMessage: string | null
) {
  self.postMessage({
    type: 'snapshot',
    job,
    currentFileId,
    currentFileName,
    currentMessage,
  });
}

async function persistAndPost(
  job: AnchorPersistedJob,
  currentFileId: string | null,
  currentFileName: string | null,
  currentMessage: string | null
) {
  job.updatedAt = nowIso();
  await putAnchorJob(job);
  postSnapshot(job, currentFileId, currentFileName, currentMessage);
}

async function ensureDirectoryPath(
  root: FileSystemDirectoryHandle,
  segments: string[]
) {
  let current = root;

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }

  return current;
}

async function getTargetVaultRoot(
  payload: WorkerStartPayload
): Promise<FileSystemDirectoryHandle> {
  if (payload.target === 'file-system-access') {
    if (!payload.directoryHandle) {
      throw new Error('No Legacy Vault folder handle is available.');
    }

    return payload.directoryHandle.getDirectoryHandle(payload.vaultDirectoryName, {
      create: true,
    });
  }

  const root = await navigator.storage.getDirectory();
  const anchorRoot = await root.getDirectoryHandle('ulumae-anchor', { create: true });
  const memorialRoot = await anchorRoot.getDirectoryHandle(payload.memorialId, {
    create: true,
  });

  return memorialRoot.getDirectoryHandle(payload.vaultDirectoryName, { create: true });
}

async function createFileWriters(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  target: AnchorTarget
) {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();

  if (!fileName) {
    throw new Error(`Invalid target path: ${relativePath}`);
  }

  const parent = await ensureDirectoryPath(root, parts);
  const fileHandle = await parent.getFileHandle(fileName, { create: true });

  if (target === 'opfs' && 'createSyncAccessHandle' in fileHandle) {
    const syncHandle = await fileHandle.createSyncAccessHandle();
    syncHandle.truncate(0);

    return {
      async write(chunk: Uint8Array, position: number) {
        syncHandle.write(chunk, { at: position });
      },
      async close() {
        syncHandle.flush();
        syncHandle.close();
      },
    };
  }

  const writable = await fileHandle.createWritable();
  await writable.truncate(0);

  return {
      async write(chunk: Uint8Array, position: number) {
        const normalizedChunk = Uint8Array.from(chunk);
        await writable.write({
          type: 'write',
          position,
          data: new Blob([normalizedChunk]),
        });
      },
    async close() {
      await writable.close();
    },
  };
}

async function writeInlineFile(
  root: FileSystemDirectoryHandle,
  target: AnchorTarget,
  file: AnchorManifest['files'][number]
) {
  const writer = await createFileWriters(root, file.relativePath, target);
  const bytes = new TextEncoder().encode(
    file.source.type === 'inline' ? file.source.content : ''
  );
  await writer.write(bytes, 0);
  await writer.close();
}

async function writeRemoteFile(
  root: FileSystemDirectoryHandle,
  target: AnchorTarget,
  file: AnchorManifest['files'][number],
  onProgress: (bytesTransferred: number) => Promise<void>
) {
  if (file.source.type !== 'remote') {
    throw new Error('Remote file expected.');
  }

  const writer = await createFileWriters(root, file.relativePath, target);
  let position = 0;

  try {
    for (let start = 0; start < file.size; start += MAX_ANCHOR_CHUNK_BYTES) {
      const end = Math.min(file.size - 1, start + MAX_ANCHOR_CHUNK_BYTES - 1);
      const response = await fetch(file.source.url, {
        cache: 'no-store',
        headers: {
          Range: `bytes=${start}-${end}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Chunk request failed with status ${response.status}.`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        await writer.write(bytes, position);
        position += bytes.byteLength;
        await onProgress(position);
        continue;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        await writer.write(value, position);
        position += value.byteLength;
        await onProgress(position);
      }
    }
  } finally {
    await writer.close();
  }
}

async function transferFile(
  root: FileSystemDirectoryHandle,
  target: AnchorTarget,
  job: AnchorPersistedJob,
  file: AnchorManifest['files'][number]
) {
  const fileState = job.fileStates[file.id];
  fileState.status = 'syncing';
  fileState.bytesTransferred = 0;
  fileState.totalBytes = file.size;
  fileState.errorMessage = null;
  fileState.attempts += 1;
  fileState.updatedAt = nowIso();
  job.phase = 'syncing';
  job.lastError = null;

  await persistAndPost(
    job,
    file.id,
    file.displayName,
    `Anchoring ${file.displayName}...`
  );

  if (file.source.type === 'inline') {
    await writeInlineFile(root, target, file);
    fileState.bytesTransferred = file.size;
    fileState.status = 'completed';
    fileState.updatedAt = nowIso();
    await persistAndPost(job, file.id, file.displayName, `Anchored ${file.displayName}.`);
    return;
  }

  await writeRemoteFile(root, target, file, async (bytesTransferred) => {
    fileState.bytesTransferred = bytesTransferred;
    fileState.updatedAt = nowIso();
    await persistAndPost(
      job,
      file.id,
      file.displayName,
      `Anchoring ${file.displayName}...`
    );
  });

  fileState.status = 'completed';
  fileState.bytesTransferred = file.size;
  fileState.updatedAt = nowIso();

  await persistAndPost(job, file.id, file.displayName, `Anchored ${file.displayName}.`);
}

async function run(payload: WorkerStartPayload) {
  const existingJob = await getAnchorJob(payload.jobKey).catch(() => null);
  const job = buildJob(payload, existingJob);
  const root = await getTargetVaultRoot(payload);

  await persistAndPost(job, null, null, 'Preparing your Legacy Vault...');

  for (const file of payload.manifest.files) {
    const fileState = job.fileStates[file.id];

    if (
      fileState &&
      fileState.signature === file.signature &&
      fileState.status === 'completed' &&
      fileState.bytesTransferred >= file.size
    ) {
      continue;
    }

    let succeeded = false;

    for (let attempt = fileState.attempts; attempt < 3; attempt += 1) {
      try {
        await transferFile(root, payload.target, job, file);
        succeeded = true;
        break;
      } catch (error: any) {
        fileState.status = attempt >= 2 ? 'skipped' : 'pending';
        fileState.errorMessage = error.message || 'File transfer failed.';
        fileState.bytesTransferred = 0;
        fileState.updatedAt = nowIso();
        job.lastError = fileState.errorMessage;

        await persistAndPost(
          job,
          file.id,
          file.displayName,
          attempt >= 2
            ? `Skipped ${file.displayName} after 3 attempts.`
            : `Retrying ${file.displayName}...`
        );
      }
    }

    if (!succeeded) {
      job.failedFileIds = Array.from(new Set([...job.failedFileIds, file.id]));
    }
  }

  job.phase = job.failedFileIds.length > 0 ? 'needs-attention' : 'complete';
  job.syncedAt = job.failedFileIds.length > 0 ? null : nowIso();
  job.lastError =
    job.failedFileIds.length > 0
      ? `${job.failedFileIds.length} file(s) still need attention.`
      : null;

  await persistAndPost(
    job,
    null,
    null,
    job.phase === 'complete'
      ? 'This archive is now anchored to your device.'
      : 'Anchoring finished with a few files that still need attention.'
  );
}

self.onmessage = async (event: MessageEvent<WorkerStartMessage>) => {
  if (event.data.type !== 'start') return;

  try {
    await run(event.data.payload);
  } catch (error: any) {
    self.postMessage({
      type: 'fatal',
      message: error.message || 'Anchoring failed unexpectedly.',
    });
  }
};
