import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authAPI } from '../../lib/api';
import { useAuth, getPostAuthPath } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/input';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import {
  Mail, Lock, ArrowRight, User, Phone, Shield, Zap, Globe, UtensilsCrossed,
  BarChart3, Package, ChevronLeft, RefreshCw,
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'Fast POS Billing', desc: 'Process restaurant orders quickly with an intuitive POS interface.' },
  { icon: Globe, title: 'Online Order Integration', desc: 'Manage delivery orders from Swiggy and Zomato directly inside the POS.' },
  { icon: UtensilsCrossed, title: 'Smart Menu Management', desc: 'Add, edit, and organize menu items with images, categories, and pricing.' },
  { icon: BarChart3, title: 'Daily Sales Insights', desc: 'Track daily revenue, orders, and top-selling dishes with real-time analytics.' },
  { icon: Package, title: 'Inventory Tracking', desc: 'Monitor ingredient stock levels and receive low-stock alerts.' },
];

export default function RegisterPage() {
  // Must come from the build environment (Vercel). No hard-coded fallback:
  // without an explicit client id the shared button shows "not configured".
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, googleLogin } = useAuth();
  const [step, setStep] = useState('register'); // 'register' | 'otp' | 'check-email'
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  // Busy only while the Google credential is actually being exchanged with the
  // backend. A cancelled popup never sets it, so no indefinite spinner.
  const [googleBusy, setGoogleBusy] = useState(false);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const otpRefs = useRef([]);

  // Called by the shared Google button once the popup returns a credential.
  const handleGoogleCredential = async (credential) => {
    if (googleBusy) return; // ignore duplicate callbacks while exchanging
    setGoogleBusy(true);
    try {
      const { user: userData, restaurant: restaurantData } = await googleLogin(credential);
      toast.success('Welcome to DineDesk! Signed in with Google.');
      // Admins (including via signup) → /admin. Everyone else follows the
      // standard onboarding / subscription / POS routing.
      navigate(getPostAuthPath(userData, restaurantData));
    } catch (err) {
      // Keep the failure visible on the page instead of forcing a reload —
      // the api layer no longer redirects anonymous 401s.
      toast.error(err.response?.data?.detail || 'Google sign-up failed. Please try again.');
    } finally {
      setGoogleBusy(false);
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
      // Use AuthContext.register so the in-memory user state is updated too.
      // Without this, ProtectedRoute still thinks we're logged out and sends
      // the user straight back to /login after a successful signup.
      const user = await register(name, email, password, formattedPhone);
      if (user) {
        // Auto-login mode (email verification not required) — straight to onboarding
        toast.success(`Welcome to DineDesk, ${user.name}! 🎉`);
        navigate('/onboarding');
      } else {
        // Verification mode — email link sent, show check-email screen
        setStep('check-email');
        toast.success('Account created! We sent a verification link to your email.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Registration failed';
      toast.error(detail);
      if (typeof detail === 'string' && detail.toLowerCase().includes('already registered')) {
        setTimeout(() => navigate('/login'), 1800);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (phoneNum) => {
    setOtpSending(true);
    try {
      await authAPI.sendOTP(phoneNum || phone);
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
      await authAPI.verifyOTP(formattedPhone, otpValue);
      setPhoneVerified(true);
      toast.success('Phone verified! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
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
      await authAPI.resendVerification(email);
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

              <Link
                to="/login"
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:border-black hover:text-black transition-colors mt-4"
              >
                Skip for now — I'll verify later
              </Link>
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

              {/* Google Sign-Up — shared official button (no One Tap / hidden-container clicks) */}
              <GoogleSignInButton
                clientId={GOOGLE_CLIENT_ID}
                onSuccess={handleGoogleCredential}
                onError={(message) => toast.error(message)}
                disabled={googleBusy}
              />
              {googleBusy && (
                <div className="flex items-center justify-center gap-2 mt-2" data-testid="google-busy">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  <span className="text-xs text-gray-500">Creating your account with Google…</span>
                </div>
              )}

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
