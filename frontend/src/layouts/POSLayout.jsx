import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFeatures } from '../contexts/FeatureContext';
import { useTheme } from '../contexts/ThemeContext';
import logoUrl from '../assets/dinedesk-logo.png';
import { daySessionAPI } from '../lib/api';
import { toast } from 'sonner';
import DayCloseReport from '../components/pos/DayCloseReport';
import {
  Home,
  ShoppingCart,
  UtensilsCrossed,
  SquareStack,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Globe,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Bell,
  ChefHat,
  Wallet,
  Building2,
  Zap,
  Truck,
  Menu,
  X,
  Gift,
  Coins,
  Store,
  MoreHorizontal,
  Lock,
  Moon,
  Sun,
  Search,
  Package,
  Monitor,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '../components/ui/sheet';

/* ───────── nav config ───────── */
const allNavItems = [
  { to: '/pos', icon: Home, label: 'Dashboard', exact: true, feature: 'dashboard' },
  { to: '/pos/orders', icon: ShoppingCart, label: 'Create Order', feature: 'menu_order' },
  { to: '/pos/quick-pos', icon: Zap, label: 'Quick POS', feature: 'menu_order' },
  { to: '/pos/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics' },
  { to: '/pos/kds', icon: ChefHat, label: 'Kitchen Display', feature: 'kds' },
  { to: '/pos/wallet', icon: Wallet, label: 'Wallet', feature: 'wallet' },
  { to: '/pos/online-orders', icon: Globe, label: 'Online Orders', feature: 'online_orders' },
  { to: '/pos/branches', icon: Building2, label: 'Branches', feature: 'branches' },
  { to: '/pos/purchase-orders', icon: Truck, label: 'Purchase Orders', feature: 'purchase_orders' },
  { to: '/pos/notifications', icon: Bell, label: 'Notifications', feature: 'notifications' },
  { to: '/pos/customers', icon: Users, label: 'Customers', feature: 'staff' },
  { to: '/pos/trident-coins', icon: Coins, label: 'Trident Coins', feature: 'wallet' },
  { to: '/pos/gift-cards', icon: Gift, label: 'Gift Cards', feature: 'wallet' },
  { to: '/pos/store', icon: Store, label: 'DineDesk Store', feature: 'settings' },
];

const manageTableItems = [
  { to: '/pos/tables', label: 'All Tables' },
  { to: '/pos/order-management', label: 'Running Orders' },
];

const manageDishItems = [
  { to: '/pos/menu', label: 'Menu Items' },
  { to: '/pos/inventory', label: 'Inventory' },
];

/* Sidebar primary items (desktop) */
const sidebarItems = [
  { to: '/pos', icon: Home, label: 'Home', exact: true, feature: 'dashboard' },
  { to: '/pos/orders', icon: ShoppingCart, label: 'Orders', feature: 'menu_order' },
  { to: '/pos/tables', icon: SquareStack, label: 'Tables', feature: 'tables' },
  { to: '/pos/quick-pos', icon: Monitor, label: 'POS', feature: 'menu_order' },
  { to: '/pos/kds', icon: ChefHat, label: 'Kitchen', feature: 'kds' },
  { to: '/pos/inventory', icon: Package, label: 'Inventory', feature: 'inventory' },
  { to: '/pos/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics' },
  { to: '/pos/customers', icon: Users, label: 'Customers', feature: 'staff' },
  { to: '/pos/staff', icon: Users, label: 'Staff', feature: 'staff' },
];

/* Bottom bar: 5 core tabs */
const bottomTabs = [
  { to: '/pos', icon: Home, label: 'Dashboard', exact: true },
  { to: '/pos/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/pos/kds', icon: ChefHat, label: 'KDS' },
  { to: '/pos/wallet', icon: Wallet, label: 'Wallet' },
];

/* ───────── Role access ───────── */
const ROLE_ACCESS = {
  owner: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
  manager: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
  cashier: new Set(['dashboard', 'menu_order', 'wallet', 'analytics']),
  captain: new Set(['menu_order', 'tables', 'kds']),
  chef: new Set(['kds']),
};

/* ═══════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function POSLayout() {
  const { user, restaurant, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { isFeatureUnlocked } = useFeatures();
  const navigate = useNavigate();
  const location = useLocation();

  const userRole = user?.role || 'owner';
  const permissions = ROLE_ACCESS[userRole] || ROLE_ACCESS.owner;
  const hasAccess = (feature) => permissions.has(feature);
  const isUnlocked = (feature) => isFeatureUnlocked(feature);

  /* ── day session ── */
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showDayOpenModal, setShowDayOpenModal] = useState(false);
  const [showDayCloseModal, setShowDayCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDayReport, setShowDayReport] = useState(false);
  const [reportSessionId, setReportSessionId] = useState(null);

  /* ── mobile more sheet ── */
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  /* ── sidebar More section (desktop) ── */
  const [sidebarMoreOpen, setSidebarMoreOpen] = useState(false);

  /* ── expandable sections inside More sheet ── */
  const isTableRoute = ['/pos/tables', '/pos/order-management'].some(p => location.pathname.startsWith(p));
  const isDishRoute = ['/pos/menu', '/pos/inventory'].some(p => location.pathname.startsWith(p));
  const [expandedSections, setExpandedSections] = useState({
    tables: isTableRoute,
    dishes: isDishRoute,
  });

  useEffect(() => { fetchDaySession(); }, []);
  useEffect(() => {
    if (isTableRoute) setExpandedSections(prev => ({ ...prev, tables: true }));
    if (isDishRoute) setExpandedSections(prev => ({ ...prev, dishes: true }));
  }, [location.pathname, isTableRoute, isDishRoute]);
  useEffect(() => { setMoreSheetOpen(false); }, [location.pathname]);

  const fetchDaySession = async () => {
    try {
      const res = await daySessionAPI.getCurrent();
      if (res.data) { setCurrentSession(res.data); setIsDayOpen(true); }
      else { setCurrentSession(null); setIsDayOpen(false); }
    } catch (err) { console.error('Failed to fetch day session:', err); }
  };

  const handleOpenDay = async () => {
    setLoading(true);
    try {
      const res = await daySessionAPI.open(parseFloat(openingCash) || 0);
      setCurrentSession(res.data); setIsDayOpen(true); setShowDayOpenModal(false); setOpeningCash('');
      toast.success('Day opened successfully!');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to open day'); }
    finally { setLoading(false); }
  };

  const handleCloseDay = async (force = false) => {
    setLoading(true);
    try {
      const res = await daySessionAPI.closeForce(parseFloat(closingCash) || 0, force);
      setCurrentSession(null); setIsDayOpen(false); setShowDayCloseModal(false); setClosingCash('');
      toast.success(`Day closed! Total sales: ₹${res.data.total_sales.toFixed(2)}`);
      setReportSessionId(currentSession?.id); setShowDayReport(true);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to close day';
      // Backend blocks close when orders are still running/unpaid — offer a force close
      if (typeof detail === 'string' && detail.includes('Cannot close the day')) {
        if (window.confirm(`${detail}\n\nClose the day anyway? Unpaid orders will be left out of today's report.`)) {
          setLoading(false);
          return handleCloseDay(true);
        }
      } else {
        toast.error(detail);
      }
    }
    finally { setLoading(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleSection = (section) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };

  /* ── check if a bottom tab is active ── */
  const isBottomTabActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  /* ── "More" items (filtered by role) ── */
  const moreNavItems = allNavItems.filter(item => hasAccess(item.feature));
  const sidebarMoreItems = moreNavItems.filter(item => !sidebarItems.some(s => s.to === item.to));

  /* ── header time + daypart session ── */
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const hour = now.getHours();
  const sessionName = hour < 11 ? 'Morning' : hour < 16 ? 'Lunch' : hour < 21 ? 'Evening' : 'Night';
  const timeLabel = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (      <div className="h-screen flex overflow-hidden bg-[#F4F7F3] dark:bg-[#0D100E]" data-testid="pos-layout">

      {/* ──────────── LEFT SIDEBAR (desktop, always dark — brand signature) ──────────── */}
      <aside className="hidden lg:flex w-[190px] xl:w-[212px] flex-col bg-[#0F2417] flex-shrink-0 overflow-y-auto">
        {/* Logo — official brand lockup */}
        <div className="flex flex-col items-start gap-1 px-4 pt-5 pb-4 flex-shrink-0">
          <img src={logoUrl} alt="DineDesk" className="lp-logo-white h-8 w-auto" loading="eager" />
          <p className="text-white/35 text-[9px] leading-tight pl-0.5">by Trident Ventures</p>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 px-2.5 space-y-0.5">
          {sidebarItems
            .filter(item => hasAccess(item.feature))
            .map((item) => {
              // subscription lock applies only where a matching addon exists;
              // role-gating is handled by hasAccess above.
              const locked = ['inventory', 'customers', 'analytics'].includes(item.feature) && !isUnlocked(item.feature);
              const target = locked ? '/pos/store' : item.to;
              return (
                <NavLink
                  key={item.to}
                  to={target}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      isActive && !locked
                        ? 'bg-[#2E9E5B] text-white shadow-sm'
                        : locked
                          ? 'text-white/35 hover:bg-white/[0.05]'
                          : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                    }`
                  }
                  title={item.label}
                >
                  {locked ? <Lock className="w-4 h-4 flex-shrink-0" /> : <item.icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="truncate">{item.label}</span>
                  {locked && <span className="ml-auto text-[8px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">PRO</span>}
                </NavLink>
              );
            })}

          {/* More — expandable advanced modules */}
          {sidebarMoreItems.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setSidebarMoreOpen(v => !v)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${sidebarMoreOpen ? 'text-white bg-white/[0.06]' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'}`}
              >
                <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
                <span>More</span>
                {sidebarMoreOpen ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>
              {sidebarMoreOpen && (
                <div className="ml-3 pl-3 border-l border-white/[0.08] space-y-0.5 mt-0.5">
                  {sidebarMoreItems.map(sub => {
                    const unlocked = isUnlocked(sub.feature);
                    return (
                      <NavLink
                        key={sub.to}
                        to={unlocked ? sub.to : '/pos/store'}
                        className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${isActive && unlocked ? 'text-white bg-white/[0.07]' : unlocked ? 'text-white/50 hover:text-white hover:bg-white/[0.05]' : 'text-white/35 hover:bg-white/[0.04]'}`}
                      >
                        {unlocked ? <sub.icon className="w-3.5 h-3.5 flex-shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />}
                        <span className="truncate">{sub.label}</span>
                        {!unlocked && <span className="ml-auto text-[8px] bg-amber-400/20 text-amber-300 px-1 py-0.5 rounded-full font-bold flex-shrink-0">PRO</span>}
                      </NavLink>
                    );
                  })}

                  {/* Manage Table group */}
                  {hasAccess('tables') && (
                    <div>
                      <button onClick={() => toggleSection('tables')} className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white transition-all">
                        <span className="flex items-center gap-2.5"><SquareStack className="w-3.5 h-3.5" />Manage Table</span>
                        {expandedSections.tables ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {expandedSections.tables && manageTableItems.map(sub => (
                        <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-2.5 py-1 rounded-lg text-xs ml-4 transition-all ${isActive ? 'text-white bg-white/[0.07]' : 'text-white/45 hover:text-white'}`}>
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  )}

                  {/* Manage Dish group */}
                  {hasAccess('menu') && (
                    <div>
                      <button onClick={() => toggleSection('dishes')} className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white transition-all">
                        <span className="flex items-center gap-2.5"><UtensilsCrossed className="w-3.5 h-3.5" />Manage Dish</span>
                        {expandedSections.dishes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {expandedSections.dishes && manageDishItems.map(sub => (
                        <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-2.5 py-1 rounded-lg text-xs ml-4 transition-all ${isActive ? 'text-white bg-white/[0.07]' : 'text-white/45 hover:text-white'}`}>
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  )}

                  {/* Settings */}
                  {hasAccess('settings') && (
                    <NavLink to="/pos/settings" className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${isActive ? 'text-white bg-white/[0.07]' : 'text-white/50 hover:text-white hover:bg-white/[0.05]'}`}>
                      <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Settings</span>
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Sidebar footer — brand signature */}
        <div className="px-4 py-4 flex-shrink-0">
          <p className="font-script text-lg text-[#3FCE85]/70 leading-tight">Absorbs chaos.<br />Serves calm.</p>
        </div>
      </aside>

      {/* ──────────── RIGHT COLUMN ──────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ──────────── TOP BAR (desktop) ──────────── */}
        <header className="hidden lg:flex h-14 items-center gap-3 px-4 bg-white dark:bg-[#12151B] border-b border-gray-200 dark:border-white/[0.07] flex-shrink-0 z-30">

          {/* Restaurant chip → details page */}
          <button
            onClick={() => navigate('/pos/restaurant')}
            className="flex items-center gap-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-1.5 pr-2 py-1 hover:border-gray-400 dark:hover:border-white/20 hover:shadow-sm transition-all flex-shrink-0"
            data-testid="restaurant-chip"
            title="View restaurant details"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-400/10 border border-amber-100 dark:border-amber-400/20 flex items-center justify-center text-base" aria-hidden="true">
              🍩
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[120px]">{restaurant?.name || 'Restaurant'}</p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-px rounded-full ${isDayOpen ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-300'}`}>
                  <span className={`w-1 h-1 rounded-full ${isDayOpen ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  {isDayOpen ? 'Open' : 'Closed'}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-white/45 font-medium">
                  {restaurant?.opening_time && restaurant?.closing_time
                    ? `${restaurant.opening_time} - ${restaurant.closing_time}`
                    : 'Details'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
          </button>

          {/* Standalone Day Open/Close control */}
          <button
            onClick={() => (isDayOpen ? setShowDayCloseModal(true) : setShowDayOpenModal(true))}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-bold transition-all flex-shrink-0 ${
              isDayOpen
                ? 'bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/25 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-400/20'
                : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-white/60 hover:border-gray-400 dark:hover:border-white/25'
            }`}
            data-testid={isDayOpen ? 'close-day-btn' : 'open-day-btn'}
            title={isDayOpen ? 'Close the day' : 'Open the day'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDayOpen ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true"></span>
            {isDayOpen ? 'Close Day' : 'Open Day'}
          </button>

          {/* Command search (visual affordance — wired to a hint for now) */}
          <button
            onClick={() => toast.info('Command search (Ctrl+K) is coming soon.')}
            className="flex-1 max-w-md flex items-center gap-2.5 h-9 px-3.5 bg-gray-100 dark:bg-white/[0.05] border border-transparent dark:border-white/[0.07] rounded-xl text-sm text-gray-400 dark:text-white/40 hover:border-gray-300 dark:hover:border-white/15 transition-all"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left truncate">What do you need today?</span>
            <kbd className="hidden xl:flex items-center gap-0.5 text-[10px] font-semibold text-gray-400 dark:text-white/35 bg-white dark:bg-white/[0.08] border border-gray-200 dark:border-white/10 rounded-md px-1.5 py-0.5">
              Ctrl K
            </kbd>
          </button>

          {/* Date + daypart session */}
          <div className="hidden xl:flex items-center gap-2 flex-shrink-0" title={timeLabel}>
            <CalendarDays className="w-4 h-4 text-gray-400 dark:text-white/40" />
            <div className="leading-tight">
              <p className="text-[11px] font-semibold text-gray-700 dark:text-white/80">{dateLabel}</p>
              <p className="text-[10px] text-gray-400 dark:text-white/40">{sessionName} Session</p>
            </div>
          </div>

          {/* Spacer pushes the rest right */}
          <div className="flex-1" />

          {/* Notifications */}
          <button
            onClick={() => navigate('/pos/notifications')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-white/55 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
          </button>

          {/* Night Shift toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-amber-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
            data-testid="theme-toggle"
            aria-label={dark ? 'Switch to light mode' : 'Switch to Night Shift'}
            title={dark ? 'Light Mode' : 'Night Shift'}
          >
            {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* Profile + dropdown */}
          {user && (
            <div className="relative group flex-shrink-0">
              <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                <div className="w-8 h-8 bg-[#0F2417] dark:bg-[#2E9E5B] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">{user.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="text-left leading-tight hidden xl:block">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/40 capitalize">{userRole}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
              </button>
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-[#1A1F26] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg py-1.5 w-44 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {hasAccess('settings') && (
                  <button onClick={() => navigate('/pos/settings')} className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-all">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                )}
                <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition-all">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </header>

        {/* ──────────── TOP BAR (mobile / tablet) ──────────── */}
        <header className="lg:hidden h-14 flex items-center justify-between px-3 bg-white dark:bg-[#12151B] border-b border-gray-200 dark:border-white/[0.07] flex-shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoUrl} alt="DineDesk" className="lp-logo-white h-7 w-auto flex-shrink-0" loading="eager" />
            <div className="min-w-0 leading-tight">
              <button
                onClick={() => navigate('/pos/restaurant')}
                className="font-heading font-bold text-gray-900 dark:text-white text-xs truncate block"
                data-testid="restaurant-chip"
                title="View restaurant details"
              >
                {restaurant?.name || 'DineDesk'}
              </button>
              <span className={`text-[9px] font-bold ${isDayOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {isDayOpen ? '● Open' : '● Closed'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => (isDayOpen ? setShowDayCloseModal(true) : setShowDayOpenModal(true))}
              className={`h-8 px-2 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-colors ${
                isDayOpen
                  ? 'border-emerald-300 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-400/10'
                  : 'border-gray-200 dark:border-white/[0.12] text-gray-500 dark:text-white/60'
              }`}
              data-testid={isDayOpen ? 'close-day-btn' : 'open-day-btn'}
            >
              {isDayOpen ? 'Close Day' : 'Open Day'}
            </button>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              data-testid="theme-toggle"
              aria-label={dark ? 'Switch to light mode' : 'Switch to Night Shift'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMoreSheetOpen(true)}
              className="w-8 h-8 rounded-lg bg-[#0F2417] dark:bg-white/[0.08] flex items-center justify-center"
              aria-label="Open menu"
            >
              {user
                ? <span className="text-white font-semibold text-xs">{user.name?.charAt(0).toUpperCase()}</span>
                : <Menu className="w-4 h-4 text-white" />}
            </button>
          </div>
        </header>

        {/* ──────────── MAIN CONTENT ──────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 md:p-5 pb-24 lg:pb-5">
            <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
          </div>
        </main>
      </div>

      {/* ──────────── BOTTOM NAV BAR (mobile only) ──────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#12151B] border-t border-gray-200 dark:border-white/[0.07] z-40" data-testid="bottom-nav">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomTabs.map((item) => {
            const active = isBottomTabActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all ${
                  active ? 'text-[#217A42] dark:text-[#3FCE85]' : 'text-gray-400 dark:text-white/40'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-[#2E9E5B]/10 dark:bg-[#2E9E5B]/20' : ''}`}>
                  <item.icon className={`w-5 h-5 ${active ? 'text-[#217A42] dark:text-[#3FCE85]' : ''}`} />
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-[#217A42] dark:text-[#3FCE85]' : 'text-gray-400 dark:text-white/40'}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreSheetOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all ${
              moreSheetOpen ? 'text-[#217A42] dark:text-[#3FCE85]' : 'text-gray-400 dark:text-white/40'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${moreSheetOpen ? 'bg-[#2E9E5B]/10 dark:bg-[#2E9E5B]/20' : ''}`}>
              <MoreHorizontal className={`w-5 h-5 ${moreSheetOpen ? 'text-[#217A42] dark:text-[#3FCE85]' : ''}`} />
            </div>
            <span className={`text-[10px] font-medium ${moreSheetOpen ? 'text-[#217A42] dark:text-[#3FCE85]' : 'text-gray-400 dark:text-white/40'}`}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ──────────── MORE SHEET (mobile) ──────────── */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-[#161A20]" data-testid="more-sheet">
          <SheetTitle className="text-base font-heading font-bold text-gray-900 dark:text-white mb-3">Navigation</SheetTitle>

          <div className="space-y-0.5">
            {/* Main nav items */}
            {moreNavItems.map((item) => {
              const unlocked = isUnlocked(item.feature);
              return (
                <NavLink
                  key={item.to}
                  to={unlocked ? item.to : '/pos/store'}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] font-medium ${
                      isActive && unlocked
                        ? 'bg-[#2E9E5B] text-white'
                        : unlocked
                          ? 'text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white'
                          : 'text-gray-400 dark:text-white/35 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                    }`
                  }
                >
                  {unlocked ? <item.icon className="w-[18px] h-[18px]" /> : <Lock className="w-[18px] h-[18px] text-amber-500" />}
                  <span>{item.label}</span>
                  {!unlocked && <span className="ml-auto text-[9px] bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-semibold">PRO</span>}
                </NavLink>
              );
            })}

            {/* Manage Table */}
            {hasAccess('tables') && (
              <div>
                <button
                  onClick={() => toggleSection('tables')}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white transition-all"
                >
                  <div className="flex items-center gap-3">
                    <SquareStack className="w-[18px] h-[18px]" />
                    <span>Manage Table</span>
                  </div>
                  {expandedSections.tables ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedSections.tables && (
                  <div className="ml-9 space-y-0.5 mt-0.5">
                    {manageTableItems.map(sub => (
                      <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-gray-900 dark:text-white font-medium bg-gray-100 dark:bg-white/[0.07]' : 'text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white'}`}>
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manage Dish */}
            {hasAccess('menu') && (
              <div>
                <button
                  onClick={() => toggleSection('dishes')}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white transition-all"
                >
                  <div className="flex items-center gap-3">
                    <UtensilsCrossed className="w-[18px] h-[18px]" />
                    <span>Manage Dish</span>
                  </div>
                  {expandedSections.dishes ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedSections.dishes && (
                  <div className="ml-9 space-y-0.5 mt-0.5">
                    {manageDishItems.map(sub => (
                      <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-gray-900 dark:text-white font-medium bg-gray-100 dark:bg-white/[0.07]' : 'text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white'}`}>
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Staff */}
            {hasAccess('staff') && (
              <NavLink
                to="/pos/staff"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] font-medium ${
                    isActive ? 'bg-[#2E9E5B] text-white' : 'text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white'
                  }`
                }
              >
                <Users className="w-[18px] h-[18px]" />
                <span>Staff</span>
              </NavLink>
            )}

            {/* Night Shift toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[13px] font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white transition-all"
              data-testid="theme-toggle-mobile"
            >
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              <span>{dark ? 'Light Mode' : 'Night Shift'}</span>
            </button>

            {/* Settings */}
            {hasAccess('settings') && (
              <NavLink
                to="/pos/settings"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] font-medium ${
                    isActive ? 'bg-[#2E9E5B] text-white' : 'text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white'
                  }`
                }
              >
                <Settings className="w-[18px] h-[18px]" />
                <span>Settings</span>
              </NavLink>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[13px] font-medium text-gray-600 dark:text-white/60 hover:bg-red-50 dark:hover:bg-red-400/10 hover:text-red-600 dark:hover:text-red-400 transition-all mt-1 border-t border-gray-100 dark:border-white/[0.06] pt-3"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span>Logout</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Day Open Modal */}
      <Dialog open={showDayOpenModal} onOpenChange={setShowDayOpenModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">Open Day</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label htmlFor="opening-cash" className="text-gray-600 dark:text-white/60">Opening Cash (₹)</Label>
            <Input id="opening-cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Enter opening cash amount" className="mt-2 h-12 rounded-xl" data-testid="opening-cash-input" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayOpenModal(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleOpenDay} disabled={loading} className="bg-[#0F2417] dark:bg-[#2E9E5B] hover:bg-[#14301F] dark:hover:bg-[#288A50] rounded-xl text-white" data-testid="confirm-open-day-btn">
              {loading ? 'Opening...' : 'Open Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Close Modal */}
      <Dialog open={showDayCloseModal} onOpenChange={setShowDayCloseModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">Close Day</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            {currentSession && (
              <div className="bg-gray-50 dark:bg-white/[0.05] p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-white/60">Opening Cash:</span><span className="font-semibold text-gray-900 dark:text-white">₹{currentSession.opening_cash.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-white/60">Total Orders:</span><span className="font-semibold text-gray-900 dark:text-white">{currentSession.total_orders}</span></div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash" className="text-gray-600 dark:text-white/60">Closing Cash (₹)</Label>
              <Input id="closing-cash" type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} placeholder="Enter closing cash amount" className="mt-2 h-12 rounded-xl" data-testid="closing-cash-input" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayCloseModal(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCloseDay} disabled={loading} variant="destructive" className="rounded-xl" data-testid="confirm-close-day-btn">
              {loading ? 'Closing...' : 'Close Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DayCloseReport sessionId={reportSessionId} open={showDayReport} onClose={() => setShowDayReport(false)} />
    </div>
  );
}
