import React, { useState, useEffect } from 'react';
import { orderAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Search, ArrowRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getImageUrl = (u) => { if (!u) return null; return u.startsWith('http') ? u : `${API_URL}${u}`; };
const FALLBACK = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=60&h=60&fit=crop';

const STATUS_STYLES = {
  ready: { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', border: 'border-[#BBF7D0]', label: 'Ready' },
  completed: { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', border: 'border-[#BBF7D0]', label: 'Completed' },
  preparing: { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FDE68A]', label: 'Preparing' },
  pending: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]', label: 'New' },
  cancelled: { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]', label: 'Cancelled' },
};

function getTableLabel(order) {
  if (order.table_number) return `T${order.table_number}`;
  return order.order_type === 'takeaway' ? 'TA' : order.order_type === 'online' ? 'OL' : 'DI';
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

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getToday();
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveStatus = async (orderId, currentStatus) => {
    const nextStatus = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'completed',
    };
    const next = nextStatus[currentStatus];
    if (!next) return;
    try {
      await orderAPI.updateStatus(orderId, next);
      toast.success(`Order moved to ${next}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  // Count orders per status
  const counts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
        (o.table_number && String(o.table_number).includes(q))
      );
    }
    return true;
  });

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'New' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'completed', label: 'Completed' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="order-management">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Orders</h1>
          <p className="text-sm text-[#9CA3AF]">Every ticket from today's service.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Guest, table or ticket ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="on-input pl-10 w-full md:w-64"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === tab.key
                ? 'bg-[#E53935] text-white shadow-md'
                : 'bg-white text-[#6B7280] border border-[#E8E8E8] hover:bg-[#F8F9FA]'
            }`}
          >
            {tab.label}
            <span className={`text-xs font-bold ${
              filter === tab.key ? 'text-white/70' : 'text-[#D1D5DB]'
            }`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Order List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="on-card p-8 text-center">
            <p className="text-[#9CA3AF]">No orders found</p>
          </div>
        ) : (
          filtered.map(order => {
            const status = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
            const label = getTableLabel(order);
            const timeAgo = getTimeAgo(order.created_at);
            const items = order.items || [];
            const canAdvance = ['pending', 'preparing', 'ready'].includes(order.status);

            return (
              <div key={order.id} className="on-card p-4 flex items-center gap-4">
                {/* Table Badge */}
                <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">{label}</span>
                </div>

                {/* Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1A1A1A] truncate">
                      {order.customer_name || 'Guest'}
                    </span>
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono">
                    #{order.order_number || order.id?.slice(-8)}
                  </p>
                </div>

                {/* Item Thumbnails */}
                <div className="hidden md:flex items-center -space-x-2">
                  {items.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-[#F8F9FA]"
                    >
                      <img
                        src={getImageUrl(item.image_url) || FALLBACK}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = FALLBACK; }}
                      />
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-[#F8F9FA] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#9CA3AF]">+{items.length - 3}</span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <span className={`on-badge ${status.bg} ${status.text} border ${status.border}`}>
                  {status.label}
                </span>

                {/* Time */}
                <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{timeAgo}</span>

                {/* Action */}
                {canAdvance && (
                  <button
                    onClick={() => handleMoveStatus(order.id, order.status)}
                    className="p-2 hover:bg-[#F8F9FA] rounded-xl transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 text-[#D1D5DB]" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
