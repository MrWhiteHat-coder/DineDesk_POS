import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, daySessionAPI, receiptAPI, inventoryAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { ChefSleeping, ChefCelebrating } from '../../components/illustrations/ChefBot';
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
  Package, CheckCircle,
  BarChart3,
  UtensilsCrossed,
  Bell,
  Gauge,
  MoreVertical,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#000000', '#374151', '#6B7280', '#9CA3AF'];

const STATUS_STYLES = {
  ready: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready' },
  completed: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Completed' },
  preparing: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'In Progress' },
  pending: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pending' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
};

// Status -> kitchen progress bar fill (%)
const STATUS_PROGRESS = {
  pending: 20,
  preparing: 60,
  ready: 85,
  completed: 100,
  cancelled: 0,
};

const TABLE_COLORS = ['bg-black', 'bg-gray-700', 'bg-gray-600', 'bg-gray-800', 'bg-gray-500', 'bg-gray-900'];

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

function getOrderTime(order) {
  try {
    return new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
  const [rightTab, setRightTab] = useState('payment');
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

  // Inventory split: quantity === 0 -> out of stock; rest -> low stock
  const outOfStockItems = lowStockItems.filter(i => (i.quantity ?? 0) <= 0);
  const lowStockOnly = lowStockItems.filter(i => (i.quantity ?? 0) > 0);

  // Filtered order list
  const filteredOrders = useMemo(() => {
    let list = [...todayOrders];
    if (orderFilter === 'process') list = list.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
    if (orderFilter === 'completed') list = list.filter(o => o.status === 'completed');
    if (orderFilter === 'takeaway') list = list.filter(o => o.order_type === 'takeaway');
    if (orderFilter === 'dinein') list = list.filter(o => o.order_type === 'dine_in');
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
      <div className="space-y-5 animate-fade-in" data-testid="pos-dashboard-skeleton">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7"><Skeleton className="h-80 rounded-xl" /></div>
          <div className="lg:col-span-5 space-y-5"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in" data-testid="pos-dashboard">
      {/* Day Status Alert */}
      {!isDayOpen && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4 animate-fade-in">
          <ChefSleeping className="w-20 h-20 flex-shrink-0" />
          <div>
            <p className="font-heading font-bold text-amber-900 text-lg">Day Not Open</p>
            <p className="text-sm text-amber-700 mt-0.5">Open the day to start taking orders. Chef is sleeping! 😴</p>
          </div>
        </div>
      )}

      {/* === ROW 1: Stats Cards === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* New Orders */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 hover-lift" data-testid="new-orders-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">New Orders</p>
            <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center relative">
              <Bell className="w-5 h-5 text-emerald-600" />
              {newOrders > 0 && (<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce-in">{newOrders}</span>)}
            </div>
          </div>
          <p className="font-numbers text-3xl font-bold text-slate-900">{newOrders}</p>
          <p className="text-[11px] text-slate-400 mt-1">Updated 5s ago</p>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 hover-lift cursor-pointer" onClick={() => setShowOrdersDetail(true)} data-testid="todays-orders-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Total Orders</p>
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="font-numbers text-3xl font-bold text-slate-900">{totalOrders}</p>
          <p className="text-[11px] text-blue-500 mt-1 font-medium flex items-center gap-1">View Details <ChevronRight className="w-3 h-3" /></p>
        </div>

        {/* Active Orders */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 hover-lift" data-testid="active-orders-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Active Orders</p>
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
              <Gauge className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="font-numbers text-3xl font-bold text-slate-900">{waitingList}</p>
          <p className="text-[11px] text-slate-400 mt-1">To Kitchen</p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 flex flex-col justify-center gap-2.5" data-testid="quick-actions-card">
          <p className="text-sm font-medium text-slate-500 mb-1">Quick Actions</p>
          <button onClick={() => navigate('/pos/orders')} className="w-full py-2.5 rounded-xl border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]">
            <Plus className="w-3.5 h-3.5" /> CREATE NEW ORDER
          </button>
          <button onClick={() => navigate('/pos/tables')} className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]">
            <Plus className="w-3.5 h-3.5" /> RESERVATION
          </button>
        </div>
      </div>

      {/* === ROW 2: Order List + Right Rail === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Order List Panel */}
        <Card className="lg:col-span-7 border-slate-200/60 bg-white rounded-2xl" data-testid="order-list-panel">
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

            {/* Filter Pills */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              {[
                { key: 'all', label: 'All', icon: ClipboardList },
                { key: 'process', label: 'On Process', icon: Clock },
                { key: 'completed', label: 'Completed', icon: CheckCircle },
                { key: 'takeaway', label: 'Takeaway', icon: Package },
                { key: 'dinein', label: 'Dine-In', icon: UtensilsCrossed },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setOrderFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                    orderFilter === tab.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                  data-testid={`order-filter-${tab.key}`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Order Card Grid (2-col like reference) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6 col-span-full">No orders found</p>
              ) : (
                filteredOrders.map(order => {
                  const status = getStatusInfo(order);
                  const label = getTableLabel(order);
                  const color = getTableColor(order.table_number || order.order_type);
                  const progress = STATUS_PROGRESS[order.status] ?? 20;
                  return (
                    <div
                      key={order.id}
                      className="relative border border-slate-200/70 rounded-2xl p-3 hover:border-slate-400 hover:shadow-card transition-all cursor-pointer bg-white"
                      onClick={() => handleViewReceipt(order)}
                      data-testid={`order-row-${order.id}`}
                    >
                      {/* Kebab */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewReceipt(order); }}
                        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        aria-label="Order actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-2 pr-6">
                        <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold text-[11px]">{label}</span>
                        </div>
                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {order.customer_name || `Order ${order.order_number}`}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${order.status === 'cancelled' ? 'bg-red-400' : order.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-900'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-5 h-5 ${color} rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
                            {(order.customer_name || 'G').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate">
                            Customer {order.customer_name ? order.customer_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] text-slate-400">Order Time: {getOrderTime(order)}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Stacked Panels */}
        <div className="lg:col-span-5 space-y-5">

          {/* Payments & Popular Items */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5" data-testid="payments-popular-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-slate-900 text-base">Payments &amp; Popular Items</h3>
            </div>
            {/* Tab row like reference: Payment | Popular Dishes | View All */}
            <div className="flex items-center gap-4 border-b border-slate-100 mb-4">
              <button
                onClick={() => setRightTab('payment')}
                className={`pb-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${rightTab === 'payment' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
              >
                Payment
              </button>
              <button
                onClick={() => setRightTab('popular')}
                className={`pb-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${rightTab === 'popular' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
              >
                Popular Dishes
              </button>
              <button onClick={() => navigate('/pos/analytics')} className="ml-auto pb-2 text-[11px] text-slate-500 font-semibold hover:text-black transition-colors">View All</button>
            </div>
            {rightTab === 'payment' ? (
              paymentOrders.length === 0 ? (
                <div className="text-center py-6"><div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><Banknote className="w-8 h-8 text-emerald-500" /></div><p className="text-sm text-slate-500 font-medium">No pending payments</p></div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {paymentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center"><span className="text-xs font-bold text-slate-600">{getTableLabel(order)}</span></div>
                        <div><p className="text-sm font-semibold text-slate-900">{order.customer_name || 'Guest'}</p><p className="text-[10px] text-slate-400">#{order.order_number}</p></div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleViewReceipt(order); }} className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-[0.97]">Pay <ArrowRight className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              analytics?.top_items && analytics.top_items.length > 0 ? (
                <div className="space-y-2.5">
                  {analytics.top_items.slice(0, 4).map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                      <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0"><UtensilsCrossed className="w-4 h-4 text-orange-500" /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p><p className="text-[10px] text-slate-400">{item.count} orders</p></div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm text-center py-4">No sales data yet</p>
            )}
          </div>

          {/* Inventory */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5" data-testid="inventory-panel">
            <h3 className="font-heading font-bold text-slate-900 text-base mb-3">Inventory</h3>
            {/* Out of Stock row */}
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${outOfStockItems.length > 0 ? 'text-red-500' : 'text-slate-300'}`} />
                <span className="text-sm font-medium text-slate-700">Out of Stock</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${outOfStockItems.length > 0 ? 'text-red-600 bg-red-100' : 'text-slate-400 bg-slate-100'}`}>{outOfStockItems.length}</span>
            </div>
            {outOfStockItems.length > 0 && (
              <div className="py-1.5">
                {outOfStockItems.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between px-1 py-1">
                    <span className="text-sm text-slate-700">{item.name}</span>
                    <span className="text-[10px] text-red-500 font-medium">0 {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
            {/* All items in stock illustration */}
            {lowStockItems.length === 0 ? (
              <div className="text-center py-4"><div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-2"><Package className="w-7 h-7 text-emerald-500" /></div><p className="text-sm text-emerald-600 font-medium">All items in stock!</p></div>
            ) : (
              <div className="text-center py-3"><div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-2"><CheckCircle className="w-6 h-6 text-emerald-500" /></div><p className="text-sm text-emerald-600 font-medium">{lowStockItems.length} items need attention</p></div>
            )}
            {/* Low Stock row */}
            <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${lowStockOnly.length > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                <span className="text-sm font-medium text-slate-700">Low Stock</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lowStockOnly.length > 0 ? 'text-amber-600 bg-amber-100' : 'text-slate-400 bg-slate-100'}`}>{lowStockOnly.length}</span>
            </div>
            {lowStockOnly.length > 0 && (
              <div className="pt-1.5">
                {lowStockOnly.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between px-1 py-1">
                    <span className="text-sm text-slate-700">{item.name}</span>
                    <span className="text-[10px] text-amber-600 font-medium">Stock: {item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === ROW 3: Charts side by side === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Trend */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/60 p-5" data-testid="sales-trend-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-slate-900 text-base">Sales Trend (Last 7 Days)</h3>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <div className="text-right">
                <p className="text-[9px] text-slate-400 font-medium leading-none">Total Sales</p>
                <p className="font-numbers text-sm font-bold text-slate-900 leading-tight">₹{(analytics?.daily_sales || 0).toFixed(0)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Revenue</span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium"><span className="w-2 h-2 rounded-full bg-slate-900"></span>Dine-In</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs><linearGradient id="colorSalesMini" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.2} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} width={50} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '11px' }} />
                <Area type="monotone" dataKey="sales" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesMini)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Types */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/60 p-5" data-testid="order-types-panel">
          <h3 className="font-heading font-bold text-slate-900 text-base mb-3">Order Types</h3>
          {orderTypeData.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">No order data yet</p>
          ) : (
            <>
              <div className="w-36 h-36 mx-auto mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={orderTypeData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={5} dataKey="value">{orderTypeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {orderTypeData.map((entry, index) => (<div key={entry.name} className="flex items-center justify-between"><div className="flex items-center gap-2 min-w-0"><div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="text-xs text-slate-600 font-medium truncate">{entry.name}</span></div><span className="text-xs font-bold text-slate-900">{entry.value}</span></div>))}
              </div>
            </>
          )}
        </div>
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
                          <span className="font-numbers text-sm font-bold text-slate-900">#{order.order_number}</span>
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
                      <p className="text-lg font-bold font-numbers text-slate-900">₹{order.total_amount.toFixed(2)}</p>
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
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
        <DialogContent className="rounded-2xl max-w-xs bg-white" data-testid="dashboard-receipt-modal">
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
                <div className="flex justify-between"><span>Order #</span><span className="font-numbers">{receiptData.order.order_number}</span></div>
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
                  <span>Total</span><span className="font-numbers">₹{receiptData.order.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-slate-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button
            onClick={handlePrintReceipt}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors mt-2"
            data-testid="dashboard-print-receipt-btn"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
