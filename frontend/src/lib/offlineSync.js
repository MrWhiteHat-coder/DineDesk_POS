/**
 * Offline sync engine — replays IndexedDB-queued orders against the live API.
 *
 * Rules:
 *  - Replays strictly oldest-first; POST /orders is idempotent per
 *    client_uuid, so retries and duplicate syncs never double-bill.
 *  - 4xx (bad payload, menu item deleted, day closed) → mark `failed` so the
 *    user can inspect it; it will never succeed by retrying.
 *  - Network / 5xx / 429 → stop this pass, keep `pending`, retry next trigger.
 *  - 401 → stop (integrity of queued orders is preserved; the session flow
 *    will handle re-auth).
 *  - Success → remove from queue, toast the real order number.
 *
 * Events that trigger a sync pass: browser `online`, app boot, and manual
 * "Sync now" from the offline banner.
 */
import { orderAPI, daySessionAPI, readOfflineDayIntent, clearOfflineDayIntent } from './api';
import { getPendingOrders, markOrderSynced, markOrderFailed, recordAttempt } from './offlineOrders';

let syncing = false;
let lastSyncAt = 0;

export const isSyncing = () => syncing;

/** Minimal event bus so UI (offline banner) can live-update its count. */
const listeners = new Set();
export const onSyncEvent = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (detail) => {
  lastSyncAt = Date.now();
  listeners.forEach((fn) => { try { fn(detail); } catch { /* noop */ } });
  window.dispatchEvent(new CustomEvent('dinedesk:orders-synced', { detail }));
  // Living brand art: celebrate a successful offline sync (real event, real count)
  try {
    const n = (detail && (detail.synced || detail.count)) || 0;
    if (detail.type === 'pass-complete' && n > 0) {
      window.dispatchEvent(new CustomEvent('dinedesk:moment', { detail: { type: 'celebration', sub: `${n} offline order${n === 1 ? '' : 's'} delivered to the kitchen.` } }));
    }
  } catch { /* moments must never break sync */ }
};

export const getLastSyncAt = () => lastSyncAt;

const runSyncPass = async ({ silent = false, toast } = {}) => {
  if (syncing) return { synced: 0, blocked: true };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, offline: true };
  }
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    /* Day-open intent MUST replay before any queued orders — the backend
       rejects orders outside an open day session. A 400 here means the day
       was already opened from another terminal → clear the intent either way. */
    const dayIntent = readOfflineDayIntent();
    if (dayIntent) {
      try {
        await daySessionAPI.open(dayIntent.opening_cash || 0);
        clearOfflineDayIntent();
        emit({ type: 'day-open-synced' });
        if (toast && !silent) toast.success('Offline day-open synced');
      } catch (err) {
        const status = err?.response?.status;
        if (status && status >= 400 && status < 500) {
          // Already open (400) or genuinely rejected — never retry an open.
          clearOfflineDayIntent();
        } else {
          // Network down mid-pass — stop before touching queued orders.
          syncing = false;
          return { synced: 0, offline: true };
        }
      }
    }
    const pending = await getPendingOrders();
    for (const record of pending) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
      if ((record.attempts || 0) >= 12) {
        // Give up after 12 real attempts — surface to the user instead of
        // retrying forever.
        await markOrderFailed(record.client_uuid, 'Too many sync attempts — please re-check this order');
        failed += 1;
        continue;
      }
      try {
        await recordAttempt(record.client_uuid);
        const res = await orderAPI.create({ ...record.payload, client_uuid: record.client_uuid });
        await markOrderSynced(record.client_uuid);
        synced += 1;
        emit({ type: 'synced', client_uuid: record.client_uuid, order: res.data, count: synced });
        if (toast && !silent) toast.success(`Offline order synced — #${res.data.order_number}`);
      } catch (err) {
        const status = err?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          await markOrderFailed(record.client_uuid, err?.response?.data?.detail || `Rejected (${status})`);
          failed += 1;
          emit({ type: 'failed', client_uuid: record.client_uuid, status, count: failed });
          if (toast && !silent) toast.error(`An offline order was rejected: ${err?.response?.data?.detail || 'invalid'}`);
        } else {
          // Network / 5xx / 429 — stop the pass, keep everything pending.
          emit({ type: 'retry-later', count: synced });
          break;
        }
      }
    }
  } finally {
    syncing = false;
  }
  if (synced > 0 || failed > 0) emit({ type: 'pass-complete', synced, failed });
  return { synced, failed };
};

export const syncOfflineOrders = runSyncPass;

/** Wire global triggers. Returns a cleanup function (used by POSLayout). */
export const initOfflineSync = ({ toast } = {}) => {
  const onOnline = () => {
    // Small delay — mobile browsers fire `online` before the connection is
    // actually usable.
    setTimeout(() => { runSyncPass({ silent: true, toast }); }, 1500);
  };
  window.addEventListener('online', onOnline);
  // Boot pass: replay anything queued from a previous session.
  setTimeout(() => { runSyncPass({ silent: true, toast }); }, 4000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      setTimeout(() => { runSyncPass({ silent: true, toast }); }, 1000);
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
};
