import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, inventoryAPI } from '../../lib/api';
import {
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  ChefHat,
  ShoppingBag,
  ArrowRight,
  Package,
} from 'lucide-react';

const STATUS_STYLES = {
  ready: { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', border: 'border-[#BBF7D0]', label: 'Ready' },
  completed: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', border: 'border-[#E5E7EB]', label: 'Completed' },
  preparing: { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FDE68A]', label: 'Preparing' },
  pending: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]', label: 'New' },
  cancelled: { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]', label: 'Cancelled' },
};

function getTableLabel(order) {
  if (order.table_number) return `T${order.table_number}`;
  return order.order_type === 'takeaway' ? 'TA' : order.order_type === 'online' ? 'OL' : 'DI';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function POSDashboard() {
  const { user } = useAuth();
  const { isDayOpen, currentSession } = useOutletContext();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [todayOrders, setTodayOrders] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [isDayOpen]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ordersRes, inventoryRes] = await Promise.all([
        analyticsAPI.get().catch(() => ({ data: null })),
        orderAPI.getToday().catch(() => ({ data: [] })),
        inventoryAPI.getAll(true).catch(() => ({ data: [] })),
      ]);
      setAnalytics(analyticsRes.data);
      setTodayOrders(ordersRes.data);
      setLowStockItems(inventoryRes.data || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Computed stats
  const openTickets = todayOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'
  ).length;

  const kitchenQueue = todayOrders.filter(
    (o) => o.status === 'preparing'
  ).length;

  const settledToday = todayOrders
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const covers = todayOrders.filter((o) => o.status === 'completed').length;

  // Live orders (active)
  const liveOrders = todayOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'
  ).slice(0, 5);

  // Popular items
  const popularItems = analytics?.top_items?.slice(0, 4) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pos-dashboard">
      {/* Live Operations Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-xs font-semibold text-[#22C55E] uppercase tracking-wider">Live Operations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A1A]">
            {getGreeting()}, {user?.name || 'there'}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {openTickets} ticket{openTickets !== 1 ? 's' : ''} open across the floor.
            {kitchenQueue > 0 ? ` Kitchen is handling ${kitchenQueue} order${kitchenQueue !== 1 ? 's' : ''}.` : ' Kitchen is clear.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDayOpen ? (
            <span className="on-badge-success">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mr-1.5" />
              Open
            </span>
          ) : (
            <span className="on-badge-error">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] mr-1.5" />
              Closed
            </span>
          )}
          <button
            onClick={() => navigate('/pos/orders')}
            className="on-btn-primary flex items-center gap-2"
          >
            <span>New order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="on-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FEF2F2] rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-[#E53935]" />
            </div>
            <span className="text-sm font-medium text-[#6B7280]">Open tickets</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">{openTickets}</p>
        </div>

        <div className="on-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FFFBEB] rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <span className="text-sm font-medium text-[#6B7280]">Kitchen queue</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">{kitchenQueue}</p>
          <p className="text-xs text-[#22C55E] mt-1">
            {kitchenQueue > 0 ? 'On pace' : 'All clear'}
          </p>
        </div>

        <div className="on-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#22C55E]" />
            </div>
            <span className="text-sm font-medium text-[#6B7280]">Settled today</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">₹{settledToday.toFixed(0)}</p>
          <p className="text-xs text-[#22C55E] mt-1">↑ Live total</p>
        </div>

        <div className="on-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <span className="text-sm font-medium text-[#6B7280]">Covers</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">{covers}</p>
          <p className="text-xs text-[#6B7280] mt-1">completed orders</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Orders */}
        <div className="lg:col-span-2 on-card">
          <div className="p-4 border-b border-[#E8E8E8]">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1A1A1A]">Live orders</h2>
              <span className="on-badge-info">{openTickets} open</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {liveOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#9CA3AF]">No active orders right now</p>
              </div>
            ) : (
              liveOrders.map((order) => {
                const status = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                const label = getTableLabel(order);
                const timeAgo = getTimeAgo(order.created_at);

                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                    onClick={() => navigate('/pos/orders')}
                  >
                    <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">{label}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1A1A1A] truncate">
                          {order.customer_name || `Order #${order.order_number}`}
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        {(order.items || []).length} item{(order.items || []).length !== 1 ? 's' : ''} · {timeAgo}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`on-badge ${status.bg} ${status.text} border ${status.border}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-[#9CA3AF]">
                        {order.status === 'ready' ? 'Ready to serve' :
                         order.status === 'preparing' ? 'Waiting for payment' :
                         order.status === 'pending' ? 'New order' : ''}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#D1D5DB]" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Popular Right Now */}
        <div className="on-card">
          <div className="p-4 border-b border-[#E8E8E8]">
            <h2 className="font-bold text-[#1A1A1A]">Popular right now</h2>
          </div>
          <div className="p-4 space-y-3">
            {popularItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#9CA3AF]">No sales data yet</p>
              </div>
            ) : (
              popularItems.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#D1D5DB] w-6">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="w-10 h-10 bg-[#F8F9FA] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-[#9CA3AF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A1A1A] truncate">{item.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{item.count} orders today</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) > 1 ? 's' : ''} ago`;
}
