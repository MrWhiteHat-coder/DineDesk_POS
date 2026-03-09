import React, { useState, useEffect } from 'react';
import { walletAPI } from '../../lib/api';
import { toast } from 'sonner';
import {
  Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw,
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

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await walletAPI.getSummary(period);
      setSummary(res.data);
    } catch (err) {
      console.error('Wallet error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, [period]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-xl font-bold text-slate-900">Wallet & Reconciliation</h1>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p.value ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
          <Button onClick={fetchSummary} variant="outline" className="h-9 rounded-lg gap-2" data-testid="wallet-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

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
        <div className="rounded-xl border border-slate-300 bg-slate-800 p-4 text-white">
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
            <p className="text-sm">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
