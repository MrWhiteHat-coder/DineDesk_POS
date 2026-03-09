# FoodFlow POS - Restaurant POS SaaS Platform

## Original Problem Statement
Build a cloud-based Restaurant POS SaaS platform for small and medium food businesses (restaurants, cafes, cloud kitchens) with two separate systems:
1. SaaS Platform Admin Dashboard - manage restaurants, subscriptions, analytics
2. Restaurant POS Application - for restaurant owners/staff daily operations

## User Choices
- **Authentication**: JWT-based custom authentication (email/password)
- **Payment**: Razorpay (mock for demo)
- **Integrations**: Mock Swiggy/Zomato UI + webhook-ready endpoints
- **Image Storage**: Local file storage
- **Brand**: FoodFlow POS

## Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API with all routes
- JWT authentication with bcrypt password hashing
- MongoDB for data persistence
- Multi-tenant architecture with restaurant_id isolation

### Frontend (React)
- `/app/frontend/src/` - React application
- Tailwind CSS with dark navy theme (redesigned)
- Shadcn/UI components
- React Router for navigation
- Recharts for analytics

### Database Collections
- users, restaurants, subscriptions
- menu_categories, menu_items, orders
- inventory, tables, day_sessions, system_logs

## What's Been Implemented

### Platform 1: Admin Dashboard
- [x] Master Dashboard with stats cards
- [x] Restaurant Management (list, search, activate/suspend)
- [x] Subscription Management
- [x] User Monitoring
- [x] System Logs
- [x] Platform Analytics

### Platform 2: Restaurant POS Application

#### Authentication & Onboarding
- [x] User registration and login
- [x] Business category selection
- [x] 3-step restaurant setup
- [x] Mock Razorpay subscription (₹2999/year)

#### POS Features (Redesigned 2026-03-09)
- [x] Dashboard with daily/weekly/monthly sales
- [x] Day Open/Close system
- [x] Menu Management with image upload (bug fixed)
- [x] POS Main Screen - redesigned with reference image
  - Light white sidebar with dark navy active states
  - Expandable navigation sections (Manage Table, Manage Dish)
  - Food card grid with availability badges
  - "Add to Cart" / "Add More (X)" button states
  - Order summary right panel with totals, discount, payment
  - Category horizontal tabs with item counts
  - Search and refresh functionality
- [x] Order Management
- [x] Tables Management
- [x] Inventory Management
- [x] Analytics Dashboard
- [x] Staff Management
- [x] Settings page
- [x] Online Orders (Mock Swiggy/Zomato)

## Bug Fixes (2026-03-09)
- [x] Image URL construction: Now stores relative paths, constructs full URL at display time using getImageUrl() helper
- [x] Works across different preview environments

## API Endpoints (27 total)
- Auth: /api/auth/register, /api/auth/login, /api/auth/me
- Restaurant: /api/restaurants/onboard, /api/restaurants/my
- Subscription: /api/subscriptions/create, /api/subscriptions/my
- Menu: /api/menu/categories, /api/menu/items
- Orders: /api/orders, /api/orders/today, /api/orders/{id}/status
- Day Session: /api/day-session/open, /api/day-session/close
- Inventory: /api/inventory
- Tables: /api/tables
- Staff: /api/staff
- Analytics: /api/analytics
- Upload: /api/upload
- Admin: /api/admin/stats, /api/admin/restaurants, etc.
- Webhooks: /api/webhooks/swiggy, /api/webhooks/zomato

## Demo Credentials
- **Admin**: admin@foodflow.com / admin123
- **Restaurant Owner**: demo@restaurant.com / demo123456

## P0/P1/P2 Features Remaining

### P1 (Important)
- [ ] Inventory Automation - auto-deduct stock on item sale
- [ ] Staff Management Roles - Owner/Manager/Cashier permissions
- [ ] Real Razorpay integration
- [ ] Receipt printing support
- [ ] Kitchen Display System (KDS) view

### P2 (Nice to have)
- [ ] Detailed Analytics - sales trends, top items charts
- [ ] Day Close Report generation
- [ ] Real Swiggy/Zomato API integration
- [ ] Customer loyalty program
- [ ] Reservation system
- [ ] Multi-branch support

## Refactoring Needed
- [ ] Break down monolithic server.py into modular routers (routes/auth.py, routes/menu.py, etc.)
