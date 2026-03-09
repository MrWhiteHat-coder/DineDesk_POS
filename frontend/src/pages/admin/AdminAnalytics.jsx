import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react';

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await adminAPI.getAnalytics();
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

  // Combine orders and revenue data
  const combinedData = analytics?.orders_by_day?.map((order, idx) => ({
    date: order.date,
    orders: order.orders,
    revenue: analytics?.revenue_by_day?.[idx]?.revenue || 0,
  })) || [];

  const totalOrders = combinedData.reduce((sum, d) => sum + d.orders, 0);
  const totalRevenue = combinedData.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="space-y-6" data-testid="admin-analytics">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Platform Analytics</h1>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Orders (30 days)</p>
                <p className="font-numbers text-3xl font-bold text-slate-900">{totalOrders}</p>
              </div>
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-7 h-7 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Revenue (30 days)</p>
                <p className="font-numbers text-3xl font-bold text-green-600">
                  ₹{totalRevenue.toFixed(0)}
                </p>
              </div>
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Chart */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Orders & Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {combinedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={false}
                    name="Orders"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={false}
                    name="Revenue (₹)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No data available yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Bar Chart */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            Daily Orders Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {analytics?.orders_by_day && analytics.orders_by_day.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.orders_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="orders" fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No order data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
