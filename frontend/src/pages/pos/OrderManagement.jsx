import React, { useState, useEffect } from 'react';
import { orderAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Clock,
  CheckCircle,
  ChefHat,
  UtensilsCrossed,
  Truck,
  RefreshCw,
} from 'lucide-react';

const statusConfig = {
  received: { label: 'New', color: 'bg-blue-500', icon: Clock },
  preparing: { label: 'Preparing', color: 'bg-amber-500', icon: ChefHat },
  ready: { label: 'Ready', color: 'bg-green-500', icon: UtensilsCrossed },
  completed: { label: 'Completed', color: 'bg-slate-400', icon: CheckCircle },
};

const orderTypeConfig = {
  dine_in: { label: 'Dine In', color: 'bg-blue-100 text-blue-700' },
  takeaway: { label: 'Takeaway', color: 'bg-green-100 text-green-700' },
  online: { label: 'Online', color: 'bg-purple-100 text-purple-700' },
};

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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
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
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-white">
            Active ({orderCounts.all})
          </TabsTrigger>
          <TabsTrigger value="received" className="data-[state=active]:bg-white">
            New ({orderCounts.received})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="data-[state=active]:bg-white">
            Preparing ({orderCounts.preparing})
          </TabsTrigger>
          <TabsTrigger value="ready" className="data-[state=active]:bg-white">
            Ready ({orderCounts.ready})
          </TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-white">
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
            <Card className="p-12 text-center">
              <p className="text-slate-400">No orders in this category</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderCard({ order, onUpdateStatus }) {
  const status = statusConfig[order.status];
  const orderType = orderTypeConfig[order.order_type];
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
          {order.items.map((item, idx) => (
            <div key={`${item.name}-${item.quantity}-${idx}`} className="flex justify-between text-sm">
              <span className="text-slate-700">
                {item.quantity}x {item.name}
              </span>
              <span className="font-numbers text-slate-500">₹{item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between font-semibold border-t border-slate-100 pt-2 mb-4">
          <span>Total</span>
          <span className="font-numbers text-slate-800">₹{order.total_amount.toFixed(2)}</span>
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
      </CardContent>
    </Card>
  );
}
