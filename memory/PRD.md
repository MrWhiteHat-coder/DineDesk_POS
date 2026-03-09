# OrderNest POS - Product Requirements Document

## Original Problem Statement
Build a multi-tenant, cloud-based Restaurant POS SaaS platform with two parts:
1. **SaaS Admin Dashboard** - Platform-wide management
2. **Restaurant POS Application** - Restaurant daily operations

## Brand: OrderNest
## Color Scheme: Primary Teal (#0F766E) | Accent Amber (#F59E0B) | Background Warm Cream (#F5F1EB)

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
- Platform-wide stats, restaurant management, subscription management, user monitoring, system logs

### Restaurant POS Application
- Day Open/Close system with PDF reports + AI insights
- Menu Management with categories, images, recipe linking
- Order Management: dine-in, takeaway, online
- Quick POS mode, Kitchen Display System (KDS)
- Purchase Order management, Receipt printing
- Inventory Management with low-stock tracking
- Analytics Dashboard with AI insights + date/branch filtering
- Staff Management (Owner, Manager, Cashier, Captain, Chef)
- Wallet/Sales summary with date picker
- Multi-Branch support with auto-generated credentials
- Customer details mandatory at checkout
- SMS/WhatsApp Notifications (Twilio - demo mode)

### Mobile Responsiveness (Completed March 9, 2026)
- Shadcn Sheet-based mobile sidebar, hamburger menu, responsive grids

### Premium Auth Pages (Completed March 9, 2026)
- Two-column layout: 60% marketing / 40% auth, feature highlights, demo credentials

### UI/UX Theme Redesign (Completed March 9, 2026)
- Teal/amber/cream color scheme inspired by premium POS reference designs
- Teal sidebar active states, amber CTA buttons, warm cream backgrounds
- Teal chart colors, teal stat cards, consistent theme across all pages
- Updated: Login, Register, Dashboard, Create Order, Quick POS, Wallet, Analytics, all POS pages

## Mocked Integrations
- Razorpay payments, Swiggy/Zomato webhooks, Twilio (demo mode)

## Backlog
- P1: Full Razorpay payment integration
- P1: Activate Twilio notifications
- P2: Swiggy/Zomato live integration
- P2: Backend refactoring into modular routers

## Key Files
- `backend/server.py` - All backend logic
- `frontend/src/layouts/POSLayout.jsx` - POS navigation (teal theme)
- `frontend/src/pages/auth/LoginPage.jsx` - Premium login
- `frontend/src/pages/auth/RegisterPage.jsx` - Premium register
- `frontend/src/pages/pos/POSDashboard.jsx` - Dashboard (teal stats cards)
- `frontend/src/pages/pos/` - All POS pages
