import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { daySessionAPI } from '../lib/api';
import { toast } from 'sonner';
import DayCloseReport from '../components/pos/DayCloseReport';
import {
  LayoutDashboard,
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
  { to: '/pos', icon: LayoutDashboard, label: 'Dashboard', exact: true, feature: 'dashboard' },
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

/* Bottom bar: 5 core tabs */
const bottomTabs = [
  { to: '/pos', icon: LayoutDashboard, label: 'Dashboard', exact: true },
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
  const navigate = useNavigate();
  const location = useLocation();

  const userRole = user?.role || 'owner';
  const permissions = ROLE_ACCESS[userRole] || ROLE_ACCESS.owner;
  const hasAccess = (feature) => permissions.has(feature);

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
  }, [location.pathname]);
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

  const handleCloseDay = async () => {
    setLoading(true);
    try {
      const res = await daySessionAPI.close(parseFloat(closingCash) || 0);
      setCurrentSession(null); setIsDayOpen(false); setShowDayCloseModal(false); setClosingCash('');
      toast.success(`Day closed! Total sales: ₹${res.data.total_sales.toFixed(2)}`);
      setReportSessionId(currentSession?.id); setShowDayReport(true);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to close day'); }
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

  const currentTime = new Date().toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="pos-layout">

      {/* ──────────── TOP BAR ──────────── */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-30">

        {/* LEFT: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-4.5 h-4.5 text-white" />
          </div>
          <h1 className="font-heading font-bold text-gray-900 text-sm leading-tight hidden sm:block">DineDesk</h1>
        </div>

        {/* CENTER: Desktop horizontal nav — 5 core items + More dropdown */}
        <nav className="hidden md:flex items-center gap-1">
          {/* 5 core items always visible */}
          {[
            { to: '/pos', icon: LayoutDashboard, label: 'Dashboard', exact: true },
            { to: '/pos/orders', icon: ShoppingCart, label: 'Create Order' },
            { to: '/pos/quick-pos', icon: Zap, label: 'Quick POS' },
            { to: '/pos/kds', icon: ChefHat, label: 'KDS' },
            { to: '/pos/wallet', icon: Wallet, label: 'Wallet' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}

          {/* More dropdown — everything else */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all">
              <MoreHorizontal className="w-4 h-4" />
              <span className="hidden lg:inline">More</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-[70vh] overflow-y-auto">
              {/* Regular nav items (excluding the 5 core ones) */}
              {allNavItems
                .filter(item => hasAccess(item.feature))
                .filter(item => !['/pos', '/pos/orders', '/pos/quick-pos', '/pos/kds', '/pos/wallet'].includes(item.to))
                .map(sub => (
                  <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `flex items-center gap-2.5 px-4 py-2 text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-600 hover:bg-gray-50'}`}>
                    <sub.icon className="w-4 h-4" />
                    <span>{sub.label}</span>
                  </NavLink>
                ))}

              {/* Divider before sections */}
              <div className="border-t border-gray-100 my-1"></div>

              {/* Manage Table */}
              {hasAccess('tables') && (
                <div>
                  <button
                    onClick={() => toggleSection('tables')}
                    className="flex items-center justify-between w-full px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <SquareStack className="w-4 h-4" />
                      <span>Manage Table</span>
                    </div>
                    {expandedSections.tables ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </button>
                  {expandedSections.tables && (
                    <div className="ml-9 space-y-0.5 mb-1">
                      {manageTableItems.map(sub => (
                        <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-900'}`}>
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
                    className="flex items-center justify-between w-full px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <UtensilsCrossed className="w-4 h-4" />
                      <span>Manage Dish</span>
                    </div>
                    {expandedSections.dishes ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </button>
                  {expandedSections.dishes && (
                    <div className="ml-9 space-y-0.5 mb-1">
                      {manageDishItems.map(sub => (
                        <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-900'}`}>
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
                  className={({ isActive }) => `flex items-center gap-2.5 px-4 py-2 text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Users className="w-4 h-4" />
                  <span>Staff</span>
                </NavLink>
              )}

              {/* Settings */}
              {hasAccess('settings') && (
                <NavLink
                  to="/pos/settings"
                  className={({ isActive }) => `flex items-center gap-2.5 px-4 py-2 text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </NavLink>
              )}
            </div>
          </div>
        </nav>

        {/* RIGHT: Branch + Day status + Profile */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Branch badge */}
          <div className="hidden md:flex items-center gap-2 bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200">
            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
            <span className="text-xs font-medium text-gray-800 truncate max-w-[120px]">
              {restaurant?.name || 'Restaurant'}
            </span>
          </div>

          {/* Day status */}
          {isDayOpen ? (
            <button onClick={() => setShowDayCloseModal(true)} className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-green-200 hover:bg-green-100 transition-colors" data-testid="close-day-btn">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span className="hidden sm:inline">Open</span>
            </button>
          ) : (
            <button onClick={() => setShowDayOpenModal(true)} className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 hover:bg-red-100 transition-colors" data-testid="open-day-btn">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
              <span className="hidden sm:inline">Closed</span>
            </button>
          )}

          {/* Time (desktop) */}
          <div className="hidden lg:flex items-center gap-1.5 text-gray-500 text-xs">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{currentTime}</span>
          </div>

          {/* Profile */}
          {user && (
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center cursor-pointer" title={user.name}>
              <span className="text-white font-semibold text-xs">{user.name?.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
      </header>

      {/* ──────────── MAIN CONTENT ──────────── */}
      <main className="flex-1 overflow-auto bg-gray-50/50 pb-16 md:pb-0">
        <div className="p-3 md:p-5">
          <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
        </div>
      </main>

      {/* ──────────── BOTTOM NAV BAR (mobile only) ──────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40" data-testid="bottom-nav">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomTabs.map((item) => {
            const active = isBottomTabActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all ${
                  active ? 'text-black' : 'text-gray-400'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-black' : ''}`}>
                  <item.icon className={`w-5 h-5 ${active ? 'text-white' : ''}`} />
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-black' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreSheetOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all ${
              moreSheetOpen ? 'text-black' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${moreSheetOpen ? 'bg-black' : ''}`}>
              <MoreHorizontal className={`w-5 h-5 ${moreSheetOpen ? 'text-white' : ''}`} />
            </div>
            <span className={`text-[10px] font-medium ${moreSheetOpen ? 'text-black' : 'text-gray-400'}`}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ──────────── MORE SHEET (mobile) ──────────── */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto bg-white" data-testid="more-sheet">
          <SheetTitle className="text-base font-heading font-bold text-gray-900 mb-3">Navigation</SheetTitle>

          <div className="space-y-0.5">
            {/* Main nav items */}
            {moreNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] font-medium ${
                    isActive
                      ? 'bg-black text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Manage Table */}
            {hasAccess('tables') && (
              <div>
                <button
                  onClick={() => toggleSection('tables')}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
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
                      <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-900'}`}>
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
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
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
                      <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-900'}`}>
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
                    isActive ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Users className="w-[18px] h-[18px]" />
                <span>Staff</span>
              </NavLink>
            )}

            {/* Settings */}
            {hasAccess('settings') && (
              <NavLink
                to="/pos/settings"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] font-medium ${
                    isActive ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[13px] font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all mt-1 border-t border-gray-100 pt-3"
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
            <Label htmlFor="opening-cash" className="text-gray-600">Opening Cash (₹)</Label>
            <Input id="opening-cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Enter opening cash amount" className="mt-2 h-12 rounded-xl" data-testid="opening-cash-input" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayOpenModal(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleOpenDay} disabled={loading} className="bg-black hover:bg-gray-800 rounded-xl text-white" data-testid="confirm-open-day-btn">
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
              <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Opening Cash:</span><span className="font-semibold">₹{currentSession.opening_cash.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Total Orders:</span><span className="font-semibold">{currentSession.total_orders}</span></div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash" className="text-gray-600">Closing Cash (₹)</Label>
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
