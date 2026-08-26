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
      toast.success('Welcome back.');
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-white" data-testid="login-page">
      <div className="relative lg:w-[56%] dd-atmosphere text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center overflow-hidden">
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute bottom-10 left-8 w-28 h-28 rounded-full bg-white/10" />

        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          <BrandMark tone="light" size={44} className="mb-10" />

          <p className="text-white/80 text-[11px] tracking-[0.22em] uppercase font-bold mb-4">
            Restaurant POS
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[50px] font-display font-bold leading-[1.08] mb-5">
            Order. Serve.<br />Collect.
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
            The restaurant till that keeps the floor, kitchen, and back office on one board.
          </p>

          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/12 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
                <div className="w-9 h-9 rounded-xl bg-white text-[#E23744] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-0.5">{f.title}</h3>
                  <p className="text-[12px] text-white/75 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:w-[44%] bg-white flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl border border-[#E8E8E8] p-7 sm:p-8 shadow-card">
            <div className="mb-6">
              <h2 className="text-[26px] font-display font-bold text-[#1C1C1C] mb-1">Welcome back</h2>
              <p className="text-sm text-[#696969]">Sign in to your DineDesk floor.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#696969] mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C9C9C]" />
                  <Input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-11 rounded-xl bg-[#F8F8F8] border-[#E8E8E8] text-sm"
                    required data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#696969] mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C9C9C]" />
                  <Input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 h-11 rounded-xl bg-[#F8F8F8] border-[#E8E8E8] text-sm"
                    required data-testid="login-password-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#E23744] hover:bg-[#CB202D] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-blue"
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
              <a href="#" className="text-xs text-[#9C9C9C] hover:text-[#E23744] transition-colors">Forgot Password?</a>
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#E8E8E8]" />
              <span className="text-[11px] text-[#9C9C9C] font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-[#E8E8E8]" />
            </div>

            <Link
              to="/register"
              className="w-full h-11 rounded-xl border border-[#E8E8E8] text-[#1C1C1C] font-bold text-sm flex items-center justify-center gap-2 hover:border-[#E23744] hover:text-[#E23744] transition-colors"
              data-testid="register-link"
            >
              Create New Account
            </Link>

            <div className="mt-6 bg-[#FFF5F6] rounded-2xl p-4 border border-[#F8D7DA]">
              <p className="text-[11px] font-bold text-[#E23744] mb-2 uppercase tracking-wider">Demo Access</p>
              <div className="space-y-1.5 text-xs text-[#696969]">
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-[#E8E8E8]">
                  <div>
                    <p className="font-bold text-[#1C1C1C]">Admin Login</p>
                    <p className="text-[#9C9C9C]">admin@ordernest.com</p>
                  </div>
                  <span className="text-[10px] bg-[#FFF5F6] text-[#E23744] px-2 py-0.5 rounded-full font-bold">admin123</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-[#E8E8E8]">
                  <div>
                    <p className="font-bold text-[#1C1C1C]">Restaurant Owner</p>
                    <p className="text-[#9C9C9C]">demo@restaurant.com</p>
                  </div>
                  <span className="text-[10px] bg-[#E23744] text-white px-2 py-0.5 rounded-full font-bold">demo123456</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-[#9C9C9C] mt-5">
            By signing in, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
