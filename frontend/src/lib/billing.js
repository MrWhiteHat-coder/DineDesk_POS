/*
 * Canonical frontend billing arithmetic — the write-down of the backend's
 * authoritative rules (server.py create_order / add_items / pay_order).
 *
 * THE SERVER IS THE FINAL AUTHORITY on every monetary value: it recomputes
 * subtotal → tax → total from its own menu prices and restaurant tax_rate
 * on every order create / add-items / pay request. This module exists so the
 * cart and payment UIs PREDICT that result exactly, instead of inventing a
 * different formula (the old screen code taxed the DISCOUNTED subtotal
 * while the backend taxes the FULL subtotal, and hardcoded 5% tax / 10%
 * "special" discounts — the displayed total disagreed with the bill).
 *
 * Rules mirrored from the backend (do not change one side without the other):
 *   tax   = round(subtotal * tax_rate / 100, 2)   subtotal BEFORE discount
 *   total = round(subtotal + tax − discount, 2)   discount validated ≤ subtotal
 *
 * Rounding: backend Python round() is banker's rounding on exact .5 paise
 * ties; JS Math.round is half-up. The difference is ≤ ₹0.005 in rare exact-
 * tie cases and only affects display — the payable amount is always the
 * server's total, which the payment panel takes from the server response.
 */

/**
 * Compute the bill breakdown for a NEW order from cart lines.
 * @param {{price:number, quantity:number}[]} lines
 * @param {number} discountAmount  what the UI proposes (≤ subtotal)
 * @param {number} taxRate  restaurant.tax_rate (percent, e.g. 5)
 */
export function calcBill(lines, discountAmount, taxRate = 5) {
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
  const discount = Math.max(0, Math.min(round2(discountAmount || 0), subtotal));
  const tax = round2(subtotal * taxRate / 100);
  const total = round2(subtotal + tax - discount);
  return { subtotal, discount, tax, total };
}

/**
 * Project the NEW total after adding deltas to a running (server-priced)
 * order, exactly like POST /orders/{id}/add-items recomputes it:
 *   new_subtotal = Σ(all embedded items) + Σ(deltas)
 *   tax on FULL new subtotal, then discount carried unchanged from the order.
 * The displayed payable delta `dtotal` must equal that projection minus the
 * server's current total_amount.
 * @param {object} order  server order doc (items[], discount_amount, tax_amount, total_amount)
 * @param {{price:number, quantity:number}[]} deltaLines  only the NEW units
 */
export function projectRunningOrder(order, deltaLines, taxRate = 5) {
  const serverSubtotal = (order.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const deltaSubtotal = round2(deltaLines.reduce((s, l) => s + l.price * l.quantity, 0));
  const newSubtotal = round2(serverSubtotal + deltaSubtotal);
  const tax = round2(newSubtotal * taxRate / 100);
  const discount = round2(order.discount_amount || 0);
  const newTotal = round2(newSubtotal + tax - discount);
  return {
    deltaSubtotal,
    deltaTax: round2(tax - round2(order.tax_amount || 0)),
    dtotal: round2(newTotal - round2(order.total_amount || 0)),
  };
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
