const INDEX_CACHE = 'ulumae-anchor-index-v1';
const INDEX_KEY = '/__ulumae_anchor_index__';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function readIndex() {
  const cache = await caches.open(INDEX_CACHE);
  const response = await cache.match(INDEX_KEY);

  if (!response) {
    return {};
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function writeIndex(index) {
  const cache = await caches.open(INDEX_CACHE);
  await cache.put(
    INDEX_KEY,
    new Response(JSON.stringify(index), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
}

async function getVaultRoot(memorialId, vaultDirectoryName) {
  const root = await navigator.storage.getDirectory();
  const anchorRoot = await root.getDirectoryHandle('ulumae-anchor');
  const memorialRoot = await anchorRoot.getDirectoryHandle(memorialId);
  return memorialRoot.getDirectoryHandle(vaultDirectoryName);
}

async function getFileHandleFromRelativePath(root, relativePath) {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();

  if (!fileName) {
    throw new Error(`Invalid relative path: ${relativePath}`);
  }

  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part);
  }

  return current.getFileHandle(fileName);
}

async function readVaultFile(entry, relativePath, mimeType) {
  const root = await getVaultRoot(entry.memorialId, entry.vaultDirectoryName);
  const fileHandle = await getFileHandleFromRelativePath(root, relativePath);
  const file = await fileHandle.getFile();

  return new Response(file.stream(), {
    headers: {
      'Content-Type': mimeType || file.type || 'application/octet-stream',
      'Content-Length': String(file.size),
      'Cache-Control': 'no-store',
    },
  });
}

function findRouteEntry(index, pathname) {
  return Object.values(index).find((entry) => entry.routePath === pathname) || null;
}

function findRemoteEntry(index, url) {
  for (const entry of Object.values(index)) {
    const remoteMatch = (entry.remoteUrlMap || []).find((item) => item.url === url);
    if (remoteMatch) {
      return {
        entry,
        remoteMatch,
      };
    }
  }

  return null;
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'configure-anchor-vault') {
    return;
  }

  event.waitUntil(
    (async () => {
      const index = await readIndex();
      index[event.data.payload.memorialId] = event.data.payload;
      await writeIndex(index);
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  event.respondWith(
    (async () => {
      const index = await readIndex();

      if (url.origin === self.location.origin) {
        const routeEntry = findRouteEntry(index, url.pathname);
        if (routeEntry) {
          try {
            return await readVaultFile(routeEntry, 'index.html', 'text/html');
          } catch (error) {
            console.error('[anchor-sw][route]', error);
          }
        }
      }

      const remoteEntry = findRemoteEntry(index, request.url);
      if (remoteEntry) {
        try {
          return await fetch(request);
        } catch {
          return readVaultFile(
            remoteEntry.entry,
            remoteEntry.remoteMatch.relativePath,
            remoteEntry.remoteMatch.mimeType
          );
        }
      }

      return fetch(request);
    })()
  );
});
