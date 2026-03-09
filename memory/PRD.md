# FoodFlow POS - Restaurant POS SaaS Platform

## Original Problem Statement
Build a cloud-based Restaurant POS SaaS platform for small and medium food businesses with:
1. SaaS Platform Admin Dashboard
2. Restaurant POS Application with daily operations management

## User Choices
- **Authentication**: JWT-based custom auth (email/password)
- **Payment**: Razorpay (mock for demo)
- **Integrations**: Mock Swiggy/Zomato + webhook-ready endpoints
- **Image Storage**: Local file storage
- **AI Insights**: Claude Sonnet 4.5 via Emergent LLM Key
- **Color Theme**: Dark navy/slate (NO orange)

## Architecture
- **Backend**: FastAPI monolithic server.py, Motor async MongoDB driver
- **Frontend**: React, Tailwind CSS, Shadcn/UI, Recharts
- **Database**: MongoDB with collections: users, restaurants, branches, subscriptions, menu_categories, menu_items, orders, inventory, tables, day_sessions, wallet_transactions, system_logs

## What's Been Implemented

### Platform 1: Admin Dashboard
- [x] Master Dashboard with stats
- [x] Restaurant Management (CRUD, activate/suspend)
- [x] Subscription Management
- [x] User Monitoring & System Logs

### Platform 2: Restaurant POS

#### Core Features
- [x] JWT Auth + Onboarding Flow + Mock Subscription (₹2999/yr)
- [x] Day Open/Close system
- [x] Menu Management with image upload + **Recipe/Preparation List**
- [x] POS Menu Order: redesigned with reference image
- [x] **Table Hold Flow**: Dine-in orders hold table, add items to running orders, release & pay
- [x] **Payment Method Selection**: Cash/Card/UPI before checkout
- [x] **Running Orders Bar**: Shows active dine-in orders on Menu Order page
- [x] Order Management + Online Orders (mock Swiggy/Zomato)
- [x] Tables Management
- [x] **Inventory Management with Auto-Deduction**: Recipe-based stock deduction on sale

#### New Features (2026-03-09)
- [x] **Kitchen Display System (KDS)**: Real-time order queue, status updates (New→Preparing→Ready)
- [x] **Wallet & Reconciliation**: Track Cash vs Card vs UPI, period filters (today/week/month), transactions
- [x] **Multi-Branch Management**: CRUD with shared/independent menu option
- [x] **Role-Based Access Control**: 4 roles (Manager/Cashier/Captain/Chef) with restricted access
- [x] **AI-Powered Sales Insights**: Claude Sonnet 4.5 analyzes sales data, suggests improvements
- [x] **Dashboard IndianRupee icon** for Today's Sales
- [x] **Premium hover animations** across all cards and interactive elements

## Role Access Matrix
| Feature | Manager | Cashier | Captain | Chef |
|---------|---------|---------|---------|------|
| Dashboard | ✓ | ✓ | | |
| Menu Order | ✓ | ✓ | ✓ | |
| Analytics | ✓ | ✓ | | |
| KDS | ✓ | | ✓ | ✓ |
| Wallet | ✓ | ✓ | | |
| Tables | ✓ | | ✓ | |
| Menu | ✓ | | | |
| Inventory | ✓ | | | |
| Staff | ✓ | | | |
| Settings | ✓ | | | |
| Branches | ✓ | | | |

## Demo Credentials
- **Admin**: admin@foodflow.com / admin123
- **Restaurant Owner**: demo@restaurant.com / demo123456

## API Endpoints (40+ total)
- Auth: register, login, me, permissions
- Restaurant: onboard, my, update
- Branches: CRUD
- Menu: categories CRUD, items CRUD with recipe
- Orders: create, running, add-items, pay, status update
- KDS: orders, status update
- Day Session: open, close, current, history
- Inventory: CRUD
- Tables: CRUD, release
- Staff: CRUD with 4 roles
- Wallet: summary with period filter
- Analytics: get, ai-insights
- Admin: stats, restaurants, subscriptions, users, logs

## Remaining Tasks

### P1
- [ ] Receipt printing support
- [ ] Real Razorpay integration
- [ ] Push notifications for online orders

### P2
- [ ] Day Close detailed report generation
- [ ] Real Swiggy/Zomato API integration
- [ ] Customer loyalty program
- [ ] Reservation system

## Refactoring
- [ ] Break server.py into modular routers
