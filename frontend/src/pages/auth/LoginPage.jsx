import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import BrandMark from '../../components/brand/BrandMark';
import {
  Mail, Lock, ArrowRight, Zap, Globe, UtensilsCrossed, BarChart3, Package,
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'Lightning POS', desc: '3-click billing. Touch-first. Built for rush hour.' },
  { icon: Globe, title: 'Online Orders', desc: 'Swiggy & Zomato land on the same board as walk-ins.' },
  { icon: UtensilsCrossed, title: 'Menu & KDS', desc: 'Photos, variants, and a kitchen that never misses a ticket.' },
  { icon: BarChart3, title: 'Live Analytics', desc: 'Covers, peaks, and bestsellers — updated as you serve.' },
  { icon: Package, title: 'CRM & Loyalty', desc: 'Customers, Trident Coins, and gift cards in one till.' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Welcome back to the floor.');
      if (user.role === 'admin') navigate('/admin');
      else if (!user.restaurant_id) navigate('/onboarding');
      else navigate('/pos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="login-page">
      <div className="relative lg:w-[58%] dd-atmosphere text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center overflow-hidden dd-grain">
        <div className="absolute top-10 right-12 w-40 h-40 rounded-full border border-saffron/20" />
        <div className="absolute bottom-16 left-10 w-24 h-24 rounded-full border border-white/10" />

        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          <BrandMark tone="light" size={44} className="mb-10" />

          <p className="text-saffron text-[11px] tracking-[0.22em] uppercase font-semibold mb-4">
            Hospitality OS
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[52px] font-display font-semibold leading-[1.08] mb-5">
            Absorbs chaos.<br />Serves calm.
          </h1>
          <p className="text-white/55 text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
            The restaurant till that keeps the floor, kitchen, and back office on one linen-quiet board.
          </p>

          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/[0.05] backdrop-blur-sm rounded-2xl p-3.5 border border-white/[0.08] hover:bg-white/[0.08] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-saffron/15 text-saffron flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5 font-body">{f.title}</h3>
                  <p className="text-[12px] text-white/50 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:w-[42%] bg-linen flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="bg-plate rounded-3xl border border-line p-7 sm:p-8 shadow-card">
            <div className="mb-6">
              <h2 className="text-[26px] font-display font-semibold text-ink mb-1">Welcome back</h2>
              <p className="text-sm text-ink/50">Sign in to your DineDesk floor.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                  <Input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-11 rounded-xl bg-linen/60 border-line text-sm"
                    required data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                  <Input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 h-11 rounded-xl bg-linen/60 border-line text-sm"
                    required data-testid="login-password-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-ink hover:bg-ink-soft text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-ink"
                disabled={loading} data-testid="login-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <a href="#" className="text-xs text-ink/40 hover:text-navy transition-colors">Forgot Password?</a>
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-line" />
              <span className="text-[11px] text-ink/35 font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <Link
              to="/register"
              className="w-full h-11 rounded-xl border border-line text-ink font-semibold text-sm flex items-center justify-center gap-2 hover:border-navy hover:text-navy transition-colors"
              data-testid="register-link"
            >
              Create New Account
            </Link>

            <div className="mt-6 bg-linen rounded-2xl p-4 border border-line">
              <p className="text-[11px] font-semibold text-ink/45 mb-2 uppercase tracking-wider">Demo Access</p>
              <div className="space-y-1.5 text-xs text-ink/70">
                <div className="flex items-center justify-between bg-plate rounded-xl px-3 py-2 border border-line">
                  <div>
                    <p className="font-semibold text-ink">Admin Login</p>
                    <p className="text-ink/40">admin@ordernest.com</p>
                  </div>
                  <span className="text-[10px] bg-navy/10 text-navy px-2 py-0.5 rounded-full font-medium">admin123</span>
                </div>
                <div className="flex items-center justify-between bg-plate rounded-xl px-3 py-2 border border-line">
                  <div>
                    <p className="font-semibold text-ink">Restaurant Owner</p>
                    <p className="text-ink/40">demo@restaurant.com</p>
                  </div>
                  <span className="text-[10px] bg-saffron/20 text-ink px-2 py-0.5 rounded-full font-medium">demo123456</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-ink/35 mt-5">
            By signing in, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
