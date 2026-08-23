import React, { useState, useEffect } from 'react';
import api, { storeAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Users, Package, MessageCircle, Building2, BarChart3,
  Code2, Palette, Gift, Check, X, Zap, Star, Crown,
  ShoppingCart, Sparkles
} from 'lucide-react';

const ICON_MAP = {
  Users, Package, MessageCircle, Building2, BarChart3, Code2, Palette, Gift
};

export default function StorePage() {
  const [addons, setAddons] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [addonsRes, subRes] = await Promise.all([
        storeAPI.getAddons(),
        storeAPI.getSubscription(),
      ]);
      setAddons(addonsRes.data);
      setSubscription(subRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (addonId) => {
    try {
      const res = await storeAPI.subscribe(addonId, billing);
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleUnsubscribe = async (addonId) => {
    try {
      const res = await storeAPI.unsubscribe(addonId);
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const activeAddons = subscription?.active_addons || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-dd-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-dd-blue via-blue-900 to-indigo-900 rounded-card p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-dd-saffron" />
            <span className="text-sm text-blue-200 font-medium">DineDesk Store</span>
          </div>
          <h1 className="text-3xl font-heading font-bold mb-2">Grow Your Restaurant</h1>
          <p className="text-blue-200 max-w-lg text-sm">
            Add powerful features to your POS. Start with the base plan and unlock add-ons as you grow.
            All add-ons can be activated instantly with prorated billing.
          </p>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-gray-900">Available Add-ons</h2>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-pill">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 rounded-pill text-sm font-semibold transition-all ${
              billing === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-1.5 rounded-pill text-sm font-semibold transition-all ${
              billing === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Annual <span className="text-dd-success text-xs">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Add-on Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {addons.map(addon => {
          const Icon = ICON_MAP[addon.icon] || Package;
          const isActive = activeAddons.includes(addon.id);
          const price = billing === 'monthly' ? addon.monthly_price : Math.round(addon.annual_price / 12);

          return (
            <Card key={addon.id} className={`relative transition-all hover:shadow-card-hover ${isActive ? 'border-dd-blue ring-1 ring-dd-blue/20' : 'border-dd-border'}`}>
              {isActive && (
                <div className="absolute -top-2 right-3 bg-dd-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-pill flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-card flex items-center justify-center ${isActive ? 'bg-dd-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading font-bold text-gray-900">{addon.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <span className="text-2xl font-bold font-numbers text-gray-900">₹{price.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 ml-1">/month</span>
                    {billing === 'annual' && (
                      <p className="text-[10px] text-dd-success font-medium">₹{addon.annual_price.toLocaleString()}/year</p>
                    )}
                  </div>
                  {isActive ? (
                    <Button
                      onClick={() => handleUnsubscribe(addon.id)}
                      variant="outline"
                      className="rounded-btn text-xs border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(addon.id)}
                      className="dd-btn-primary text-xs gap-1"
                    >
                      <Zap className="w-3 h-3" /> Add
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Base Features (always included) */}
      <Card className="border-dd-border">
        <CardContent className="p-5">
          <h3 className="font-heading font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-dd-saffron" /> Always Included (Base Plan)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['POS Billing', 'Table Management', 'Menu Management', 'KOT Display', 'Basic Reports', 'Day Session', 'Staff Roles', 'Receipt Printing'].map(feature => (
              <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="w-4 h-4 text-dd-success flex-shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
