# DineDesk Full Product Overhaul — Delivery Report

**Branch:** `main` · **Date:** 2026-10-15

---

## 1. UI/UX Changes

- **Theme tokens** ([index.css](frontend/src/index.css), [tailwind.config.js](frontend/tailwind.config.js)): unified CSS variables + static Tailwind palette retuned to the mandated warm-charcoal scheme — backgrounds `#101412` / `#141915` / `#191F1B`, inputs `#202721`, borders `#303832`, text `#F4F1E8`/`#A5ADA5`, accent `#F4A261` with `#20170F` button text, semantic `#78C091` / `#82B4E8` / `#E76F51`. Hardcoded off-palette colors were swept from POS screens; dark is the default look.
- **App shell** ([POSLayout.jsx](frontend/src/layouts/POSLayout.jsx)): consistent nav hierarchy, active-page identification, restaurant context, user/permission area; consistent page headers with contextual primary actions; responsive two-pane POS layout that preserves usability on narrow desktop widths (panels stack instead of shrinking unusably).
- **Shared UI**: GuardReasonDialog for destructive confirmations ([GuardReasonDialog.jsx](frontend/src/components/pos/GuardReasonDialog.jsx)) used for void/refund/wastage/adjust paths; busy-state + double-submit guards on checkout/payment/dialog buttons (disabled-while-pending + per-order in-flight keys); visible success/failure toasts; consistent status badges, currency/date formatting, empty and error states across POS screens (Dashboard, Tables, Inventory, Customers, Analytics, Staff, Settings, Wallet, Wastage, Menu, QuickPOS).
- **Dashboard** ([POSDashboard.jsx](frontend/src/pages/pos/POSDashboard.jsx)): all metrics (today's sales, orders, AOV, payment breakdown, pending kitchen orders, low-stock alerts, recent transactions, day status) are computed from real server data scoped to the restaurant + day session; clicking metrics deep-links into the relevant views. Verified no hardcoded demo numbers remained in production screens.

## 2. Billing Bugs Identified and Fixed

| # | Bug | Fix |
|---|-----|-----|
| B1 | **Frontend taxed the discounted subtotal; backend taxes the full subtotal** (POSMain.jsx `total = subtotal + tax − discount` where tax was computed on `subtotal − discount`; backend `server.py` computes `subtotal + rate·subtotal − discount`). Bills displayed at the POS disagreed with the authoritative server bill. | New canonical module [lib/billing.js](frontend/src/lib/billing.js) mirrors the backend formula exactly (tax at `restaurant.tax_rate` on the **full** subtotal, then subtract discount). POSMain, QuickPOS and the running-order projection all consume it. |
| B2 | **Hardcoded 5% tax / 10% discount rules** ignored the restaurant's configured `tax_rate`. | Rates now come from `useAuth().restaurant`; no hardcoded rates remain in POS screens. |
| B3 | Discount inputs could produce negative totals / stale totals when lines changed. | `calcBill` clamps discount to a sane maximum, and quantity changes re-run the projection through the same path. |
| B4 | Duplicate-payment risk on retry submits. | Checkout buttons disable while pending; server-side status guard rejects paid orders from being charged again (regression-tested). |

Regression tests added in [billing.test.js](frontend/src/lib/__tests__/billing.test.js) (8 unit tests) and backend suites (below).

## 3. Inventory Bugs Identified and Fixed

| # | Bug | Fix |
|---|-----|-----|
| I1 | Ingredient deductions could race and produce lost updates. | Deductions use a conditional atomic `$inc` with a stock-availability guard; every move writes a ledger entry with `balance_after` ([server.py](backend/server.py) `deduct_inventory`). |
| I2 | Ledger and stock could disagree. | Ledger `delta`/`balance_after` are asserted equal to the applied `$inc` in tests. |
| I3 | Wastage/adjustments lacked reasons and double-submit protection. | Reason is required; guard dialog + per-item in-flight keys; actor + timestamp recorded; movements are append-only (corrections are reversal movements, never history rewrites). |
| I4 | Draft purchases/stale client state risked double stock-in. | Receive paths are confirmed-server-side once; re-confirmation is rejected (tested). |
| I5 | `release_table` freed a table while an open (unpaid) order still occupied it. | Release now refuses when an unpaid order references the table ([server.py](backend/server.py), tested). |

## 4. Anime Interaction Bugs Identified and Fixed

The anime moment system ([RestaurantMoments.jsx](frontend/src/components/pos/RestaurantMoments.jsx)) had been **deleted from the tree while live triggers still fired** into a missing handler — the component was restored from Git history with all its artwork and behavior preserved, and remounted app-wide in POSLayout.

- **Trigger accuracy**: payment-success character fires only **after** payment is recorded and before receipt rendering; order-placed → kitchen moment only on a *successful* create; walk-in guest, offline-save, day-close and error moments fire on their actual server-confirmed outcomes — never on render, poll, refresh, or a failed operation.
- **Duplicate/overlap control**: the pre-existing cooldown/queue/mute logic was evaluated and kept; rapid repeated API retries cannot stack animations.
- **Reduced motion** preference respected, timers/listeners cleaned up on unmount, assets verified present in the packaged build (`static/media/*.png` present in `win-unpacked`).

## 5. Backend / Database Consistency Improvements

([server.py](backend/server.py) — MongoDB; no destructive schema changes, no migrations required.)

- **Refund/void workflow** (new): paid orders can be refunded by authorized roles with `require_manager_pin` + a mandatory reason; order → `refunded`, order stays excluded from day-close revenue (day close already filters `payment_status == 'paid'`), wallet reversal transactions recorded when the original payment was wallet, audit entries + stock policy of *no automatic restock on refund*. Duplicate refund is rejected.
- **Customer read-back**: order creation resolves `customer_id` authoritatively server-side from the requesting user's tenant (404 on foreign customers), and the field the history endpoint queries is what gets persisted.
- **Addon gating**: `require_addon` entitlement gate enforced server-side + [backfill script](scripts/backfill_subscription_docs.py) with dry-run default for pre-existing tenants.
- **Branch password, table status, KDS events, receipt numbering, offline day-open**: audited and verified already correct in the current tree (P0-3/4/5 of the earlier audit).
- Security tests ([test_p0_security.py](backend/tests/test_p0_security.py)) cover tenant isolation, role checks, and payment double-charge rejection.
- Atomic reorder-recovery + crash-safe multi-tenant controls landed in earlier batch commits (9e5261e).

## 6. Tests Executed and Actual Results

| Suite | Command | Result |
|-------|---------|--------|
| Backend (full) | `python -m pytest tests/ -q` | **125 passed, 110 skipped** |
| │ refund/void + table-release regressions | `tests/test_p0_batch4.py` | included above |
| │ security/tenant isolation | `tests/test_p0_security.py` | included above |
| │ atomic inventory / CRM / webhook race | `tests/test_p0_batch2.py` etc. | included above |
| Frontend (full) | `CI=true npx craco test --watchAll=false` | **2 suites, 16 tests passed** |
| │ billing arithmetic unit tests (new) | `lib/__tests__/billing.test.js` | included above |
| Frontend production build | `npx craco build` | exit 0 |
| Electron package | `npx electron-builder --win nsis --x64` | exit 0 |
| Packaged app smoke test | launched `win-unpacked/DineDesk POS.exe`, verified main + GPU + renderer processes alive, then `taskkill` | passed |

No tests were weakened or skipped to make suites pass; the canceled retry of an already-refunded order is asserted against the server's actual (correct) 400 behavior.

## 7. Windows Build and Installer Location

- **Installer:** [DineDesk-POS-Setup-1.0.0.exe](release/windows/DineDesk-POS-Setup-1.0.0.exe) (with `.blockmap`), rebuilt after all fixes.
- Unpacked build for inspection: `release/windows/win-unpacked/`.
- Verified in-bundle: latest frontend build output and anime character assets.

## 8. Known Limitations / Untested Scenarios

- **Clean-machine install test not performed** in this environment: the packaged exe was smoke-run directly from `win-unpacked` (launch, renderer, assets) rather than via the NSIS setup wizard on a pristine Windows host. Wizard-driven install, uninstall, and shortcut/register checks need a human on a clean machine.
-Real gateway payment verification (verified UPI/card) cannot be exercised from tests without provider credentials; manual-confirmation paths are covered by tests, gateway-verified flows need live keys.
- Printer hardware (thermal receipt printing) not attached in this environment; the receipt generation, reprint-without-side-effects and failure-retry logic is covered by `test_iter6_receipt.py`, but physical print output needs human verification.
- Desktop offline E2E ([offline-e2e.js](desktop/offline-e2e.js)) runs against a live MongoDB; it was validated in earlier sessions (`test_result.md`), not re-run post-freeze here beyond backend/frontend suites.
- Anime moments were verified via unit tests + code-path inspection of triggers; a human visual pass on the real screens (timing/feel) is still recommended.

## 9. Changed Files and Commits

Commits (this branch, chronological):

1. `e2a2dd0` Production readiness: email-only OTP auth, kitchen flag, offline day-open, Windows .exe
2. `56a0419` Fix blank desktop window (protocol.handle Response API) + desktop CORS origin
3. `7fb5d6f` Fix blank /register page (TDZ crash) + add OTP delivery telemetry
4. `3de1348` Fix registration blocked by CORS (allowlist misspelled domain)
5. `9e5261e` **P0 data-integrity batches 1–3**: security hardening, atomic inventory, crash recovery
6. `9218a9d` **Backend: refund/void workflow + table release guard** ([server.py](backend/server.py), [test_p0_batch4.py](backend/tests/test_p0_batch4.py))
7. `6968bc9` **Frontend: warm-charcoal theme, anime moments repair, canonical billing** ([index.css](frontend/src/index.css), [ThemeContext.js](frontend/src/contexts/ThemeContext.js), [tailwind.config.js](frontend/tailwind.config.js), [billing.js](frontend/src/lib/billing.js) + tests, [POSMain.jsx](frontend/src/pages/pos/POSMain.jsx), [QuickPOSPage.jsx](frontend/src/pages/pos/QuickPOSPage.jsx), [OrderManagement.jsx](frontend/src/pages/pos/OrderManagement.jsx), [api.js](frontend/src/lib/api.js), [RestaurantMoments.jsx](frontend/src/components/pos/RestaurantMoments.jsx), [POSLayout.jsx](frontend/src/layouts/POSLayout.jsx))
8. *(this commit)* `DELIVERY_REPORT.md` + rebuilt Windows installer artifacts

Full working-tree audit with the original prioritized issue list is preserved in [audit/DineDesk_Audit.md](audit/DineDesk_Audit.md).

## 10. Still Requiring Human Verification

1. Run `DineDesk-POS-Setup-1.0.0.exe` on a clean Windows machine: install → launch → quit → relaunch → uninstall.
2. Physical thermal printer output (receipt + reprint).
3. A live gateway payment (UPI/card) end-to-end with real credentials.
4. Visual review of the anime moments and final theme on the target POS hardware.
5. Operator run of `scripts/backfill_subscription_docs.py` (dry-run first) against production data before applying.
