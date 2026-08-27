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
  ClipboardList,
  SquareStack,
  Package,
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
  Heart,
  Store,
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

const navItems = [
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

export default function POSLayout() {
  const { user, restaurant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const ROLE_ACCESS = {
    owner: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
    manager: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
    cashier: new Set(['dashboard', 'menu_order', 'wallet', 'analytics']),
    captain: new Set(['menu_order', 'tables', 'kds']),
    chef: new Set(['kds']),
  };
  const userRole = user?.role || 'owner';
  const permissions = ROLE_ACCESS[userRole] || ROLE_ACCESS.owner;
  const hasAccess = (feature) => permissions.has(feature);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showDayOpenModal, setShowDayOpenModal] = useState(false);
  const [showDayCloseModal, setShowDayCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDayReport, setShowDayReport] = useState(false);
  const [reportSessionId, setReportSessionId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      toast.success(`Day closed! Total sales: \u20B9${res.data.total_sales.toFixed(2)}`);
      setReportSessionId(currentSession?.id); setShowDayReport(true);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to close day'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleSection = (section) => { setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] })); };

  const currentTime = new Date().toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const SidebarNav = () => (
    <>
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.filter(item => hasAccess(item.feature)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] font-medium ${
                  isActive
                    ? 'bg-dd-blue text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {hasAccess('tables') && (
          <div>
            <button
              onClick={() => toggleSection('tables')}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
              data-testid="nav-manage-table"
            >
              <div className="flex items-center gap-3">
                <SquareStack className="w-[18px] h-[18px]" />
                <span>Manage Table</span>
              </div>
              {expandedSections.tables ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {expandedSections.tables && (
              <div className="ml-9 space-y-0.5 mt-0.5">
                {manageTableItems.map((sub) => (
                  <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-900'}`}>
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          )}

          {hasAccess('menu') && (
          <div>
            <button
              onClick={() => toggleSection('dishes')}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
              data-testid="nav-manage-dish"
            >
              <div className="flex items-center gap-3">
                <UtensilsCrossed className="w-[18px] h-[18px]" />
                <span>Manage Dish</span>
              </div>
              {expandedSections.dishes ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {expandedSections.dishes && (
              <div className="ml-9 space-y-0.5 mt-0.5">
                {manageDishItems.map((sub) => (
                  <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-black font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-900'}`}>
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          )}

          {hasAccess('staff') && (
          <NavLink
            to="/pos/staff"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] font-medium ${
                isActive ? 'bg-yellow-400 text-neutral-900 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
            data-testid="nav-staff"
          >
            <Users className="w-[18px] h-[18px]" />
            <span>Staff</span>
          </NavLink>
          )}
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-gray-100 space-y-0.5">
        {hasAccess('settings') && (
        <NavLink
          to="/pos/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] font-medium ${
              isActive ? 'bg-yellow-400 text-neutral-900 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
          data-testid="nav-settings"
        >
          <Settings className="w-[18px] h-[18px]" />
          <span>Settings</span>
        </NavLink>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-[13px] font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
          data-testid="logout-btn"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white flex" data-testid="pos-layout">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[240px] bg-white flex-col border-r border-gray-200 flex-shrink-0">
        <div className="h-[68px] flex items-center gap-3 px-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-dd-blue rounded-xl flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
           <h1 className="font-heading font-bold text-gray-900 text-base leading-tight">DineDesk</h1>
              <p className="text-[10px] text-gray-400 leading-tight">by Trident Ventures</p>
            </div>
          </div>
          <SidebarNav />
        </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[260px] p-0 flex flex-col" data-testid="mobile-sidebar">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className="h-[68px] flex items-center gap-3 px-5 border-b border-gray-100">
            <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-gray-900 text-base leading-tight">DineDesk</h1>
              <p className="text-[10px] text-gray-400 leading-tight">Restaurant POS</p>
            </div>
          </div>
          <SidebarNav />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[56px] bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-5 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100" data-testid="mobile-menu-btn">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2 bg-gray-100 px-2 md:px-3 py-1.5 rounded-xl border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-gray-600"></div>
              <span className="text-xs md:text-sm font-medium text-gray-800 truncate max-w-[120px] md:max-w-none">
                {restaurant?.name || 'Restaurant'}
              </span>
            </div>
            {isDayOpen ? (
              <button onClick={() => setShowDayCloseModal(true)} className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 hover:bg-green-100 transition-colors" data-testid="close-day-btn">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="hidden sm:inline">Open</span>
              </button>
            ) : (
              <button onClick={() => setShowDayOpenModal(true)} className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 hover:bg-red-100 transition-colors" data-testid="open-day-btn">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <span className="hidden sm:inline">Closed</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-2 text-gray-500 text-xs">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{currentTime}</span>
            </div>
            <div className="w-px h-6 bg-gray-200 hidden md:block"></div>
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">{user.name?.charAt(0).toUpperCase()}</span>
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 md:p-5 bg-gray-50/50">
          <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
        </main>
      </div>

      {/* Day Open Modal */}
      <Dialog open={showDayOpenModal} onOpenChange={setShowDayOpenModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">Open Day</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label htmlFor="opening-cash" className="text-gray-600">Opening Cash ({'\u20B9'})</Label>
            <Input id="opening-cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Enter opening cash amount" className="mt-2 h-12 rounded-xl" data-testid="opening-cash-input" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayOpenModal(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleOpenDay} disabled={loading} className="bg-yellow-400 hover:bg-yellow-300 rounded-xl text-white" data-testid="confirm-open-day-btn">
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
                <div className="flex justify-between text-sm"><span className="text-gray-600">Opening Cash:</span><span className="font-semibold">{'\u20B9'}{currentSession.opening_cash.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Total Orders:</span><span className="font-semibold">{currentSession.total_orders}</span></div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash" className="text-gray-600">Closing Cash ({'\u20B9'})</Label>
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
