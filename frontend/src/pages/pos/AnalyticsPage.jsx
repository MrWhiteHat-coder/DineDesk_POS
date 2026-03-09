import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Clock } from 'lucide-react';

const COLORS = ['#F97316', '#22C55E', '#3B82F6', '#EAB308', '#8B5CF6'];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await analyticsAPI.get();
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const orderTypeData = analytics?.order_type_breakdown
    ? Object.entries(analytics.order_type_breakdown).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value,
      }))
    : [];

  const paymentData = analytics?.payment_breakdown
    ? Object.entries(analytics.payment_breakdown).map(([name, value]) => ({
        name: name.toUpperCase(),
        value,
      }))
    : [];

  const hourlyData = analytics?.hourly_orders || [];

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Analytics</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Daily Sales</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  ₹{(analytics?.daily_sales || 0).toFixed(2)}
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

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Orders</p>
                <p className="font-numbers text-2xl font-bold text-slate-900">
                  {analytics?.total_orders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Order Type Breakdown */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Order Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
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
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {orderTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  No order data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [`₹${value.toFixed(2)}`, 'Amount']}
                    />
                    <Bar dataKey="value" fill="#F97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  No payment data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Orders */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Peak Order Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 12 }}
                    stroke="#94A3B8"
                    tickFormatter={(hour) => `${hour}:00`}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(hour) => `${hour}:00`}
                  />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#F97316"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorOrders)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No hourly data yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Selling Items */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Top Selling Items</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.top_items && analytics.top_items.length > 0 ? (
            <div className="space-y-3">
              {analytics.top_items.slice(0, 10).map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-numbers font-bold text-orange-500 w-6">
                      #{index + 1}
                    </span>
                    <span className="font-medium text-slate-900">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{
                          width: `${(item.count / analytics.top_items[0].count) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-numbers font-semibold text-slate-600 w-16 text-right">
                      {item.count} sold
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No sales data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
