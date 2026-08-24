import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ListOrdered, ShoppingCart, ChefHat, MoreHorizontal } from 'lucide-react';

const navItems = [
  { to: '/pos', icon: Home, label: 'Overview', exact: true },
  { to: '/pos/orders', icon: ListOrdered, label: 'Orders', badge: true },
  { to: '/pos/quick-pos', icon: ShoppingCart, label: 'POS', primary: true },
  { to: '/pos/kds', icon: ChefHat, label: 'Kitchen' },
  { to: '/pos/more', icon: MoreHorizontal, label: 'More' },
];

export default function BottomNav({ orderCount = 0 }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8E8E8] z-50 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
                item.primary
                  ? isActive
                    ? 'bg-[#E53935] text-white shadow-lg shadow-[#E53935]/30'
                    : 'bg-[#E53935] text-white shadow-md'
                  : isActive
                    ? 'text-[#E53935] bg-[#FFEBEE]'
                    : 'text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F8F9FA]'
              }`
            }
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.badge && orderCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#E53935] text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {orderCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
