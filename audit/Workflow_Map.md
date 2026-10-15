# DineDesk — Order & Money Workflow Map (authoritative)

Derived from the implemented code as of 2026-10-15. Where the earlier audit
([DineDesk_Audit.md](DineDesk_Audit.md)) listed defects, this map states the
**single authoritative rule** now implemented, and which module owns it.

Financial and inventory arithmetic are owned by exactly one place each:

| Concern | Owner | Mirrors may read, never re-derive |
|---|---|---|
| Bill totals (tax, discount, payable) | **Backend** `create_order` in [backend/server.py](../backend/server.py) | Frontend [lib/billing.js](frontend/src/lib/billing.js) mirrors the formula for display only; pinned equal by tests |
| Discount cap & validation | Backend `create_order` (capped at subtotal, negatives rejected) | `calcBill()` clamps identically for live feedback |
| Tax treatment | Backend: `restaurant.tax_rate` on the **full subtotal**, discount subtracted after tax | same |
| Stock deduction | Backend `deduct_inventory` — atomic conditional `$inc` with availability guard + ledger row (`delta`, `balance_after`) | never duplicated client-side |
| Payment allocations (incl. split) | Backend `_payment_allocations(order)` from `order.payment_splits` | POS shows breakdown read-only |
| Refund accounting | Backend `/orders/{id}/refund` — per-method wallet `refund` rows, atomic `payment_status` flip | OrderManagement button is the only UI entry |
| Day-close reconciliation | Backend `close_day` + `get_day_close_report` | DayCloseReport modal + PDF render, never recompute |

---

## 1. Order lifecycle (single state machine, enforced server-side)

```
created (received) → preparing → ready → completed
        └────────────── cancelled (any non-terminal state)
completed ──refund──► refunded  (payment status: paid → refunded)
```

- Transitions validated by `_validate_order_transition` ([server.py](../backend/server.py)):
  backwards moves and skips are rejected; **repeated same-status updates are
  idempotent no-ops**.
- Kitchen status is NOT proof of payment: `pay_order` requires `ready` first when
  the kitchen is enabled, and `completed` requires payment. POS, KDS and
  OrderManagement all read the same order docs.
- Cancellation and refund are distinct events: unpaid orders are *cancelled*
  (reason required; optional manager PIN; recipe-aware restock exactly once via
  atomic claim — retries cannot restock twice). Paid orders are never
  "cancelled" — they go through `/orders/{id}/refund`.
- KDS surfaces: status color coding, freshness ring for new orders, `>20 min`
  delayed flag + filter ([KDSPage.jsx](frontend/src/pages/pos/KDSPage.jsx));
  polling never re-triggers anime moments.

## 2. Stock deduction timing (order → money → inventory)

| Event | Inventory effect |
|---|---|
| Order created / items added (confirmed order enters the day) | Recipe-based deduction, atomic, once (ledger `sale_usage`). Leveraged by `client_uuid` idempotency — replayed offline orders never deduct twice. |
| Screen renders, cart edits, payment dialog opened | **No** inventory effect. |
| Payment failed / order left unpaid | No reversal — the confirmed order still holds its consumption (kitchen may have started). Cancellation path decides restoration. |
| Cancellation before preparation | Restock (`cancel_restock` ledger row), exactly once. |
| Order completed/paid | None — already deducted. |
| Refund of a paid order | **Policy (documented decision):** restock only if the operator asserts `restock=true` (goods physically returned to sellable stock); otherwise the refund audit records "no restock — treat as waste". A refund never blindly re-enters inventory. |
| Purchase received | `purchase` ledger movement, atomic `$inc`, once (re-confirm rejected). |
| Wastage / manual adjustment | Explicit reason + actor + timestamp required; append-only ledger. |

Concurrent sales of the last unit: the conditional `$inc` guard (`quantity >= needed`)
serializes consumers in MongoDB; the loser gets a clean
`InsufficientStockError` → HTTP 409 with a clear message, never a silent
negative or lost update.

## 3. Payment rules

- Methods: cash, card, UPI as configured; split payments persisted as
  `payment_splits` allocations.
- Cash: `amount_received` validated ≥ payable (unless partial is explicitly
  configured); change stored on the order.
- A payment is "paid" only when the backend records it; retrying a payment on a
  paid order is rejected server-side (no double charge). UI buttons disable
  while pending; failed payments leave the order payable and clearly show the
  failure.
- Order numbering: atomic Mongo `counters` per restaurant-day — duplicate order
  numbers impossible under concurrent creates and webhooks.

## 4. Tables

- Dine-in create occupies the table; pay/complete/cancel/refund releases it.
- `release` refuses while an unpaid order still references the table (no
  dangling running orders).
- **Open business decision (not silently invented):** table merge/transfer is
  not implemented in the current data model. If operators need it, the endpoint
  must atomically re-point `current_order_id` + `table_number` and audit the
  move. Deferred to an explicit product decision.

## 5. Day open / close reconciliation (authoritative formulas)

```
cash_collected = Σ paid-order cash allocations (incl. split cash shares)
cash_refunds   = Σ wallet 'refund' rows of this session, method 'cash'
expected_cash  = opening_cash + cash_collected − cash_refunds
difference     = counted_closing_cash − expected_cash   (shown explicitly)
```

- Revenue excludes refunded orders (`payment_status == 'paid'` only);
  refunds are reported per method (`refund_breakdown`).
- close guard: refuses while running/unpaid orders exist (`completed`,
  `cancelled`, `refunded` are all terminal and don't block); `force=true`
  overrides and is audited.
- Duplicate close is impossible — the session flips `open → closed` once; late
  payments after close belong to the next session by `day_session_id`
  (documented reconciliation rule).
- Every figure in the dashboard, analytics, wallet and PDF derives from the
  same orders/wallet/day-session records — no screen-side arithmetic.

## 6. Failure / retry / duplicate governance

- Critical effects (order insert, payment claim, refund claim, restock,
  purchase receive) use conditional single-document claims; the loser of a race
  gets a clean 4xx, never a duplicated effect.
- Offline queue replays oldest-first with `client_uuid` dedupe; day-open intent
  replays before orders.
- All destructive actions require a reason (and manager PIN when configured)
  and land in the audit log.

---

### Findings fixed in this overhaul round (2026-10-15)

1. **Day-close cash-refund reconciliation** — refunded cash bills were invisible
   to the drawer math (`expected_cash` overstated by the refund; refunded
   orders also blocked day-close entirely). Fixed in `close_day`, the JSON
   report, the PDF drawer section and the DayCloseReport modal; regression
   tests in [test_p0_batch5.py](../backend/tests/test_p0_batch5.py).
2. **Stale off-token dark surfaces** (`#12151B`, `#161A20`, `#1A1F26`,
   `#0D100E`) replaced with the theme tokens (`#191F1B`, `#101412`) across all
   remaining POS screens, layouts and components.
3. **Documented open decisions**: partial refunds (attribution of returned
   items is a business call), table merge/transfer, coupon/percent discounts —
   listed here rather than invented.
