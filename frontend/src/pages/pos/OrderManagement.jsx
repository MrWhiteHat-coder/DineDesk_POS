import React, { useState, useEffect } from 'react';
import { orderAPI, feedbackAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { ChefThumbsUp } from '../../components/illustrations/ChefBot';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Clock,
  CheckCircle,
  ChefHat,
  UtensilsCrossed,
  Truck,
  RefreshCw,
  Heart,
  Star,
} from 'lucide-react';
import servedTableImg from '../../assets/moments/served_table.png';
import { moment } from '../../components/pos/RestaurantMoments';

const statusConfig = {
  received: { label: 'New', color: 'bg-blue-500', icon: Clock },
  preparing: { label: 'Preparing', color: 'bg-amber-500', icon: ChefHat },
  ready: { label: 'Ready', color: 'bg-green-500', icon: UtensilsCrossed },
  completed: { label: 'Completed', color: 'bg-slate-400', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-rose-400', icon: RefreshCw },
};
// Guard: any unexpected status falls back to New instead of crashing the card tree
const safeStatus = (s) => statusConfig[s] || statusConfig.received;

const orderTypeConfig = {
  dine_in: { label: 'Dine In', color: 'bg-blue-100 text-blue-700' },
  takeaway: { label: 'Takeaway', color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' },
  online: { label: 'Online', color: 'bg-purple-100 text-purple-700' },
};
// Guard: unknown order types fall back to takeaway styling
const safeOrderType = (t) => orderTypeConfig[t] || orderTypeConfig.takeaway;

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only init with interval

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getToday();
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderAPI.updateStatus(orderId, newStatus);
      toast.success(`Order status updated to ${statusConfig[newStatus].label}`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update order');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return order.status !== 'completed';
    if (activeTab === 'completed') return order.status === 'completed';
    return order.status === activeTab;
  });

  const orderCounts = {
    all: orders.filter((o) => o.status !== 'completed').length,
    received: orders.filter((o) => o.status === 'received').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-24 rounded-lg" /></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="order-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Order Management</h1>
        <Button variant="outline" onClick={fetchOrders} data-testid="refresh-orders-btn">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            Active ({orderCounts.all})
          </TabsTrigger>
          <TabsTrigger value="received" className="data-[state=active]:bg-white">
            New ({orderCounts.received})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="data-[state=active]:bg-white">
            Preparing ({orderCounts.preparing})
          </TabsTrigger>
          <TabsTrigger value="ready" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            Ready ({orderCounts.ready})
          </TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            Completed ({orderCounts.completed})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredOrders.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={updateOrderStatus}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center animate-fade-in">
              {activeTab === 'completed' ? (
                <>
                  <img src={servedTableImg} alt="" aria-hidden="true" className="w-36 h-28 mx-auto mb-3 object-contain moment-bob" draggable="false" />
                  <p className="text-lg font-heading font-bold text-slate-600 dark:text-white/80 mb-1">Every guest served</p>
                  <p className="text-sm text-slate-400 dark:text-white/40">Completed bills land here — a full house, well fed</p>
                </>
              ) : (
                <>
                  <ChefThumbsUp className="w-28 h-28 mx-auto mb-3" />
                  <p className="text-lg font-heading font-bold text-slate-600 dark:text-white/80 mb-1">No orders here</p>
                  <p className="text-sm text-slate-400 dark:text-white/40">Orders will appear here when customers place them</p>
                </>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderCard({ order, onUpdateStatus }) {
  const status = safeStatus(order.status);
  const orderType = safeOrderType(order.order_type);
  const StatusIcon = status.icon;

  const getNextStatus = () => {
    switch (order.status) {
      case 'received':
        return 'preparing';
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'completed';
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();

  return (
    <Card className="overflow-hidden" data-testid={`order-card-${order.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-numbers text-lg font-bold">#{order.order_number}</span>
            <Badge className={orderType.color}>{orderType.label}</Badge>
          </div>
          <Badge className={`${status.color} text-white`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </Badge>
        </div>
        {order.table_number && (
          <p className="text-sm text-slate-500">Table {order.table_number}</p>
        )}
        {order.platform && (
          <Badge variant="outline" className="w-fit">
            {order.platform.toUpperCase()}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {/* Items */}
        <div className="space-y-2 mb-4">
          {(order.items || []).map((item, idx) => (
            <div key={`${item.name}-${item.quantity}-${idx}`} className="flex justify-between text-sm">
              <span className="text-slate-700">
                {item.quantity}x {item.name}
              </span>
              <span className="font-numbers text-slate-500">₹{(item.total ?? 0).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between font-semibold border-t border-slate-100 pt-2 mb-4">
          <span>Total</span>
          <span className="font-numbers text-slate-800">₹{(order.total_amount ?? 0).toFixed(2)}</span>
        </div>

        {/* Customer Info */}
        {(order.customer_name || order.customer_phone) && (
          <div className="text-sm text-slate-500 mb-4">
            {order.customer_name && <p>{order.customer_name}</p>}
            {order.customer_phone && <p>{order.customer_phone}</p>}
          </div>
        )}

        {/* Payment */}
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-slate-500">Payment</span>
          <Badge variant="outline" className="capitalize">
            {order.payment_method}
          </Badge>
        </div>

        {/* Time */}
        <p className="text-xs text-slate-400 mb-4">
          {new Date(order.created_at).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {/* Action Button */}
        {nextStatus && (
          <Button
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            className={`w-full ${
              nextStatus === 'preparing'
                ? 'bg-amber-500 hover:bg-amber-600'
                : nextStatus === 'ready'
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-slate-500 hover:bg-slate-600'
            }`}
            data-testid={`update-status-${order.id}`}
          >
            Mark as {statusConfig[nextStatus].label}
          </Button>
        )}

        {/* Guest feedback — completed orders only (real POST /feedback event) */}
        {order.status === 'completed' && (
          <FeedbackButton orderId={order.id} />
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackButton({ orderId }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!rating) { toast.error('Pick a rating first'); return; }
    setSaving(true);
    try {
      await feedbackAPI.create({ order_id: orderId, rating, comment: comment.trim() || undefined, category: 'dine_in' });
      toast.success('Thanks — feedback recorded!');
      moment('tip_feedback', 'Your guest appreciates the meal.');
      setOpen(false);
      setRating(0);
      setComment('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full mt-2 gap-2 min-h-[44px]"
        data-testid={`feedback-${orderId}`}
      >
        <Heart className="w-4 h-4 text-rose-500" />
        Guest feedback
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" /> How was the food?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setRating(n)}
                className="p-1 rounded-lg hover:scale-110 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Star className={`w-8 h-8 transition-colors ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-white/20'}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything the kitchen should know? (optional)"
            rows={2}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <Button onClick={submit} disabled={saving || !rating} className="w-full dd-btn-primary min-h-[48px]">
            {saving ? 'Saving…' : 'Send feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
