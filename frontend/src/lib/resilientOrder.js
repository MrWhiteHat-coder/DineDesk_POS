/**
 * Resilient order creation — the single entry POS pages use to place orders.
 *
 * Online: exactly the old behaviour (POST /orders, return server response).
 * Network failure (no response = wifi down / server unreachable): the order is
 * queued in IndexedDB with a client_uuid idempotency key and returned with a
 * local OFF- order number. The sync engine replays it when connectivity
 * returns; the backend dedupes by client_uuid so it can never double-bill.
 *
 * Server rejections (4xx with a response) are NOT swallowed — the real error
 * propagates so validation messages still show.
 */
import { orderAPI } from './api';
import { enqueueOfflineOrder, newClientUuid, offlineOrderNumber } from './offlineOrders';

export const createOrderResilient = async (payload, display = {}) => {
  try {
    const res = await orderAPI.create(payload);
    return { online: true, data: res.data };
  } catch (err) {
    if (err.response) throw err; // real API error — caller shows it
    // Network-level failure → go offline.
    const client_uuid = newClientUuid();
    const queuedPayload = { ...payload, client_uuid };
    const localOrder = {
      id: client_uuid,
      client_uuid,
      order_number: offlineOrderNumber(),
      offline: true,
      order_type: payload.order_type,
      table_number: payload.table_number ?? null,
      total_amount: display.total ?? null,
      item_count: (payload.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
      created_at: new Date().toISOString(),
    };
    await enqueueOfflineOrder(queuedPayload, {
      ...localOrder,
      customer_name: payload.customer_name || null,
    });
    // Let the POS layout banner update its waiting count immediately.
    window.dispatchEvent(new CustomEvent('dinedesk:orders-queued'));
    return { online: false, data: localOrder };
  }
};
