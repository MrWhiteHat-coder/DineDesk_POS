import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import BrandMark from '../../components/brand/BrandMark';
import {
  Mail, Lock, ArrowRight, User, Zap, Globe, UtensilsCrossed, BarChart3, Package,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'https://dinedesk-rft1.onrender.com';

const features = [
  { icon: Zap, title: 'Fast POS Billing', desc: 'Process restaurant orders quickly with an intuitive POS interface.' },
  { icon: Globe, title: 'Online Order Integration', desc: 'Manage delivery orders from Swiggy and Zomato directly inside the POS.' },
  { icon: UtensilsCrossed, title: 'Smart Menu Management', desc: 'Add, edit, and organize menu items with images, categories, and pricing.' },
  { icon: BarChart3, title: 'Daily Sales Insights', desc: 'Track daily revenue, orders, and top-selling dishes with real-time analytics.' },
  { icon: Package, title: 'Inventory Tracking', desc: 'Monitor ingredient stock levels and receive low-stock alerts.' },
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('register');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/register`, { name, email, password });
      setStep('check-email');
      toast.success('Check your email to verify your account.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await axios.post(`${API}/api/auth/resend-verification`, { email });
      toast.success('Verification email sent! Check your inbox.');
    } catch (err) {
      toast.error('Could not resend. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="register-page">
      <div className="relative lg:w-[58%] dd-atmosphere text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center overflow-hidden dd-grain">
        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          <BrandMark tone="light" size={44} className="mb-10" />
          <p className="text-saffron text-[11px] tracking-[0.22em] uppercase font-semibold mb-4">
            Open your floor
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-display font-semibold leading-[1.1] mb-4">
            Smart restaurant POS, built for speed and calm.
          </h1>
          <p className="text-white/55 text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
            DineDesk helps restaurants manage orders, menus, inventory, and online deliveries from one board.
          </p>
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/[0.05] backdrop-blur-sm rounded-2xl p-3.5 border border-white/[0.08]">
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
          {step === 'check-email' ? (
            <div className="bg-plate rounded-3xl border border-line p-7 sm:p-8 text-center shadow-card">
              <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-display font-semibold text-ink mb-2">Check your email</h2>
              <p className="text-sm text-ink/50 mb-6">
                We sent a verification link to <span className="font-semibold text-ink">{email}</span>. Click it to activate your account, then sign in.
              </p>

              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-11 rounded-xl border border-line text-ink font-semibold text-sm hover:border-navy hover:text-navy transition-colors disabled:opacity-60 mb-3"
              >
                {resending ? 'Sending...' : 'Resend Email'}
              </button>

              <Link
                to="/login"
                className="w-full h-11 rounded-xl bg-ink hover:bg-ink-soft text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="text-xs text-ink/35 mt-4">Link expires in 24 hours</p>
            </div>
          ) : (
            <div className="bg-plate rounded-3xl border border-line p-7 sm:p-8 shadow-card">
              <div className="mb-6">
                <h2 className="text-[26px] font-display font-semibold text-ink mb-1">Create your account</h2>
                <p className="text-sm text-ink/50">Start managing your restaurant today.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Restaurant Owner Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                    <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                      className="pl-10 h-11 rounded-xl bg-linen/60 border-line text-sm"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="pl-10 h-11 rounded-xl bg-linen/60 border-line text-sm"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                      className="pl-10 h-11 rounded-xl bg-linen/60 border-line text-sm"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password"
                      className="pl-10 h-11 rounded-xl bg-linen/60 border-line text-sm"
                      required />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-ink hover:bg-ink-soft text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mt-1"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Create Account <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-line" />
                <span className="text-[11px] text-ink/35 font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <Link
                to="/login"
                className="w-full h-11 rounded-xl border border-line text-ink font-semibold text-sm flex items-center justify-center gap-2 hover:border-navy hover:text-navy transition-colors"
              >
                Sign In to Existing Account
              </Link>
            </div>
          )}
          <p className="text-center text-[11px] text-ink/35 mt-5">
            By creating an account, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
