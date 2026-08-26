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
    <div className="min-h-screen bg-[#F8F8F8] flex">
      <aside
        className={`bg-white border-r border-[#E8E8E8] flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-[72px] flex items-center justify-between px-4 border-b border-[#E8E8E8]">
          {!collapsed && <BrandMark tone="dark" size={34} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#696969] hover:text-[#E23744] hover:bg-[#FFF5F6]"
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
                    ? 'bg-[#E23744] text-white shadow-sm'
                    : 'text-[#696969] hover:bg-[#FFF5F6] hover:text-[#E23744]'
                }`
              }
              data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-semibold text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-[#E8E8E8]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-[#696969] hover:bg-[#FFF5F6] hover:text-[#E23744] transition-all"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-semibold text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] bg-white border-b border-[#E8E8E8] flex items-center justify-between px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#E23744] font-bold">Platform</p>
            <h1 className="font-display font-semibold text-lg text-[#1C1C1C] leading-tight">
              DineDesk Admin
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#E23744] rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            {user && (
              <div className="text-sm">
                <p className="font-semibold text-[#1C1C1C]">{user.name}</p>
                <p className="text-[#696969] text-xs capitalize">{user.role}</p>
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
