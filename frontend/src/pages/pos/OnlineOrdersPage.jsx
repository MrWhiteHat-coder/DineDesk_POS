import React, { useState, useEffect } from 'react';
import { orderAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { RefreshCw, Globe, Check, X, Clock, Truck } from 'lucide-react';

export default function OnlineOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getAll({ order_type: 'online' });
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
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'swiggy') return order.platform === 'swiggy';
    if (activeTab === 'zomato') return order.platform === 'zomato';
    return true;
  });

  const platformCounts = {
    all: orders.length,
    swiggy: orders.filter((o) => o.platform === 'swiggy').length,
    zomato: orders.filter((o) => o.platform === 'zomato').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="online-orders-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Online Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Orders from Swiggy and Zomato (Mock Integration)
          </p>
        </div>
        <Button variant="outline" onClick={fetchOrders} data-testid="refresh-online-orders-btn">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Online</p>
              <p className="font-numbers text-xl font-bold">{platformCounts.all}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/swiggy-logo.png" alt="Swiggy" className="w-10 h-10 object-cover rounded-lg" />
            </div>
            <div>
              <p className="text-sm text-slate-800">Swiggy</p>
              <p className="font-numbers text-xl font-bold text-slate-700">
                {platformCounts.swiggy}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/zomato-logo.png" alt="Zomato" className="w-10 h-10 object-cover rounded-lg" />
            </div>
            <div>
              <p className="text-sm text-red-600">Zomato</p>
              <p className="font-numbers text-xl font-bold text-red-700">
                {platformCounts.zomato}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mock Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Mock Integration Active</h3>
          <p className="text-sm text-blue-700">
            This is a demo integration. In production, orders would automatically appear here via
            webhooks. Webhook endpoints are ready at:
          </p>
          <div className="mt-2 space-y-1 text-xs font-mono bg-blue-100 p-2 rounded">
            <p>POST /api/webhooks/swiggy</p>
            <p>POST /api/webhooks/zomato</p>
          </div>
        </CardContent>
      </Card>

      {/* Platform Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-white">
            All ({platformCounts.all})
          </TabsTrigger>
          <TabsTrigger value="swiggy" className="data-[state=active]:bg-white">
            Swiggy ({platformCounts.swiggy})
          </TabsTrigger>
          <TabsTrigger value="zomato" className="data-[state=active]:bg-white">
            Zomato ({platformCounts.zomato})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} data-testid={`online-order-${order.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden`}>
                          {order.platform === 'swiggy' ? (
                            <img src="/swiggy-logo.png" alt="Swiggy" className="w-10 h-10 object-cover rounded-lg" />
                          ) : (
                            <img src="/zomato-logo.png" alt="Zomato" className="w-10 h-10 object-cover rounded-lg" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-numbers font-bold">#{order.order_number}</span>
                            <Badge className="capitalize">{order.platform}</Badge>
                          </div>
                          <p className="text-sm text-slate-500">
                            {order.customer_name || 'Customer'} •{' '}
                            {new Date(order.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge
                          className={
                            order.status === 'completed'
                              ? 'bg-green-500'
                              : order.status === 'preparing'
                              ? 'bg-amber-500'
                              : order.status === 'ready'
                              ? 'bg-blue-500'
                              : 'bg-slate-500'
                          }
                        >
                          {order.status}
                        </Badge>
                        <p className="font-numbers font-bold text-lg mt-1">
                          ₹{order.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span>
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-numbers">₹{item.total?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    {order.status !== 'completed' && (
                      <div className="mt-4 flex gap-2">
                        {order.status === 'received' && (
                          <Button
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            className="bg-amber-500 hover:bg-amber-600"
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            Accept & Prepare
                          </Button>
                        )}
                        {order.status === 'preparing' && (
                          <Button
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, 'ready')}
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Mark Ready
                          </Button>
                        )}
                        {order.status === 'ready' && (
                          <Button
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            <Truck className="w-4 h-4 mr-1" />
                            Mark Picked Up
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">No online orders yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Orders from Swiggy/Zomato will appear here
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
