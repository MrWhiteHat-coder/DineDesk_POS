import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { daySessionAPI } from '../lib/api';
import { toast } from 'sonner';
import DayCloseReport from '../components/pos/DayCloseReport';
import BrandMark from '../components/brand/BrandMark';
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
  Gift,
  Coins,
  Store,
  LayoutGrid,
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
  { to: '/pos', icon: LayoutDashboard, label: 'Dashboard', exact: true, feature: 'dashboard', group: 'floor' },
  { to: '/pos/orders', icon: ShoppingCart, label: 'Create Order', feature: 'menu_order', group: 'floor' },
  { to: '/pos/quick-pos', icon: Zap, label: 'Quick POS', feature: 'menu_order', group: 'floor' },
  { to: '/pos/kds', icon: ChefHat, label: 'Kitchen Display', feature: 'kds', group: 'floor' },
  { to: '/pos/online-orders', icon: Globe, label: 'Online Orders', feature: 'online_orders', group: 'floor' },
  { to: '/pos/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics', group: 'insights' },
  { to: '/pos/wallet', icon: Wallet, label: 'Wallet', feature: 'wallet', group: 'money' },
  { to: '/pos/branches', icon: Building2, label: 'Branches', feature: 'branches', group: 'insights' },
  { to: '/pos/purchase-orders', icon: Truck, label: 'Purchase Orders', feature: 'purchase_orders', group: 'money' },
  { to: '/pos/notifications', icon: Bell, label: 'Notifications', feature: 'notifications', group: 'insights' },
  { to: '/pos/customers', icon: Users, label: 'Customers', feature: 'staff', group: 'people' },
  { to: '/pos/trident-coins', icon: Coins, label: 'Trident Coins', feature: 'wallet', group: 'money' },
  { to: '/pos/gift-cards', icon: Gift, label: 'Gift Cards', feature: 'wallet', group: 'money' },
  { to: '/pos/store', icon: Store, label: 'DineDesk Store', feature: 'settings', group: 'system' },
];

const manageTableItems = [
  { to: '/pos/tables', label: 'All Tables' },
  { to: '/pos/order-management', label: 'Running Orders' },
];

const manageDishItems = [
  { to: '/pos/menu', label: 'Menu Items' },
  { to: '/pos/inventory', label: 'Inventory' },
];

const GROUP_META = {
  floor: 'Floor',
  people: 'People',
  money: 'Money',
  insights: 'Insights',
  system: 'Grow',
};

const bottomItems = [
  { to: '/pos', icon: LayoutDashboard, label: 'Home', feature: 'dashboard', exact: true },
  { to: '/pos/orders', icon: ShoppingCart, label: 'Orders', feature: 'menu_order' },
  { to: '/pos/quick-pos', icon: Zap, label: 'POS', feature: 'menu_order' },
  { to: '/pos/kds', icon: ChefHat, label: 'Kitchen', feature: 'kds' },
  { to: '/pos/more', icon: LayoutGrid, label: 'More', feature: null },
];

const navClass = (isActive) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] font-semibold ${
    isActive
      ? 'bg-[#E23744] text-white shadow-sm'
      : 'text-[#696969] hover:bg-[#FFF5F6] hover:text-[#E23744]'
  }`;

export default function POSLayout() {
  const { user, restaurant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.documentElement.classList.remove('night');
    try { localStorage.removeItem('dinedesk-night'); } catch {}
  }, []);

  const ROLE_ACCESS = {
    owner: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
    manager: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
    cashier: new Set(['dashboard', 'menu_order', 'wallet', 'analytics']),
    captain: new Set(['menu_order', 'tables', 'kds']),
    chef: new Set(['kds']),
  };
  const userRole = user?.role || 'owner';
  const permissions = ROLE_ACCESS[userRole] || ROLE_ACCESS.owner;
  const hasAccess = (feature) => !feature || permissions.has(feature);
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

  const SidebarNav = () => {
    const visible = navItems.filter((item) => hasAccess(item.feature));
    const groups = ['floor', 'people', 'money', 'insights', 'system'];
    return (
      <>
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {groups.map((group) => {
            const items = visible.filter((i) => i.group === group);
            if (group === 'floor') {
              return (
                <div key={group} className="mb-4">
                  <p className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[#9C9C9C]">
                    {GROUP_META[group]}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.exact}
                        className={({ isActive }) => navClass(isActive)}
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
                          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#696969] hover:bg-[#FFF5F6] hover:text-[#E23744] transition-all"
                          data-testid="nav-manage-table"
                        >
                          <div className="flex items-center gap-3">
                            <SquareStack className="w-[18px] h-[18px]" />
                            <span>Manage Table</span>
                          </div>
                          {expandedSections.tables ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                        </button>
                        {expandedSections.tables && (
                          <div className="ml-9 space-y-0.5 mt-0.5">
                            {manageTableItems.map((sub) => (
                              <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-[#E23744] font-semibold bg-[#FFF5F6]' : 'text-[#9C9C9C] hover:text-[#1C1C1C]'}`}>
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
                          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#696969] hover:bg-[#FFF5F6] hover:text-[#E23744] transition-all"
                          data-testid="nav-manage-dish"
                        >
                          <div className="flex items-center gap-3">
                            <UtensilsCrossed className="w-[18px] h-[18px]" />
                            <span>Manage Dish</span>
                          </div>
                          {expandedSections.dishes ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                        </button>
                        {expandedSections.dishes && (
                          <div className="ml-9 space-y-0.5 mt-0.5">
                            {manageDishItems.map((sub) => (
                              <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? 'text-[#E23744] font-semibold bg-[#FFF5F6]' : 'text-[#9C9C9C] hover:text-[#1C1C1C]'}`}>
                                {sub.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (items.length === 0 && !(group === 'people' && hasAccess('staff'))) return null;

            return (
              <div key={group} className="mb-4">
                <p className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[#9C9C9C]">
                  {GROUP_META[group]}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      className={({ isActive }) => navClass(isActive)}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                  {group === 'people' && hasAccess('staff') && (
                    <NavLink
                      to="/pos/staff"
                      className={({ isActive }) => navClass(isActive)}
                      data-testid="nav-staff"
                    >
                      <Users className="w-[18px] h-[18px]" />
                      <span>Staff</span>
                    </NavLink>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-[#E8E8E8] space-y-0.5">
          {hasAccess('settings') && (
            <NavLink
              to="/pos/settings"
              className={({ isActive }) => navClass(isActive)}
              data-testid="nav-settings"
            >
              <Settings className="w-[18px] h-[18px]" />
              <span>Settings</span>
            </NavLink>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[13px] font-semibold text-[#696969] hover:bg-[#FFF5F6] hover:text-[#E23744] transition-all"
            data-testid="logout-btn"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex" data-testid="pos-layout">
      <aside className="hidden lg:flex w-[248px] bg-white flex-col flex-shrink-0 border-r border-[#E8E8E8]">
        <div className="h-[72px] flex items-center px-5 border-b border-[#E8E8E8]">
          <BrandMark tone="dark" size={36} />
        </div>
        <SidebarNav />
      </aside>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-white" data-testid="mobile-sidebar">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className="h-[72px] flex items-center px-5 border-b border-[#E8E8E8]">
            <BrandMark tone="dark" size={36} />
          </div>
          <SidebarNav />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] bg-white border-b border-[#E8E8E8] flex items-center justify-between px-3 md:px-5 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-[#FFF5F6]" data-testid="mobile-menu-btn">
              <Menu className="w-5 h-5 text-[#1C1C1C]" />
            </button>
            <div className="flex items-center gap-2 bg-[#FFF5F6] px-2.5 md:px-3 py-1.5 rounded-xl border border-[#F8D7DA] min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E23744] flex-shrink-0" />
              <span className="text-xs md:text-sm font-bold text-[#1C1C1C] truncate max-w-[120px] md:max-w-[220px]">
                {restaurant?.name || 'Restaurant'}
              </span>
            </div>
            {isDayOpen ? (
              <button onClick={() => setShowDayCloseModal(true)} className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#267E3E] px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold border border-[#C8E6C9] hover:bg-[#C8E6C9] transition-colors" data-testid="close-day-btn">
                <div className="w-1.5 h-1.5 rounded-full bg-[#267E3E] animate-pulse" />
                <span className="hidden sm:inline">Open</span>
              </button>
            ) : (
              <button onClick={() => setShowDayOpenModal(true)} className="flex items-center gap-1.5 bg-[#FFF5F6] text-[#E23744] px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold border border-[#F8D7DA] hover:bg-[#FDECEE] transition-colors" data-testid="open-day-btn">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E23744]" />
                <span className="hidden sm:inline">Closed</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-3">
            <div className="hidden md:flex items-center gap-2 text-[#9C9C9C] text-xs">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{currentTime}</span>
            </div>
            <div className="w-px h-6 bg-[#E8E8E8] hidden md:block" />
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#E23744] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">{user.name?.charAt(0).toUpperCase()}</span>
                </div>
                <span className="hidden md:block text-sm font-semibold text-[#1C1C1C]">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 md:p-5 pb-24 lg:pb-6 bg-[#F8F8F8]">
          <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
        </main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E8E8E8] pb-safe">
          <div
            className="grid h-16"
            style={{ gridTemplateColumns: `repeat(${bottomItems.filter((item) => hasAccess(item.feature)).length || 1}, minmax(0, 1fr))` }}
          >
            {bottomItems.filter((item) => hasAccess(item.feature)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
                    isActive ? 'text-[#E23744]' : 'text-[#9C9C9C]'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      <Dialog open={showDayOpenModal} onOpenChange={setShowDayOpenModal}>
        <DialogContent className="rounded-2xl bg-white">
          <DialogHeader><DialogTitle className="font-display text-xl">Open Day</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label htmlFor="opening-cash" className="text-[#696969]">Opening Cash ({'\u20B9'})</Label>
            <Input id="opening-cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Enter opening cash amount" className="mt-2 h-12 rounded-xl" data-testid="opening-cash-input" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayOpenModal(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleOpenDay} disabled={loading} className="bg-[#E23744] hover:bg-[#CB202D] rounded-xl text-white" data-testid="confirm-open-day-btn">
              {loading ? 'Opening...' : 'Open Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDayCloseModal} onOpenChange={setShowDayCloseModal}>
        <DialogContent className="rounded-2xl bg-white">
          <DialogHeader><DialogTitle className="font-display text-xl">Close Day</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            {currentSession && (
              <div className="bg-[#FFF5F6] p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm"><span className="text-[#696969]">Opening Cash:</span><span className="font-semibold">{'\u20B9'}{currentSession.opening_cash.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#696969]">Total Orders:</span><span className="font-semibold">{currentSession.total_orders}</span></div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash" className="text-[#696969]">Closing Cash ({'\u20B9'})</Label>
              <Input id="closing-cash" type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} placeholder="Enter closing cash amount" className="mt-2 h-12 rounded-xl" data-testid="closing-cash-input" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayCloseModal(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCloseDay} disabled={loading} className="bg-[#E23744] hover:bg-[#CB202D] rounded-xl text-white" data-testid="confirm-close-day-btn">
              {loading ? 'Closing...' : 'Close Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DayCloseReport sessionId={reportSessionId} open={showDayReport} onClose={() => setShowDayReport(false)} />
    </div>
  );
}
