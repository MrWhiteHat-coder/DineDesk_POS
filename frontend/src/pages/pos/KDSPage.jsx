import React, { useState, useEffect } from 'react';
import { kdsAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Clock, ChefHat, CheckCircle2, Utensils, RefreshCw, Play, Pause, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';

const STATUS_CONFIG = {
  received: {
    headerBg: 'bg-emerald-600',
    borderColor: 'border-emerald-200',
    badge: { bg: 'bg-emerald-100 text-emerald-700', label: 'New Order' },
    action: { next: 'preparing', label: 'Start Preparing', bg: 'bg-emerald-600 hover:bg-emerald-700' },
    progressColor: 'bg-emerald-500',
  },
  preparing: {
    headerBg: 'bg-amber-500',
    borderColor: 'border-amber-200',
    badge: { bg: 'bg-amber-100 text-amber-700', label: 'In Kitchen' },
    action: { next: 'ready', label: 'Mark Ready', bg: 'bg-amber-500 hover:bg-amber-600' },
    progressColor: 'bg-amber-500',
  },
};

export default function KDSPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchOrders = async () => {
    try { const res = await kdsAPI.getOrders(); setOrders(res.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try { await kdsAPI.updateStatus(orderId, newStatus); toast.success(`Order updated to ${newStatus}`); fetchOrders(); } catch { toast.error('Failed to update'); }
  };

  const getMinutesSince = (createdAt) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  const getTimeSince = (createdAt) => {
    const diff = getMinutesSince(createdAt);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };
  const getProgressPct = (createdAt) => Math.min(100, (getMinutesSince(createdAt) / 30) * 100);
  const isDelayed = (createdAt) => getMinutesSince(createdAt) > 20;

  const filteredOrders = filter === 'all' ? orders
    : filter === 'new' ? orders.filter(o => o.status === 'received')
    : filter === 'kitchen' ? orders.filter(o => o.status === 'preparing')
    : filter === 'delayed' ? orders.filter(o => isDelayed(o.created_at))
    : orders;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div data-testid="kds-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Kitchen Display</h1>
          <p className="text-sm text-slate-500 mt-0.5">{orders.length} active orders</p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: 'All Orders' },
            { key: 'new', label: 'New' },
            { key: 'kitchen', label: 'In Kitchen' },
            { key: 'delayed', label: 'Delayed' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f.key ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`} data-testid={`kds-filter-${f.key}`}>
              {f.label}
            </button>
          ))}
          <Button onClick={fetchOrders} variant="outline" className="h-8 rounded-lg gap-1.5 text-xs" data-testid="kds-refresh">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <CheckCircle2 className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-sm">No pending orders in the kitchen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
            const delayed = isDelayed(order.created_at);
            const headerBg = delayed ? 'bg-rose-500' : config.headerBg;
            const progress = getProgressPct(order.created_at);
            const orderTypeLabel = order.order_type === 'dine_in' ? 'Dine In' : order.order_type === 'takeaway' ? 'Takeaway' : 'Online';

            return (
              <div key={order.id} className={`bg-white rounded-xl border ${delayed ? 'border-rose-200' : config.borderColor} overflow-hidden shadow-sm hover:shadow-md transition-all`} data-testid={`kds-order-${order.id}`}>
                {/* Colored Header */}
                <div className={`${headerBg} px-4 py-3 text-white`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {order.customer_name || 'Guest'}
                      </span>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">{orderTypeLabel}</span>
                    </div>
                    {delayed && <AlertTriangle className="w-4 h-4 text-white animate-pulse" />}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/80">
                    <span>Order #{order.order_number}</span>
                    <span>Token: {order.order_number?.slice(-3)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/80 mt-0.5">
                    <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {order.table_number && <span className="flex items-center gap-1"><Utensils className="w-3 h-3" /> Table {order.table_number}</span>}
                  </div>
                </div>

                {/* Items List */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Order Items</p>
                  <div className="space-y-1.5">
                    {(order.items || []).map((item, idx) => (
                      <div key={`${item.name}-${item.quantity}-${idx}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-slate-100 rounded text-[10px] font-bold text-slate-600 flex items-center justify-center">{item.quantity}</span>
                          <span className="text-[13px] text-slate-800">{item.name}</span>
                        </div>
                        {item.notes && <span className="text-[10px] text-amber-600 italic">{item.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="px-4 pb-2">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${delayed ? 'bg-rose-500' : config.progressColor}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[10px] font-semibold ${delayed ? 'text-rose-600' : 'text-slate-400'}`}>
                      <Clock className="w-3 h-3 inline mr-0.5" />{getTimeSince(order.created_at)}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${delayed ? 'bg-rose-100 text-rose-700' : config.badge.bg}`}>
                      {delayed ? 'Delayed' : config.badge.label}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                {config.action && (
                  <div className="px-4 pb-3 flex gap-2">
                    <Button onClick={() => handleStatusUpdate(order.id, config.action.next)} className={`flex-1 h-9 rounded-lg text-white text-xs font-bold ${config.action.bg}`} data-testid={`kds-action-${order.id}`}>
                      <Play className="w-3.5 h-3.5 mr-1" /> {config.action.label}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
