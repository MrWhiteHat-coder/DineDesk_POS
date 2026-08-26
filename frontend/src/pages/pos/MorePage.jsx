import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import {
  SquareStack,
  ClipboardList,
  UtensilsCrossed,
  Package,
  Globe,
  Truck,
  Users,
  UserCog,
  Wallet,
  Gift,
  Coins,
  BarChart3,
  Building2,
  Bell,
  Store,
  Settings,
  ChevronRight,
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Operations',
    items: [
      { to: '/pos/tables', icon: SquareStack, label: 'Tables', desc: 'Floor plan & occupancy', feature: 'tables' },
      { to: '/pos/order-management', icon: ClipboardList, label: 'Running Orders', desc: 'Live tickets on the floor', feature: 'tables' },
      { to: '/pos/menu', icon: UtensilsCrossed, label: 'Menu Items', desc: 'Categories, photos, prices', feature: 'menu' },
      { to: '/pos/inventory', icon: Package, label: 'Inventory', desc: 'Stock levels & alerts', feature: 'inventory' },
      { to: '/pos/online-orders', icon: Globe, label: 'Online Orders', desc: 'Swiggy & Zomato desk', feature: 'online_orders' },
      { to: '/pos/purchase-orders', icon: Truck, label: 'Purchase Orders', desc: 'Supplier restocks', feature: 'purchase_orders' },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/pos/customers', icon: Users, label: 'Customers', desc: 'CRM & visit history', feature: 'staff' },
      { to: '/pos/staff', icon: UserCog, label: 'Staff', desc: 'Roles and access', feature: 'staff' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/pos/wallet', icon: Wallet, label: 'Wallet', desc: 'Cash-up & settlement', feature: 'wallet' },
      { to: '/pos/gift-cards', icon: Gift, label: 'Gift Cards', desc: 'Issue and redeem', feature: 'wallet' },
      { to: '/pos/trident-coins', icon: Coins, label: 'Trident Coins', desc: 'Loyalty currency', feature: 'wallet' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { to: '/pos/analytics', icon: BarChart3, label: 'Analytics', desc: 'Sales, peaks, bestsellers', feature: 'analytics' },
      { to: '/pos/branches', icon: Building2, label: 'Branches', desc: 'Multi-location control', feature: 'branches' },
      { to: '/pos/notifications', icon: Bell, label: 'Notifications', desc: 'SMS & WhatsApp', feature: 'notifications' },
      { to: '/pos/store', icon: Store, label: 'DineDesk Store', desc: 'Add-ons for the floor', feature: 'settings' },
      { to: '/pos/settings', icon: Settings, label: 'Settings', desc: 'Restaurant profile', feature: 'settings' },
    ],
  },
];

export default function MorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const ROLE_ACCESS = {
    owner: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
    manager: new Set(['dashboard', 'menu_order', 'analytics', 'kds', 'tables', 'menu', 'inventory', 'staff', 'settings', 'online_orders', 'wallet', 'branches', 'purchase_orders', 'notifications']),
    cashier: new Set(['dashboard', 'menu_order', 'wallet', 'analytics']),
    captain: new Set(['menu_order', 'tables', 'kds']),
    chef: new Set(['kds']),
  };
  const permissions = ROLE_ACCESS[user?.role || 'owner'] || ROLE_ACCESS.owner;
  const hasAccess = (feature) => permissions.has(feature);

  return (
    <div className="max-w-4xl mx-auto" data-testid="more-page">
      <PageHeader
        eyebrow="Navigate"
        title="More"
        subtitle="Everything else on the floor — grouped the way a service team thinks."
      />

      <div className="space-y-7">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => hasAccess(i.feature));
          if (items.length === 0) return null;
          return (
            <section key={section.title}>
              <h2 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink/40 mb-2 px-1">
                {section.title}
              </h2>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {items.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#E8E8E8] text-left hover:border-[#E23744] hover:shadow-card transition-all group"
                  >
                    <span className="w-10 h-10 rounded-xl bg-[#FFF5F6] text-[#E23744] flex items-center justify-center flex-shrink-0 group-hover:bg-[#E23744] group-hover:text-white transition-colors">
                      <item.icon className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-[#1C1C1C]">{item.label}</span>
                      <span className="block text-xs text-[#696969] truncate">{item.desc}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#C8C8C8] group-hover:text-[#E23744]" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
