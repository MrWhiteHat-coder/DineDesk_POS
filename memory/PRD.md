# FoodFlow POS - Product Requirements Document

## Original Problem Statement
Build a multi-tenant, cloud-based Restaurant POS SaaS platform with two parts:
1. **SaaS Admin Dashboard** - Platform-wide management
2. **Restaurant POS Application** - Restaurant daily operations

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
- Subscription management (fixed ₹2999/year plan)
- User monitoring, system logs, admin analytics

### Restaurant POS Application
- User onboarding: account creation, business category, restaurant setup, subscription
- Day Open/Close system with detailed Day Close Reports
- Menu Management: categories, items with images, recipe linking
- Order Management: dine-in, takeaway, online order types
- Quick POS mode for fast order processing
- Kitchen Display System (KDS)
- Purchase Order management (create, receive, cancel with inventory updates)
- Receipt generation and printing
- Basic Inventory Management with low-stock tracking
- Analytics Dashboard with AI-powered insights (Claude Sonnet 4.5)
- Staff Management with 4 roles (Manager, Cashier, Captain, Chef)
- Role-based frontend access control
- Wallet/Sales summary
- Multi-Branch support (stubbed)
- Editable running orders
- Premium dark navy/slate UI theme

### Tested & Verified (March 9, 2026)
- Quick POS: menu grid, category filtering, cart, payments (Cash/Card/UPI), receipt modal
- Purchase Orders: CRUD with inventory items, status filters, receive/cancel
- Day Close Report: summary cards, payment breakdown, cash drawer, top items, hourly chart, print
- Receipt API: returns restaurant + order details
- Dashboard Order Types chart: shows breakdown by order type

## Mocked Integrations
- Razorpay payment processing
- Swiggy online orders webhook
- Zomato online orders webhook

## Backlog / Future Tasks
- **P1**: Real Razorpay payment integration (user deferred)
- **P2**: Real Swiggy/Zomato delivery platform integration
- **P2**: Backend refactoring - break `server.py` into modular APIRouter files

## Key Files
- `backend/server.py` - All backend logic (~1818 lines)
- `frontend/src/lib/api.js` - API client
- `frontend/src/layouts/POSLayout.jsx` - POS navigation & day session controls
- `frontend/src/pages/pos/` - All POS page components
- `frontend/src/pages/admin/` - Admin dashboard pages
