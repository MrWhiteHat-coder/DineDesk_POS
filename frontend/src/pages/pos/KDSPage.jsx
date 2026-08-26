import React, { useState, useEffect } from 'react';
import { kdsAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Clock, ChefHat, CheckCircle2, Utensils, RefreshCw, Play, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import PageHeader from '../../components/common/PageHeader';

const STATUS_CONFIG = {
  received: {
    headerBg: 'bg-navy',
    borderColor: 'border-navy/15',
    badge: { bg: 'bg-navy/10 text-navy', label: 'New Order' },
    action: { next: 'preparing', label: 'Start Preparing', bg: 'bg-navy hover:bg-navy-bright' },
    progressColor: 'bg-navy',
    column: 'incoming',
  },
  preparing: {
    headerBg: 'bg-terracotta',
    borderColor: 'border-terracotta/20',
    badge: { bg: 'bg-orange-50 text-terracotta', label: 'In Kitchen' },
    action: { next: 'ready', label: 'Mark Ready', bg: 'bg-terracotta hover:bg-[#a84d1f]' },
    progressColor: 'bg-terracotta',
    column: 'cooking',
  },
};

function Ticket({ order, delayed, onUpdate }) {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const headerBg = delayed ? 'bg-rose' : config.headerBg;
  const getMinutesSince = (createdAt) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  const getTimeSince = (createdAt) => {
    const diff = getMinutesSince(createdAt);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };
  const progress = Math.min(100, (getMinutesSince(order.created_at) / 30) * 100);
  const orderTypeLabel = order.order_type === 'dine_in' ? 'Dine In' : order.order_type === 'takeaway' ? 'Takeaway' : 'Online';

  return (
    <div className={`bg-plate rounded-2xl border ${delayed ? 'border-rose/30' : config.borderColor} overflow-hidden shadow-card hover:shadow-card-hover transition-all`} data-testid={`kds-order-${order.id}`}>
      <div className={`${headerBg} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate">
              {order.customer_name || 'Guest'}
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">{orderTypeLabel}</span>
          </div>
          {delayed && <AlertTriangle className="w-4 h-4 text-white animate-pulse flex-shrink-0" />}
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/80">
          <span className="font-numbers">#{order.order_number}</span>
          <span>Token {order.order_number?.slice(-3)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/80 mt-0.5">
          <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {order.table_number && <span className="flex items-center gap-1"><Utensils className="w-3 h-3" /> Table {order.table_number}</span>}
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-[10px] font-bold text-ink/35 uppercase tracking-wider mb-2">Order Items</p>
        <div className="space-y-1.5">
          {(order.items || []).map((item, idx) => (
            <div key={`${item.name}-${item.quantity}-${idx}`} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 bg-linen rounded text-[10px] font-bold text-ink flex items-center justify-center">{item.quantity}</span>
                <span className="text-[13px] text-ink truncate">{item.name}</span>
              </div>
              {item.notes && <span className="text-[10px] text-terracotta italic ml-2 truncate max-w-[40%]">{item.notes}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="w-full h-1.5 bg-linen rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${delayed ? 'bg-rose' : config.progressColor}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[10px] font-semibold ${delayed ? 'text-rose' : 'text-ink/40'}`}>
            <Clock className="w-3 h-3 inline mr-0.5" />{getTimeSince(order.created_at)}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${delayed ? 'bg-rose/10 text-rose' : config.badge.bg}`}>
            {delayed ? 'Delayed' : config.badge.label}
          </span>
        </div>
      </div>

      {config.action && (
        <div className="px-4 pb-3 flex gap-2">
          <Button onClick={() => onUpdate(order.id, config.action.next)} className={`flex-1 h-10 rounded-xl text-white text-xs font-bold ${config.action.bg}`} data-testid={`kds-action-${order.id}`}>
            <Play className="w-3.5 h-3.5 mr-1" /> {config.action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

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

  const isDelayed = (createdAt) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)) > 20;

  const filteredOrders = filter === 'all' ? orders
    : filter === 'new' ? orders.filter(o => o.status === 'received')
    : filter === 'kitchen' ? orders.filter(o => o.status === 'preparing')
    : filter === 'delayed' ? orders.filter(o => isDelayed(o.created_at))
    : orders;

  const incoming = filteredOrders.filter(o => o.status === 'received');
  const cooking = filteredOrders.filter(o => o.status === 'preparing');
  const other = filteredOrders.filter(o => o.status !== 'received' && o.status !== 'preparing');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div data-testid="kds-page">
      <PageHeader
        eyebrow="Kitchen"
        title="Kitchen Display"
        subtitle={`${orders.length} active tickets · auto-refreshes every 10s`}
        icon={ChefHat}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all', label: 'All Orders' },
              { key: 'new', label: 'New' },
              { key: 'kitchen', label: 'In Kitchen' },
              { key: 'delayed', label: 'Delayed' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f.key ? 'bg-ink text-white' : 'bg-plate text-ink/60 border border-line hover:bg-linen'}`} data-testid={`kds-filter-${f.key}`}>
                {f.label}
              </button>
            ))}
            <Button onClick={fetchOrders} variant="outline" className="h-8 rounded-lg gap-1.5 text-xs" data-testid="kds-refresh">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-ink/35 bg-plate rounded-3xl border border-dashed border-line">
          <CheckCircle2 className="w-16 h-16 mb-4 text-forest/40" />
          <p className="text-lg font-display font-medium text-ink">All caught up</p>
          <p className="text-sm">No pending tickets in the kitchen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-navy">Incoming</h2>
              <span className="text-[11px] font-numbers text-navy bg-navy/10 px-2 py-0.5 rounded-full">{incoming.length}</span>
            </div>
            <div className="space-y-3">
              {incoming.map((order) => (
                <Ticket key={order.id} order={order} delayed={isDelayed(order.created_at)} onUpdate={handleStatusUpdate} />
              ))}
              {incoming.length === 0 && <p className="text-xs text-ink/35 text-center py-8 bg-plate rounded-2xl border border-dashed border-line">Queue is clear</p>}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-terracotta">On the pass</h2>
              <span className="text-[11px] font-numbers text-terracotta bg-orange-50 px-2 py-0.5 rounded-full">{cooking.length}</span>
            </div>
            <div className="space-y-3">
              {cooking.map((order) => (
                <Ticket key={order.id} order={order} delayed={isDelayed(order.created_at)} onUpdate={handleStatusUpdate} />
              ))}
              {cooking.length === 0 && <p className="text-xs text-ink/35 text-center py-8 bg-plate rounded-2xl border border-dashed border-line">Nothing cooking</p>}
            </div>
          </section>

          <section className="hidden xl:block">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink/45">Also on board</h2>
              <span className="text-[11px] font-numbers text-ink/45 bg-linen px-2 py-0.5 rounded-full">{other.length}</span>
            </div>
            <div className="space-y-3">
              {other.map((order) => (
                <Ticket key={order.id} order={order} delayed={isDelayed(order.created_at)} onUpdate={handleStatusUpdate} />
              ))}
              {other.length === 0 && <p className="text-xs text-ink/35 text-center py-8 bg-plate rounded-2xl border border-dashed border-line">No other tickets</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
