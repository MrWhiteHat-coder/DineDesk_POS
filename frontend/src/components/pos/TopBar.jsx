import React, { useState } from 'react';
import { Search, ShoppingCart, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ cartCount = 0, onSearch }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-[#E8E8E8] flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#E53935] rounded-xl flex items-center justify-center">
          <span className="text-white text-lg">🍽️</span>
        </div>
        <div>
          <h1 className="font-bold text-[#1A1A1A] text-base leading-tight">OrderNest</h1>
          <p className="text-[10px] text-[#9CA3AF] leading-tight">Restaurant POS</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search dishes, tables, or orders..."
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full h-10 pl-10 pr-12 bg-[#F8F9FA] border border-[#E8E8E8] rounded-xl text-sm focus:ring-2 focus:ring-[#E53935]/20 focus:border-[#E53935] outline-none transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border border-[#E8E8E8] rounded text-[10px] text-[#9CA3AF]">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#E8E8E8] rounded text-[10px] text-[#9CA3AF]">K</kbd>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Cart */}
        <button className="relative p-2 hover:bg-[#F8F9FA] rounded-xl transition-colors">
          <ShoppingCart className="w-5 h-5 text-[#6B7280]" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E53935] text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 hover:bg-[#F8F9FA] rounded-xl transition-colors"
          >
            <div className="w-8 h-8 bg-[#1A1A1A] rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-[#1A1A1A] leading-tight">{user?.name || 'User'}</p>
              <p className="text-[10px] text-[#9CA3AF] leading-tight capitalize">{user?.role || 'owner'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-[#E8E8E8] shadow-lg z-50 py-1">
                <button
                  onClick={() => { navigate('/pos/settings'); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#1A1A1A] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
