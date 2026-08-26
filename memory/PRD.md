# DineDesk - Restaurant POS SaaS Platform

## Original Problem Statement
Build a multi-tenant, cloud-based Restaurant POS SaaS platform with:
- **Platform 1 (Admin Dashboard):** Master dashboard for platform-wide stats, restaurant management, subscription management.
- **Platform 2 (Restaurant POS):** Complete POS interface with menu management, order management, KDS, inventory, AI-analytics, multi-branch support, staff roles.

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Recharts
- **Backend:** FastAPI, Motor (async MongoDB driver), JWT auth
- **Database:** MongoDB
- **AI:** Claude Sonnet 4.5 via Emergent LLM Key (Analytics)
- **Architecture:** Multi-tenant SaaS, Monolithic Backend

## Theme
- **Current:** DineDesk Zomato-inspired system — white canvas, red `#E23744` containers/CTAs, Poppins + Nunito Sans, white sidebar with red active state. Payment dialogs stay white and readable.

## What's Been Implemented
- Full authentication system (JWT) with admin, owner, manager, cashier, captain, chef roles
- Restaurant onboarding flow (business category, restaurant setup, subscription)
- Operations Dashboard with stats, order list, payment panel, charts
- POS Create Order page (2-panel: menu grid + cart/checkout)
- Quick POS page (fast checkout mode)
- Kitchen Display System (KDS) with status management
- Menu Management (categories + items with images)
- Table Management (add, edit, status tracking)
- Inventory Management with low-stock alerts
- Staff Management with role-based access
- Wallet/Financial overview
- Online Orders page (Swiggy/Zomato - mocked)
- Multi-branch support
- Purchase Orders
- Notifications (Twilio - mocked/demo)
- AI Analytics (Claude Sonnet 4.5)
- Day open/close sessions with reports
- Customer lookup and auto-complete
- Receipt generation and printing
- Mobile responsive sidebar (Sheet/Drawer)
- Full rebranding from FoodFlow to OrderNest
- Clean White/Black UI theme overhaul
- Mobile scrolling fixes for all pages
- Code quality fixes: XSS removal, sessionStorage, array keys, hook deps
- Production build fix (syntax error in QuickPOSPage.jsx)

## Mocked/Demo Integrations
- **Razorpay:** Payment processing is mocked
- **Twilio:** SMS/WhatsApp notifications are in demo mode
- **Online Orders:** Swiggy/Zomato webhooks are placeholder

## Credentials
- Admin: admin@ordernest.com / admin123
- Restaurant Owner: demo@restaurant.com / demo123456

## Backlog (P1-P2)
### P1
- Full Payment Integration (Replace mock Razorpay with live)
- Activate Twilio Notifications (live credentials needed)

### P2
- Live Delivery Platform Integration (Swiggy/Zomato webhooks)
- Backend Refactoring (Break server.py into modular APIRouters)
- Split oversized frontend components (MenuManagement, POSDashboard, POSMain)
