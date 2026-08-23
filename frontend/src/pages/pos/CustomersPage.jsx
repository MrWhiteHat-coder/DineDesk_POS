import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api, { customerCRM_API } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  Users, Search, Plus, Phone, Mail, Star, Crown,
  Award, Calendar, ShoppingCart, TrendingUp, Gift,
  ChevronRight, X, UserPlus, Coins
} from 'lucide-react';

const TIER_CONFIG = {
  silver: { label: 'Silver', icon: Award, color: 'bg-gray-100 text-gray-700', border: 'border-gray-200', min: 0 },
  gold: { label: 'Gold', icon: Star, color: 'bg-amber-50 text-amber-700', border: 'border-amber-200', min: 1000 },
  platinum: { label: 'Platinum', icon: Crown, color: 'bg-purple-50 text-purple-700', border: 'border-purple-200', min: 5000 },
};

export default function CustomersPage() {
  const { restaurant } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      const res = await customerCRM_API.getAll();
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      await customerCRM_API.create(newCustomer);
      toast.success('Customer added!');
      setShowAdd(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add customer');
    }
  };

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    if (tierFilter) list = list.filter(c => c.tier === tierFilter);
    return list;
  }, [customers, search, tierFilter]);

  const tierStats = useMemo(() => ({
    silver: customers.filter(c => c.tier === 'silver').length,
    gold: customers.filter(c => c.tier === 'gold').length,
    platinum: customers.filter(c => c.tier === 'platinum').length,
    total: customers.length,
  }), [customers]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-900">Customer CRM</h1>
          <p className="text-sm text-gray-500">Manage customers, loyalty tiers, and engagement</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="dd-btn-primary gap-2" data-testid="add-customer-btn">
          <UserPlus className="w-4 h-4" /> Add Customer
        </Button>
      </div>

      {/* Tier Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-dd-blue text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-200">Total Customers</p>
              <Users className="w-5 h-5 text-blue-200" />
            </div>
            <p className="text-3xl font-bold font-numbers">{tierStats.total}</p>
          </CardContent>
        </Card>
        {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className={`border ${cfg.border}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">{cfg.label} Members</p>
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-3xl font-bold font-numbers text-gray-900">{tierStats[key]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 dd-input"
          />
        </div>
        <div className="flex gap-1.5">
          {['', 'silver', 'gold', 'platinum'].map(tier => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-3 py-2 rounded-btn text-xs font-semibold transition-all ${
                tierFilter === tier ? 'bg-dd-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tier ? TIER_CONFIG[tier].label : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="trident-watermark">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No customers yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first customer to start building loyalty</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(customer => {
            const tierCfg = TIER_CONFIG[customer.tier] || TIER_CONFIG.silver;
            const TierIcon = tierCfg.icon;
            return (
              <div
                key={customer.id}
                className="flex items-center gap-4 p-4 bg-white rounded-card border border-dd-border hover:shadow-card-hover transition-all cursor-pointer"
                onClick={() => { setSelectedCustomer(customer); setShowDetail(true); }}
                data-testid={`customer-row-${customer.id}`}
              >
                <div className="w-11 h-11 bg-dd-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{customer.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{customer.name}</span>
                    <span className={`dd-badge ${tierCfg.color} flex items-center gap-1`}>
                      <TierIcon className="w-3 h-3" /> {tierCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>
                    {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-dd-saffron-dark font-bold text-sm">
                    <Coins className="w-4 h-4" />
                    {customer.loyalty_points?.toLocaleString() || 0}
                  </div>
                  <p className="text-[10px] text-gray-400">{customer.total_visits || 0} visits · ₹{(customer.total_spent || 0).toLocaleString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            );
          })
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="rounded-modal max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-gray-600 text-sm">Name *</Label>
              <Input
                value={newCustomer.name}
                onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                placeholder="Customer name"
                className="mt-1.5 dd-input"
              />
            </div>
            <div>
              <Label className="text-gray-600 text-sm">Phone *</Label>
              <Input
                value={newCustomer.phone}
                onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="mt-1.5 dd-input"
              />
            </div>
            <div>
              <Label className="text-gray-600 text-sm">Email</Label>
              <Input
                value={newCustomer.email}
                onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                className="mt-1.5 dd-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-btn">Cancel</Button>
            <Button onClick={handleAddCustomer} className="dd-btn-primary">Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="rounded-modal max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Customer Profile</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-dd-blue rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">{selectedCustomer.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedCustomer.name}</h3>
                  <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                  {selectedCustomer.email && <p className="text-xs text-gray-400">{selectedCustomer.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-dd-blue/5 rounded-card p-3 text-center">
                  <Coins className="w-5 h-5 text-dd-saffron mx-auto mb-1" />
                  <p className="text-xl font-bold font-numbers">{selectedCustomer.loyalty_points || 0}</p>
                  <p className="text-[10px] text-gray-500">Trident Coins</p>
                </div>
                <div className="bg-gray-50 rounded-card p-3 text-center">
                  <ShoppingCart className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-xl font-bold font-numbers">{selectedCustomer.total_visits || 0}</p>
                  <p className="text-[10px] text-gray-500">Total Visits</p>
                </div>
                <div className="bg-gray-50 rounded-card p-3 text-center">
                  <TrendingUp className="w-5 h-5 text-dd-success mx-auto mb-1" />
                  <p className="text-xl font-bold font-numbers">₹{(selectedCustomer.total_spent || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Total Spent</p>
                </div>
              </div>
              {selectedCustomer.allergies && (
                <div className="bg-amber-50 rounded-card p-3 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700">⚠️ Allergies</p>
                  <p className="text-sm text-amber-800 mt-1">{selectedCustomer.allergies}</p>
                </div>
              )}
              {selectedCustomer.preferences && (
                <div className="bg-blue-50 rounded-card p-3 border border-blue-200">
                  <p className="text-xs font-semibold text-dd-blue">Preferences</p>
                  <p className="text-sm text-gray-700 mt-1">{selectedCustomer.preferences}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
