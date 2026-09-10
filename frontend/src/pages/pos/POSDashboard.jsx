import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, daySessionAPI, receiptAPI, inventoryAPI, tableAPI, kdsAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Printer,
  ArrowRight,
  TrendingUp,
  Banknote,
  CreditCard,
  Smartphone,
  Clock,
  CheckCircle,
  UtensilsCrossed,
  Bell,
  MoreHorizontal,
  Flame,
  ConciergeBell,
  CalendarPlus,
  Receipt,
  Sparkles,
  Users,
  ChevronDown,
  Maximize2,
  ArrowRightLeft,
  AlertTriangle,
  Package,
  Timer,
  CircleDollarSign,
  Monitor,
  CalendarDays,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

/* ───────── helpers ───────── */

const STATUS_STYLES = {
  ready: { bg: 'bg-blue-50 dark:bg-blue-400/10', text: 'text-blue-600 dark:text-blue-300', label: 'Ready' },
  completed: { bg: 'bg-emerald-50 dark:bg-emerald-400/10', text: 'text-emerald-600 dark:text-emerald-300', label: 'Completed' },
  preparing: { bg: 'bg-amber-50 dark:bg-amber-400/10', text: 'text-amber-600 dark:text-amber-300', label: 'Preparing' },
  pending: { bg: 'bg-gray-100 dark:bg-white/[0.07]', text: 'text-gray-600 dark:text-white/60', label: 'Pending' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-400/10', text: 'text-red-600 dark:text-red-300', label: 'Cancelled' },
};

function getOrderTime(order) {
  try {
    return new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function minutesSince(dateStr) {
  try { return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000)); }
  catch { return 0; }
}

/* Live floor tile colors per table state (reference palette) */
function tableVisual(table, order) {
  if (order && order.status === 'ready') {
    return { ring: 'ring-blue-500/70 bg-blue-50 dark:bg-blue-500/15', dot: 'bg-blue-500', label: 'Ready', chip: 'bg-blue-500' };
  }
  if (order && order.payment_status !== 'paid' && order.status === 'completed') {
    return { ring: 'ring-red-500/70 bg-red-50 dark:bg-red-500/15', dot: 'bg-red-500', label: 'Payment', chip: 'bg-red-500' };
  }
  if (order && (order.status === 'pending' || order.status === 'preparing')) {
    return { ring: 'ring-[#2E9E5B]/70 bg-emerald-50 dark:bg-emerald-500/15', dot: 'bg-[#2E9E5B]', label: order.status === 'preparing' ? 'Preparing' : 'Seated', chip: 'bg-[#2E9E5B]' };
  }
  if (table.status === 'reserved') {
    return { ring: 'ring-blue-400/60 bg-blue-50/60 dark:bg-blue-400/10', dot: 'bg-blue-400', label: 'Reserved', chip: 'bg-blue-400' };
  }
  if (table.status === 'occupied') {
    return { ring: 'ring-[#2E9E5B]/50 bg-emerald-50/70 dark:bg-emerald-500/10', dot: 'bg-[#2E9E5B]', label: 'Dining', chip: 'bg-[#2E9E5B]' };
  }
  return { ring: 'ring-gray-300/70 dark:ring-white/15 bg-gray-100 dark:bg-white/[0.05]', dot: 'bg-gray-400 dark:bg-white/30', label: 'Available', chip: 'bg-gray-400 dark:bg-white/30' };
}

/* Mini sparkline (metric cards) */
function Spark({ data, color = '#2E9E5B' }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="w-16 h-8 flex-shrink-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${color.replace('#', '')})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CONTROL ROOM DASHBOARD
   ═══════════════════════════════════════════════════════ */
export default function POSDashboard() {
  const { user, restaurant } = useAuth();
  const { isDayOpen } = useOutletContext();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [todayOrders, setTodayOrders] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mapTab, setMapTab] = useState('floor');
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOrdersDetail, setShowOrdersDetail] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => { fetchData(); }, [isDayOpen]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ordersRes, historyRes, inventoryRes, tablesRes] = await Promise.all([
        analyticsAPI.get().catch(() => ({ data: null })),
        orderAPI.getToday().catch(() => ({ data: [] })),
        daySessionAPI.getHistory().catch(() => ({ data: [] })),
        inventoryAPI.getAll(true).catch(() => ({ data: [] })),
        tableAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setAnalytics(analyticsRes.data);
      setTodayOrders(ordersRes.data || []);
      setSessionHistory(historyRes.data || []);
      setLowStockItems(inventoryRes.data || []);
      setTables(tablesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── derived stats ── */
  const activeOrders = todayOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
  const unpaidCompleted = todayOrders.filter(o => o.status === 'completed' && o.payment_status !== 'paid');
  const preparingOrders = todayOrders.filter(o => o.status === 'preparing' || o.status === 'pending');
  const readyOrders = todayOrders.filter(o => o.status === 'ready');
  const delayedOrders = activeOrders.filter(o => minutesSince(o.created_at) > 10 && o.status !== 'ready');

  const occupiedTables = tables.filter(t => t.status === 'occupied' || (todayOrders.some(o => String(o.table_number) === String(t.table_number) && ['pending', 'preparing', 'ready'].includes(o.status))));
  const occupancyPct = tables.length > 0 ? Math.round((occupiedTables.length / tables.length) * 100) : 0;

  const outOfStockItems = lowStockItems.filter(i => (i.quantity ?? 0) <= 0);
  const lowStockOnly = lowStockItems.filter(i => (i.quantity ?? 0) > 0);

  const salesHistory = sessionHistory.slice(0, 7).reverse().map(s => ({ date: s.date, v: s.total_sales }));
  const ordersHistory = sessionHistory.slice(0, 7).reverse().map(s => ({ date: s.date, v: s.total_orders }));
  const lastSales = salesHistory[salesHistory.length - 1]?.v ?? 0;
  const prevSales = salesHistory[salesHistory.length - 2]?.v ?? 0;
  const salesDelta = prevSales > 0 ? Math.round(((lastSales - prevSales) / prevSales) * 100) : null;
  const lastOrdersCount = ordersHistory[ordersHistory.length - 1]?.v ?? 0;
  const prevOrdersCount = ordersHistory[ordersHistory.length - 2]?.v ?? 0;
  const ordersDelta = prevOrdersCount > 0 ? Math.round(((lastOrdersCount - prevOrdersCount) / prevOrdersCount) * 100) : null;

  const hasData = todayOrders.length > 0 || tables.length > 0 || lastSales > 0;

  /* Kitchen health line under the greeting */
  const attentionCount = delayedOrders.length + unpaidCompleted.length + outOfStockItems.length + lowStockOnly.length;
  const kitchenLine = preparingOrders.length > 0
    ? `kitchen is cooking ${preparingOrders.length} order${preparingOrders.length > 1 ? 's' : ''}`
    : readyOrders.length > 0
      ? `${readyOrders.length} order${readyOrders.length > 1 ? 's' : ''} ready to serve`
      : 'kitchen running normally';

  /* ── Attention Now items (real data only) ── */
  const attentionItems = useMemo(() => {
    const items = [];
    delayedOrders.slice(0, 2).forEach(o => items.push({
      key: `delay-${o.id}`,
      icon: Flame,
      tone: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-400/10',
      title: o.table_number ? `Table ${o.table_number}` : `Order #${o.order_number}`,
      desc: `Order waiting for ${minutesSince(o.created_at)} min`,
      action: 'View',
      testid: 'attention-delayed-order',
      run: () => openReceipt(o),
    }));
    preparingOrders.slice(0, 1).forEach(o => items.push({
      key: `kot-${o.id}`,
      icon: ConciergeBell,
      tone: 'text-amber-500 dark:text-amber-300 bg-amber-50 dark:bg-amber-400/10',
      title: `Order #${o.order_number}`,
      desc: 'In the kitchen now',
      action: 'Mark Ready',
      testid: 'attention-kot-ready',
      run: async () => {
        try {
          await kdsAPI.updateStatus(o.id, 'ready');
          toast.success(`Order #${o.order_number} marked ready`);
          fetchData();
        } catch { toast.error('Could not update the order'); }
      },
    }));
    unpaidCompleted.slice(0, 1).forEach(o => items.push({
      key: `pay-${o.id}`,
      icon: CircleDollarSign,
      tone: 'text-blue-500 dark:text-blue-300 bg-blue-50 dark:bg-blue-400/10',
      title: o.table_number ? `Table ${o.table_number}` : `Order #${o.order_number}`,
      desc: 'Payment pending',
      action: 'Take Payment',
      testid: 'attention-payment-pending',
      run: () => navigate('/pos/order-management'),
    }));
    if (outOfStockItems.length > 0) items.push({
      key: 'oos',
      icon: Package,
      tone: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-400/10',
      title: outOfStockItems[0].name,
      desc: outOfStockItems.length > 1 ? `Out of stock + ${outOfStockItems.length - 1} more item${outOfStockItems.length > 2 ? 's' : ''}` : 'Out of stock',
      action: 'Restock',
      testid: 'attention-out-of-stock',
      run: () => navigate('/pos/inventory'),
    });
    if (lowStockOnly.length > 0) items.push({
      key: 'low',
      icon: AlertTriangle,
      tone: 'text-amber-500 dark:text-amber-300 bg-amber-50 dark:bg-amber-400/10',
      title: lowStockOnly[0].name,
      desc: `Low stock (${lowStockOnly[0].quantity} ${lowStockOnly[0].unit || 'left'})`,
      action: 'Restock',
      testid: 'attention-low-stock',
      run: () => navigate('/pos/inventory'),
    });
    return items.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOrders, lowStockItems]);

  /* ── Service Flow (real counts) ── */
  const avgKitchenMin = preparingOrders.length > 0
    ? Math.round(preparingOrders.reduce((a, o) => a + minutesSince(o.created_at), 0) / preparingOrders.length)
    : 0;
  const avgServeMin = readyOrders.length > 0
    ? Math.round(readyOrders.reduce((a, o) => a + minutesSince(o.created_at), 0) / readyOrders.length)
    : 0;

  /* ── table <-> order join ── */
  const orderForTable = (table) =>
    todayOrders.find(o => String(o.table_number) === String(table.table_number) && ['pending', 'preparing', 'ready', 'completed'].includes(o.status));

  const selectedTable = tables.find(t => t.id === selectedTableId) || null;
  const selectedTableOrder = selectedTable ? orderForTable(selectedTable) : null;

  /* ── receipt (preserved logic) ── */
  const openReceipt = async (order) => {
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
    if (!receiptRef?.current) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    const style = win.document.createElement('style');
    style.textContent = 'body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}';
    win.document.head.appendChild(style);
    win.document.title = 'Receipt';
    win.document.body.innerHTML = receiptRef.current.innerHTML;
    win.print();
  };

  /* ── greeting ── */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'Chef').split(' ')[0];
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  /* ═════════ SKELETON ═════════ */
  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in" data-testid="pos-dashboard-skeleton">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <Skeleton className="h-20 w-72 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3 flex-1 max-w-xl"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <div className="space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
        </div>
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  /* ═════════ RENDER ═════════ */
  return (
    <div className="space-y-5 animate-fade-in max-w-[1400px]" data-testid="pos-dashboard">

      {/* ═══ GREETING + METRICS ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading-xl text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {greeting}, {firstName} <span aria-hidden="true">🌱</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>
              {tables.length > 0
                ? `${occupiedTables.length} table${occupiedTables.length !== 1 ? 's' : ''} active · ${attentionCount} thing${attentionCount !== 1 ? 's' : ''} need attention · ${kitchenLine}`
                : `${kitchenLine} · add tables from the Tables page to see your floor`}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${hasData ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-white/45'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasData ? 'bg-emerald-500 animate-calm-pulse' : 'bg-gray-400'}`} />
              {hasData ? 'Live data' : 'No service yet'}
            </span>
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 lg:w-[440px] flex-shrink-0">
          {/* Sales today */}
          <button
            onClick={() => navigate('/pos/analytics')}
            className="text-left bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5 hover:shadow-card-hover dark:hover:shadow-card-dark transition-all"
            data-testid="sales-today-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center"><Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-300" /></div>
              <Spark data={salesHistory} />
            </div>
            <p className="font-numbers text-xl font-bold text-gray-900 dark:text-white leading-none">₹{(analytics?.daily_sales ?? lastSales ?? 0).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-1 flex items-center gap-1">
              Sales today
              {salesDelta !== null && <span className={`font-bold ${salesDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>↑ {salesDelta >= 0 ? '+' : ''}{salesDelta}%</span>}
            </p>
          </button>

          {/* Active orders */}
          <button
            onClick={() => setShowOrdersDetail(true)}
            className="text-left bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5 hover:shadow-card-hover dark:hover:shadow-card-dark transition-all"
            data-testid="active-orders-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-400/10 flex items-center justify-center"><Users className="w-4 h-4 text-blue-600 dark:text-blue-300" /></div>
              <Spark data={ordersHistory} color="#3B82F6" />
            </div>
            <p className="font-numbers text-xl font-bold text-gray-900 dark:text-white leading-none">{activeOrders.length}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-1 flex items-center gap-1">
              Active orders
              {ordersDelta !== null && <span className={`font-bold ${ordersDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>↑ {ordersDelta >= 0 ? '+' : ''}{ordersDelta}%</span>}
            </p>
          </button>

          {/* Tables occupied */}
          <div
            className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5"
            data-testid="tables-occupied-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center"><Monitor className="w-4 h-4 text-gray-500 dark:text-white/50" /></div>
              <Spark data={ordersHistory} color="#6B7280" />
            </div>
            <p className="font-numbers text-xl font-bold text-gray-900 dark:text-white leading-none">{occupiedTables.length} / {tables.length}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-1 flex items-center gap-1">
              Tables occupied
              {tables.length > 0 && <span className="font-bold text-emerald-500">{occupancyPct}%</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ DAY CLOSED NOTE (replaces old amber banner — calm, actionable) ═══ */}
      {!isDayOpen && (
        <div className="bg-amber-50/70 dark:bg-amber-400/[0.07] border border-amber-200/70 dark:border-amber-400/20 rounded-2xl px-4 py-3 flex items-center gap-3 text-sm">
          <Timer className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-amber-800 dark:text-amber-200 flex-1 min-w-0">Day is not open yet — open the day from the restaurant card above to start taking orders.</p>
        </div>
      )}

      {/* ═══ MAP + RIGHT RAIL ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── LIVE SERVICE MAP ── */}
        <Card className="lg:col-span-2 bg-white dark:bg-[#12151B] border-gray-200 dark:border-white/[0.07] rounded-2xl" data-testid="live-service-map">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h2 className="font-heading font-bold text-gray-900 dark:text-white text-lg leading-tight">Live Service Map</h2>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Your restaurant. In real time.</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Tabs */}
                <div className="flex bg-gray-100 dark:bg-white/[0.06] rounded-xl p-1">
                  {[
                    { key: 'floor', label: 'Floor' },
                    { key: 'orders', label: 'Orders' },
                    { key: 'kitchen', label: 'Kitchen' },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setMapTab(t.key); setSelectedTableId(null); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mapTab === t.key ? 'bg-[#2E9E5B] text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white'}`}
                      data-testid={`map-tab-${t.key}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FLOOR */}
            {mapTab === 'floor' && (
              tables.length === 0 ? (
                <div className="py-14 text-center" data-testid="floor-empty">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center mx-auto mb-3"><Monitor className="w-7 h-7 text-gray-400 dark:text-white/30" /></div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-white/70">No tables yet</p>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-1 mb-4">Add your tables to see the live floor here.</p>
                  <button onClick={() => navigate('/pos/tables')} className="px-4 py-2 rounded-xl bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-105 transition-all">Go to Tables</button>
                </div>
              ) : (
                <div className="relative">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5" data-testid="floor-grid">
                    {tables.map((table) => {
                      const order = orderForTable(table);
                      const vis = tableVisual(table, order);
                      const mins = order ? minutesSince(order.created_at) : null;
                      const isSelected = selectedTableId === table.id;
                      return (
                        <button
                          key={table.id}
                          onClick={() => setSelectedTableId(isSelected ? null : table.id)}
                          className={`relative rounded-2xl p-2.5 ring-1 ${vis.ring} text-left transition-all hover:scale-[1.03] ${isSelected ? 'ring-2 ring-gray-900 dark:ring-white scale-[1.03] shadow-lg' : ''}`}
                          data-testid={`floor-table-${table.table_number}`}
                        >
                          <p className="font-numbers font-bold text-sm text-gray-900 dark:text-white leading-none">T{String(table.table_number).padStart(2, '0')}</p>
                          <p className="text-[10px] text-gray-500 dark:text-white/40 leading-none mt-1.5">{table.capacity} seats</p>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${vis.chip}`} />
                            <span className="text-[10px] font-bold text-gray-700 dark:text-white/70 leading-none">{vis.label}</span>
                          </div>
                          {mins !== null && ['pending', 'preparing', 'ready'].includes(order.status) && (
                            <p className="font-numbers text-[10px] text-gray-500 dark:text-white/45 leading-none mt-1">{mins} min</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Kitchen queue strip */}
                  {(preparingOrders.length > 0 || readyOrders.length > 0) && (
                    <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1" data-testid="kitchen-queue">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-white/35 uppercase tracking-wider flex-shrink-0">Kitchen →</span>
                      {[...preparingOrders, ...readyOrders].slice(0, 5).map(o => {
                        const st = STATUS_STYLES[o.status] || STATUS_STYLES.pending;
                        return (
                          <button key={o.id} onClick={() => openReceipt(o)} className={`flex items-center gap-2 flex-shrink-0 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.07] ${st.bg} hover:shadow-sm transition-all`}>
                            <span className="font-numbers text-xs font-bold text-gray-900 dark:text-white">#{o.order_number}</span>
                            <span className={`text-[9px] font-bold ${st.text}`}>{st.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Table popover */}
                  {selectedTable && (
                    <div className="mt-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-4 animate-fade-in" data-testid="table-detail">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <p className="font-heading font-bold text-gray-900 dark:text-white">Table {String(selectedTable.table_number).padStart(2, '0')}</p>
                          {(() => {
                            const vis = tableVisual(selectedTable, selectedTableOrder);
                            return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vis.ring} text-gray-700 dark:text-white/80`}>{vis.label}</span>;
                          })()}
                        </div>
                        {selectedTableOrder && ['pending', 'preparing', 'ready'].includes(selectedTableOrder.status) && (
                          <p className="font-numbers text-sm font-bold text-amber-600 dark:text-amber-300">{minutesSince(selectedTableOrder.created_at)} min</p>
                        )}
                      </div>

                      {selectedTableOrder ? (
                        <>
                          <div className="flex items-center gap-2 mb-2.5 text-xs text-gray-500 dark:text-white/45">
                            <span>Up to {selectedTable.capacity} guests</span>
                            {selectedTableOrder.order_type === 'dine_in' && <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-white/[0.08] rounded-md font-semibold text-gray-600 dark:text-white/60">Dine-In</span>}
                            <span>· {getOrderTime(selectedTableOrder)}</span>
                          </div>
                          <div className="space-y-1 mb-3">
                            {(selectedTableOrder.items || []).slice(0, 4).map((item, i) => (
                              <div key={`${item.name}-${i}`} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 dark:text-white/70"><span className="font-semibold">{item.quantity} ×</span> {item.name}</span>
                                <span className="font-numbers text-gray-900 dark:text-white/80">₹{item.total?.toFixed(0)}</span>
                              </div>
                            ))}
                            {(selectedTableOrder.items || []).length === 0 && <p className="text-xs text-gray-400 dark:text-white/35">No item details on this order.</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-numbers text-base font-bold text-gray-900 dark:text-white mr-auto">₹{selectedTableOrder.total_amount?.toFixed(0)}</p>
                            <button onClick={() => navigate('/pos/orders')} className="px-3.5 py-2 rounded-xl bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-105 transition-all" data-testid="table-open-order">Open Order</button>
                            <button onClick={() => openReceipt(selectedTableOrder)} className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/15 text-gray-700 dark:text-white/70 text-xs font-bold hover:bg-white dark:hover:bg-white/[0.06] transition-all">View Bill</button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500 dark:text-white/45 flex-1">This table is free right now.</p>
                          <button onClick={() => navigate('/pos/orders')} className="px-3.5 py-2 rounded-xl bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-105 transition-all">New Order Here</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            )}

            {/* ORDERS */}
            {mapTab === 'orders' && (
              todayOrders.length === 0 ? (
                <div className="py-14 text-center" data-testid="orders-tab-empty">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center mx-auto mb-3"><Receipt className="w-7 h-7 text-gray-400 dark:text-white/30" /></div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-white/70">No orders yet</p>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-1">Your first order today will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto pr-1" data-testid="orders-tab-grid">
                  {todayOrders.map(order => {
                    const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                    return (
                      <button key={order.id} onClick={() => openReceipt(order)} className={`text-left rounded-2xl border border-gray-200 dark:border-white/[0.07] p-3 ${st.bg} hover:shadow-sm transition-all`} data-testid={`order-row-${order.id}`}>
                        <p className="font-numbers font-bold text-base text-gray-900 dark:text-white leading-none">#{order.order_number}</p>
                        <p className="text-[10px] text-gray-500 dark:text-white/45 mt-1.5 leading-none">{order.table_number ? `Table ${order.table_number}` : (order.order_type || '').replace('_', ' ')} · {getOrderTime(order)}</p>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-2.5 ${st.bg} ${st.text}`}>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* KITCHEN */}
            {mapTab === 'kitchen' && (
              preparingOrders.length === 0 && readyOrders.length === 0 ? (
                <div className="py-14 text-center" data-testid="kitchen-tab-empty">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center mx-auto mb-3"><CheckCircle className="w-7 h-7 text-emerald-500" /></div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-white/70">Kitchen all clear</p>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-1">Nothing cooking or waiting right now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" data-testid="kitchen-tab-grid">
                  {[...preparingOrders, ...readyOrders].map(order => {
                    const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                    const mins = minutesSince(order.created_at);
                    const late = mins > 10 && order.status !== 'ready';
                    return (
                      <button key={order.id} onClick={() => openReceipt(order)} className={`text-left rounded-2xl border p-3.5 transition-all hover:shadow-sm ${late ? 'border-red-300 dark:border-red-400/40 bg-red-50 dark:bg-red-400/10' : 'border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.04]'}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-numbers font-bold text-lg text-gray-900 dark:text-white leading-none">#{order.order_number}</p>
                          <span className={`font-numbers text-xs font-bold ${late ? 'text-red-500' : 'text-gray-500 dark:text-white/45'}`}>{mins} min</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-white/45 mt-1.5">{order.table_number ? `Table ${order.table_number}` : (order.order_type || '').replace('_', ' ')} · {(order.items || []).length} items</p>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-2 ${st.bg} ${st.text}`}>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* ── RIGHT RAIL ── */}
        <div className="space-y-4">

          {/* Quick Capture */}
          <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4" data-testid="quick-actions-card">
            <h3 className="font-heading font-bold text-gray-900 dark:text-white text-base mb-3">Quick Capture</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigate('/pos/orders')} className="col-span-2 flex items-center gap-3 p-3 rounded-xl bg-[#2E9E5B] text-white hover:brightness-105 active:scale-[0.98] transition-all" data-testid="quick-new-order">
                <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0"><Monitor className="w-5 h-5" /></span>
                <span className="text-sm font-bold">New Order</span>
              </button>
              <button onClick={() => navigate('/pos/tables')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 dark:border-white/[0.08] hover:border-[#2E9E5B]/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-400/[0.06] transition-all" data-testid="quick-reservation">
                <CalendarPlus className="w-5 h-5 text-gray-600 dark:text-white/60" strokeWidth={1.8} />
                <span className="text-[11px] font-bold text-gray-700 dark:text-white/70">Reservation</span>
              </button>
              <button onClick={() => toast.info('Expense tracking arrives with the Wallet upgrade.')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 dark:border-white/[0.08] hover:border-[#2E9E5B]/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-400/[0.06] transition-all" data-testid="quick-expense">
                <Receipt className="w-5 h-5 text-gray-600 dark:text-white/60" strokeWidth={1.8} />
                <span className="text-[11px] font-bold text-gray-700 dark:text-white/70">Expense</span>
              </button>
              <button onClick={() => navigate('/pos/kds')} className="col-span-2 flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/[0.08] hover:border-[#2E9E5B]/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-400/[0.06] transition-all" data-testid="quick-kot">
                <UtensilsCrossed className="w-5 h-5 text-gray-600 dark:text-white/60" strokeWidth={1.8} />
                <span className="text-[13px] font-bold text-gray-700 dark:text-white/70">KOT · Kitchen tickets</span>
              </button>
            </div>
          </div>

          {/* Attention Now */}
          <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4" data-testid="attention-panel">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                Attention Now
                {attentionItems.length > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{attentionItems.length}</span>
                )}
              </h3>
              <button onClick={() => navigate('/pos/notifications')} className="text-xs font-semibold text-[#268A4E] dark:text-[#3FCE85] hover:underline flex items-center gap-0.5">View All <ArrowRight className="w-3 h-3" /></button>
            </div>

            {attentionItems.length === 0 ? (
              <div className="py-8 text-center" data-testid="attention-empty">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center mx-auto mb-2.5"><CheckCircle className="w-6 h-6 text-emerald-500" /></div>
                <p className="text-sm font-semibold text-gray-700 dark:text-white/70">All calm</p>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Nothing needs your attention right now.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {attentionItems.map(item => (
                  <div key={item.key} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors" data-testid={item.testid}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.tone}`}>
                      <item.icon className="w-5 h-5" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/45 truncate">{item.desc}</p>
                    </div>
                    <button
                      onClick={item.run}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-200 dark:border-white/15 text-gray-700 dark:text-white/75 hover:bg-[#2E9E5B] hover:text-white hover:border-[#2E9E5B] transition-all active:scale-[0.97]"
                    >
                      {item.action}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TODAY'S SERVICE FLOW ═══ */}
      <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="service-flow-panel">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-heading font-bold text-gray-900 dark:text-white text-lg leading-tight">Today's Service Flow</h2>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">From orders to happy guests.</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-white/50 border border-gray-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Today
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-stretch">
          {/* Orders Placed */}
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-2xl p-3.5" data-testid="flow-placed">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.08] flex items-center justify-center mb-2.5"><Receipt className="w-4 h-4 text-gray-500 dark:text-white/50" /></div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">Orders Placed</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight">{todayOrders.length}</span>
              {ordersDelta !== null && <span className={`text-[10px] font-bold ${ordersDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>↑ {ordersDelta >= 0 ? '+' : ''}{ordersDelta}%</span>}
            </p>
          </div>

          <div className="hidden md:flex items-center justify-center text-gray-300 dark:text-white/20"><ArrowRight className="w-5 h-5" /></div>

          {/* In Kitchen */}
          <div className="bg-amber-50/70 dark:bg-amber-400/[0.07] rounded-2xl p-3.5" data-testid="flow-kitchen">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-amber-200/60 dark:border-amber-400/20 flex items-center justify-center mb-2.5"><Flame className="w-4 h-4 text-amber-500" /></div>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-white/50">In Kitchen</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight">{preparingOrders.length}</span>
              {preparingOrders.length > 0 && <span className="text-[10px] font-semibold text-gray-500 dark:text-white/45">Avg {avgKitchenMin} min</span>}
            </p>
          </div>

          <div className="hidden md:flex items-center justify-center text-gray-300 dark:text-white/20"><ArrowRight className="w-5 h-5" /></div>

          {/* Serving at Tables */}
          <div className="bg-blue-50/70 dark:bg-blue-400/[0.07] rounded-2xl p-3.5" data-testid="flow-serving">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-blue-200/60 dark:border-blue-400/20 flex items-center justify-center mb-2.5"><ConciergeBell className="w-4 h-4 text-blue-500" /></div>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-white/50">Ready to Serve</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight">{readyOrders.length}</span>
              {readyOrders.length > 0 && <span className="text-[10px] font-semibold text-gray-500 dark:text-white/45">Avg {avgServeMin} min</span>}
            </p>
          </div>

          <div className="hidden md:flex items-center justify-center text-gray-300 dark:text-white/20"><ArrowRight className="w-5 h-5" /></div>

          {/* Payments */}
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-2xl p-3.5" data-testid="flow-payments">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.08] flex items-center justify-center mb-2.5"><CreditCard className="w-4 h-4 text-gray-500 dark:text-white/50" /></div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">Payments</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight">{unpaidCompleted.length}</span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-white/45">pending</span>
            </p>
          </div>
        </div>

        {/* Flow verdict — honest, computed from real state */}
        <div className={`mt-3 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold ${delayedOrders.length > 0
          ? 'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-300'
          : 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-300'}`}
          data-testid="flow-verdict"
        >
          {delayedOrders.length > 0
            ? <><AlertTriangle className="w-4 h-4 flex-shrink-0" />{delayedOrders.length} order{delayedOrders.length > 1 ? 's' : ''} waiting over 10 minutes — check Attention Now.</>
            : <><TrendingUp className="w-4 h-4 flex-shrink-0" />Smooth flow{todayOrders.length > 0 ? '' : ' — ready for the first order'}.</>}
        </div>
      </div>

      {/* ═══ TODAY'S ORDERS DETAIL (metric card click) ═══ */}
      <Dialog open={showOrdersDetail} onOpenChange={setShowOrdersDetail}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="orders-detail-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Today's Orders ({todayOrders.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {todayOrders.length === 0 ? (
              <p className="text-gray-400 dark:text-white/40 text-center py-8">No orders today yet.</p>
            ) : (
              todayOrders.map((order) => {
                const PmIcon = order.payment_method === 'cash' ? Banknote : order.payment_method === 'card' ? CreditCard : order.payment_method === 'upi' ? Smartphone : Clock;
                const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                return (
                  <div key={order.id} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.07] p-4" data-testid={`order-detail-${order.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-numbers text-sm font-bold text-gray-900 dark:text-white">#{order.order_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-white/[0.08] dark:text-white/60'}`}>{order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-white/45">
                          <PmIcon className="w-3 h-3" />
                          <span className="capitalize">{order.payment_method || 'pending'}</span>
                          {order.table_number && <span>· Table {order.table_number}</span>}
                          <span>· {getOrderTime(order)}</span>
                        </div>
                      </div>
                      <p className="text-lg font-bold font-numbers text-gray-900 dark:text-white">₹{order.total_amount?.toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
                      {(order.items || []).map((item, idx) => (
                        <div key={`${item.name}-${item.quantity}-${idx}`} className="bg-white dark:bg-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs border border-gray-100 dark:border-white/[0.06]">
                          <span className="font-semibold text-gray-800 dark:text-white/85">{item.quantity}x</span>{' '}
                          <span className="text-gray-600 dark:text-white/60">{item.name}</span>
                          <span className="text-gray-400 dark:text-white/35 ml-1">₹{item.total?.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => openReceipt(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-[#2E9E5B] text-white text-xs font-semibold hover:bg-gray-800 dark:hover:bg-[#288A50] transition-colors"
                      data-testid={`view-receipt-${order.id}`}
                    >
                      <Printer className="w-3.5 h-3.5" /> View / Print Bill
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ RECEIPT MODAL (logic preserved) ═══ */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs bg-white" data-testid="dashboard-receipt-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" /> Bill / Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div ref={receiptRef}>
              <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
                <h2 className="font-bold text-base text-gray-900">{receiptData.restaurant.name}</h2>
                <p className="text-[10px] text-gray-500">{receiptData.restaurant.address}, {receiptData.restaurant.city}</p>
                <p className="text-[10px] text-gray-500">{receiptData.restaurant.phone}</p>
              </div>
              <div className="text-[11px] mb-2 text-gray-800">
                <div className="flex justify-between"><span>Order #</span><span className="font-numbers">{receiptData.order.order_number}</span></div>
                <div className="flex justify-between"><span>Type</span><span className="capitalize">{receiptData.order.order_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span>Payment</span><span className="capitalize">{receiptData.order.payment_method}</span></div>
                <div className="flex justify-between"><span>Date</span><span>{new Date(receiptData.order.created_at).toLocaleString()}</span></div>
                {receiptData.order.table_number && (
                  <div className="flex justify-between"><span>Table</span><span>{receiptData.order.table_number}</span></div>
                )}
              </div>
              <hr className="border-dashed border-gray-300 my-1" />
              <div className="space-y-1 text-[11px] text-gray-800">
                {(receiptData.order.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{item.total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <hr className="border-dashed border-gray-300 my-1" />
              <div className="text-[11px] space-y-0.5 text-gray-800">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{receiptData.order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{receiptData.order.tax_amount?.toFixed(2)}</span></div>
                {receiptData.order.discount_amount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-₹{receiptData.order.discount_amount?.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-300">
                  <span>Total</span><span className="font-numbers">₹{receiptData.order.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-gray-400 mt-3">Thank you for dining with us!</p>
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
