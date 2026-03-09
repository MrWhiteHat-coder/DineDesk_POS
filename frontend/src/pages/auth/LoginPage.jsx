import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import {
  Mail, Lock, ArrowRight, Zap, Globe, UtensilsCrossed, BarChart3, Package,
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'Fast POS Billing', desc: 'Process restaurant orders quickly with an intuitive POS interface.' },
  { icon: Globe, title: 'Online Order Integration', desc: 'Manage delivery orders from Swiggy and Zomato directly inside the POS.' },
  { icon: UtensilsCrossed, title: 'Smart Menu Management', desc: 'Add, edit, and organize menu items with images, categories, and pricing.' },
  { icon: BarChart3, title: 'Daily Sales Insights', desc: 'Track daily revenue, orders, and top-selling dishes with real-time analytics.' },
  { icon: Package, title: 'Inventory Tracking', desc: 'Monitor ingredient stock levels and receive low-stock alerts.' },
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
      toast.success('Welcome back!');
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
      {/* LEFT — Product Presentation */}
      <div className="relative lg:w-[60%] bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Order Nest</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Smart Restaurant POS Built for Speed and Simplicity
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
            Order Nest helps restaurants manage orders, menus, inventory, and online deliveries from one powerful dashboard.
          </p>

          {/* Feature Cards - hidden on very small screens, visible from sm */}
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 hover:bg-white/15 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5">{f.title}</h3>
                  <p className="text-[12px] text-white/70 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Auth Panel */}
      <div className="lg:w-[40%] bg-slate-50 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Auth Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome to Order Nest</h2>
              <p className="text-sm text-slate-500">Sign in to manage your restaurant operations.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:ring-orange-500 focus-visible:border-orange-500"
                    required
                    data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:ring-orange-500 focus-visible:border-orange-500"
                    required
                    data-testid="login-password-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <a href="#" className="text-xs text-slate-400 hover:text-orange-500 transition-colors">Forgot Password?</a>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] text-slate-400 font-medium uppercase">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <Link
              to="/register"
              className="w-full h-11 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 hover:border-orange-300 hover:text-orange-600 transition-colors"
              data-testid="register-link"
            >
              Create New Account
            </Link>

            {/* Demo Credentials */}
            <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Demo Access</p>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <div>
                    <p className="font-semibold text-slate-700">Admin Login</p>
                    <p className="text-slate-400">admin@foodflow.com</p>
                  </div>
                  <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">admin123</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <div>
                    <p className="font-semibold text-slate-700">Restaurant Owner</p>
                    <p className="text-slate-400">demo@restaurant.com</p>
                  </div>
                  <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">demo123456</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-5">
            By signing in, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
