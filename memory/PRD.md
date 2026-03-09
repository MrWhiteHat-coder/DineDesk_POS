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
- **Color Theme**: Dark navy/slate (NO orange) — premium professional look

## Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API with all routes
- JWT authentication with bcrypt password hashing
- MongoDB for data persistence
- Multi-tenant architecture with restaurant_id isolation

### Frontend (React)
- `/app/frontend/src/` - React application
- Tailwind CSS with dark navy/slate theme
- Shadcn/UI components (primary: slate-800)
- React Router for navigation
- Recharts for analytics (blue chart color)

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
- [x] User registration and login (dark navy theme)
- [x] Business category selection
- [x] 3-step restaurant setup
- [x] Mock Razorpay subscription (₹2999/year)

#### POS Features (Redesigned 2026-03-09)
- [x] Dashboard with daily/weekly/monthly sales
- [x] Day Open/Close system
- [x] Menu Management with image upload
  - Compact 5-column card grid
  - Smaller card sizes for better overview
- [x] POS Main Screen - reference-based redesign
  - Light white sidebar with dark navy active states
  - Auto-expanding navigation sections
  - Food card grid with availability badges
  - "Add to Cart" / "Add More" button states
  - Order summary right panel
- [x] Order Management
- [x] Tables Management
- [x] Inventory Management
- [x] Analytics Dashboard (blue chart theme)
- [x] Staff Management
- [x] Settings page
- [x] Online Orders (Mock Swiggy/Zomato)

## Bug Fixes & UI Updates (2026-03-09)
- [x] Image URL construction: relative paths + getImageUrl() helper
- [x] Complete orange→dark navy theme migration (all pages, CSS vars, charts, hex codes)
- [x] Sidebar auto-expand for active sub-routes
- [x] Menu Management card sizes reduced

## Demo Credentials
- **Admin**: admin@foodflow.com / admin123
- **Restaurant Owner**: demo@restaurant.com / demo123456

## P1/P2 Features Remaining

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
- [ ] Break down monolithic server.py into modular routers
