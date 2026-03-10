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

### Mobile Responsiveness (March 9, 2026)
- Shadcn Sheet-based mobile sidebar, hamburger menu, responsive grids

### Premium Auth Pages (March 9, 2026)
- Two-column layout: 60% marketing / 40% auth, feature highlights

### UI/UX Theme Redesign (March 9, 2026)
- Teal/amber/cream color scheme across all pages

### Operations Dashboard Redesign (March 10, 2026)
- **Row 1**: 4 stats cards - New Orders (teal), Total Orders (clickable), Waiting List, Create New Order (amber CTA)
- **Row 2**: 3-column operations panels:
  - Order List: Search + filter tabs (All/On Process/Completed) + order rows with colored table badges
  - Payment: Search + unpaid orders with Pay Now buttons
  - Popular Dishes + Out of Stock (with inventory data)
- **Row 3**: Charts (Sales Trend, Order Types) pushed to bottom
- Receipt/bill modal with print functionality preserved
- Orders detail modal preserved

## Mocked Integrations
- Razorpay payments, Swiggy/Zomato webhooks, Twilio (demo mode)

## Backlog
- P1: Full Razorpay payment integration
- P1: Activate Twilio notifications
- P2: Swiggy/Zomato live integration
- P2: Backend refactoring into modular routers

## Key Files
- `backend/server.py` - All backend logic
- `frontend/src/layouts/POSLayout.jsx` - POS navigation
- `frontend/src/pages/auth/LoginPage.jsx` - Premium login
- `frontend/src/pages/auth/RegisterPage.jsx` - Premium register
- `frontend/src/pages/pos/POSDashboard.jsx` - Operations dashboard
- `frontend/src/pages/pos/` - All POS pages
