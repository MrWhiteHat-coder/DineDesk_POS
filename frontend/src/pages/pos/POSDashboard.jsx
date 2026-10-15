import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, daySessionAPI, receiptAPI, inventoryAPI, tableAPI, kdsAPI } from '../../lib/api';
import { toast } from 'sonner';
import haptics from '../../lib/haptics';
import AskDineDesk from '../../components/pos/AskDineDesk';
import { Skeleton } from '../../components/ui/skeleton';
import CountUp from '../../components/ui/CountUp';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Printer,
  ArrowRight,
  Banknote,
  CreditCard,
  Smartphone,
  Clock,
  CheckCircle,
  UtensilsCrossed,
  MoreHorizontal,
  Flame,
  ConciergeBell,
  Receipt,
  Users,
  AlertTriangle,
  Package,
  Timer,
  CircleDollarSign,
  Monitor,
  XCircle,
  Plus,
  IndianRupee,
  ShoppingCart,
  BarChart3,
  ClipboardList,
  Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ───────── design tokens (dark-first) ─────────
   #101412 bg · #141915 sidebar · #191F1B surface · #202721 input
   #303832 border · #F4F1E8 text · #A5ADA5 secondary · #F4A261 accent
   #78C091 success · #82B4E8 info · #E76F51 error · #20170F on-accent */

const SURFACE = 'bg-white dark:bg-[#191F1B]';
const BORDER = 'border-gray-200 dark:border-[#303832]';
const TEXT = 'text-gray-900 dark:text-[#F4F1E8]';
const SUBTEXT = 'text-gray-500 dark:text-[#A5ADA5]';
const FAINT = 'text-gray-400 dark:text-[#A5ADA5]/60';
const AMBER_BTN = 'bg-[#F4A261] text-[#20170F] hover:bg-[#e8955a]';

const STATUS_STYLES = {
  ready: { bg: 'bg-[#82B4E8]/10 border border-[#82B4E8]/30', text: 'text-[#82B4E8]', label: 'Ready' },
  completed: { bg: 'bg-[#78C091]/10 border border-[#78C091]/30', text: 'text-[#78C091]', label: 'Completed' },
  preparing: { bg: 'bg-[#F4A261]/10 border border-[#F4A261]/30', text: 'text-[#F4A261]', label: 'Preparing' },
  pending: { bg: 'bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-[#303832]', text: 'text-gray-600 dark:text-[#A5ADA5]', label: 'Pending' },
  cancelled: { bg: 'bg-[#E76F51]/10 border border-[#E76F51]/30', text: 'text-[#E76F51]', label: 'Cancelled' },
  refunded: { bg: 'bg-[#E76F51]/10 border border-[#E76F51]/30', text: 'text-[#E76F51]', label: 'Refunded' },
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

/* Floor tile visual per table state — semantic, not status-quo green:
   amber = live service, info = ready to deliver, error = payment issue,
   green reserved for genuinely positive states (availability). */
function tableVisual(table, order) {
  if (order && order.status === 'ready') {
    return { ring: 'ring-[#82B4E8]/70', tile: 'bg-[#82B4E8]/10', dot: 'bg-[#82B4E8]', label: 'Ready', labelTone: 'text-[#82B4E8]' };
  }
  if (order && order.payment_status !== 'paid' && order.status === 'completed') {
    return { ring: 'ring-[#E76F51]/70', tile: 'bg-[#E76F51]/10', dot: 'bg-[#E76F51]', label: 'Payment', labelTone: 'text-[#E76F51]' };
  }
  if (order && (order.status === 'pending' || order.status === 'preparing')) {
    return { ring: 'ring-[#F4A261]/70', tile: 'bg-[#F4A261]/10', dot: 'bg-[#F4A261]', label: order.status === 'preparing' ? 'Preparing' : 'Seated', labelTone: 'text-[#F4A261]' };
  }
  if (table.status === 'reserved') {
    return { ring: 'ring-[#82B4E8]/40', tile: 'bg-[#82B4E8]/5', dot: 'bg-[#82B4E8]', label: 'Reserved', labelTone: 'text-[#82B4E8]' };
  }
  if (table.status === 'occupied') {
    return { ring: 'ring-[#F4A261]/50', tile: 'bg-[#F4A261]/5', dot: 'bg-[#F4A261]', label: 'Dining', labelTone: 'text-[#F4A261]' };
  }
  return {
    ring: 'ring-[#303832]', tile: 'bg-[#202721] dark:bg-[#202721]',
    dot: 'bg-gray-400 dark:bg-[#A5ADA5]/40', label: 'Available', labelTone: 'text-[#78C091]',
  };
}

/* ═══════════════════════════════════════════════════════
   OPERATIONS COMMAND CENTRE DASHBOARD
   ═══════════════════════════════════════════════════════ */
export default function POSDashboard() {
  const { user, restaurant } = useAuth();
  const { isDayOpen, refreshSession } = useOutletContext();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [todayOrders, setTodayOrders] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [longPressTable, setLongPressTable] = useState(null);
  const [tableActionLoading, setTableActionLoading] = useState(false);
  const longPressTimerRef = useRef(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOrdersDetail, setShowOrdersDetail] = useState(false);
  const [tableFilter, setTableFilter] = useState('all');
  const receiptRef = useRef(null);
  const seenOrderIdsRef = useRef(null);
  const pulseTimerRef = useRef(null);

  useEffect(() => { fetchData(); }, [isDayOpen]);
  useEffect(() => () => { if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current); }, []);

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
      const incoming = ordersRes.data || [];
      setTodayOrders(incoming);
      setSessionHistory(historyRes.data || []);
      setLowStockItems(inventoryRes.data || []);
      setTables(tablesRes.data || []);

      /* ── new-order live pulse ──
         First load only seeds the seen-set (no pulse on page open). Any
         genuinely fresh order afterwards fires a one-shot ring + haptic. */
      const incomingIds = new Set(incoming.map(o => o.id));
      if (seenOrderIdsRef.current === null) {
        seenOrderIdsRef.current = incomingIds;
      } else {
        const fresh = incoming.find(o => !seenOrderIdsRef.current.has(o.id));
        if (fresh) {
          seenOrderIdsRef.current = incomingIds;
          setNewOrderPulse(true);
          haptics.tick();
          if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = setTimeout(() => setNewOrderPulse(false), 2000);
        } else {
          seenOrderIdsRef.current = incomingIds;
        }
      }
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
  const availableTables = tables.filter(t => t.status !== 'occupied' && t.status !== 'reserved');
  const reservedTables = tables.filter(t => t.status === 'reserved');
  const tableFreeCount = tables.length - occupiedTables.length - reservedTables.filter(t => !occupiedTables.includes(t)).length;

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

  /* Delta chip — hidden entirely when there is no valid comparison */
  const deltaChip = (delta) => {
    if (delta === null || delta === 0) return null;
    const up = delta > 0;
    return (
      <span className={`font-semibold ${up ? 'text-[#78C091]' : 'text-[#E76F51]'}`}>
        {up ? '↑' : '↓'} {Math.abs(delta)}%
      </span>
    );
  };

  const hasData = todayOrders.length > 0 || tables.length > 0 || lastSales > 0;

  /* One-line operational summary under the heading (real data only) */
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
      tone: 'text-[#E76F51] bg-[#E76F51]/10',
      title: o.table_number ? `Table ${o.table_number}` : `Order #${o.order_number}`,
      desc: `Order waiting for ${minutesSince(o.created_at)} min`,
      action: 'View',
      testid: 'attention-delayed-order',
      run: () => openReceipt(o),
    }));
    preparingOrders.slice(0, 1).forEach(o => items.push({
      key: `kot-${o.id}`,
      icon: ConciergeBell,
      tone: 'text-[#F4A261] bg-[#F4A261]/10',
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
      tone: 'text-[#82B4E8] bg-[#82B4E8]/10',
      title: o.table_number ? `Table ${o.table_number}` : `Order #${o.order_number}`,
      desc: 'Payment pending',
      action: 'Take Payment',
      testid: 'attention-payment-pending',
      run: () => navigate('/pos/order-management'),
    }));
    if (outOfStockItems.length > 0) items.push({
      key: 'oos',
      icon: Package,
      tone: 'text-[#E76F51] bg-[#E76F51]/10',
      title: outOfStockItems[0].name,
      desc: outOfStockItems.length > 1 ? `Out of stock + ${outOfStockItems.length - 1} more item${outOfStockItems.length > 2 ? 's' : ''}` : 'Out of stock',
      action: 'Restock',
      testid: 'attention-out-of-stock',
      run: () => navigate('/pos/inventory'),
    });
    if (lowStockOnly.length > 0) items.push({
      key: 'low',
      icon: AlertTriangle,
      tone: 'text-[#F4A261] bg-[#F4A261]/10',
      title: lowStockOnly[0].name,
      desc: `Low stock (${lowStockOnly[0].quantity} ${lowStockOnly[0].unit || 'left'})`,
      action: 'Restock',
      testid: 'attention-low-stock',
      run: () => navigate('/pos/inventory'),
    });
    return items.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOrders, lowStockItems]);

  /* ── table <-> order join ── */
  const orderForTable = (table) =>
    todayOrders.find(o => String(o.table_number) === String(table.table_number) && ['pending', 'preparing', 'ready', 'completed'].includes(o.status));

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

  /* ── long-press table quick actions (mobile power move) ── */
  const startTableLongPress = (table) => {
    cancelTableLongPress();
    longPressTimerRef.current = setTimeout(() => {
      haptics.warning();
      setLongPressTable(table);
    }, 480);
  };
  const cancelTableLongPress = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };
  useEffect(() => () => cancelTableLongPress(), []);

  const applyTableAction = async (action) => {
    if (!longPressTable) return;
    setTableActionLoading(true);
    try {
      await tableAPI.updateStatus(longPressTable.id, action);
      toast.success(`Table ${longPressTable.table_number} → ${action}`);
      haptics.success();
      setLongPressTable(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update table');
    } finally {
      setTableActionLoading(false);
    }
  };

  /* ── greeting ── */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'Chef').split(' ')[0];
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const branchLabel = restaurant?.name || 'Your restaurant';

  /* ═════════ SKELETON (matches the real layout) ═════════ */
  if (loading) {
    return (
      <div className="animate-fade-in max-w-[1440px] space-y-3.5" data-testid="pos-dashboard-skeleton">
        {/* Heading */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-52 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-6 w-20 rounded-md hidden sm:block" />
        </div>
        {/* Glance strip */}
        <div className="rounded-2xl border border-gray-200 dark:border-[#303832] p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded-sm" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-3 w-14 rounded-sm" />
            </div>
          ))}
        </div>
        {/* Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          <div className="lg:col-span-7 space-y-3.5">
            <div className="rounded-2xl bg-white dark:bg-[#191F1B] border border-gray-200 dark:border-[#303832] p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
            <div className="rounded-2xl bg-white dark:bg-[#191F1B] border border-gray-200 dark:border-[#303832] p-4 space-y-4">
              <Skeleton className="h-5 w-32 rounded-md" />
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 space-y-3.5">
            <div className="rounded-2xl bg-white dark:bg-[#191F1B] border border-gray-200 dark:border-[#303832] p-4 space-y-2.5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 rounded-xl" />)}</div>
            <div className="rounded-2xl bg-white dark:bg-[#191F1B] border border-gray-200 dark:border-[#303832] p-4 space-y-2.5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 rounded-xl" />)}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ═════════ RENDER ═════════ */

  /* Hourly sales (real orders → local-time buckets). */
  const computeHourlySales = (orders) => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0 }));
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      try {
        const h = new Date(o.created_at).getHours();
        buckets[h].sales += (o.total_amount || 0);
      } catch { /* skip malformed */ }
    });
    return buckets;
  };
  const hourlySales = computeHourlySales(todayOrders);

  const todaySales = todayOrders.filter(o => o.status !== 'cancelled' && o.payment_status !== 'refunded').reduce((a, o) => a + (o.total_amount || 0), 0);
  const avgOrderValue = todaySales > 0 && todayOrders.length > 0 ? todaySales / Math.max(1, todayOrders.filter(o => o.status !== 'cancelled').length) : 0;
  const cancelledOrders = todayOrders.filter(o => o.status === 'cancelled');
  const servedOrders = todayOrders.filter(o => o.status === 'completed');
  const newOrders = todayOrders.filter(o => o.status === 'pending');

  /* Top selling items (real line items → revenue) */
  const computeTopItems = (orders) => {
    const map = {};
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      (o.items || []).forEach(it => {
        if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0 };
        map[it.name].qty += (it.quantity || 0);
        map[it.name].revenue += (it.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  };
  const topItems = computeTopItems(todayOrders);

  const filteredTables = tableFilter === 'occupied' ? occupiedTables
    : tableFilter === 'available' ? availableTables
    : tableFilter === 'reserved' ? reservedTables
    : tables;

  const fmtHour = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'AM' : 'PM'}`;
  const fmtAxis = (v) => (v >= 1000 ? `₹${(v / 1000).toFixed(1).replace(/\.0$/, '')}K` : `₹${v}`);

  /* ── glance metrics (label, value, context — comparison only when valid) ── */
  const glance = [
    { label: 'Net Sales', value: <CountUp value={todaySales} prefix="₹" />, sub: <>vs. yesterday {deltaChip(salesDelta) || '—'}</>, href: '/pos/analytics', testid: 'sales-today-card' },
    { label: 'Orders', value: <CountUp value={todayOrders.length} />, sub: <>vs. yesterday {deltaChip(ordersDelta) || '—'}</>, href: '/pos/order-management', testid: 'total-orders-card' },
    { label: 'Avg Order', value: `₹${avgOrderValue.toFixed(0)}`, sub: 'per bill', testid: 'aov-today-card' },
    { label: 'Active Now', value: activeOrders.length, sub: unpaidCompleted.length > 0 ? `${unpaidCompleted.length} awaiting payment` : `${readyOrders.length} ready to serve`, testid: 'active-orders-card' },
    { label: 'Floor', value: `${occupiedTables.length}/${tables.length}`, sub: `${Math.max(tableFreeCount, 0)} free`, testid: 'active-tables-card' },
  ];

  const statusRows = [
    { key: 'new', label: 'New Orders', count: newOrders.length, icon: ClipboardList, tone: 'text-[#82B4E8] bg-[#82B4E8]/10' },
    { key: 'prep', label: 'Preparing', count: preparingOrders.length, icon: Flame, tone: 'text-[#F4A261] bg-[#F4A261]/10' },
    { key: 'ready', label: 'Ready', count: readyOrders.length, icon: CheckCircle, tone: 'text-[#78C091] bg-[#78C091]/10' },
    { key: 'served', label: 'Served', count: servedOrders.length, icon: ConciergeBell, tone: 'text-gray-500 dark:text-[#A5ADA5] bg-gray-100 dark:bg-white/[0.06]' },
    { key: 'cancelled', label: 'Cancelled', count: cancelledOrders.length, icon: XCircle, tone: 'text-[#E76F51] bg-[#E76F51]/10' },
  ];

  const quickLinks = [
    { label: 'New Bill', icon: Receipt, to: '/pos/order-management' },
    { label: 'Kitchen', icon: ConciergeBell, to: '/pos/kds' },
    { label: 'Tables', icon: Monitor, to: '/pos/tables' },
    { label: 'Add Menu', icon: UtensilsCrossed, to: '/pos/menu' },
    { label: 'Customers', icon: Users, to: '/pos/customers' },
    { label: 'Reports', icon: BarChart3, to: '/pos/analytics' },
  ];

  const recentOrders = [...todayOrders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4);

  return (
    <div className="space-y-3.5 animate-fade-in max-w-[1440px]" data-testid="pos-dashboard">

      {/* ═══ COMPACT OPERATIONAL HEADING ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3" data-testid="dashboard-heading">
        <div className="min-w-0">
          <h1 className={`font-heading text-xl md:text-2xl font-bold tracking-tight ${TEXT} truncate`}>
            {greeting}, {firstName} <span aria-hidden="true">·</span>{' '}
            <span className="text-gray-500 dark:text-[#A5ADA5] font-semibold">{branchLabel}</span>
          </h1>
          <p className={`text-xs md:text-[13px] ${SUBTEXT} mt-0.5 flex items-center gap-1.5 flex-wrap`}>
            <span className="truncate">{dateLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{kitchenLine}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${hasData ? 'border-[#78C091]/40 bg-[#78C091]/10 text-[#78C091]' : 'border-[#303832] bg-[#202721] text-[#A5ADA5]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${hasData ? 'bg-[#78C091]' : 'bg-[#A5ADA5]/50'}`} />
            {isDayOpen ? (hasData ? 'Live service' : 'Day open · no orders yet') : 'Day closed'}
          </span>
          {attentionCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border border-[#E76F51]/40 bg-[#E76F51]/10 text-[#E76F51]">
              <AlertTriangle className="w-3 h-3" /> {attentionCount} need attention
            </span>
          )}
        </div>
      </header>

      {/* ═══ DAY CONTROL (only when closed) ═══ */}
      {!isDayOpen && (
        <div className="bg-[#F4A261]/10 dark:bg-[#F4A261]/[0.08] border border-[#F4A261]/30 dark:border-[#F4A261]/25 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="day-closed-banner">
          <Timer className="w-5 h-5 text-[#F4A261] flex-shrink-0 hidden sm:block" />
          <p className="text-[13px] text-[#F4A261] flex-1 min-w-0 font-medium">Day is not open — billing is paused until you open the day.</p>
          <button
            onClick={async () => {
              try {
                await daySessionAPI.open(0);
                toast.success('Day opened — good service! 🌱');
                haptics.success();
                refreshSession();
              } catch { toast.error('Could not open the day — try again'); }
            }}
            className={`flex-shrink-0 px-4 py-2 rounded-lg ${AMBER_BTN} text-xs font-bold active:scale-[0.97] transition-all min-h-[38px]`}
            data-testid="open-day-banner-btn"
          >
            Open Day
          </button>
        </div>
      )}

      {/* ═══ TODAY AT A GLANCE — one compact strip, divided ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 rounded-2xl bg-white dark:bg-[#191F1B] border border-gray-200 dark:border-[#303832] divide-x divide-y md:divide-y-0 divide-gray-100 dark:divide-[#303832] overflow-hidden" data-testid="glance-strip">
        {glance.map((m, i) => {
          const Comp = m.href ? 'button' : 'div';
          return (
            <Comp
              key={m.label}
              onClick={m.href ? () => navigate(m.href) : undefined}
              className={`text-left p-3 md:p-3.5 bg-inherit ${m.href ? 'hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors' : ''}`}
              data-testid={m.testid}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider ${FAINT}`}>{m.label}</p>
              <p className={`font-numbers text-xl md:text-[22px] font-bold ${TEXT} leading-tight mt-1 ${m.testid === 'total-orders-card' && newOrderPulse ? 'live-pulse rounded-md' : ''}`}>{m.value}</p>
              <p className={`text-[10px] mt-1 ${FAINT} truncate`}>{m.sub}</p>
            </Comp>
          );
        })}
      </div>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

        {/* ───── PRIMARY: attention + floor ───── */}
        <div className="lg:col-span-7 space-y-3.5 min-w-0">

          {/* Attention Now — only real events, each leading somewhere */}
          {attentionItems.length > 0 && (
            <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="attention-panel">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}>
                  <Zap className="w-4 h-4 text-[#F4A261]" /> Needs Attention
                </h2>
                <span className={`text-[10px] font-bold ${FAINT}`}>{attentionItems.length} item{attentionItems.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1" >
                {attentionItems.map(item => (
                  <div key={item.key} className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors" data-testid={item.testid}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.tone}`}><item.icon className="w-4 h-4" strokeWidth={1.9} /></span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold ${TEXT} truncate`}>{item.title}</p>
                      <p className={`text-[11px] ${FAINT} truncate`}>{item.desc}</p>
                    </div>
                    <button onClick={item.run} className={`flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#303832] text-[11px] font-bold text-gray-700 dark:text-[#F4F1E8] hover:border-[#F4A261]/60 hover:text-[#F4A261] active:scale-95 transition-all`}>
                      {item.action}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Live Service Map — real tables only, compact tiles, legend */}
          <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="active-tables-panel">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}><Monitor className="w-4 h-4 text-[#F4A261]" /> Live Floor</h2>
                <p className={`text-[11px] ${FAINT} mt-0.5`}>{occupiedTables.length} of {tables.length} tables in service</p>
              </div>
              <button onClick={() => navigate('/pos/tables')} className={`text-xs font-semibold text-[#F4A261] hover:underline flex items-center gap-0.5`}>Manage <ArrowRight className="w-3 h-3" /></button>
            </div>

            {/* legend */}
            <div className="flex items-center gap-3 mb-3 flex-wrap text-[10px] font-semibold" data-testid="floor-legend">
              {[
                ['bg-[#F4A261]', 'Dining / Preparing'],
                ['bg-[#82B4E8]', 'Ready / Reserved'],
                ['bg-[#E76F51]', 'Payment due'],
                ['bg-gray-400 dark:bg-[#A5ADA5]/40', 'Available'],
              ].map(([dot, label]) => (
                <span key={label} className={`flex items-center gap-1.5 ${SUBTEXT}`}>
                  <span className={`w-2 h-2 rounded-full ${dot}`} /> {label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {[{ k: 'all', l: `All (${tables.length})` }, { k: 'occupied', l: `Occupied (${occupiedTables.length})` }, { k: 'available', l: `Available (${availableTables.length})` }, { k: 'reserved', l: `Reserved (${reservedTables.length})` }].map(f => (
                <button key={f.k} onClick={() => setTableFilter(f.k)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${tableFilter === f.k ? 'bg-[#F4A261] text-[#20170F] border-[#F4A261]' : 'border-[#303832] bg-transparent text-gray-600 dark:text-[#A5ADA5] hover:border-[#F4A261]/50'}`} data-testid={`table-filter-${f.k}`}>{f.l}</button>
              ))}
            </div>

            {tables.length === 0 ? (
              <div className="py-8 text-center" data-testid="floor-empty">
                <p className={`text-sm font-semibold ${SUBTEXT}`}>No tables yet</p>
                <p className={`text-xs ${FAINT} mt-1 mb-3`}>Add tables to see your live floor.</p>
                <button onClick={() => navigate('/pos/tables')} className={`px-4 py-2 rounded-lg ${AMBER_BTN} text-xs font-bold transition-all`}>Go to Tables</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 gap-2" data-testid="active-tables-grid">
                {filteredTables.map((table) => {
                  const vis = tableVisual(table, orderForTable(table));
                  return (
                    <div
                      key={table.id}
                      onContextMenu={(e) => { e.preventDefault(); setLongPressTable(table); }}
                      onTouchStart={() => startTableLongPress(table)}
                      onTouchEnd={cancelTableLongPress}
                      onTouchMove={cancelTableLongPress}
                      onClick={() => { const o = orderForTable(table); if (o) openReceipt(o); else navigate('/pos/tables'); }}
                      className={`relative rounded-xl p-2.5 ring-1 ${vis.ring} ${vis.tile} cursor-pointer select-none hover:scale-[1.03] active:scale-95 transition-transform`}
                      data-testid={`table-card-${table.table_number}`}
                      title="Click: open bill · Long-press / right-click: quick actions"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className={`font-numbers font-bold text-[13px] ${TEXT} leading-none`}>T{String(table.table_number).padStart(2, '0')}</p>
                        <MoreHorizontal className={`w-3 h-3 ${FAINT} flex-shrink-0`} />
                      </div>
                      <p className={`text-[9px] ${FAINT} mt-1`}>{table.capacity} seats</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${vis.dot}`} />
                        <span className={`text-[9px] font-bold ${vis.labelTone}`}>{vis.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Top sellers + hourly flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="top-items-panel">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}><UtensilsCrossed className="w-4 h-4 text-[#F4A261]" /> Top Sellers</h2>
                <button onClick={() => navigate('/pos/analytics')} className={`text-xs font-semibold text-[#F4A261] hover:underline flex items-center gap-0.5`}>All <ArrowRight className="w-3 h-3" /></button>
              </div>
              {topItems.length === 0 ? (
                <div className="py-6 text-center" data-testid="top-items-empty">
                  <p className={`text-sm font-semibold ${SUBTEXT}`}>No sales yet today</p>
                  <p className={`text-xs ${FAINT} mt-1`}>Best sellers show up here.</p>
                </div>
              ) : (
                <div className="space-y-1" data-testid="top-items-list">
                  {topItems.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2.5 py-1.5 px-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${idx === 0 ? 'bg-[#F4A261]/15 text-[#F4A261]' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-[#A5ADA5]'}`}>{idx + 1}</span>
                      <div className="flex-1 min-w-0 truncate">
                        <p className={`text-[12.5px] font-bold ${TEXT} truncate`}>{item.name}</p>
                        <p className={`text-[10px] ${FAINT}`}>{item.qty} ordered</p>
                      </div>
                      <span className={`font-numbers text-xs font-bold ${TEXT}`}>₹{item.revenue.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="sales-flow-panel">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}><BarChart3 className="w-4 h-4 text-[#F4A261]" /> Sales Flow</h2>
                <span className={`text-[10px] font-bold ${FAINT} flex items-center gap-1`}><Clock className="w-3 h-3" /> today</span>
              </div>
              <div className="h-32" data-testid="sales-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlySales.filter(b => b.hour >= 7 && b.hour <= 23)} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="hour" tickFormatter={(h) => fmtHour(h)} tick={{ fontSize: 8 }} interval={4} axisLine={false} tickLine={false} stroke="#A5ADA5" />
                    <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 8 }} axisLine={false} tickLine={false} stroke="#A5ADA5" />
                    <Tooltip
                      formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Sales']}
                      labelFormatter={(h) => fmtHour(h)}
                      contentStyle={{ borderRadius: 10, border: '1px solid #303832', fontSize: 11, background: '#191F1B', color: '#F4F1E8' }}
                      cursor={{ fill: 'rgba(244,162,97,0.08)' }}
                    />
                    <Bar dataKey="sales" fill="#F4A261" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>

        {/* ───── SECONDARY: actions + order status + latest ───── */}
        <div className="lg:col-span-5 space-y-3.5 min-w-0">

          {/* Quick Actions — one primary amber action + compact links */}
          <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="quick-actions-card">
            <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2 mb-3`}>
              <Zap className="w-4 h-4 text-[#F4A261]" /> Quick Actions
            </h2>
            <button onClick={() => navigate('/pos/orders')} className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F4A261] text-[#20170F] hover:bg-[#e8955a] active:scale-[0.98] transition-all mb-2.5" data-testid="quick-new-order">
              <span className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg bg-[#20170F]/10 flex items-center justify-center"><Plus className="w-4.5 h-4.5" /></span><span className="text-sm font-bold">New Order</span></span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              {quickLinks.map(l => (
                <button key={l.label} onClick={() => navigate(l.to)} className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-[#303832] hover:border-[#F4A261]/50 hover:bg-[#F4A261]/[0.06] active:scale-[0.97] transition-all" data-testid={`quick-${l.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <l.icon className="w-4 h-4 text-gray-600 dark:text-[#A5ADA5]" strokeWidth={1.8} />
                  <span className="text-[10px] font-bold text-gray-700 dark:text-[#F4F1E8]/80 text-center leading-tight">{l.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Order status — live kitchen counts */}
          <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="order-status-card">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}><ClipboardList className="w-4 h-4 text-[#F4A261]" /> Order Status</h2>
              <button onClick={() => setShowOrdersDetail(true)} className={`text-xs font-semibold text-[#F4A261] hover:underline flex items-center gap-0.5`}>View All <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="space-y-0.5" >
              {statusRows.map(row => (
                <button key={row.key} onClick={() => navigate('/pos/kds')} className="w-full flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left" data-testid={`status-row-${row.key}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${row.tone}`}><row.icon className="w-4 h-4" strokeWidth={1.9} /></span>
                  <span className={`text-[13px] font-semibold text-gray-800 dark:text-[#F4F1E8]/85 flex-1`}>{row.label}</span>
                  <span className={`font-numbers text-sm font-bold ${TEXT}`}>{row.count}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Latest orders — live, clickable */}
          <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="recent-orders-panel">
            <div className="flex items-center justify-between mb-2">
              <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}><Receipt className="w-4 h-4 text-[#F4A261]" /> Latest Orders</h2>
              <span className={`text-[10px] font-bold ${FAINT}`}>today</span>
            </div>
            {recentOrders.length === 0 ? (
              <div className="py-5 text-center" data-testid="recent-orders-empty">
                <p className={`text-[13px] font-semibold ${SUBTEXT}`}>No orders yet — open the POS to take the first one.</p>
                <button onClick={() => navigate('/pos/orders')} className={`mt-2 px-3.5 py-1.5 rounded-lg ${AMBER_BTN} text-[11px] font-bold transition-all`}>Open POS</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#303832]">
                {recentOrders.map(order => {
                  const PmIcon = order.payment_method === 'cash' ? Banknote : order.payment_method === 'card' ? CreditCard : order.payment_method === 'upi' ? Smartphone : Clock;
                  const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                  return (
                    <button key={order.id} onClick={() => openReceipt(order)} className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] px-1.5 -mx-1.5 rounded-lg transition-colors" data-testid={`recent-order-${order.id}`}>
                      <PmIcon className={`w-3.5 h-3.5 ${FAINT} flex-shrink-0`} />
                      <span className={`font-numbers text-[12px] font-bold ${TEXT}`}>#{order.order_number}</span>
                      {order.table_number && <span className={`text-[10px] ${FAINT}`}>T{order.table_number}</span>}
                      <span className="flex-1" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${st.bg} ${st.text}`}>{st.label}</span>
                      <span className={`font-numbers text-[12px] font-bold ${TEXT} w-14 text-right`}>₹{order.total_amount?.toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Stock alerts — compact, merged with attention restock entries */}
          {lowStockItems.length > 0 && (
            <section className={`${SURFACE} ${BORDER} rounded-2xl p-3.5 md:p-4`} data-testid="inventory-alerts-panel">
              <div className="flex items-center justify-between mb-2">
                <h2 className={`font-heading font-bold text-sm ${TEXT} flex items-center gap-2`}><Package className="w-4 h-4 text-[#E76F51]" /> Stock Alerts</h2>
                <button onClick={() => navigate('/pos/inventory')} className={`text-xs font-semibold text-[#F4A261] hover:underline flex items-center gap-0.5`}>All <ArrowRight className="w-3 h-3" /></button>
              </div>
              <div className="space-y-0.5" data-testid="inventory-alerts-list">
                {lowStockItems.slice(0, 4).map(item => (
                  <button key={item.id} onClick={() => navigate('/pos/inventory')} className="w-full flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] text-left transition-colors">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${(item.quantity ?? 0) <= 0 ? 'bg-[#E76F51]/10 text-[#E76F51]' : 'bg-[#F4A261]/10 text-[#F4A261]'}`}><Package className="w-3.5 h-3.5" /></span>
                    <p className={`text-[12.5px] font-bold ${TEXT} flex-1 truncate`}>{item.name}</p>
                    <span className={`font-numbers text-[11px] font-bold flex-shrink-0 ${(item.quantity ?? 0) <= 0 ? 'text-[#E76F51]' : 'text-[#F4A261]'}`}>
                      {(item.quantity ?? 0) <= 0 ? 'OUT' : `${item.quantity} ${item.unit || ''} left`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
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
              <p className="text-gray-400 dark:text-[#A5ADA5] text-center py-8">No orders today yet.</p>
            ) : (
              todayOrders.map((order) => {
                const PmIcon = order.payment_method === 'cash' ? Banknote : order.payment_method === 'card' ? CreditCard : order.payment_method === 'upi' ? Smartphone : Clock;
                const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                return (
                  <div key={order.id} className="bg-gray-50 dark:bg-[#202721] rounded-xl border border-gray-200 dark:border-[#303832] p-4" data-testid={`order-detail-${order.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-numbers text-sm font-bold ${TEXT}`}>#{order.order_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${order.payment_status === 'paid' ? 'bg-[#78C091]/10 text-[#78C091]' : 'bg-gray-200 text-gray-600 dark:bg-white/[0.08] dark:text-[#A5ADA5]'}`}>{order.payment_status === 'paid' ? 'Paid' : order.payment_status === 'refunded' ? 'Refunded' : 'Unpaid'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-[#A5ADA5]">
                          <PmIcon className="w-3 h-3" />
                          <span className="capitalize">{order.payment_method || 'pending'}</span>
                          {order.table_number && <span>· Table {order.table_number}</span>}
                          <span>· {getOrderTime(order)}</span>
                        </div>
                      </div>
                      <p className={`text-lg font-bold font-numbers ${TEXT}`}>₹{order.total_amount?.toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
                      {(order.items || []).map((item, idx) => (
                        <div key={`${item.name}-${item.quantity}-${idx}`} className="bg-white dark:bg-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs border border-gray-100 dark:border-[#303832]">
                          <span className={`font-semibold text-gray-800 dark:text-[#F4F1E8]/85`}>{item.quantity}x</span>{' '}
                          <span className="text-gray-600 dark:text-[#A5ADA5]">{item.name}</span>
                          <span className="text-gray-400 dark:text-[#A5ADA5]/50 ml-1">₹{item.total?.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => openReceipt(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-[#303832] text-white dark:text-[#F4F1E8] text-xs font-semibold hover:bg-gray-800 dark:hover:bg-[#3d4540] transition-colors"
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

      {/* ── Long-press table quick actions ── */}
      <Dialog open={!!longPressTable} onOpenChange={(open) => { if (!open) setLongPressTable(null); }}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">
              Table {longPressTable ? String(longPressTable.table_number).padStart(2, '0') : ''}
            </DialogTitle>
            <p className="text-xs text-gray-400">Quick actions</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2" data-testid="table-quick-actions">
            {[
              { action: 'available', label: 'Free up', tone: 'bg-gray-50 dark:bg-[#202721] text-gray-700 dark:text-[#F4F1E8]/80 border-gray-200 dark:border-[#303832]' },
              { action: 'occupied', label: 'Seat now', tone: 'bg-[#F4A261]/10 text-[#F4A261] border-[#F4A261]/30' },
              { action: 'reserved', label: 'Reserve', tone: 'bg-[#82B4E8]/10 text-[#82B4E8] border-[#82B4E8]/30' },
              { action: 'available', label: 'Reset', tone: 'bg-[#78C091]/10 text-[#78C091] border-[#78C091]/30' },
            ].map(({ action, label, tone }) => (
              <button
                key={label}
                onClick={() => applyTableAction(action)}
                disabled={tableActionLoading}
                className={`py-3 rounded-xl border text-xs font-bold active:scale-95 transition-all disabled:opacity-50 ${tone}`}
                data-testid={`table-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {label}
              </button>
            ))}
          </div>
          {longPressTable && longPressTable.capacity && (
            <p className="text-[11px] text-gray-400 text-center">{longPressTable.capacity} seats</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Ask DineDesk — AI assistant lives on the Dashboard only */}
      <AskDineDesk />
    </div>
  );
}
