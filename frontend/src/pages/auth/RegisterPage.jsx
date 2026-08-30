import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { authAPI } from '../../lib/api';
import { Input } from '../../components/ui/input';
import {
  Mail, Lock, ArrowRight, User, Phone, Shield, Zap, Globe, UtensilsCrossed,
  BarChart3, Package, ChevronLeft, RefreshCw,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'https://dinedesk-rft1.onrender.com';
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

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
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('register'); // 'register' | 'otp' | 'check-email'
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const otpRefs = useRef([]);

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google) return;
    const timer = setTimeout(() => {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
      } catch (e) { console.error('Google init error:', e); }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleResponse = async (response) => {
    setGoogleLoading(true);
    try {
      const res = await authAPI.googleLogin(response.credential);
      const { access_token, user: userData } = res.data;
      sessionStorage.setItem('token', access_token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      toast.success('Account created with Google!');
      if (!userData.restaurant_id) navigate('/onboarding');
      else navigate('/pos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Google sign-up failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google sign-up is not configured yet.');
      return;
    }
    setGoogleLoading(true);
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-btn-register'),
            { theme: 'outline', size: 'large', width: '100%', text: 'continue_with' }
          );
          document.getElementById('google-signin-btn-register')?.click();
        }
        setGoogleLoading(false);
      });
    } catch (e) {
      setGoogleLoading(false);
      toast.error('Google sign-up failed to initialize.');
    }
  };

  // OTP countdown timer
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const formatPhone = (val) => {
    // Auto-format: ensure + prefix and digits only
    let cleaned = val.replace(/[^+\d]/g, '');
    if (!cleaned.startsWith('+')) cleaned = '+91' + cleaned.replace(/^\+?91/, '');
    return cleaned;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (!phone.trim()) { toast.error('Phone number is required'); return; }

    const formattedPhone = formatPhone(phone);
    if (formattedPhone.length < 12) { toast.error('Please enter a valid phone number with country code'); return; }

    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/register`, { name, email, password, phone: formattedPhone });
      // Registration succeeded — now send OTP for phone verification
      await sendOTP(formattedPhone);
      setStep('otp');
      toast.success('Account created! Verify your phone number to continue.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (phoneNum) => {
    setOtpSending(true);
    try {
      await axios.post(`${API}/api/auth/send-otp`, { phone: phoneNum || phone });
      setOtpTimer(60); // 60s cooldown
      toast.success('OTP sent! Check your phone.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1); // Only last char
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (newOtp.every((d) => d !== '')) {
      verifyOTP(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      otpRefs.current[5]?.focus();
      verifyOTP(pasted);
    }
  };

  const verifyOTP = async (otpValue) => {
    setOtpVerifying(true);
    try {
      const formattedPhone = formatPhone(phone);
      await axios.post(`${API}/api/auth/verify-otp`, { phone: formattedPhone, otp: otpValue });
      setPhoneVerified(true);
      setStep('check-email');
      toast.success('Phone number verified!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpVerifying(false);
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

          {/* STEP: Check Email */}
          {step === 'check-email' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                We sent a verification link to <span className="font-semibold text-gray-700">{email}</span>. Click it to activate your account, then sign in.
              </p>

              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:border-black hover:text-black transition-colors disabled:opacity-60 mb-3"
              >
                {resending ? 'Sending...' : 'Resend Email'}
              </button>

              <Link
                to="/login"
                className="w-full h-11 rounded-xl bg-black hover:bg-gray-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="text-xs text-gray-400 mt-4">Link expires in 24 hours</p>
            </div>
          )}

          {/* STEP: OTP Verification */}
          {step === 'otp' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8">
              <button
                onClick={() => setStep('register')}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Verify your phone</h2>
                <p className="text-sm text-gray-500">
                  Enter the 6-digit code sent to <span className="font-semibold text-gray-700">{phone}</span>
                </p>
              </div>

              {/* OTP Input */}
              <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-black focus:ring-0 outline-none transition-colors bg-gray-50"
                    disabled={otpVerifying}
                  />
                ))}
              </div>

              {otpVerifying && (
                <p className="text-center text-sm text-gray-500 mb-4">Verifying...</p>
              )}

              {/* Resend OTP */}
              <div className="text-center">
                {otpTimer > 0 ? (
                  <p className="text-sm text-gray-400">
                    Resend OTP in <span className="font-semibold text-gray-600">{otpTimer}s</span>
                  </p>
                ) : (
                  <button
                    onClick={() => sendOTP(formatPhone(phone))}
                    disabled={otpSending}
                    className="inline-flex items-center gap-1.5 text-sm text-black font-semibold hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${otpSending ? 'animate-spin' : ''}`} />
                    Resend OTP
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center mt-4">Didn't receive the code? Check your spam folder or try again.</p>
            </div>
          )}

          {/* STEP: Register Form */}
          {step === 'register' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h2>
                <p className="text-sm text-gray-500">Start managing your restaurant today.</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-3.5">
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
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 text-sm focus-visible:ring-black focus-visible:border-black"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Include country code (e.g. +91 for India)</p>
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

              {/* Google Sign-Up */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={googleLoading}
                className="w-full h-11 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-60"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
              <div id="google-signin-btn-register" className="hidden" />

              <Link
                to="/login"
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:border-black hover:text-black transition-colors mt-3"
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
