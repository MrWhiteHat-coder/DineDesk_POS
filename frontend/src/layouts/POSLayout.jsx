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
  ChevronLeft,
  ChevronRight,
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
  { to: '/pos/orders', icon: ShoppingCart, label: 'Menu Orders (POS)' },
  { to: '/pos/order-management', icon: ClipboardList, label: 'Orders' },
  { to: '/pos/online-orders', icon: Globe, label: 'Online Orders' },
  { to: '/pos/tables', icon: SquareStack, label: 'Tables' },
  { to: '/pos/menu', icon: UtensilsCrossed, label: 'Menu Management' },
  { to: '/pos/inventory', icon: Package, label: 'Inventory' },
  { to: '/pos/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/pos/staff', icon: Users, label: 'Staff' },
  { to: '/pos/settings', icon: Settings, label: 'Settings' },
];

export default function POSLayout() {
  const { user, restaurant, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showDayOpenModal, setShowDayOpenModal] = useState(false);
  const [showDayCloseModal, setShowDayCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);

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

  const currentTime = new Date().toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-slate-900">FoodFlow</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-500 hover:text-slate-700"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 mb-1 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="font-heading font-semibold text-lg text-slate-900">
              {restaurant?.name || 'Restaurant'}
            </h1>
            <span className="text-sm text-slate-500">{currentTime}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Day Open/Close Toggle */}
            <div className="flex items-center gap-2">
              {isDayOpen ? (
                <Button
                  onClick={() => setShowDayCloseModal(true)}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  data-testid="close-day-btn"
                >
                  <Moon className="w-4 h-4 mr-2" />
                  Close Day
                </Button>
              ) : (
                <Button
                  onClick={() => setShowDayOpenModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="open-day-btn"
                >
                  <Sun className="w-4 h-4 mr-2" />
                  Open Day
                </Button>
              )}
            </div>

            {/* User Info */}
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              {user && (
                <div className="text-sm">
                  <p className="font-medium text-slate-900">{user.name}</p>
                  <p className="text-slate-500 text-xs capitalize">{user.role}</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
        </main>
      </div>

      {/* Day Open Modal */}
      <Dialog open={showDayOpenModal} onOpenChange={setShowDayOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Open Day</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="opening-cash">Opening Cash (₹)</Label>
            <Input
              id="opening-cash"
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="Enter opening cash amount"
              className="mt-2"
              data-testid="opening-cash-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDayOpenModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOpenDay}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600"
              data-testid="confirm-open-day-btn"
            >
              {loading ? 'Opening...' : 'Open Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Close Modal */}
      <Dialog open={showDayCloseModal} onOpenChange={setShowDayCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Close Day</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {currentSession && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Opening Cash:</span>
                  <span className="font-numbers font-semibold">₹{currentSession.opening_cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Orders:</span>
                  <span className="font-numbers font-semibold">{currentSession.total_orders}</span>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash">Closing Cash (₹)</Label>
              <Input
                id="closing-cash"
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="Enter closing cash amount"
                className="mt-2"
                data-testid="closing-cash-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDayCloseModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCloseDay}
              disabled={loading}
              variant="destructive"
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
