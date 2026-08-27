import React, { useState, useEffect } from 'react';
import { walletAPI } from '../../lib/api';
import { Input } from '../../components/ui/input';
import {
  Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw, CalendarDays,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function WalletPage() {
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

  useEffect(() => { fetchSummary(); }, [period, selectedDate]);

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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
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
    <div data-testid="wallet-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="font-heading text-xl font-bold text-slate-900">Wallet & Reconciliation</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                period === p.value && !selectedDate ? 'bg-black text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
          <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 ${selectedDate ? 'bg-black border-black' : 'bg-white border-slate-200'}`}>
            <CalendarDays className={`w-4 h-4 ${selectedDate ? 'text-white' : 'text-slate-500'}`} />
            <Input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={handleDateChange}
              className={`h-7 border-0 p-0 text-sm font-medium w-36 focus-visible:ring-0 ${selectedDate ? 'text-white' : 'text-slate-800'}`}
              data-testid="wallet-date-picker"
            />
          </div>
          <Button onClick={fetchSummary} variant="outline" className="h-9 rounded-lg gap-2" data-testid="wallet-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Date indicator */}
      {selectedDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 mb-4">
          Showing report for <span className="font-semibold">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <button onClick={() => { setSelectedDate(''); setPeriod('today'); }} className="ml-2 text-xs underline text-blue-600 hover:text-blue-800">Clear</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.color}`} data-testid={`wallet-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center gap-3">
              <card.icon className="w-8 h-8 opacity-70" />
              <div>
                <p className="text-xs opacity-70">{card.label}</p>
                <p className="text-xl font-bold">₹{card.value.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
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
