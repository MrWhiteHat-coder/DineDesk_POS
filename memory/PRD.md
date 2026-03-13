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

### Core POS Features
- Day Open/Close, Menu Management, Order Management (dine-in/takeaway/online)
- Quick POS, KDS, Purchase Orders, Receipt Printing, Inventory
- Analytics + AI insights, Staff Management (5 roles), Wallet, Multi-Branch
- Customer mandatory at checkout, Twilio notifications (demo mode)

### UI/UX Redesigns Completed

#### Premium Auth Pages (March 9, 2026)
- Two-column layout: 60% teal marketing / 40% auth card

#### Operations Dashboard (March 10, 2026)
- Row 1: 4 stats cards - New Orders (teal), Total Orders (clickable), Waiting List, CREATE NEW ORDER (amber)
- Row 2: Order List (search + filter: All/On Process/Completed) | Payment (search + Pay Now) | Popular Dishes + Out of Stock
- Row 3: Sales Trend chart + Order Types pie chart (secondary)

#### 3-Column POS Create Order (March 13, 2026)
- LEFT (~160px): Vertical category sidebar with counts (hidden on mobile, horizontal tabs instead)
- CENTER: Search bar + product grid (4 cols desktop, 2 cols mobile), click-to-add items
- RIGHT (~320px): Cart items with qty +/- controls, billing summary (subtotal, discount, tax, round off, payable), customer fields, action buttons (Hold, Discount, Confirm)

#### KDS Redesign (March 13, 2026)
- Color-coded order cards: green (received), amber (preparing), rose (delayed >20min)
- Colored headers with customer name, order type badge, order number, token, time
- Items list, progress bars, timers, filter tabs (All/New/In Kitchen/Delayed)

### Mobile Responsiveness
- Sheet-based mobile sidebar, responsive grids, stacked panels on mobile

## Mocked Integrations
- Razorpay, Swiggy/Zomato, Twilio (demo mode)

## Backlog
- P1: Full Razorpay payment integration
- P1: Activate Twilio notifications
- P2: Swiggy/Zomato live integration
- P2: Backend refactoring into modular routers
