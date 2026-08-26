import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, daySessionAPI, receiptAPI, inventoryAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  ClipboardList,
  ShoppingCart,
  Clock,
  AlertCircle,
  Printer,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  Banknote,
  CreditCard,
  Smartphone,
  Package,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#1B4F72', '#D4A017', '#C45C26', '#1A7A54'];

const STATUS_STYLES = {
  ready: { bg: 'bg-emerald-100', text: 'text-forest', label: 'Ready' },
  completed: { bg: 'bg-linen', text: 'text-ink/70', label: 'Completed' },
  preparing: { bg: 'bg-orange-50', text: 'text-terracotta', label: 'In Progress' },
  pending: { bg: 'bg-navy/10', text: 'text-navy', label: 'Pending' },
  cancelled: { bg: 'bg-rose/10', text: 'text-rose', label: 'Cancelled' },
};

const TABLE_COLORS = ['bg-navy', 'bg-ink', 'bg-terracotta', 'bg-navy-bright', 'bg-saffron', 'bg-forest'];

function getTableColor(tableNum) {
  if (!tableNum) return 'bg-slate-500';
  const hash = String(tableNum).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return TABLE_COLORS[hash % TABLE_COLORS.length];
}

function getTableLabel(order) {
  if (order.table_number) return `T${order.table_number}`;
  return order.order_type === 'takeaway' ? 'TA' : order.order_type === 'online' ? 'OL' : 'DI';
}

function getStatusInfo(order) {
  if (order.status === 'completed' && order.payment_status !== 'paid') {
    return { ...STATUS_STYLES.completed, sublabel: 'Waiting For Payment' };
  }
  const s = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
  const sublabels = {
    ready: 'Ready to serve',
    preparing: 'In the Kitchen',
    completed: 'Done',
    pending: 'New order',
  };
  return { ...s, sublabel: sublabels[order.status] || '' };
}

export default function POSDashboard() {
  const { restaurant } = useAuth();
  const { isDayOpen, currentSession } = useOutletContext();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [todayOrders, setTodayOrders] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOrdersDetail, setShowOrdersDetail] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => { fetchData(); }, [isDayOpen]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ordersRes, historyRes, inventoryRes] = await Promise.all([
        analyticsAPI.get().catch(() => ({ data: null })),
        orderAPI.getToday().catch(() => ({ data: [] })),
        daySessionAPI.getHistory().catch(() => ({ data: [] })),
        inventoryAPI.getAll(true).catch(() => ({ data: [] })),
      ]);
      setAnalytics(analyticsRes.data);
      setTodayOrders(ordersRes.data);
      setSessionHistory(historyRes.data);
      setLowStockItems(inventoryRes.data || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Computed stats
  const newOrders = todayOrders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const totalOrders = todayOrders.length;
  const waitingList = todayOrders.filter(o => o.status === 'ready' || o.status === 'preparing').length;

  // Filtered order list
  const filteredOrders = useMemo(() => {
    let list = [...todayOrders];
    if (orderFilter === 'process') list = list.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
    if (orderFilter === 'completed') list = list.filter(o => o.status === 'completed');
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter(o =>
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.table_number && String(o.table_number).includes(q)) ||
        (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
        (o.id && o.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [todayOrders, orderFilter, orderSearch]);

  // Payment list (unpaid orders)
  const paymentOrders = useMemo(() => {
    let list = todayOrders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled');
    if (paymentSearch.trim()) {
      const q = paymentSearch.toLowerCase();
      list = list.filter(o =>
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.order_number && String(o.order_number).toLowerCase().includes(q))
      );
    }
    return list;
  }, [todayOrders, paymentSearch]);

  const handleViewReceipt = async (order) => {
    setSelectedOrder(order);
    try {
      const rcpt = await receiptAPI.get(order.id);
      setReceiptData(rcpt.data);
      setShowReceipt(true);
    } catch {
      toast.error('Failed to load receipt');
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    const style = win.document.createElement('style');
    style.textContent = 'body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}';
    win.document.head.appendChild(style);
    win.document.title = 'Receipt';
    win.document.body.innerHTML = receiptRef.current.innerHTML;
    win.print();
  };

  const salesChartData = sessionHistory.slice(0, 7).reverse().map(s => ({ date: s.date, sales: s.total_sales, orders: s.total_orders }));
  const orderTypeData = analytics?.order_type_breakdown
    ? Object.entries(analytics.order_type_breakdown).map(([name, value]) => ({ name: name.replace('_', ' ').toUpperCase(), value }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="pos-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-navy/70 font-semibold mb-1">Live operations</p>
          <h1 className="font-display text-[26px] font-semibold text-ink tracking-tight">
            {restaurant?.name || 'Service floor'}
          </h1>
          <p className="text-sm text-ink/45 mt-0.5">
            {isDayOpen ? 'Service is open — tickets land here as they come.' : 'Open the day to start taking orders.'}
          </p>
        </div>
      </div>

      {!isDayOpen && (
        <div className="bg-saffron/15 border border-saffron/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-saffron-deep" />
          <div>
            <p className="font-medium text-ink">Day not open</p>
            <p className="text-sm text-ink/60">Open the day from the header to start taking orders</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-navy border-navy text-white shadow-blue" data-testid="new-orders-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/70">New Orders</p>
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="font-numbers text-3xl font-bold">{newOrders}</p>
            <p className="text-[10px] text-white/50 mt-1">Updated every new order</p>
          </CardContent>
        </Card>

        <Card className="bg-plate border-line cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setShowOrdersDetail(true)} data-testid="todays-orders-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-ink/50">Total Orders</p>
              <div className="w-10 h-10 bg-linen rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-navy" />
              </div>
            </div>
            <p className="font-numbers text-3xl font-bold text-ink">{totalOrders}</p>
            <p className="text-[10px] text-ink/40 mt-1 flex items-center gap-1">Click to view details <ChevronRight className="w-3 h-3" /></p>
          </CardContent>
        </Card>

        <Card className="bg-plate border-line" data-testid="waiting-list-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-ink/50">Waiting List</p>
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-terracotta" />
              </div>
            </div>
            <p className="font-numbers text-3xl font-bold text-ink">{waitingList}</p>
            <p className="text-[10px] text-forest mt-1">Active kitchen orders</p>
          </CardContent>
        </Card>

        <button
          onClick={() => navigate('/pos/orders')}
          className="bg-ink hover:bg-ink-soft rounded-2xl border-0 shadow-ink text-white font-bold flex items-center justify-center gap-2.5 text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          data-testid="create-new-order-btn"
        >
          <Plus className="w-5 h-5" />
          <span>CREATE NEW ORDER</span>
        </button>
      </div>

      {/* === ROW 2: Operations Panels === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Order List Panel */}
        <Card className="lg:col-span-4 border-slate-200/60 bg-white" data-testid="order-list-panel">
          <CardContent className="p-4">
            <h3 className="font-heading font-bold text-slate-900 text-base mb-3">Order List</h3>

            {/* Search */}
            <div className="relative mb-3">
              <Input
                placeholder="Search a Order"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                className="pl-3 pr-9 h-9 rounded-xl bg-slate-50 border-slate-200 text-sm"
                data-testid="order-search-input"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 mb-3">
              {[
                { key: 'all', label: 'All' },
                { key: 'process', label: 'On Process' },
                { key: 'completed', label: 'Completed' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setOrderFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    orderFilter === tab.key ? 'bg-ink text-white' : 'bg-linen text-ink/60 hover:bg-[#ebe4d8]'
                  }`}
                  data-testid={`order-filter-${tab.key}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Order Rows */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No orders found</p>
              ) : (
                filteredOrders.map(order => {
                  const status = getStatusInfo(order);
                  const label = getTableLabel(order);
                  const color = getTableColor(order.table_number || order.order_type);
                  return (
                    <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewReceipt(order)} data-testid={`order-row-${order.id}`}>
                      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-bold text-xs">{label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 truncate">{order.customer_name || `Order #${order.order_number}`}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{(order.items || []).length} Items</span>
                          <span>·</span>
                          <span>{status.sublabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Panel */}
        <Card className="lg:col-span-4 border-slate-200/60 bg-white" data-testid="payment-panel">
          <CardContent className="p-4">
            <h3 className="font-heading font-bold text-slate-900 text-base mb-3">Payment</h3>

            <div className="relative mb-3">
              <Input
                placeholder="Search a Order"
                value={paymentSearch}
                onChange={e => setPaymentSearch(e.target.value)}
                className="pl-3 pr-9 h-9 rounded-xl bg-slate-50 border-slate-200 text-sm"
                data-testid="payment-search-input"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {paymentOrders.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No pending payments</p>
              ) : (
                paymentOrders.map(order => {
                  const label = getTableLabel(order);
                  const color = getTableColor(order.table_number || order.order_type);
                  return (
                    <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors" data-testid={`payment-row-${order.id}`}>
                      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-bold text-xs">{label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">{order.customer_name || 'Guest'}</p>
                        <p className="text-[11px] text-slate-400">Order #{order.order_number}</p>
                      </div>
                      <button
                        onClick={() => handleViewReceipt(order)}
                        className="flex items-center gap-1 bg-ink hover:bg-ink-soft text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                        data-testid={`pay-now-${order.id}`}
                      >
                        Pay Now <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Popular Dishes + Out of Stock */}
        <div className="lg:col-span-4 space-y-4">
          {/* Popular Dishes */}
          <Card className="border-slate-200/60 bg-white" data-testid="popular-dishes-panel">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-slate-900 text-base">Popular Dishes</h3>
                <button onClick={() => navigate('/pos/analytics')} className="text-[11px] text-navy font-semibold hover:underline">View All</button>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-4 mb-2 border-b border-slate-100 pb-1.5">
                <span className="w-6">Rank</span>
                <span>Name</span>
              </div>
              {analytics?.top_items && analytics.top_items.length > 0 ? (
                <div className="space-y-2">
                  {analytics.top_items.slice(0, 4).map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-6">0{idx + 1}</span>
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-600 font-medium">Orders: {item.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-4">No sales data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Out of Stock */}
          <Card className="border-slate-200/60 bg-white" data-testid="out-of-stock-panel">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-slate-900 text-base">Out of Stock</h3>
                <button onClick={() => navigate('/pos/inventory')} className="text-[11px] text-navy font-semibold hover:underline">View All</button>
              </div>
              {lowStockItems.length > 0 ? (
                <div className="space-y-2.5">
                  {lowStockItems.slice(0, 4).map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-amber-600 font-medium">
                          Stock: {item.current_stock} {item.unit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-600 text-sm text-center py-4">All items in stock</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* === ROW 3: Charts (Secondary) === */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-slate-200/60">
          <CardContent className="p-5">
            <h3 className="font-heading font-bold text-slate-900 text-base mb-3">Sales Trend (Last 7 Days)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4F72" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#1B4F72" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="sales" stroke="#1B4F72" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60">
          <CardContent className="p-5">
            <h3 className="font-heading font-bold text-slate-900 text-base mb-3">Order Types</h3>
            <div className="h-52 flex items-center justify-center">
              {orderTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {orderTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm">No order data yet</p>
              )}
            </div>
            {orderTypeData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {orderTypeData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-xs text-slate-600">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === MODALS === */}

      {/* Today's Orders Detail Modal */}
      <Dialog open={showOrdersDetail} onOpenChange={setShowOrdersDetail}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="orders-detail-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Today's Orders ({todayOrders.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {todayOrders.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No orders today yet.</p>
            ) : (
              todayOrders.map((order) => {
                const pmIcon = order.payment_method === 'cash' ? Banknote : order.payment_method === 'card' ? CreditCard : order.payment_method === 'upi' ? Smartphone : Clock;
                const PmIcon = pmIcon;
                return (
                  <div key={order.id} className="bg-slate-50 rounded-xl border border-slate-200/60 p-4" data-testid={`order-detail-${order.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">#{order.order_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            order.order_type === 'dine_in' ? 'bg-blue-100 text-blue-700'
                            : order.order_type === 'takeaway' ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700'
                          }`}>{order.order_type.replace('_', ' ')}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700'
                            : order.status === 'preparing' ? 'bg-amber-100 text-amber-700'
                            : order.payment_status === 'paid' ? 'bg-green-100 text-green-700'
                            : 'bg-slate-200 text-slate-600'
                          }`}>{order.payment_status === 'paid' ? 'Paid' : order.status}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <PmIcon className="w-3 h-3" />
                          <span className="capitalize">{order.payment_method || 'pending'}</span>
                          {order.table_number && <span>· Table {order.table_number}</span>}
                          <span>· {new Date(order.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-slate-900">₹{order.total_amount.toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
                      {(order.items || []).map((item, idx) => (
                        <div key={`${item.name}-${item.quantity}-${idx}`} className="bg-white rounded-lg px-2.5 py-1.5 text-xs border border-slate-100">
                          <span className="font-semibold text-slate-800">{item.quantity}x</span>{' '}
                          <span className="text-slate-600">{item.name}</span>
                          <span className="text-slate-400 ml-1">₹{item.total?.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleViewReceipt(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-ink-soft transition-colors"
                      data-testid={`view-receipt-${order.id}`}
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Bill
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Print Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs" data-testid="dashboard-receipt-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" /> Bill / Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div ref={receiptRef}>
              <div className="text-center border-b border-dashed border-slate-300 pb-2 mb-2">
                <h2 className="font-bold text-base">{receiptData.restaurant.name}</h2>
                <p className="text-[10px] text-slate-500">{receiptData.restaurant.address}, {receiptData.restaurant.city}</p>
                <p className="text-[10px] text-slate-500">{receiptData.restaurant.phone}</p>
              </div>
              <div className="text-[11px] mb-2">
                <div className="flex justify-between"><span>Order #</span><span className="font-mono">{receiptData.order.order_number}</span></div>
                <div className="flex justify-between"><span>Type</span><span className="capitalize">{receiptData.order.order_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span>Payment</span><span className="capitalize">{receiptData.order.payment_method}</span></div>
                <div className="flex justify-between"><span>Date</span><span>{new Date(receiptData.order.created_at).toLocaleString()}</span></div>
                {receiptData.order.table_number && (
                  <div className="flex justify-between"><span>Table</span><span>{receiptData.order.table_number}</span></div>
                )}
              </div>
              <hr className="border-dashed border-slate-300 my-1" />
              <div className="space-y-1 text-[11px]">
                {(receiptData.order.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{item.total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <hr className="border-dashed border-slate-300 my-1" />
              <div className="text-[11px] space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{receiptData.order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{receiptData.order.tax_amount?.toFixed(2)}</span></div>
                {receiptData.order.discount_amount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-₹{receiptData.order.discount_amount?.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-slate-300">
                  <span>Total</span><span>₹{receiptData.order.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-slate-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button
            onClick={handlePrintReceipt}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors mt-2"
            data-testid="dashboard-print-receipt-btn"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
