import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
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
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('register'); // 'register' | 'otp'
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/register`, { name, email, password });
      setStep('otp');
      toast.success('OTP sent! Check your email.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setVerifying(true);
    try {
      const res = await axios.post(`${API}/api/auth/verify-email`, { email, otp: otpValue });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Email verified! Welcome to DineDesk 🎉');
      setTimeout(() => navigate('/pos'), 1000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await axios.post(`${API}/api/auth/resend-verification`, { email });
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
      toast.success('New OTP sent! Check your email.');
    } catch (err) {
      toast.error('Could not resend. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="register-page">
      {/* LEFT */}
      <div className="relative lg:w-[60%] bg-black text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/[0.03] rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">DineDesk</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Smart Restaurant POS Built for Speed and Simplicity
          </h1>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
            DineDesk helps restaurants manage orders, menus, inventory, and online deliveries from one powerful dashboard.
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

      {/* RIGHT */}
      <div className="lg:w-[40%] bg-white flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-sm">
          {step === 'otp' ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Verify your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                We sent a 6-digit code to <span className="font-semibold text-gray-700">{email}</span>. Enter it below to activate your account.
              </p>

              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputsRef.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full h-11 rounded-xl bg-black hover:bg-gray-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mb-3"
              >
                {verifying ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Verify & Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:border-black hover:text-black transition-colors disabled:opacity-60"
              >
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>

              <p className="text-xs text-gray-400 mt-4">Code expires in 10 minutes</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h2>
                <p className="text-sm text-gray-500">Start managing your restaurant today.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Restaurant Owner Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                      className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                      className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password"
                      className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                      required />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-black hover:bg-gray-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mt-1"
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
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-gray-400 font-medium uppercase">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <Link
                to="/login"
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:border-black hover:text-black transition-colors"
              >
                Sign In to Existing Account
              </Link>
            </div>
          )}
          <p className="text-center text-[11px] text-gray-400 mt-5">
            By creating an account, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
