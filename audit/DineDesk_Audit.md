# DineDesk — Existing Application Audit (2026-10-12)

Scope: audit only. No code was modified. All findings below are evidence-based against the current checkout. No secrets, keys, or credential values are reproduced.

---

## A. Architecture Map

### Stack (as deployed, verified from configs)
| Layer | Technology | Config evidence |
|---|---|---|
| Frontend | React 19 (CRA + craco), react-router-dom 7, Tailwind 3, Radix UI, Recharts, sonner toasts, PWA (service worker at production boot) | `frontend/package.json`, `frontend/src/index.js` |
| Backend | FastAPI 0.110 + Motor (async MongoDB), PyJWT HS256, bcrypt, fpdf2, sendgrid, twilio, google-generativeai | `backend/server.py` (4,786 lines), `backend/requirements.txt` |
| Database | MongoDB Atlas (motor client; db name default `DineDesk`), in-app `"id"`-keyed docs, `_id` stripped everywhere | [server.py:47](backend/server.py) |
| Auth | Bearer JWT; email+password; email OTP verification via SendGrid (SMTP Gmail fallback); phone OTP via Twilio with in-memory store | server.py L1387–1719 |
| Deployment | Render free tier (`render.yaml`, uvicorn); static frontend build uploaded to desktop bundle | `render.yaml`, `desktop/package.json` |
| Desktop | Electron 33 wrapper loading `frontend/build` via custom `app://local` protocol, NSIS installer | `desktop/main.js`, `desktop/package.json` |
| Celery / queues / sockets | **None** — background work is `asyncio.create_task` fire-and-forget inside the API process | server.py |

### Approximately 120+ API routes grouped by module (grep of `@api_router` decorators — 110 route decorators in `backend/server.py`)
- Auth: register ( emailed 6-digit OTP), verify-signup-otp, resend-signup-otp, verify-email (legacy link flow), resend, login, forgot/reset password, send-otp/verify-otp (phone), me, permissions.
- Restaurant/onboarding, branches (with per-branch user login), subscriptions (MOCK payment), menu categories/items, tables, orders (create w/ idempotency, add-items, pay, status), KDS, day-session (open/close/current/history/report/report-pdf/ai-insights), inventory + movements ledger, wastage, purchase orders, receipt, wallet, analytics, DineDesk Intelligence (insights + ask), notifications, customers, coins (Trident loyalty), gift cards, Seva, Store add-on subscriptions, feedback, admin (stats/restaurants/subscriptions/users/logs/analytics), webhooks swiggy/zomato, upload, health.

### Collections
`users, restaurants, branches, subscriptions, day_sessions, orders, tables, menu_categories, menu_items, inventory, stock_movements, wastage, purchase_orders, wallet_transactions, customers, coin_transactions, gift_cards, gift_card_transactions, notifications, notification_settings, restaurant_subscriptions, feedback, system_logs, audit_logs, counters` (order-number sequence).

### Frontend pages
Auth (login, register w/ OTP verify, verify-email, forgot/reset), onboarding (business category → restaurant setup → subscription), admin (6 pages), POS nested under `/pos` inside `POSLayout` (Dashboard, POSMain orders, QuickPOS, Menu, OrderManagement, Tables, Inventory, Wastage, Analytics, Staff, Settings, RestaurantDetails, OnlineOrders, KDS, Wallet, Branches, PurchaseOrders, Notifications, Customers, GiftCards, TridentCoins, Store) gated by `FeatureGate` (addon lock) — see `frontend/src/App.js`.

### Key cross-cutting pieces
- Role access matrix exists twice: backend `ROLE_ACCESS` (server.py L~700: owner/manager/cashier/captain/chef) and frontend `ROLE_ACCESS` in POSLayout plus a different `ADDON_FEATURES` mapping in FeatureContext — see gaps §E/G.
- Offline: IndexedDB queue (`offlineOrders.js`) + sync engine (`offlineSync.js`), day-open intent queued in localStorage, resilient order creation (`resilientOrder.js`).
- Anime/living brand art: chef illustrations (ChefShrugging/ChefWinking in POSMain), "Restaurant Moments" celebration events on sync (`dinedesk:moment` custom events; component referenced in POSLayout/AnalyticsPage etc).

---

## B. Feature Inventory with Status

Legend: ✅ Working (implemented + verified end-to-end in code), 🔶 Partial, ❌ Broken, 🧪 **Mocked**, ⬜ Missing.

### Core POS
| Feature | Status | Evidence / notes |
|---|---|---|
| Email signup + 6-digit OTP via SendGrid | ✅ | hashed OTP, 10-min expiry, 5 attempts, single use; SMTP fallback; dev auto-verify when no provider (server.py L1387+) |
| Login + JWT (24h default) | ✅ | bcrypt verify, verification gate only when email provider configured |
| Password reset (token link) | ✅ | 1h expiry, anti-enumeration response |
| Onboarding (onboard → tables auto-created) | ✅ | server.py L1722 |
| Subscription payment | 🧪 Mocked | `/subscriptions/create` fabricates `pay_mock_` payment id, ₹2,999/yr, no gateway |
| Open Day / closing cash / session | ✅ | open prevents duplicates; close guards running/unpaid orders with `force` override; per-restaurant-day counter |
| Menu (categories, items, availability, image upload, price) | ✅ | upload ext whitelist + size cap |
| Menu recipe → inventory link | ✅ | `RecipeIngredient` list on menu items; deduct on order |
| Tax handling | 🔶 Partial | single global `tax_rate` percent on restaurant doc; **no per-item/CGST-SGST split, no tax-inclusive pricing, no tax slabs** |
| Modifiers/add-ons per item | ⬜ Missing | no modifiers model anywhere |
| Table create/status/release | ✅ | occupied on dine-in order create, freed on pay/complete/cancel |
| Table transfer (move order to another table) | ⬜ Missing | no endpoint; only manual free `release` |
| Table status endpoint abuse | ❌ Broken/P0 | `PUT /tables/{id}/status` accepts ANY string and sets it with **no `check_role`, no whitelist** — any user can poison table state |
| POS order create (validation, availability, discount cap) | ✅ | thorough server-side validation; landing table occupied; wallet entries |
| Order idempotency for offline replay (client_uuid) | ✅ | dedupe on replay |
| Offline order queue (IndexedDB) + sync engine | ✅ | resilient order → queue → replay oldest-first, 12-attempt cap, day-open replays first (`offlineOrders.js`, `offlineSync.js`) |
| Offline day-open | ✅ | localStorage intent, replayed before orders |
| KOT / KDS | ✅ (single-status, no item-level) | KDS shows whole orders `received→preparing→ready`; "served" legacy mapped to ready. No per-item KOT, no KOT print, no course/fire groups |
| Order lifecycle enforcement | ✅ | `_validate_order_transition` prevents skip/backwards; kitchen-off restaurants can bill directly |
| Payments (cash/card/UPI) | ✅ (recorded only) | no gateway; single + split payment supported with paise-tolerant sum check (server.py L2737+) |
| Change management for cash | ✅ | stored + validated |
| Duplicate payment prevention | ✅ | `pay` rejects already-paid |
| Refund flow | 🔶 Partial | only implicit: cancelling a *paid* top-level order (blocked for completed) writes a `refund` wallet row. There is **no explicit refund/void UI or API for paid completed orders** — the error message tells the user to "process a refund/void" that doesn't exist |
| Discounts | 🔶 Partial | flat amount, capped at subtotal; no percent discounts, no coupon engine, no per-item discounts |
| Day close reconciliation report + PDF | ✅ | PDF brief uses fpdf2; cash drawer expected-vs-counted with difference; wastage section only when data exists |
| Receipt | ✅ | server returns order + restaurant; print via `window.open` (requires popup) |
| Wallet (day totals, breakdown) | ✅ | cash/card/UPI/refunds/net |
| Inventory CRUD + low stock | ✅ | `is_low_stock` maintained on every write path |
| Stock movement ledger | ✅ | purchase / sale_usage / wastage / adjustment / cancel_restock |
| Recipe-based deduction | ✅ | deduct_inventory on order create + add-items; floor at 0 |
| Cancel-restock | ✅ | fire-and-forget async restore |
| Purchase orders receive→inventory | ✅ | | 
| Wastage logging + summary + audit | ✅ | |
| Analytics (daily/weekly/monthly, top items, hourly in IST) | ✅ | |
| AI insights (DineDesk Intelligence) | ✅/Gemini | verified fact-sheet approach; graceful degradation without key |
| Ask DineDesk (chat) | ✅ | intent-routed over computed data |
| Notifications (SMS/WhatsApp customer) | 🧪 Mocked | `send_order_notification` writes a log row with status `"demo"`, **body sends nothing**; notification settings toggle effective only via `sms_enabled` flag |
| Swiggy webhook | 🧪 Mocked | real insert, but contract is a guessed schema (restaurant_id passed in body by client), **no shared-secret/signature auth**, order number from racing `count_documents` |
| Zomato webhook | 🧪 Mocked | same as Swiggy |
| Frontend Swiggy/Zomato "integration" | 🧪 Mocked | Onboarding collects `delivery_platforms` and OnlineOrdersPage lists webhook-created orders; no real partner API credentials/HMAC verify anywhere |
| Customers CRM | ✅ basic | CRUD, lookup by phone from orders, visits/spent roll-up **not** updated on order (see F1) |
| Trident Coins (earn/redeem/topup/donate) | 🔶 Partial | redemptions create a txn row and mutate balance but **are never applied to any order total** — no link between coins and billing |
| Gift cards | 🔶 Partial | purchase returns `coins_earned` computed but **never credited**; redeem works on card balance but is not usable as a payment method in POS; **no tenant scoping on redeem/lookup by code** |
| Seva donations | 🔶 Partial | stat-only derivative of coin donations |
| Store add-ons | 🔶 Partial (fake billing) | subscribe/unsubscribe flip a document; never charges; demo tenant seeded with all add-ons active |
| Multi-branch | 🔶 Partial | branch `_id`/branch auth is only filters; **branch_id is a captured value from env — see `docker-compose.yml` userDataFixtures — never used on backend data** |
| Staff management | ✅ basic | create (password supplied in request plaintext!), deactivate; no staff edit endpoint |
| Admin module | ✅ | platform stats, restaurants, users, logs, analytics |
| Feedback | ✅ minimal store | |
| Phone OTP (Twilio) | 🔶 Partial | in-memory store (resets on restart); falls back to email when no Twilio; only validates, doesn't attach verification to login |
| FSSAI license verification | ❌ Disabled (intentional) | endpoints return `{"status":"disabled"}` stubs, kept for API stability; expiry-alert loop suppressed. Meets the stated requirement (removed, not re-introduced — but the UI still shows an FSSAI field) |
| FSSAI expiry notification helper | 🔶 Partial | `check_license_expiry` still runs at day open (server.py L2347); inserts notifications keyed off now-ish dates. Harmless but couples to the disabled flow |
| Landing page | — | exists (`/`, `/store`) — per instructions *do not add*, already present; not re-reviewing into a new feature request but flagging it here as present, not touched |
| Token/API-key rotation UI, audit log export | ⬜ Missing | |
| Table transfer, next-day auto-close, held-day reminder | ⬜ Missing | day sessions on free Render: server may sleep/restart leaving stale "open" session; nothing auto-recovers |

### Frontend-specific observations
- PWA registration only in production (good).
- POSLayout duplicates `ROLE_ACCESS`; e.g. cashier has `analytics` on both; **new users with no restaurant hit onboarding; subscribed gated by `restaurant.subscription_status === 'active'`** which the MOCK subscription endpoint sets.
- `FeatureContext` maps addons→features by fuzzy **name slug matching** (`name.includes(...)`) — fragile if addon names change; `FeatureGate` for `analytics`/`inventory`/`customers`/`branches`/`notifications`/`purchase_orders` etc. where backend has **no corresponding enforcement** (backend only enforces `ROLE_ACCESS`, not addon entitlement) → server-side addon enforcement gap.
- API error normalization (FastAPI 422 detail arrays → strings) centralized in the interceptor — good.
- Token also stored in `localStorage` (PWA offline replay) in addition to sessionStorage, so not strictly per-tab — noted (XSS impact).

---

## C. End-to-end workflow diagrams (as-is)

```
1. Signup: RegisterPage → POST /auth/register
     └─(provider configured) hashed OTP stored, email queued via SendGrid
   → /auth/verify-signup-otp → burn OTP, activate, JWT issued
   → AuthContext persists token (session + localStorage)
   → ProtectedRoute → /onboarding (no restaurant) → /subscription (not 'active') → /pos
2. Day open (POSLayout header): daySessionAPI.open(opening_cash)
   → POST /day-session/open → one 'open' session doc per restaurant
   Offline: queueOfflineDayOpen() → localStorage, optimistic local session, sync engine replays first
3. Order (POSMain / QuickPOS): menu fetch → cart → createOrderResilient()
   → POST /orders (check_role; requires open session; discount cap; idempotent client_uuid)
      → items validated vs restaurant-scoped menu
      → subtotal → tax (restaurant tax_rate) → total
      → insert order → occupy table → deduct_inventory() [+ stock_movements]
      → wallet transaction(s) → optional (mock) SMS log
   Offline: IndexedDB queue (client_uuid) → local OFF- number → online replay
4. KDS: polls GET /kds/orders (received/preparing) → PUT status (transition map)
   → POSMain/OrderManagement settle → POST /orders/{id}/pay
      (kitchen-enabled: must be 'ready' first) → split/single payment → paid → table freed
   → PUT /orders/{id}/status completed (kitchen: must be ready; must be paid)
5. Inventory: PO create → GET /purchase-orders → receive → inventory +
   stock_movements('purchase') → sale deducts ('sale_usage') → wastage ('wastage')
   → manual edit ('adjustment') → cancel order restocks ('cancel_restock')
6. Day close: POST /day-session/close(counted_cash)
   → guard: open & unpaid orders blocking (force override, audited)
   → aggregates paid orders by method, sets closing cash
   → GET /day-session/{id}/report + /report-pdf (fpdf2 brief)
7. Admin: token w/ role=admin → admin routes (get_admin_user dep)
```

---

## D. Critical bugs and data-integrity risks

**D1. Order-number generation race in the receipt/wastage semi-transparent duplicate path (`_restock_inventory` is fire-and-forget).** [server.py:255](backend/server.py) launches `asyncio.create_task` for both cancel-restock and order notifications; on a free-tier single-worker Render crash these vanish silently. Cancel-restock especially: the ledger gets a `cancel_restock` entry *integrity-critical* for stock accuracy but it can be lost on process death or, worse, run concurrently with a real sale on the same item causing a **double-crediting race on the same inventory doc's read-modify-write**.

**D2. Non-atomic inventory deduction.** `deduct_inventory` (server.py L~441) does: read item → compute new_qty → `$set`. Two concurrent orders for the same item lose writes (last-write-wins). Correct fix is `{$inc: {"quantity": -x}}` with `$min`-style clamps. Same pattern in `receive_purchase_order` and cancel-restock. **Stock is structurally driftable under load.**

**D3. Webhook race: order numbers `.count_documents`+1.** webhooks/swiggy & zomato (server.py L3372+) compute order_number from a count; two concurrent webhook deliveries produce duplicate `order_number`. The normal POS path uses the atomic counters collection — the webhooks don't. Also **zero authentication/signature verification on these endpoints** and queryable without any shared secret.

**D4. Webhook body shape is a guess** — real Swiggy/Zomato webhooks carry payloads with partner-internal ids, a signed header, etc. Today's dict needs `restaurant_id`, `order_id`, `items[...].name/total/quantity`… mapped nowhere partner-faithfully; treat as mock until partner docs staged.

**D5. `update_table_status` is unauthenticated-ish.** Any signed-in user (any role incl. chef) can set a table to any string ("destroyed", garbage), and it never touches orders — meaning a table can be "free" while its `current_order_id` is still attached. `release_table` likewise frees a table with an open attached order — the running order then dangles (no table).

**D6. No transactionality across multi-write sequences.** Order create does: insert order → occupy table → deduct inventory → wallet txn — sequential awaits with no Mongo transaction; a failure partway leaves partial state (e.g. order exists, wallet not written, inventory gone). Motor 3.3 supports transactions only on replicasets; on free shared Atlas tier likely unsupported. Rollback/correction paths don't exist.

**D7. Refund path is dead-ended.** error string tells users to "process a refund/void" for paid orders, but the endpoint only allows cancel for unpaid; there's no refund route. Paid bills that need voiding are impossible; cashier workaround would be manual database edits.

**D8. Coins/gift-card money is cosmetic.** `/coins/redeem` gives a "discount" number that POS billing never accepts; gift-card redemption isn't a payment method. A restaurant could hand 'free credit' with no accounting tie to any order. No double-ledger, no balances audit trail (only the txn list).

**D9. `restaurant_id` is trusted from the webhook body**, so a caller hitting `/webhooks/swiggy` can attribute orders to any restaurant (currently unauthenticated) — also breaks day-report reconciliation.

**D10. Phone OTP store is in-memory** (`_otp_store` dict) — restart loses pending OTPs; multi-instance deployments break. Fine for single free-tier Render, floats on multi-worker.

**D11. `log_action` has mutable default-style bug: `user_id: str = None` is fine, but `record_stock_movement`'s calms are:**
`_rate_limit_store` and `_otp_store` are module dicts (see D10) and `role`-checks read `user.get("role")` where `user` may be `{}` — `check_role(user, "menu_order")` on an admin is given by pass-through; fine — the actual mutable-default issue was false caution on my part; **withdraw that one.** Rate limiting keys only by email/phone (no IP), and `_check_rate_limit` is per-process — combined with D10, the in-memory protections evaporate on multi-worker.

**D11 (real). Backend addon/feature enforcement absent.** Forbidden pages are hidden by frontend `FeatureGate` only; the corresponding backend endpoints have **no addon entitlement check** (e.g. InventoryPage gated by `inventory` addon, but nothing on the server). Anyone with a token uses the endpoints directly. Billing-dependent feature has server-side gap.

**D12. Frontend demo account is hardcoded into `docker-compose.yml`... — actually not.** Demo init is gated by `ENABLE_DEMO_ACCOUNT` but the seed **runs by default (`true`)** with a known password (`DEMO_PASSWORD` default `123456`) in every new deployment. Fake-tenant clutter inside a production DB. Risk: a real deployment that forgets the env var ships a public demo owner account whose restaurant is "fully active subscription" - known credentials + owner role.

**D13. Analytics totals inconsistently filtered.** `/analytics` leverages payment_status=='paid' but `/analytics/ai-insights` uses `status in ['completed','paid']` (an invalid literal status for the lifecycle) — inconsistent filters mean the two "daily sales" numbers can disagree.

**D14. `day-session/close` aggregates by `payment_method`, but split payments set `payment_method='split'`** — split bills are invisible in the cash/card/UPI day-close buckets (they exist only in wallet transactions). Day-close reconciliation under-counts cash/card/UPI by exactly the split-bill amount.

**D15. Report PDF `report-pdf` streams whole PDF in memory**; fine at load levels expected. Minor.

**D16. Frontend `generateOrderNumber()` shows a random 5-digit "order number" locally** (`B00042`) that never matches the server's — display-only, but users may quote the wrong #.

**D17. `maintenance`-ish: frontend jars against `_id`... not an issue.** Frontend `customerCRM_API.getOrders` queries `customer_id` — but orders never store `customer_id`; they store `customer_phone` (orders created via `OrderCreate` never link to the customers collection). Old orders list will be **empty forever** for any CRM customer (server.py `/customers/{id}/orders` filters on a field never set). Broken feature in practice.

**D18. `CHECK: customers/{id}/orders` filters `customer_id` never written.** (same as D17 — kept because it's a distinct helper endpoint.)

**D19. Daily "today" analytics timezone handling is inconsistent**: `get_analytics` handles IST correctly; `/analytics/ai-insights`, `wallet/summary` "today" and admin daily_orders use naive UTC midnight — the numbers disagree, e.g. "today's sales" in dashboard vs AI tab.

### Verified tests obtained during audit (actually run)
- `backend/tests/test_reliability.py`: **22 passed** (in-process, stub Mongo) — covers Guard audit, require_reason, manager PIN, day-close guard, tenant-scoped inventory.
- Full `pytest tests/`: **cannot run**: `test_iter6_receipt.py` and `test_iter7_customer_day_report.py` fail at collection (`AttributeError: 'NoneType' object has no ...`) and the rest (test_pos_api, test_new_features, iter5/8/9) are **integration tests that target a dead external URL** (`https://responsive-pos-4.preview.emergentagent.com`, hardcoded default) — 10 failed / 86 errors / 22 passed when attempted, from connection errors.
- Frontend: `craco test` → **8 passed** (single suite: `api.auth.test.js` — axios-interceptor behavior only).

---

## E. Security & multi-tenant gaps

1. **Webhooks completely unauthenticated** (no HMAC, no shared secret, no IP filter) → anyone can forge online orders; coupled with D3/D9. **Severity: critical.**
2. **Addon gating is front-end only** — paying customers can be bypassed by using APIs directly. (D11)
3. **JWT in localStorage** — PWA affordance; XSS → session theft; no token rotation, no revocation list, no refresh tokens; 24h fixed lifetime.
4. **Rate limits + OTP stores are per-process memory** — reset on restart, ineffective under multiple workers.
5. **`/staff` create sends staff password in plaintext in the request body from the StaffPage UI** (design smell: means browsers/proxies see it; also reveals the owner can set weak ones; min length not enforced server-side *for staff* whereas branch and reset flows enforce 6+). `/branches` enforces ≥6 for branch manager; `/staff` does not.
6. **`PUT /tables/{id}/status` has no `check_role`** — chef/cashier can tamper. **`release_table` frees a table still bound to an open order** → dangling running order.
7. **Store/subscribe endpoints do not check role or addon pricing**; anyone with wallet-like access can flip entitlements.
8. **`/admin/*` protected, good. `/audit-logs` owner/manager/admin scoped by restaurant, good. `get_staff` excludes password. `admin/users` excludes password. `update_customer`**: read-back missing restaurant scoping in second find_one (`find_one({"id": customer_id})` without `restaurant_id` projection after update) — a tenantless cross-tenant read-back is possible on update (server.py:4372–4385): find→update scoped, then read-back unscoped → **cross-tenant customer data leak on update**.
9. **`update_branch` writes the whole BranchCreate including `login_email`/`login_password` into the branch doc** (branch docs contain login_email; password goes to a users doc — the branch doc gets `login_password`? No — BranchCreate includes login_password and `update_data = data.model_dump()` writes it **into the branch document verbatim).** Branch passwords persisted in cleartext in `branches` collection on update. Severity high.
10. **Gift card redeem/delete** — `GET /giftcards/{code}` requires auth but not tenant scoping; `redeem` uses global code lookup — cross-tenant gift cards could be redeemed (a code belongs to another restaurant) → gift card issued by tenant A can be redeemed by tenant B's staff, and settlement (95% to a restaurant) is returned but never applied anywhere.
11. **`/coins/*` all tenant-scoped — good. `/seva/stats` fine.** `/customers/lookup` regex on phone — fine-ish; could be enumerated but scoped.
12. **CORS**: a hard-coded allowlist including the desktop `app://local` origin + `allow_credentials=True` — OK. `app://local` with credentials in Electron is standard.
13. **Uploads**: extension whitelist + size cap, but no content-type sniff (SVG allowed → stored XSS vector if served inline).
14. **Destructive deletion** of menu items/inventory is a **hard delete** (no soft delete), causing historical order receipts to render `''` for item names? No — orders embed item copies; receipts are safe. But inventory hard delete orphans stock_movements references (ledger rows point to a dead id).
15. **Mongo document `id` string keys, unique index only on `users.email`** — no DB-level uniqueness guarantees on `"id"` for any other collection; UUID collisions astronomically unlikely but `restaurant_id`-scoped data has no referential integrity — a bug can silently attach doc to the wrong tenant if a filter is forgotten (as in #8).
16. Demo tenant seeds on by default with known password (D12) → known-credential risk.
17. **Branch user password stored twice** — users doc (hashed) and branch `login_email` + update path (D9 above writes model_dump() including plaintext `login_password`).

---

## F. Test coverage & missing tests

Current:
- Backend unit-ish: 22 tests in `test_reliability.py` pass (stub-Mongo in-process). **Full backend suite is not runnable** (2 collection errors + dead external target for integration tests).
- Frontend: 8 tests in one suite (api client only). No page-level tests, no workflow tests, no offline-queue unit tests.

Missing (high value per workflow):
- Order lifecycle transitions & cancel/reason/PIN enforcement against a real Mongo (testcontainers/mockmotor).
- Day close guard incl. force path, split-payment accounting at close (D14).
- Inventory atomicity (concurrent deduction, lost-update repro).
- Webhook auth + idempotency + order_number uniqueness.
- Offline queue sync engine (fakes: failing POST → fails; duplicate replay).
- Auth: OTP expiry/attempt burnout; email verification gate; password reset expiry.
- Frontend: component tests for POSMain cart math, PaymentModal splits, POSLayout day session, FeatureGate.

---

## G. Prioritized remediation roadmap

### P0 — critical (data corruption / security)
| # | Item | Why |
|---|---|---|
| P0-1 | Make webhook endpoints authenticated (partner-shared secret/HMAC) + atomic order numbers (counters) + faithful payload mapping | forgeable orders, duplicate order numbers |
| P0-2 | Inventory deduction with `$inc` (or Mongo transaction) | lost updates drift stock permanently |
| P0-3 | Server-side addon entitlement check (middleware) | paid feature can be used without payment |
| P0-4 | Fix `update_customer` cross-tenant read-back; sweep ALL read-backs for tenant scoping | cross-tenant data leak |
| P0-5 | `update_branch`/branch model: stop persisting `login_password` (store users doc only) + enforce min length | cleartext secrets in DB |
| P0-6 | Add refund/void workflow for paid orders (audited, manager-PIN, restock optional + wallet refund) | dead-ended money path |
| P0-7 | Role + whitelist on `PUT /tables/{id}/status`; block release when open order attached | state poisoning |
| P0-8 | Fix close-day split-payment aggregation (attribute splits to per-method buckets) | reconciliation silently wrong |
| P0-9 | Disable demo seeding by default (`ENABLE_DEMO_ACCOUNT` default false) | known credentials in prod |
| P0-10 | Fix `/customers/{id}/orders` (query by phone or store customer_id at order create) | broken customer history |

### P1 — high
- P1-1 Coin redemption applies to orders (payment method on OrderPayment + wallet fund ledger).
- P1-2 Gift card as payment method with tenant-scoped code + settlement record.
- P1-3 Replace fire-and-forget cancel-restock with synchronous, transactional restock (or durable queue).
- P1-4 Persistent OTP store (Mongo-backed) + IP-inclusive rate limiting; move rate limiting to middleware.
- P1-5 Staff password reset flow + min length; hashed-only storage; no plaintext in StaffCreate flow.
- P1-6 Unify analytics date filters (status `completed`/`paid` mismatch) and timezones (IST everywhere).
- P1-7 Backend roles matrix alignment + fix duplicated frontend `ROLE_ACCESS`.
- P1-8 Table transfer endpoint + KOT item-level transitions (P2-2 dependency).

### P2 — medium
- P2-1 Per-item tax configuration (CGST/SGST, inclusive/exclusive).
- P2-2 Item-level KOT printing + modifications/cancel items from a running order (currently only add-items; nothing removes items).
- P2-3 Progressively hard-delete → soft-delete menu/inventory to preserve ledger integrity.
- P2-4 SVG upload hardening (serve `Content-Disposition: attachment` or sanitization).
- P2-5 Print receipts via kiosk printing or WebUSB/ESC-POS abstraction (window.open printers popup).
- P2-6 Day-session auto-recovery for stale open sessions (rent/heartbeat), next-day reminder.
- P2-7 Token refresh + revocation for stolen-token windows.
- P2-8 Replace `scripts/dash_rewrite.py`-style artifacts if any are dead code (housekeeping).

### P3 — enhancements
- Real email/SMS provider for customer notifications (replace demo log).
- FSSAI verification re-enablement (endpoints stubbed intentionally — acceptable per requirements).
- Fractional quantities & units conversion, HSN notes, GST filing export (GSTR-1 CSV).
- Exportable audit/CSV reports, multi-restaurant compare, offline menu caching depth.
- Serial/order printer integration tests, E2E Playwright suite for the 5 core workflows, load tests on order paths.

---

## H. Acceptance criteria for recommended fixes

- **P0-1 Webhooks**: given a request without a valid signature/secret → `401`; with valid → order created once, `order_number` unique under concurrent delivery (test: 2 parallel posts → distinct numbers)
- **P0-2 Inventory**: two concurrent POST /orders same item → final stock = start − 2×usage (lost-update gone); unit test proves `$inc` usage.
- **P0-3 Addons**: API call to a gated endpoint without the addon → `403 Addon required`; with addons → 200.
- **P0-4 Tenancy**: `PUT /customers/{id}` from another tenant → 404; second find filtered by tenant.
- **P0-5 Branch**: after update, `branches` doc contains **no `login_password`** key; creating branch still yields login-capable manager user.
- **P0-6 Refunds**: paid order → refund endpoint → wallet refund txn, order marked refunded, day report excludes it, audit row exists, PIN enforced when set.
- **P0-7 Tables**: invalid status string → 400; role without tables → 403; release with open order → 409.
- **P0-8 Splits**: day close with a split order (₹400 cash + ₹278 UPI) → cash bucket += 400, upi += 278.
- **P0-9 Demo**: fresh deploy with defaults → no `demo@dinedesk.in` user.
- **P0-10 CRM**: creating order with `customer_id` (or lookup by phone) → history returns orders.
- **P1s**: analogous (see each item above); P2-1 → tax preview matches invoice; P2-6 → stale open session auto-consistent with history.

---

*Report generated statically from source and verified spot-checks. Actually-run artifacts: backend `test_reliability.py` 22 passed; grouped backend suite partially blocked as noted; frontend 8 tests pass. Nothing else was executed.*
