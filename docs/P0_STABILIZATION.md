# DineDesk P0 Batch 3 — Phase 1 Stabilization Notes

Scope: data-integrity stabilization only. No new features, no UI changes,
no deployments. All behavior described here is covered by regression tests in
`backend/tests/test_p0_batch3.py` (plus the earlier batches).

---

## 1. Inventory crash recovery (order deducted but insert never landed)

### The risk
`create_order` deducts recipe inventory **before** inserting the order (a 409
stock-validation must leave no order residue). If the process dies in that
window, the deduction is in the stock ledger but no order ever exists — so the
cancel-restock path can never fire and the stock is silently lost.

### The mechanism (`server.recover_orphaned_order_deductions`)
Runs once at app startup, after indexes. Safety properties:

1. **Ledger is the source of truth.** Deduction ledger rows are now tagged
   `ref_type="order_deduction"`, `ref_id=<order id>` (rollback/recovery rows
   carry the same `ref_id`). The outstanding amount is recomputed each run as
   `−(Σ ledger deltas for that ref)` — recovery **never remembers amounts**.
   Recovery rows share the same ref, so a crash *during* recovery resumes with
   only the remainder. Stock therefore can never be restocked twice.
2. **Ledger-row-first ordering.** The recovery ledger row is written before
   the `$inc`. The only residual window is a crash between that row and the
   `$inc`: the ledger then shows a recovery row whose `balance_after` is
   higher than actual stock — a loud, reviewable inconsistency (reported via
   `balance_after` in the ledger), never a silent double-restock.
3. **No false positives.** A group is processed only when (a) no order with
   that id exists, and (b) every row in the group is older than
   `RECOVERY_GRACE_SECONDS` (default 300 s), so another app worker's
   in-flight create is never "recovered" mid-request.
4. **Cross-worker claim.** `stock_recovery_claims` documents: the insert is
   the atomic claim; a fresh `processing` claim blocks other workers; a claim
   older than the grace TTL is treated as a dead process's and reclaimed
   (reclaim-safe because amounts are recomputed). Completion flips it `done`.
5. **Ledger corruption is flagged, not "fixed".** If a group's net ledger
   delta is *positive* on some item, nothing is touched; an ERROR is logged
   for manual reconciliation.
6. **No offline-replay interference.** The replay path (unique
   `(restaurant_id, client_uuid)` + duplicate-key compensation) is unchanged;
   crash recovery covers only orders whose insert never happened at all.

Regime limits (documented, tested):
- Legacy rows written before this feature (`ref_type="menu_item"`) carry no
  order identity and are intentionally not recoverable.
- A restaurant running only ONE app process has no concurrency exposure;
  multi-worker deployments rely on the grace window + claims.

### Verified behaviors (test_p0_batch3.py)
created-before-insert fully restored; idempotent double run; remainder-only
resume after a mid-recovery crash; settled 409 (net 0) untouched; live order
untouched; grace window respected; tenant-isolated; positive-net flagged not
touched; active claim blocks a second worker; stale claim reclaimed.
End-to-end: a real `create_order`'s ledger rows carry the landed order's id.

---

## 2. Stock shortage policy (`stock_validation`)

**Nothing about the defaults changed.** The per-restaurant flag
`restaurants.stock_validation` decides:

| Setting | On shortage | Sale result | Ledger |
|---|---|---|---|
| flag absent / false (default, legacy) | deduct what is there, floor at zero | sale **succeeds**; overselling possible | records the **actual** applied delta (e.g. −1 for a 2-unit recipe when 1 was in stock) |
| flag true | raise `InsufficientStockError` → HTTP **409** before order insert | sale **rejected**; stock & orders untouched | on multi-ingredient shortages, already-applied deductions are compensated with `order_deduction_rollback` rows |

Regime contract (tested):
- Missing flag ⇒ exactly old behavior (floored deduction, successful sale).
- Flag on + sufficient stock ⇒ full exact deduction.
- Flag on + shortage ⇒ 409, stock untouched, no order residue.
- Either regime stock can never go negative (`$inc` guarded on quantity).

Recommendation: enable `stock_validation` per restaurant once stock counts
are trusted; legacy data with old flooring can make strict validation
difficult on day one. This is an operational choice per tenant — not flipped
here for anyone.

---

## 3. Legacy duplicate order numbers — dry-run report + manual resolution

The unique `(restaurant_id, order_number)` index is **deliberately not
created** while legacy duplicates exist (server startup logs and skips it).
Two tools cover this residual risk:

- **Startup:** the app itself logs detected duplicate groups at launch and
  proceeds WITHOUT the unique index (service unaffected; numbering stays
  duplicate-free going forward via atomic counters).
- **Dry-run report (read-only, never writes):**
  `python scripts/check_order_number_duplicates.py`
  — prints every duplicate group per restaurant with each copy's `id`,
  `created_at`, `status`, payment method/status, total and platform, plus
  whether the unique index is currently active.
  `--json` for machine-readable; `-r <restaurant_id>` to scope.
  Exit codes: `0` clean, `2` duplicates remain, `3` DB unreachable.
  There is **no** `--apply`: renumbering/deleting duplicates is explicitly NOT
  automated because order numbers appear on receipts, settlements and
  external-platform records; duplicates are financial records until proven
  otherwise.

### Manual resolution process
1. Run the report; inspect each duplicate group (same restaurant + number).
2. Identify the legitimate record — usually the earliest `created_at`, and
   the copy carrying the payments/wallet rows/paid status.
3. Prove the other copy is a re-creation artifact (e.g. a retried webhook
   landing the same day-number). If in doubt, leave it and escalate.
4. Renumber the artifact by hand to a fresh unused number of the same day
   sequence (e.g. manually bump the `counters` doc for that
   `restaurant:YYYYMMDD` key, take the new number, update only the artifact's
   `order_number`). Renumbering is done by an operator in the DB —
   this tooling never does it automatically.
5. Re-run the report until it is clean. The next app startup will then
   create the unique index automatically.
6. Never delete the duplicate order: cancel it (with reason) if a refund path
   applies, or keep it for audit if it is a financial record.

---

## 4. Staging verification checklist (Phase-1 sign-off)

Run against a STAGING environment (real MongoDB replica set so the unique
index and transactions-class operations behave as in production).
Backend on staging, desktop app pointed at staging (`DINEDesk.exe` with
staging API base or dev server), test tenant + second tenant for isolation.

### A. Authentication & sessions
- [ ] Login with owner/manager/cashier roles; wrong password rejected; token
      expiry handled; logout clears state.
- [ ] Roles actually gate the API: cashier cannot read audit logs (403),
      cannot delete menu items, etc.

### B. Tenant isolation
- [ ] Second restaurant cannot read or mutate the first one's orders,
      inventory, customers (expect 404s, not data).
- [ ] CRM history endpoint returns only own-tenant orders (incl. legacy
      phone-fallback rows not leaking across tenants).
- [ ] Webhook creation for a non-existent restaurant_id → 404.

### C. POS billing & payments
- [ ] Create takeaway order (single method) and dine-in order → subtotal,
      tax, discount, total correct on bill & print.
- [ ] Split payment across 2 methods (incl. a ₹0.01-tolerance case) → wallet
      shows one row per method; day-close report attributes each to its method.
- [ ] Pay an already-paid order → 400. Cancel a completed/paid order → 400.
- [ ] Cash change validation still blocks change ≥ tendered total.

### D. Inventory
- [ ] Recipe-linked items deduct on sale; stock ledger (`movements` API)
      matches the resulting quantity.
- [ ] `stock_validation` OFF tenant: oversell attempt still succeeds and the
      ledger records the floored (actual) delta.
- [ ] `stock_validation` ON tenant: oversell attempt → HTTP 409 to the POS UI,
      stock unchanged, no order left behind.
- [ ] Cancel an unpaid order with restock: stock returns exactly once even
      when the transition is repeated/double-clicked (cancel twice idempotent).
- [ ] Wastage and purchase-order receipt movement the ledger (atomic $inc).

### E. Crash recovery (new)
- [ ] With a recipe-sale in flight, kill the backend process between the
      stock deduction and order insert (or simulate: insert a
      `sale_usage` row tagged `order_deduction` for a non-existent order id,
      backdate it past 5 minutes, restart).
- [ ] On restart, the log shows "Crash recovery: restored …" and stock is back
      with an `order_deduction_recovery` ledger row.
- [ ] Restart again → no second restoration, no duplicate recovery rows.
- [ ] Confirm `stock_recovery_claims` shows status `done`.

### F. Day close & reports
- [ ] Orders must have an open day session; close without open session → 400.
- [ ] Day-close totals equal Σ orders for the day; with a legacy split record
      (no persisted allocations) the report buckets it under `split` with a
      reconciliation warning — no invented cash/UPI attribution.
- [ ] KDS-enabled tenant cannot complete/pay before "ready" lifecycle.

### G. CRM history
- [ ] Orders joined to a CRM customer carry `customer_id`; history for that
      customer lists them; guest orders stay unattached.

### H. Webhooks
- [ ] Swiggy/Zomato webhook with valid HMAC → 200; concurrent deliveries get
      unique sequential numbers (no `E11000` races).
- [ ] Replay the same webhook payload → distinct new order (expected current
      behavior) or rejected depending on configured dedupe; no crash.

### I. Offline replay (desktop)
- [ ] Go offline, create 3 orders, come back online: exactly 3 orders in the
      backend; retry a second sync race (two offline clients replaying the
      same `client_uuid`) → one order, the duplicate returns the original and
      does NOT double-deduct inventory.
- [ ] Legacy duplicates check: `python scripts/check_order_number_duplicates.py`
      exit 0 after the fix-up described in §3.

### J. Desktop startup
- [ ] Fresh install launch → login screen; server-reachable indicator behaves;
      no console errors on Electron start (`--enable-logging` run).
- [ ] `desktop/offline-e2e.js` passes against staging.
- [ ] Print bill dialog works on the packaging build (`release/windows`
      build artifact).

### Known verification limits (do NOT tick these without a real DB)
- Real parallel-Mongo concurrency (`$inc` contention, index creation,
  duplicate-key fallback under load) can only be proven on the staging
  replica set — the CI suites use serialization stubs by design.
- `stock_recovery_claims` TTL/reclaim behavior across TWO live app workers is
  only meaningful in a 2-worker staging run.

---

## 5. Commands

```bash
# Backend regression suite (all P0 + reliability batches, 110 tests)
cd backend && python -m pytest tests/test_p0_security.py tests/test_p0_endpoints.py \
    tests/test_reliability.py tests/test_p0_batch2.py tests/test_p0_batch3.py -q

# Frontend
cd frontend && CI=true npx craco test --watchAll=false

# Legacy duplicate order-number report (read-only)
python scripts/check_order_number_duplicates.py --json
```
