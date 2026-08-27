import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import {
  Mail, Lock, ArrowRight, Zap, Globe, UtensilsCrossed, BarChart3, Package,
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'Lightning POS', desc: '3-click order placement. Touch-optimized. Works offline.' },
  { icon: Globe, title: 'Online Orders', desc: 'Swiggy & Zomato integrated directly into your dashboard.' },
  { icon: UtensilsCrossed, title: 'Menu Management', desc: 'Categories, variants, images, pricing — all in one place.' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Sales trends, peak hours, top dishes — updated live.' },
  { icon: Package, title: 'Inventory & CRM', desc: 'Stock alerts, customer loyalty, Trident Coins, Gift Cards.' },
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
      <div className="relative lg:w-[60%] bg-yellow-400 text-neutral-900 p-8 sm:p-12 lg:p-16 flex flex-col justify-center overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/[0.03] rounded-full translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight">DineDesk</span>
              <p className="text-[10px] text-white/40 -mt-0.5">by Trident Ventures</p>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading-xl font-black leading-tight mb-4">
            Absorbs chaos.<br />Serves calm.
          </h1>
          <p className="text-white/50 text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
            Restaurant POS + CRM + Loyalty + Gift Cards — built for teams that refuse to compromise.
          </p>

          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/[0.05] backdrop-blur-sm rounded-xl p-3.5 border border-white/[0.08] hover:bg-white/[0.08] transition-colors">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5">{f.title}</h3>
                  <p className="text-[12px] text-white/50 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Auth Panel */}
      <div className="lg:w-[40%] bg-white flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-heading font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-500">Sign in to your DineDesk dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                    required data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                    required data-testid="login-password-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-dd-blue hover:bg-dd-blue-light text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-blue"
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
              <a href="#" className="text-xs text-gray-400 hover:text-black transition-colors">Forgot Password?</a>
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] text-gray-400 font-medium uppercase">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <Link
              to="/register"
              className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:border-dd-blue hover:text-dd-blue transition-colors"
              data-testid="register-link"
            >
              Create New Account
            </Link>

            <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Demo Access</p>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-700">Admin Login</p>
                    <p className="text-gray-400">admin@ordernest.com</p>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">admin123</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-700">Restaurant Owner</p>
                    <p className="text-gray-400">demo@restaurant.com</p>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">demo123456</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-5">
            By signing in, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
