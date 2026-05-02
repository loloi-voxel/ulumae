import {
  ANCHOR_DB_NAME,
  ANCHOR_DB_VERSION,
  ANCHOR_JOBS_STORE,
  type AnchorPersistedJob,
} from '@/lib/anchor/shared';

function openAnchorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ANCHOR_DB_NAME, ANCHOR_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ANCHOR_JOBS_STORE)) {
        db.createObjectStore(ANCHOR_JOBS_STORE, { keyPath: 'jobKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, tx: IDBTransaction) => void
): Promise<T> {
  return openAnchorDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(ANCHOR_JOBS_STORE, mode);
        const store = tx.objectStore(ANCHOR_JOBS_STORE);

        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.oncomplete = () => db.close();

        executor(store, tx);

        (tx as IDBTransaction & { __resolve?: (value: T) => void }).__resolve = resolve;
      })
  );
}

export async function getAnchorJob(jobKey: string): Promise<AnchorPersistedJob | null> {
  return withStore<AnchorPersistedJob | null>('readonly', (store, tx) => {
    const request = store.get(jobKey);

    request.onerror = () => tx.abort();
    request.onsuccess = () => {
      const resolve = (tx as IDBTransaction & { __resolve?: (value: AnchorPersistedJob | null) => void }).__resolve;
      resolve?.((request.result as AnchorPersistedJob | undefined) || null);
    };
  });
}

export async function putAnchorJob(job: AnchorPersistedJob): Promise<void> {
  await withStore<void>('readwrite', (store, tx) => {
    const request = store.put(job);

    request.onerror = () => tx.abort();
    request.onsuccess = () => {
      const resolve = (tx as IDBTransaction & { __resolve?: (value: void) => void }).__resolve;
      resolve?.();
    };
  });
}

export async function deleteAnchorJob(jobKey: string): Promise<void> {
  await withStore<void>('readwrite', (store, tx) => {
    const request = store.delete(jobKey);

    request.onerror = () => tx.abort();
    request.onsuccess = () => {
      const resolve = (tx as IDBTransaction & { __resolve?: (value: void) => void }).__resolve;
      resolve?.();
    };
  });
}
