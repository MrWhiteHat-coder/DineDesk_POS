import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { walletAPI } from '../../lib/api';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw, CalendarDays, Wallet, CircleDollarSign,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function WalletPage() {
  const { currentSession } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await walletAPI.getSummary(selectedDate ? 'custom' : period, selectedDate || undefined);
      setSummary(res.data);
    } catch (err) {
      console.error('Wallet error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, [period, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    if (date) {
      setPeriod('');
    }
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    setSelectedDate('');
  };

  if (loading || !summary) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const cards = [
    { label: 'Cash Sales', value: summary.total_cash, icon: Banknote, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Card Sales', value: summary.total_card, icon: CreditCard, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'UPI Sales', value: summary.total_upi, icon: Smartphone, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Total Sales', value: summary.total_sales, icon: TrendingUp, color: 'bg-slate-50 text-slate-800 border-slate-200' },
  ];

  return (
    <div className="max-w-[1400px] animate-fade-in" data-testid="wallet-page">
      {/* Header — reference: icon tile + big title + script quote + period pills */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(240px,320px)_auto] gap-4 items-stretch mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-100 dark:border-emerald-400/20 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Wallet & Reconciliation</h1>
            <p className="text-sm text-slate-500 dark:text-white/50 mt-0.5">Track every rupee. Settle with confidence.</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-emerald-50/80 dark:bg-emerald-400/[0.06] border border-emerald-100 dark:border-emerald-400/15 p-4 flex flex-col justify-center">
          <p className="font-script text-lg text-[#1B5A38] dark:text-[#3FCE85] leading-snug">"Transparent today, more tomorrow."</p>
        </div>
        <div className="flex flex-col items-end justify-center gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-full p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  period === p.value && !selectedDate ? 'bg-[#0F2417] dark:bg-[#2E9E5B] text-white' : 'text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white'
                }`}
                data-testid={`period-${p.value}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 ${selectedDate ? 'bg-[#0F2417] border-[#0F2417] dark:bg-[#2E9E5B] dark:border-[#2E9E5B]' : 'bg-white border-slate-200 dark:bg-white/[0.04] dark:border-white/10'}`}>
              <CalendarDays className={`w-4 h-4 ${selectedDate ? 'text-white' : 'text-slate-500 dark:text-white/50'}`} />
              <Input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={handleDateChange}
                className={`h-7 border-0 p-0 text-sm font-medium w-36 focus-visible:ring-0 bg-transparent ${selectedDate ? 'text-white' : 'text-slate-800 dark:text-white'}`}
                data-testid="wallet-date-picker"
              />
            </div>
            <Button onClick={fetchSummary} variant="outline" className="h-10 rounded-xl gap-2" data-testid="wallet-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Date indicator */}
      {selectedDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 mb-4">
          Showing report for <span className="font-semibold">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <button onClick={() => { setSelectedDate(''); setPeriod('today'); }} className="ml-2 text-xs underline text-blue-600 hover:text-blue-800">Clear</button>
        </div>
      )}

      {/* Summary Cards — reference tile style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#191F1B] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4" data-testid={`wallet-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-white/45">{card.label}</p>
                <p className="text-xl font-bold font-numbers text-slate-900 dark:text-white">₹{card.value.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Opening Cash & Counter Balance */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">Opening Cash</p>
              <p className="text-xl font-bold text-amber-800">₹{(currentSession?.opening_cash || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-900 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-300 font-medium">Counter Balance</p>
              <p className="text-xl font-bold">₹{((currentSession?.opening_cash || 0) + summary.total_cash).toFixed(2)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Opening + Cash Sales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Net Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-8 h-8 opacity-70" />
            <div>
              <p className="text-xs opacity-70">Total Refunds</p>
              <p className="text-xl font-bold">₹{summary.total_refunds.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-black p-4 text-white">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="w-8 h-8 opacity-70" />
            <div>
              <p className="text-xs opacity-70">Net Amount</p>
              <p className="text-xl font-bold">₹{summary.net_amount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Recent Transactions</h2>
        </div>
        {summary.transactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {summary.transactions.map((txn) => (
              <div key={txn.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    txn.transaction_type === 'sale' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {txn.transaction_type === 'sale' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{txn.transaction_type}</p>
                    <p className="text-xs text-slate-400">{new Date(txn.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${txn.transaction_type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.transaction_type === 'sale' ? '+' : '-'}₹{txn.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">{txn.payment_method}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <Banknote className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No transactions for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
