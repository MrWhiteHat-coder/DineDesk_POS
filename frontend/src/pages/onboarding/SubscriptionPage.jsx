import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscriptionAPI, restaurantAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  UtensilsCrossed,
  Check,
  CreditCard,
  Shield,
  Zap,
  BarChart3,
  Package,
  Users,
  Globe,
} from 'lucide-react';

const features = [
  { icon: Zap, text: 'POS Billing System' },
  { icon: UtensilsCrossed, text: 'Menu Management' },
  { icon: CreditCard, text: 'Order Management' },
  { icon: Globe, text: 'Online Order Integration' },
  { icon: Package, text: 'Inventory Tracking' },
  { icon: BarChart3, text: 'Analytics Dashboard' },
  { icon: Users, text: 'Staff Management' },
  { icon: Shield, text: 'Secure & Reliable' },
];

export default function SubscriptionPage() {
  const { restaurant, updateRestaurant } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!restaurant?.id) {
      toast.error('Restaurant not found. Please complete setup first.');
      navigate('/onboarding');
      return;
    }

    setLoading(true);
    try {
      // Mock Razorpay payment
      toast.info('Processing payment...', { duration: 2000 });
      
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await subscriptionAPI.create({
        restaurant_id: restaurant.id,
        payment_method: 'mock_razorpay',
      });

      // Refresh restaurant data
      const restaurantRes = await restaurantAPI.getMy();
      updateRestaurant(restaurantRes.data);

      toast.success('Subscription activated! Welcome to FoodFlow POS!');
      navigate('/pos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/30">
            <UtensilsCrossed className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">
            Activate Your POS
          </h1>
          <p className="text-slate-500">One simple plan for all your needs</p>
        </div>

        {/* Subscription Card */}
        <Card className="border-2 border-orange-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Restaurant POS Plan</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-numbers text-4xl font-bold">₹2,999</span>
                  <span className="text-orange-100">/year</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <CreditCard className="w-8 h-8" />
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <p className="text-slate-600 mb-6">Everything you need to run your restaurant efficiently:</p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="text-sm text-slate-700">{feature.text}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg"
              data-testid="subscribe-btn"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing Payment...
                </div>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pay ₹2,999 with Razorpay
                </>
              )}
            </Button>

            <p className="text-center text-xs text-slate-400 mt-4">
              Secure payment powered by Razorpay (Mock Demo)
            </p>
          </CardContent>
        </Card>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <div className="flex items-center gap-2 text-slate-400">
            <Shield className="w-4 h-4" />
            <span className="text-xs">256-bit SSL</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Check className="w-4 h-4" />
            <span className="text-xs">Cancel Anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
