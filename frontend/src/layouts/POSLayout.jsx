import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { daySessionAPI } from '../lib/api';
import { toast } from 'sonner';
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
  Sun,
  Moon,
  Globe,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  RefreshCw,
  Bell,
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

const navItems = [
  { to: '/pos', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/pos/orders', icon: ShoppingCart, label: 'Menu Order' },
  { to: '/pos/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/pos/online-orders', icon: Globe, label: 'Online Orders' },
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
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showDayOpenModal, setShowDayOpenModal] = useState(false);
  const [showDayCloseModal, setShowDayCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    tables: false,
    dishes: false,
  });

  useEffect(() => {
    fetchDaySession();
  }, []);

  const fetchDaySession = async () => {
    try {
      const res = await daySessionAPI.getCurrent();
      if (res.data) {
        setCurrentSession(res.data);
        setIsDayOpen(true);
      } else {
        setCurrentSession(null);
        setIsDayOpen(false);
      }
    } catch (err) {
      console.error('Failed to fetch day session:', err);
    }
  };

  const handleOpenDay = async () => {
    setLoading(true);
    try {
      const res = await daySessionAPI.open(parseFloat(openingCash) || 0);
      setCurrentSession(res.data);
      setIsDayOpen(true);
      setShowDayOpenModal(false);
      setOpeningCash('');
      toast.success('Day opened successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to open day');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    setLoading(true);
    try {
      const res = await daySessionAPI.close(parseFloat(closingCash) || 0);
      setCurrentSession(null);
      setIsDayOpen(false);
      setShowDayCloseModal(false);
      setClosingCash('');
      toast.success(`Day closed! Total sales: ₹${res.data.total_sales.toFixed(2)}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close day');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const currentTime = new Date().toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex" data-testid="pos-layout">
      {/* Sidebar - Light Theme */}
      <aside className="w-[240px] bg-white flex flex-col border-r border-slate-200 flex-shrink-0">
        {/* Logo */}
        <div className="h-[68px] flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-slate-900 text-base leading-tight">FoodFlow</h1>
            <p className="text-[10px] text-slate-400 leading-tight">Cashier Daily Assistant</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-[13px] font-medium ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Manage Table - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('tables')}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                data-testid="nav-manage-table"
              >
                <div className="flex items-center gap-3">
                  <SquareStack className="w-[18px] h-[18px]" />
                  <span>Manage Table</span>
                </div>
                {expandedSections.tables ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.tables && (
                <div className="ml-9 space-y-0.5 mt-0.5">
                  {manageTableItems.map((sub) => (
                    <NavLink
                      key={sub.to}
                      to={sub.to}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? 'text-slate-900 font-medium bg-slate-100'
                            : 'text-slate-500 hover:text-slate-700'
                        }`
                      }
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            {/* Manage Dish - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('dishes')}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                data-testid="nav-manage-dish"
              >
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="w-[18px] h-[18px]" />
                  <span>Manage Dish</span>
                </div>
                {expandedSections.dishes ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.dishes && (
                <div className="ml-9 space-y-0.5 mt-0.5">
                  {manageDishItems.map((sub) => (
                    <NavLink
                      key={sub.to}
                      to={sub.to}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? 'text-slate-900 font-medium bg-slate-100'
                            : 'text-slate-500 hover:text-slate-700'
                        }`
                      }
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            {/* Staff */}
            <NavLink
              to="/pos/staff"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-[13px] font-medium ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
              data-testid="nav-staff"
            >
              <Users className="w-[18px] h-[18px]" />
              <span>Staff</span>
            </NavLink>
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-0.5">
          <NavLink
            to="/pos/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-[13px] font-medium ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
            data-testid="nav-settings"
          >
            <Settings className="w-[18px] h-[18px]" />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-[13px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
            data-testid="logout-btn"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-[56px] bg-white border-b border-slate-200 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
              <span className="text-sm font-medium text-slate-800">
                {restaurant?.name || 'Restaurant'}
              </span>
            </div>
            {isDayOpen ? (
              <button
                onClick={() => setShowDayCloseModal(true)}
                className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 hover:bg-green-100 transition-colors"
                data-testid="close-day-btn"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Open
              </button>
            ) : (
              <button
                onClick={() => setShowDayOpenModal(true)}
                className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 hover:bg-red-100 transition-colors"
                data-testid="open-day-btn"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                Closed
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{currentTime}</span>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            {user && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-5">
          <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
        </main>
      </div>

      {/* Day Open Modal */}
      <Dialog open={showDayOpenModal} onOpenChange={setShowDayOpenModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Open Day</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="opening-cash" className="text-slate-600">Opening Cash (₹)</Label>
            <Input
              id="opening-cash"
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="Enter opening cash amount"
              className="mt-2 h-12 rounded-xl"
              data-testid="opening-cash-input"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayOpenModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleOpenDay}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 rounded-xl text-white"
              data-testid="confirm-open-day-btn"
            >
              {loading ? 'Opening...' : 'Open Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Close Modal */}
      <Dialog open={showDayCloseModal} onOpenChange={setShowDayCloseModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Close Day</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {currentSession && (
              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Opening Cash:</span>
                  <span className="font-semibold">₹{currentSession.opening_cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Orders:</span>
                  <span className="font-semibold">{currentSession.total_orders}</span>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash" className="text-slate-600">Closing Cash (₹)</Label>
              <Input
                id="closing-cash"
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="Enter closing cash amount"
                className="mt-2 h-12 rounded-xl"
                data-testid="closing-cash-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDayCloseModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCloseDay}
              disabled={loading}
              variant="destructive"
              className="rounded-xl"
              data-testid="confirm-close-day-btn"
            >
              {loading ? 'Closing...' : 'Close Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
