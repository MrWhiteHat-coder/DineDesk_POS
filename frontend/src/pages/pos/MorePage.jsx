import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  LayoutGrid,
  Truck,
  Users,
  UserCog,
  Settings,
  ChevronRight,
  Wallet,
  Building2,
  Bell,
  Coins,
  Gift,
  Store,
  BarChart3,
  Package,
} from 'lucide-react';

const sections = [
  {
    title: 'OPERATIONS',
    items: [
      { to: '/pos/menu', icon: UtensilsCrossed, label: 'Menu manager', desc: 'Dishes, pricing, availability', color: '#E53935' },
      { to: '/pos/tables', icon: LayoutGrid, label: 'Floor plan', desc: 'Tables, zones and covers', color: '#E53935' },
      { to: '/pos/purchase-orders', icon: Truck, label: 'Suppliers', desc: 'Deliveries and purchase orders', color: '#3B82F6' },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      { to: '/pos/customers', icon: Users, label: 'Customers', desc: 'Profiles and loyalty', color: '#8B5CF6' },
      { to: '/pos/staff', icon: UserCog, label: 'Staff & shifts', desc: 'Roles, roles and permissions', color: '#EC4899' },
      { to: '/pos/settings', icon: Settings, label: 'Settings', desc: 'Taxes, printers, receipts', color: '#6B7280' },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { to: '/pos/analytics', icon: BarChart3, label: 'Analytics', desc: 'Sales reports and insights', color: '#F59E0B' },
      { to: '/pos/wallet', icon: Wallet, label: 'Wallet', desc: 'Payments and settlements', color: '#22C55E' },
      { to: '/pos/inventory', icon: Package, label: 'Inventory', desc: 'Stock management', color: '#06B6D4' },
    ],
  },
  {
    title: 'MARKETING',
    items: [
      { to: '/pos/gift-cards', icon: Gift, label: 'Gift Cards', desc: 'Create and manage gift cards', color: '#F97316' },
      { to: '/pos/trident-coins', icon: Coins, label: 'Trident Coins', desc: 'Loyalty rewards program', color: '#EAB308' },
      { to: '/pos/store', icon: Store, label: 'DineDesk Store', desc: 'Marketplace for add-ons', color: '#8B5CF6' },
    ],
  },
];

export default function MorePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="more-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">More</h1>
        <p className="text-sm text-[#6B7280] mt-1">Everything else in the workspace, grouped by what you came here to do.</p>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">{section.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {section.items.map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="on-card-hover p-4 flex items-center gap-4 text-left group"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1A1A] group-hover:text-[#E53935] transition-colors">{item.label}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{item.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#D1D5DB] group-hover:text-[#E53935] transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
