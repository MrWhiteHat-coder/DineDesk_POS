import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, daySessionAPI, receiptAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertCircle,
  Package,
  Users,
  Printer,
  ChevronRight,
  X,
  Eye,
  Banknote,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0F766E', '#22C55E', '#0EA5E9', '#F59E0B'];

export default function POSDashboard() {
  const { restaurant } = useAuth();
  const { isDayOpen, currentSession } = useOutletContext();
  const [analytics, setAnalytics] = useState(null);
  const [todayOrders, setTodayOrders] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrdersDetail, setShowOrdersDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [isDayOpen]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ordersRes, historyRes] = await Promise.all([
        analyticsAPI.get().catch(() => ({ data: null })),
        orderAPI.getToday().catch(() => ({ data: [] })),
        daySessionAPI.getHistory().catch(() => ({ data: [] })),
      ]);

      setAnalytics(analyticsRes.data);
      setTodayOrders(ordersRes.data);
      setSessionHistory(historyRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const todaySales = todayOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const todayOrderCount = todayOrders.length;

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
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}</style></head><body>`);
    win.document.write(receiptRef.current.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // Prepare chart data
  const salesChartData = sessionHistory.slice(0, 7).reverse().map((s) => ({
    date: s.date,
    sales: s.total_sales,
    orders: s.total_orders,
  }));

  const orderTypeData = analytics?.order_type_breakdown
    ? Object.entries(analytics.order_type_breakdown).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value,
      }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pos-dashboard">
      {/* Day Status Alert */}
      {!isDayOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Day Not Open</p>
            <p className="text-sm text-amber-600">Open the day to start taking orders</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-teal-700 border-teal-700 text-white shadow-lg shadow-teal-700/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-100 mb-1">Today's Sales</p>
                <p className="font-numbers text-2xl font-bold text-white">
                  ₹{todaySales.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-[10px] text-teal-200 mt-2">Updated every new order</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60/60 bg-white cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" onClick={() => setShowOrdersDetail(true)} data-testid="todays-orders-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Today's Orders</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">{todayOrderCount}</p>
              </div>
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-teal-700" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">Click to view details <ChevronRight className="w-3 h-3" /></p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60/60 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Weekly Sales</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  ₹{(analytics?.weekly_sales || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60/60 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Monthly Sales</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  ₹{(analytics?.monthly_sales || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card className="border-slate-200/60">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Sales Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F766E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#0F766E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Type Breakdown */}
        <Card className="border-slate-200/60">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Order Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {orderTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {orderTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400">No order data yet</p>
              )}
            </div>
            {orderTypeData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {orderTypeData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-slate-600">
                      {entry.name}: {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Items */}
      <Card className="border-slate-200/60">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Top Selling Items</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.top_items && analytics.top_items.length > 0 ? (
            <div className="space-y-3">
              {analytics.top_items.slice(0, 5).map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-numbers font-bold text-slate-800 w-6">
                      #{index + 1}
                    </span>
                    <span className="font-medium text-slate-900">{item.name}</span>
                  </div>
                  <span className="font-numbers font-semibold text-slate-600">
                    {item.count} sold
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No sales data yet. Start taking orders!</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card className="border-slate-200/60">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Recent Orders Today</CardTitle>
        </CardHeader>
        <CardContent>
          {todayOrders.length > 0 ? (
            <div className="space-y-3">
              {todayOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-numbers font-semibold text-slate-900">
                      #{order.order_number}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        order.order_type === 'dine_in'
                          ? 'bg-blue-100 text-blue-700'
                          : order.order_type === 'takeaway'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {order.order_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'preparing'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="font-numbers font-semibold text-slate-900">
                      ₹{order.total_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No orders today yet.</p>
          )}
        </CardContent>
      </Card>

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
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">₹{order.total_amount.toFixed(2)}</p>
                      </div>
                    </div>
                    {/* Items */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="bg-white rounded-lg px-2.5 py-1.5 text-xs border border-slate-100">
                          <span className="font-semibold text-slate-800">{item.quantity}x</span>{' '}
                          <span className="text-slate-600">{item.name}</span>
                          <span className="text-slate-400 ml-1">₹{item.total?.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewReceipt(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-900 text-xs font-semibold hover:bg-amber-500 transition-colors"
                        data-testid={`view-receipt-${order.id}`}
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Bill
                      </button>
                    </div>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-semibold hover:bg-amber-500 transition-colors mt-2"
            data-testid="dashboard-print-receipt-btn"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
