// Canonical billing arithmetic — must mirror the BACKEND exactly
// (server.py create_order: tax on FULL subtotal at restaurant.tax_rate,
// then subtract discount). These tests pin the contract that previously
// disagreed between screens.
import { calcBill, projectRunningOrder } from '../billing';

describe('calcBill', () => {
  test('tax applies on the FULL subtotal before discount', () => {
    // subtotal 100, tax 5%, discount 10 → tax 5, total 95 (NOT 94.50)
    const b = calcBill([{ price: 100, quantity: 1 }], 10, 5);
    expect(b.tax).toBe(5);
    expect(b.total).toBe(95);
  });

  test('custom restaurant tax_rate is honoured (no hardcoded 5%)', () => {
    const b = calcBill([{ price: 200, quantity: 2 }], 0, 12);
    expect(b.tax).toBe(48);
  });

  test('discount is capped at the subtotal', () => {
    const b = calcBill([{ price: 50, quantity: 1 }], 80, 5);
    expect(b.discount).toBe(50);
    expect(b.total).toBe(2.5); // 50 + 2.5 tax − 50 capped discount
  });

  test('zero-value order totals to zero', () => {
    const b = calcBill([], 0, 5);
    expect(b).toEqual({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  });

  test('rounding is paise-safe', () => {
    const b = calcBill([{ price: 33.33, quantity: 3 }], 0, 5);
    expect(b.subtotal).toBe(99.99);
    expect(b.tax).toBe(5);
    expect(b.total).toBe(104.99);
  });
});

describe('projectRunningOrder', () => {
  const order = {
    items: [{ price: 40, quantity: 2 }],
    discount_amount: 10,
    tax_amount: 4,      // 80 * 5%
    total_amount: 74,   // 80 + 4 − 10
  };

  test('delta tax is computed on the FULL new subtotal like the backend', () => {
    // Add 1 more ₹40 item: new subtotal 120, tax 6, total 116 → delta ₹42
    const p = projectRunningOrder(order, [{ price: 40, quantity: 1 }], 5);
    expect(p.deltaSubtotal).toBe(40);
    expect(p.deltaTax).toBe(2);
    expect(p.dtotal).toBe(42);
  });

  test('no new items → no charge', () => {
    const p = projectRunningOrder(order, [], 5);
    expect(p.dtotal).toBe(0);
  });

  test('quantity increase of an existing item undercharges nothing', () => {
    // Old code ignored increases on existing items — this pins the fix.
    const merged = projectRunningOrder(order, [{ price: 40, quantity: 2 }], 5);
    // +2 units: new subtotal 160, tax 8, total 158 → delta 84
    expect(merged.dtotal).toBe(84);
  });
});
