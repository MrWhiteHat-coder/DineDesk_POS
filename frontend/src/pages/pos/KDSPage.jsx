import React, { useState, useEffect } from 'react';
import { kdsAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Clock, ChefHat, CheckCircle2, Utensils, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';

const STATUS_FLOW = {
  received: { next: 'preparing', label: 'Start Preparing', color: 'bg-blue-500' },
  preparing: { next: 'ready', label: 'Mark Ready', color: 'bg-amber-500' },
};

const STATUS_COLORS = {
  received: 'border-blue-400 bg-blue-50',
  preparing: 'border-amber-400 bg-amber-50',
};

const STATUS_BADGES = {
  received: { bg: 'bg-blue-100 text-blue-700', icon: Clock, label: 'New' },
  preparing: { bg: 'bg-amber-100 text-amber-700', icon: ChefHat, label: 'Preparing' },
};

export default function KDSPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await kdsAPI.getOrders();
      setOrders(res.data);
    } catch (err) {
      console.error('KDS fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await kdsAPI.updateStatus(orderId, newStatus);
      toast.success(`Order updated to ${newStatus}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const getTimeSince = (createdAt) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="kds-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Kitchen Display</h1>
          <p className="text-sm text-slate-500 mt-0.5">{orders.length} active orders</p>
        </div>
        <Button onClick={fetchOrders} variant="outline" className="h-9 rounded-lg gap-2" data-testid="kds-refresh">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <CheckCircle2 className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-sm">No pending orders in the kitchen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => {
            const statusInfo = STATUS_BADGES[order.status] || STATUS_BADGES.received;
            const StatusIcon = statusInfo.icon;
            const flow = STATUS_FLOW[order.status];
            return (
              <div
                key={order.id}
                className={`rounded-xl border-2 p-4 transition-all hover:shadow-md ${STATUS_COLORS[order.status] || 'border-slate-200 bg-white'}`}
                data-testid={`kds-order-${order.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">#{order.order_number}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.bg}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{getTimeSince(order.created_at)}</span>
                </div>

                {order.order_type === 'dine_in' && order.table_number && (
                  <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <Utensils className="w-3 h-3" /> Table {order.table_number}
                  </div>
                )}

                <div className="space-y-1.5 mb-4">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between text-sm">
                      <div className="flex-1">
                        <span className="font-semibold text-slate-800">{item.quantity}x</span>{' '}
                        <span className="text-slate-700">{item.name}</span>
                        {item.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{item.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {flow && (
                  <Button
                    onClick={() => handleStatusUpdate(order.id, flow.next)}
                    className={`w-full h-9 rounded-lg text-white text-sm font-semibold ${flow.color} hover:opacity-90`}
                    data-testid={`kds-action-${order.id}`}
                  >
                    {flow.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
