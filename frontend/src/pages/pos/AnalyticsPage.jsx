import React, { useState, useEffect } from 'react';
import { analyticsAPI, branchAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Clock, Sparkles, RefreshCw, CalendarDays, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ReactMarkdown from 'react-markdown';

const COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#8B5CF6', '#EF4444'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'manager';

  useEffect(() => {
    if (isOwnerOrManager) {
      branchAPI.getAll().then(res => setBranches(res.data)).catch(() => {});
    }
  }, [isOwnerOrManager]);

  useEffect(() => { fetchAnalytics(); }, [selectedDate, selectedBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.get(selectedDate, selectedBranch);
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await analyticsAPI.getAiInsights();
      setAiInsights(res.data);
    } catch (err) {
      console.error('AI insights error:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

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
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900">Analytics</h1>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Branch Selector */}
          {isOwnerOrManager && branches.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-7 border-0 p-0 text-sm font-medium w-40 focus:ring-0" data-testid="branch-selector">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            <Input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-7 border-0 p-0 text-sm font-medium text-slate-800 w-36 focus-visible:ring-0"
              data-testid="analytics-date-picker"
            />
          </div>
          {!isToday && (
            <Button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} variant="outline" className="h-9 rounded-lg text-xs" data-testid="analytics-today-btn">
              Today
            </Button>
          )}
        </div>
      </div>

      {/* Filter indicators */}
      {(!isToday || selectedBranch !== 'all') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2 flex-wrap">
          {!isToday && (
            <span>Date: <span className="font-semibold">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></span>
          )}
          {selectedBranch !== 'all' && (
            <span>{!isToday && '|'} Branch: <span className="font-semibold">{branches.find(b => b.id === selectedBranch)?.name || selectedBranch}</span></span>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <div className="grid lg:grid-cols-2 gap-6"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200/60 hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{isToday ? 'Daily' : 'Date'} Sales</p>
                    <p className="font-numbers text-2xl font-bold text-slate-900">₹{(analytics?.daily_sales || 0).toFixed(2)}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200/60 hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Weekly Sales</p>
                    <p className="font-numbers text-2xl font-bold text-slate-900">₹{(analytics?.weekly_sales || 0).toFixed(2)}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200/60 hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Monthly Sales</p>
                    <p className="font-numbers text-2xl font-bold text-slate-900">₹{(analytics?.monthly_sales || 0).toFixed(2)}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200/60 hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total Orders</p>
                    <p className="font-numbers text-2xl font-bold text-slate-900">{analytics?.total_orders || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-slate-800" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

                    {/* Charts Row - 3 column layout */}
          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
                <h3 className="font-heading font-bold text-slate-900 text-base mb-4">Order Type Breakdown</h3>
                <div className="h-52">
                  {orderTypeData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={orderTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{orderTypeData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <div className="flex items-center justify-center h-full text-slate-400">No order data</div>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
                <h3 className="font-heading font-bold text-slate-900 text-base mb-4">Peak Order Hours</h3>
                <div className="h-48">
                  {hourlyData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><defs><linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(hour) => `${hour}:00`} /><YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" /><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px' }} labelFormatter={(hour) => `${hour}:00`} /><Area type="monotone" dataKey="orders" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorOrders)" /></AreaChart></ResponsiveContainer>) : <div className="flex items-center justify-center h-full text-slate-400">No hourly data</div>}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
                <h3 className="font-heading font-bold text-slate-900 text-base mb-4">Payment Methods</h3>
                <div className="h-48">
                  {paymentData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><BarChart data={paymentData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" /><YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" /><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px' }} formatter={(value) => [`Rs.${value.toFixed(2)}`, 'Amount']} /><Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>) : <div className="flex items-center justify-center h-full text-slate-400">No payment data</div>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
                <h3 className="font-heading font-bold text-slate-900 text-base mb-4">Top Selling Items</h3>
                {analytics?.top_items && analytics.top_items.length > 0 ? (<div className="space-y-3">{analytics.top_items.slice(0, 5).map((item, index) => (<div key={item.name} className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400 w-5">{index + 1}</span><div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0"><TrendingUp className="w-4 h-4 text-orange-500" /></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p><p className="text-[10px] text-slate-400">{item.count} orders</p></div></div>))}</div>) : <p className="text-slate-400 text-sm text-center py-4">No sales data</p>}
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
                <h3 className="font-heading font-bold text-slate-900 text-base mb-4">AI-Powered Insights</h3>
                <button onClick={fetchAiInsights} disabled={insightsLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-60 mb-4">
                  {insightsLoading ? (<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />) : (<Sparkles className="w-4 h-4" />)}
                  {insightsLoading ? 'Analyzing...' : 'Generate Insights'}
                </button>
                {aiInsights ? (<div className="prose prose-sm prose-slate max-w-none text-xs" data-testid="ai-insights-content"><ReactMarkdown>{aiInsights.insights}</ReactMarkdown></div>) : (<div className="text-center py-6 text-slate-400"><Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-xs font-medium">Click to get AI-powered sales analysis</p><p className="text-[10px] mt-1 text-slate-300">Powered by Gemini AI</p></div>)}
              </div>
            </div>
          </div>

</>
      )}
    </div>
  );
}
