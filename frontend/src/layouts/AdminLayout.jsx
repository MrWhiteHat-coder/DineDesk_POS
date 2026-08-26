import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/brand/BrandMark';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Users,
  FileText,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/admin/restaurants', icon: Store, label: 'Restaurants' },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/logs', icon: FileText, label: 'System Logs' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-linen flex">
      <aside
        className={`bg-ink flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-[72px] flex items-center justify-between px-4 border-b border-white/8">
          {!collapsed && <BrandMark tone="light" size={34} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/50 hover:text-white hover:bg-white/10"
            data-testid="admin-sidebar-toggle"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 mb-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/12 text-white'
                    : 'text-white/50 hover:bg-white/8 hover:text-white'
                }`
              }
              data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-white/8">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-white/50 hover:bg-rose/20 hover:text-rose-200 transition-all"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] bg-plate/90 backdrop-blur-md border-b border-line flex items-center justify-between px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-navy/70 font-semibold">Platform</p>
            <h1 className="font-display font-semibold text-lg text-ink leading-tight">
              DineDesk Admin
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-navy rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            {user && (
              <div className="text-sm">
                <p className="font-medium text-ink">{user.name}</p>
                <p className="text-ink/45 text-xs capitalize">{user.role}</p>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
