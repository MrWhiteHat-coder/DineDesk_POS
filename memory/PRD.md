# FoodFlow POS - Product Requirements Document

## Original Problem Statement
Build a multi-tenant, cloud-based Restaurant POS SaaS platform with two parts:
1. **SaaS Admin Dashboard** - Platform-wide management
2. **Restaurant POS Application** - Restaurant daily operations

## Brand: OrderNest

## Architecture
- **Backend**: FastAPI + MongoDB (monolithic `server.py`)
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Auth**: JWT-based (PyJWT)
- **AI**: Claude Sonnet 4.5 via `emergentintegrations`
- **Database**: MongoDB via Motor async driver

## Demo Credentials
- Admin: `admin@foodflow.com` / `admin123`
- Restaurant Owner: `demo@restaurant.com` / `demo123456`

## Completed Features

### Platform Admin Dashboard
- Platform-wide stats (total restaurants, revenue, orders)
- Restaurant management (view, search, activate/suspend)
- Subscription management (fixed 2999/year plan)
- User monitoring, system logs, admin analytics

### Restaurant POS Application
- User onboarding: account creation, business category, restaurant setup, subscription
- Day Open/Close system with detailed Day Close Reports (PDF download + AI insights)
- Menu Management: categories, items with images, recipe linking
- Order Management: dine-in, takeaway, online order types
- Quick POS mode for fast order processing
- Kitchen Display System (KDS)
- Purchase Order management (create, receive, cancel with inventory updates)
- Receipt generation and printing
- Basic Inventory Management with low-stock tracking
- Analytics Dashboard with AI-powered insights (Claude Sonnet 4.5) + date/branch filtering
- Staff Management with 5 roles (Owner, Manager, Cashier, Captain, Chef)
- Role-based frontend access control
- Wallet/Sales summary with date picker
- Multi-Branch support with auto-generated login credentials
- Editable running orders
- Customer details mandatory at checkout with phone auto-suggest
- SMS/WhatsApp Notifications (Twilio - demo mode)

### Mobile Responsiveness (Completed March 9, 2026)
- Mobile sidebar navigation using Shadcn Sheet component (slide-out drawer)
- Hamburger menu button on mobile (<1024px), hidden on desktop
- Auto-close sidebar on route navigation
- All POS pages responsive: Dashboard, Create Order, Quick POS, Analytics, KDS, Wallet, etc.

### Premium Auth Pages Redesign (Completed March 9, 2026)
- Two-column layout: 60% marketing left / 40% auth right
- Orange gradient left panel with feature highlights (Fast POS, Online Orders, Menu Management, Analytics, Inventory)
- Clean auth card with icon inputs, OR divider, demo credentials section
- Responsive: stacks vertically on mobile
- Brand renamed from FoodFlow to OrderNest across entire application

## Mocked Integrations
- Razorpay payment processing
- Swiggy online orders webhook
- Zomato online orders webhook
- Twilio notifications (demo mode - backend calls commented out)

## Backlog / Future Tasks
- **P1**: Full Razorpay payment integration (user deferred)
- **P1**: Activate Twilio notifications (move from demo mode to production)
- **P2**: Real Swiggy/Zomato delivery platform integration
- **P2**: Backend refactoring - break `server.py` into modular APIRouter files

## Key Files
- `backend/server.py` - All backend logic
- `frontend/src/lib/api.js` - API client
- `frontend/src/layouts/POSLayout.jsx` - POS navigation & day session controls
- `frontend/src/pages/auth/LoginPage.jsx` - Premium login page
- `frontend/src/pages/auth/RegisterPage.jsx` - Premium register page
- `frontend/src/pages/pos/` - All POS page components
- `frontend/src/pages/admin/` - Admin dashboard pages
