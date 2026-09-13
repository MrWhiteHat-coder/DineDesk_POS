/**
 * Offline order queue — IndexedDB persistence for orders placed while the
 * restaurant's network is down.
 *
 * Design:
 *  - One object store `queue`, keyed by the order's client_uuid.
 *  - Records carry everything needed to replay the exact POST /orders call:
 *    payload, display info for the local receipt/list, created time, attempts.
 *  - Pure IndexedDB — no external dependency, works in every modern browser
 *    and the installed PWA.
 *  - All methods are promise-based and fail soft (callers decide what to do
 *    when storage itself is unavailable).
 */

const DB_NAME = 'dinedesk-offline';
const DB_VERSION = 1;
const STORE = 'queue';

let dbPromise = null;

function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'client_uuid' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const wrap = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withStore = async (mode, fn) => {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const result = await fn(tx.objectStore(STORE));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const newClientUuid = () =>
  (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Generate an offline order number for local display: OFF-<base36 time>-<rand> */
export const offlineOrderNumber = () =>
  `OFF-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

/**
 * Save an offline order. `payload` is the exact OrderCreate body to replay;
 * `display` carries what the UI showed the user (local number, total, type,
 * table, item count) so orders lists can render before sync completes.
 */
export const enqueueOfflineOrder = (payload, display = {}) =>
  withStore('readwrite', (store) => store.put({
    client_uuid: payload.client_uuid,
    payload,
    display,
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
  }));

/** All queued orders, oldest first (sync order). */
export const getPendingOrders = async () => {
  try {
    const all = await withStore('readonly', (store) => wrap(store.getAll()));
    return (all || [])
      .filter((o) => o.status === 'pending')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
};

/** Pending count for banners — 0 if storage is unavailable. */
export const getPendingCount = async () => {
  try {
    const orders = await getPendingOrders();
    return orders.length;
  } catch {
    return 0;
  }
};

export const getFailedOrders = async () => {
  try {
    const all = await withStore('readonly', (store) => wrap(store.getAll()));
    return (all || []).filter((o) => o.status === 'failed');
  } catch {
    return [];
  }
};

export const markOrderSynced = (clientUuid) =>
  withStore('readwrite', (store) => store.delete(clientUuid)).catch(() => {});

export const markOrderFailed = (clientUuid, error) =>
  withStore('readwrite', (store) =>
    wrap(store.get(clientUuid)).then((record) => {
      if (record) {
        record.status = 'failed';
        record.last_error = String(error || '').slice(0, 300);
        store.put(record);
      }
    })
  ).catch(() => {});

/** Bump the retry counter (still pending) so we can cap runaway attempts. */
export const recordAttempt = (clientUuid) =>
  withStore('readwrite', (store) =>
    wrap(store.get(clientUuid)).then((record) => {
      if (record) {
        record.attempts = (record.attempts || 0) + 1;
        store.put(record);
      }
    })
  ).catch(() => {});

export { newClientUuid };
