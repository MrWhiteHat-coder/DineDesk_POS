import React, { useState, useEffect, useMemo } from 'react';
import api, { customerCRM_API, coinsAPI, sevaAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  Coins, TrendingUp, ArrowUpRight, ArrowDownRight, Gift,
  Heart, Smartphone, Search, Users, Crown, Award, Star,
  Zap, Clock
} from 'lucide-react';

const TXN_ICONS = {
  earn: { icon: TrendingUp, color: 'text-dd-success', bg: 'bg-emerald-50' },
  redeem: { icon: ArrowDownRight, color: 'text-dd-blue', bg: 'bg-blue-50' },
  topup: { icon: Smartphone, color: 'text-dd-saffron-dark', bg: 'bg-amber-50' },
  donate: { icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50' },
  bonus: { icon: Gift, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const COIN_VALUE = 0.20; // 1 coin = ₹0.20

export default function TridentCoinsPage() {
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [sevaStats, setSevaStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showTopup, setShowTopup] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [donateCoins, setDonateCoins] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [custRes, txnRes, sevaRes] = await Promise.all([
        customerCRM_API.getAll(),
        coinsAPI.getTransactions(),
        sevaAPI.getStats(),
      ]);
      setCustomers(custRes.data);
      setTransactions(txnRes.data);
      setSevaStats(sevaRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    if (!selectedCustomer || !topupAmount) return;
    try {
      const res = await coinsAPI.topup({
        customer_id: selectedCustomer.id,
        amount_inr: parseFloat(topupAmount)
      });
      toast.success(res.data.message);
      setShowTopup(false);
      setTopupAmount('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleDonate = async () => {
    if (!selectedCustomer || !donateCoins) return;
    try {
      const res = await coinsAPI.donate({
        customer_id: selectedCustomer.id,
        coins: parseInt(donateCoins)
      });
      toast.success(res.data.message);
      setShowDonate(false);
      setDonateCoins('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [customers, search]);

  const totalCoinsIssued = customers.reduce((s, c) => s + (c.loyalty_points || 0), 0);
  const totalLiability = totalCoinsIssued * COIN_VALUE;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-dd-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
          <Coins className="w-6 h-6 text-dd-saffron" /> Trident Coins Wallet
        </h1>
        <p className="text-sm text-gray-500">100 Trident Coins = ₹20 value · Earn, redeem, and donate</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-dd-blue to-blue-800 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-200">Total Coins Issued</p>
              <Coins className="w-5 h-5 text-dd-saffron" />
            </div>
            <p className="text-3xl font-bold font-numbers">{totalCoinsIssued.toLocaleString()}</p>
            <p className="text-[10px] text-blue-300 mt-1">Liability: ₹{totalLiability.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Active Customers</p>
            <p className="text-3xl font-bold font-numbers text-gray-900">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Transactions</p>
            <p className="text-3xl font-bold font-numbers text-gray-900">{transactions.length}</p>
          </CardContent>
        </Card>
        {sevaStats && (
          <Card className="border-pink-200 bg-pink-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-1 mb-1">
                <Heart className="w-4 h-4 text-pink-500" />
                <p className="text-sm text-pink-700">Seva Impact</p>
              </div>
              <p className="text-2xl font-bold font-numbers text-pink-800">{sevaStats.meals_funded || 0} meals</p>
              <p className="text-[10px] text-pink-600">{sevaStats.coins_donated || 0} coins donated</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Value Guide */}
      <div className="bg-gradient-to-r from-dd-blue/5 to-dd-saffron/5 rounded-card p-4 border border-dd-border">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-dd-saffron" />
            <span className="font-semibold">100 Coins</span>
            <span className="text-gray-400">=</span>
            <span className="font-bold text-dd-blue">₹20</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-dd-saffron" />
            <span>Earn: ₹1000 bill = 10 coins</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-dd-blue" />
            <span>Top-up: 3% fee</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 dd-input" />
      </div>

      {/* Customer Wallets */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="trident-watermark">
            <CardContent className="p-12 text-center">
              <Coins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No customers yet</p>
              <p className="text-sm text-gray-400 mt-1">Add customers to start the Trident Coins loyalty program</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(customer => {
            const tier = customer.tier || 'silver';
            const TierIcon = tier === 'platinum' ? Crown : tier === 'gold' ? Star : Award;
            return (
              <div key={customer.id} className="flex items-center gap-4 p-4 bg-white rounded-card border border-dd-border hover:shadow-card-hover transition-all">
                <div className="w-11 h-11 bg-dd-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{customer.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{customer.name}</span>
                    <span className={`dd-badge ${tier === 'platinum' ? 'bg-purple-50 text-purple-700' : tier === 'gold' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      <TierIcon className="w-3 h-3 mr-0.5" /> {tier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{customer.phone}</p>
                </div>
                <div className="text-right mr-2">
                  <div className="flex items-center gap-1 justify-end text-dd-saffron-dark font-bold">
                    <Coins className="w-4 h-4" />
                    <span className="font-numbers text-lg">{(customer.loyalty_points || 0).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">≈ ₹{((customer.loyalty_points || 0) * COIN_VALUE).toFixed(0)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setSelectedCustomer(customer); setShowTopup(true); }}
                    className="p-2 rounded-lg bg-blue-50 text-dd-blue hover:bg-blue-100 transition-colors"
                    title="Top up"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setSelectedCustomer(customer); setShowDonate(true); }}
                    className="p-2 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
                    title="Donate to Seva"
                  >
                    <Heart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div>
          <h3 className="font-heading font-bold text-gray-900 mb-3">Recent Transactions</h3>
          <div className="space-y-1.5">
            {transactions.slice(0, 10).map(txn => {
              const cfg = TXN_ICONS[txn.type] || TXN_ICONS.earn;
              const Icon = cfg.icon;
              const cust = customers.find(c => c.id === txn.customer_id);
              return (
                <div key={txn.id} className="flex items-center gap-3 p-3 bg-white rounded-card border border-dd-border">
                  <div className={`w-9 h-9 ${cfg.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{txn.description}</p>
                    <p className="text-xs text-gray-400">{cust?.name || 'Customer'} · {new Date(txn.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`font-bold font-numbers text-sm ${txn.type === 'earn' || txn.type === 'topup' ? 'text-dd-success' : txn.type === 'donate' ? 'text-pink-600' : 'text-dd-blue'}`}>
                    {txn.type === 'redeem' || txn.type === 'donate' ? '-' : '+'}{txn.coins} coins
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top-up Dialog */}
      <Dialog open={showTopup} onOpenChange={setShowTopup}>
        <DialogContent className="rounded-modal max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Top Up Coins</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Top up {selectedCustomer?.name}'s wallet via UPI (3% convenience fee)
            </p>
            <div>
              <Label className="text-sm text-gray-600">Amount (₹)</Label>
              <Input type="number" placeholder="Enter amount" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="mt-1.5 dd-input" />
            </div>
            {topupAmount && (
              <div className="bg-blue-50 rounded-card p-3 text-sm">
                <p>Amount: ₹{parseFloat(topupAmount).toFixed(2)}</p>
                <p>Fee (3%): ₹{(parseFloat(topupAmount) * 0.03).toFixed(2)}</p>
                <p className="font-semibold text-dd-blue mt-1">
                  Coins: {Math.floor(((parseFloat(topupAmount) * 0.97) / 20) * 100)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTopup(false)} className="rounded-btn">Cancel</Button>
            <Button onClick={handleTopup} className="dd-btn-primary">Top Up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Donate Dialog */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="rounded-modal max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Donate to Seva 🙏</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Donate {selectedCustomer?.name}'s Trident Coins to feed the hungry
            </p>
            <div>
              <Label className="text-sm text-gray-600">Coins to Donate</Label>
              <Input type="number" placeholder="Enter coins" value={donateCoins} onChange={e => setDonateCoins(e.target.value)} className="mt-1.5 dd-input" />
            </div>
            {donateCoins && (
              <div className="bg-pink-50 rounded-card p-3 border border-pink-200">
                <p className="text-sm text-pink-700">
                  ❤️ {donateCoins} coins = ₹{(parseInt(donateCoins) * COIN_VALUE).toFixed(0)} donation
                </p>
                <p className="text-xs text-pink-600 mt-1">≈ {Math.floor((parseInt(donateCoins) * COIN_VALUE) / 50)} meals funded</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDonate(false)} className="rounded-btn">Cancel</Button>
            <Button onClick={handleDonate} className="bg-pink-600 text-white hover:bg-pink-700 rounded-btn gap-2">
              <Heart className="w-4 h-4" /> Donate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
