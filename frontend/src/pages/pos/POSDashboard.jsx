import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, orderAPI, daySessionAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertCircle,
  Package,
  Users,
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

const COLORS = ['#3B82F6', '#22C55E', '#3B82F6', '#EAB308'];

export default function POSDashboard() {
  const { restaurant } = useAuth();
  const { isDayOpen, currentSession } = useOutletContext();
  const [analytics, setAnalytics] = useState(null);
  const [todayOrders, setTodayOrders] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
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
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Today's Sales</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  ₹{todaySales.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Today's Orders</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">{todayOrderCount}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-slate-800" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Weekly Sales</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  ₹{(analytics?.weekly_sales || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Monthly Sales</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  ₹{(analytics?.monthly_sales || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Sales Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
                    stroke="#3B82F6"
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
        <Card className="border-slate-200">
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
      <Card className="border-slate-200">
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
      <Card className="border-slate-200">
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
    </div>
  );
}
