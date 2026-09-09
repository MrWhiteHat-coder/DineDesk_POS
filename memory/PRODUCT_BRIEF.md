# DineDesk POS - Product & Development Brief (CONSTITUTION)

> Source of truth for all DineDesk development. Every feature, page, and refactor must comply.
> Brand: DineDesk by Trident Ventures - "Absorbs chaos. Serves calm."

## 1. What DineDesk Is
Cloud-based Restaurant POS + Restaurant Operating System SaaS. Target: roadside carts, tea shops, cafes, cloud kitchens, restaurants, fine dining, multi-branch groups. SAME product for all - difference is which modules are activated, not feature count or separate products.

## 2. Business Model - Modular, Not Tiers
No rigid Basic/Pro/Premium. Instead:
- DineDesk Core (affordable base): billing, basic POS, menu, basic customer info, receipt, basic reports. A roadside cart owner must be able to afford it.
- DineDesk Store: add-on modules activated as restaurants grow - Inventory, KDS, Reservations, QR Ordering, Online Ordering, CRM, Loyalty, Advanced Analytics, Staff, Purchase Orders, Multi Branch, Central Kitchen, AI Analytics, Integrations.
- Concept: Start small. Add power when you need it.

## 3. Core UX Philosophy
Complexity should be available, but complexity should never be forced.
- Small owner must never feel overwhelmed by features they do not need.
- Enterprise owner must always find advanced features.
- Differentiation = Capability + Simplicity + Modularity + UX, not feature count.

## 4. Existing Codebase (respect it)
Repo: MrWhiteHat-coder/DineDesk_POS. Frontend: React + Tailwind + shadcn/UI + Recharts. Backend: FastAPI + MongoDB (Motor) + JWT.
Already implemented: auth (6 roles), onboarding, POS, orders, KDS, menu, tables, inventory, staff, wallet, online orders (mock), multi-branch, purchase orders, notifications, AI analytics, day open/close, customers, receipts, printing, Night Shift, responsive UI.
DO NOT rebuild from scratch. Understand first, improve without breaking business logic.

## 5. Security (Phase 0 - before major dev)
- JWT_SECRET must come ONLY from env vars - no hardcoded fallback in repo.
- Same for MongoDB creds, Gemini, SendGrid, Twilio, Gmail, admin creds, payment creds.
- No production secret ever committed to GitHub. Rotate after removal.

## 6. Development Workflow (order matters)
Product discussion > UX spec > reference image > dev brief > frontend impl > backend/API verify > functional test > dark mode test > mobile test > build test > commit > next feature.
- Each major feature = separate checkpoint/commit.
- main stays stable; prefer a dev branch for active work.
- Never mix unrelated changes in one commit.
- Commit style: feat/fix/refactor with meaningful subjects.

## 7. Design System First
Before per-page redesigns, build a reusable DineDesk design system. All pages must feel like ONE product.

## 8. Visual Language
- Personality: efficient, minimal, reliable, calm, professional, fast, modern. A quiet control room inside a busy restaurant.
- Fonts: Manrope headings, Inter body, Barlow Condensed for prices/order numbers/timers/tokens/receipt totals/kitchen values (glare-proof, scannable).

## 9. Color System
- Light: white/soft-paper bg, white cards, subtle gray borders, deep ink text.
- Green = positive/active states + occasional brand moments. NEVER yellow CTA. NEVER blue/saffron branding (retired).
- Functional colors only for function: green=success, amber=warning/low-stock/pending, red=error/cancelled, blue=information. Not decoration.

## 10. Night Shift (dark mode)
Not a color inversion. Deep bg, slightly elevated cards, subtle borders, high-contrast text, controlled functional colors. Every page must pass Light + Night Shift before it counts as complete.

## 11. Interaction Principle
Interactive != complicated. Every interaction needs a reason: hover feedback, clear active states, smooth drawers, quick actions, inline editing, contextual popups, command search, keyboard shortcuts, toasts, real-time state, smart filtering, expand/collapse. Avoid gratuitous animation; motion communicates state.

## 12. POS Rules
Most important screen. Fast, touch-friendly, predictable, scannable. 48px+ touch targets. Desktop ~70% menu (clean Bento grid) / 30% cart (visually stable). Key actions always reachable. Cashier at peak lunch must never think about the UI.

## 13-18. Dashboard = Restaurant Control Room
Not random charts. Answers: What is happening now? What needs attention? What next? How are we performing?
Signature components:
- LIVE SERVICE hero: greeting + live counts (tables active, things needing attention, kitchen status).
- LIVE SERVICE MAP: visual floor - available/seated/dining/preparing/ready/payment-pending/reserved/delayed. Click a table > contextual panel (guests, type, wait time, items, total, [Open Order][Call Kitchen][More]).
- ATTENTION NOW: surfaces actionable problems (delayed order, KOT ready, low stock, reservation arriving, payment pending) with direct action buttons. Do not make users hunt for problems.
- TODAY SERVICE FLOW: Orders Placed > In Kitchen > Serving > Payments > Completed.
- Contextual by time: morning=opening tasks, lunch=live service, evening=rush monitoring, closing=settlement. Dashboard says here-is-what-matters-right-now, not here-are-your-25-modules.

## 19. DineDesk Store UX
Extension marketplace, not a pricing page. Categories: RUN (billing/POS/payments), OPERATE (inventory/KDS/purchase), SERVE (tables/reservations/QR/captain), GROW (CRM/loyalty/marketing/feedback), UNDERSTAND (analytics/reports/AI), SCALE (multi-branch/central kitchen/HQ), CONNECT (online orders/payments/accounting/printers/API). Each module: what it does, who needs it, problem it solves, price, Add-to-DineDesk button, current status.

## 20-21. Feature Architecture (frontend AND backend)
restaurant > enabled_features > permissions > nav visibility > page access > API authorization. Disabled modules show Available-in-DineDesk-Store with Explore, never fully hidden. Backend must also validate module access on APIs - frontend gating alone is insecure.

## 22. Navigation
Do not overwhelm small restaurants. Core: Home, Orders, Tables, POS, Kitchen, Inventory, Analytics, Customers, Staff, More. Modules determine prominence; advanced lives under More. Enterprise gets expanded nav. Same DineDesk, different complexity.

## 23-24. Responsive + Accessibility
Desktop (counter systems), tablet, mobile (bottom nav/sheet/drawer). 48px+ POS targets. Keyboard accessible, visible focus, AA contrast, never color-only state (green dot PLUS Ready label).

## 25. Toasts
One consistent system. Every important action confirms: Order created, KOT sent to kitchen, Payment completed, Inventory updated, Reservation confirmed, Feature activated, Day closed successfully. No silent operations.

## 26-27. Empty States and Honest Data - CRITICAL
NEVER invent fake social proof or fake metrics. No 2500-happy-restaurants, no fake sales, no fake testimonials in production UI.
- No orders > No orders yet. Your first order will appear here.
- No inventory > Inventory is ready. Add your first ingredient.
- Thin analytics > Not enough data yet. Keep using DineDesk.
- Demo/sample data must be clearly distinguished from real data in production.

## 28. Backend Architecture
server.py is a large monolith - do NOT blindly rewrite. Map routes/dependencies first, then gradually extract routers/ (auth, restaurants, orders, pos, menu, tables, inventory, kitchen, customers, staff, payments, analytics, branches, subscriptions, features), services/, models/, middleware/, utils/. Incremental, never one giant refactor.

## 29. Frontend Architecture
Break oversized files gradually (POSDashboard, POSMain, MenuManagement) into component folders, e.g. POSDashboard/{index,LiveServiceMap,AttentionPanel,ServiceFlow,QuickCapture}.jsx.

## 30. UI Redesign Rule
Preserve ALL business logic (API calls, filtering, receipts, printing, day session logic) when changing visuals. Never break working features for aesthetics.

## 31-34. API-first, Loading, Errors, Performance
Every UI feature needs a defined data source + failure/no-data/loading/no-permission behavior. Intentional skeletons (not giant spinners); partial failures never destroy the whole page; specific errors with Retry. No unnecessary API calls/re-renders/deps; memoize only where it helps.

## 35. Real-Time (later)
WebSockets/SSE/efficient polling only after basic data flow is stable. New order/KOT/table/payment events should eventually update dashboard + floor map live.

## 36. DineDesk AI
Operational intelligence, not a chatbot decoration. Examples: lunch sales up vs yesterday but a table waiting too long; stock may run out during dinner rush; table turnover increased this week.

## 37. KDS
Kitchen reality: huge order numbers, timers, clear status, item grouping, priority, sound/visual feedback, minimal distraction, Night Shift, high contrast. Order understood in under 1 second.

## 38. Inventory (future)
Ingredient > recipe usage > theoretical stock > actual stock > wastage > purchase > supplier > cost > food cost.

## 39. Analytics
Not a wall of charts. What happened > Why > What to do.

## 40. Multi-Branch (enterprise only)
Company > Region > Branch > Floor > Tables. HQ compares sales/orders/food cost/inventory/staff/profitability. Never expose this complexity to a one-table tea shop.

## 41. The Big UX Rule
Every screen answers: What is the user trying to accomplish? Design from user tasks, not database fields.

## 42. Reference Images
Treat as UX + visual DIRECTION (hierarchy, spacing, IA, relationships), not pixel-by-pixel spec. Adapt into the existing codebase; do not blindly recreate if it conflicts with real functionality. Do not remove functionality just because it is absent from a reference image.

## 43. Innovation Filter
Good: Live Service Map, Attention Now, Service Flow, contextual dashboard, feature store, progressive complexity, operational AI. Bad: random floating cards, excessive gradients, huge animations, unnecessary 3D, complicated nav, anything that slows billing.

## 44. Development Phases
0 Security/repo stability > 1 Design system > 2 App shell + navigation > 3 Auth + onboarding > 4 Dashboard > 5 POS/billing > 6 Orders > 7 Tables + Live Service Map > 8 KDS > 9 Menu > 10 Inventory > 11 Payments/wallet > 12 Customers/CRM > 13 Staff > 14 Analytics/AI > 15 Online orders > 16 Multi-branch > 17 DineDesk Store/subscription > 18 Enterprise.

## 45. Pre-Commit Checklist
Frontend build, backend startup check, relevant tests, dark mode check, mobile check, console error check, API error check. Meaningful commit messages.

## 46-47. Working Rules for Buffy
- Inspect before changing; never assume, never duplicate components, never recreate existing APIs, never change backend contracts without checking frontend deps.
- Per task: inspect > understand > state files to change (briefly) > implement > test > concise report (Changed / Functionality preserved / Tests / Build PASS-FAIL / Known issues).

## 48-49. Vision and 10 Design Laws
One restaurant OS that grows with the restaurant - billing > POS > ... > enterprise, same ecosystem.
1. Simple by default. 2. Powerful when needed. 3. Fast during rush. 4. Calm during chaos. 5. Every interaction has a purpose. 6. Never force advanced features on small restaurants. 7. Never sacrifice usability for beauty. 8. Never fake data or social proof. 9. Every page supports Light + Night Shift. 10. One coherent product, not a collection of screens.

Ultimate goal: DineDesk makes restaurant operations feel simpler than they actually are. The restaurant can be chaotic. The software should not be.

## Current Work State (2026-09-09)
- White+Black design system + Night Shift shipped (commits up to 5f87e99), store-page theme fix pushed.
- Login page redesign draft (split-screen reference) sits UNCOMMITTED in working tree - user will provide a NEW reference image. Note rule 26: the drafted 2500-Happy-Restaurants stats and fake Chef Arjun testimonial VIOLATE the no-fake-social-proof rule and must be removed/honest-ified in the next iteration.
- User manages usage limits: plan today, build tomorrow. Batched instructions preferred.
