import React, { useState, useEffect } from 'react';
import { kdsAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Clock, ArrowRight } from 'lucide-react';

const COLUMNS = [
  { key: 'pending', label: 'INCOMING', color: '#3B82F6', dot: '#3B82F6' },
  { key: 'preparing', label: 'ON THE PASS', color: '#F59E0B', dot: '#F59E0B' },
  { key: 'ready', label: 'READY TO SERVE', color: '#22C55E', dot: '#22C55E' },
];

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '1m';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h`;
}

function getTableLabel(order) {
  if (order.table_number) return `T${order.table_number}`;
  return order.order_type === 'takeaway' ? 'TA' : order.order_type === 'online' ? 'OL' : 'DI';
}

export default function KDSPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await kdsAPI.getOrders();
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMoveOrder = async (orderId, newStatus) => {
    try {
      await kdsAPI.updateStatus(orderId, newStatus);
      toast.success(`Order moved to ${newStatus}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const getColumnOrders = (status) => {
    if (status === 'pending') {
      return orders.filter(o => o.status === 'pending' || o.status === 'received');
    }
    return orders.filter(o => o.status === status);
  };

  const getNextStatus = (current) => {
    if (current === 'pending' || current === 'received') return 'preparing';
    if (current === 'preparing') return 'ready';
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kds-page">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Kitchen display</h1>
        <p className="text-sm text-[#9CA3AF]">Tickets age from left to right. Anything past 15 minutes is flagged.</p>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const colOrders = getColumnOrders(col.key);
          const nextStatus = getNextStatus(col.key);

          return (
            <div key={col.key} className="space-y-3">
              {/* Column Header */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.dot }} />
                <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">{col.label}</h2>
                <span className="ml-auto text-sm font-bold text-[#D1D5DB]">{colOrders.length}</span>
              </div>

              {/* Order Cards */}
              <div className="space-y-3">
                {colOrders.length === 0 ? (
                  <div className="on-card p-6 text-center">
                    <p className="text-sm text-[#D1D5DB]">No orders</p>
                  </div>
                ) : (
                  colOrders.map(order => {
                    const label = getTableLabel(order);
                    const timeAgo = getTimeAgo(order.created_at);
                    const isOngoing = col.key === 'preparing' && parseInt(timeAgo) > 15;

                    return (
                      <div
                        key={order.id}
                        className={`on-card p-4 ${
                          isOngoing ? 'border-[#FDE68A] bg-[#FFFBEB]' : ''
                        }`}
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#1A1A1A]">
                              {order.customer_name || 'Guest'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            <span className={`text-xs font-medium ${isOngoing ? 'text-[#EF4444]' : 'text-[#9CA3AF]'}`}>
                              {timeAgo}
                            </span>
                          </div>
                        </div>

                        {/* Table Badge */}
                        <div className="mb-3">
                          <span className="inline-flex items-center px-2.5 py-1 bg-[#F8F9FA] rounded-lg text-xs font-semibold text-[#6B7280]">
                            {label}
                          </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-1.5 mb-3">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="text-sm text-[#1A1A1A]">
                              {item.quantity || 1}× {item.name}
                            </div>
                          ))}
                        </div>

                        {/* Action Button */}
                        {nextStatus && (
                          <button
                            onClick={() => handleMoveOrder(order.id, nextStatus)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#1A1A1A] text-white hover:bg-[#374151]"
                          >
                            {nextStatus === 'preparing' ? 'Start Preparing' : 'Mark Ready'}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
