import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { authAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/input';
import usePageMeta from '../../lib/usePageMeta';
import {
  Mail, Lock, ArrowRight, User, Phone, Shield, Zap, Globe, UtensilsCrossed,
  BarChart3, Package, ChevronLeft, RefreshCw, Moon, Sun,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import logoUrl from '../../assets/dinedesk-logo.png';

const features = [
  { icon: Zap, title: 'Fast POS Billing', desc: 'Process restaurant orders quickly with an intuitive POS interface.' },
  { icon: Globe, title: 'Online Order Integration', desc: 'Manage delivery orders from Swiggy and Zomato directly inside the POS.' },
  { icon: UtensilsCrossed, title: 'Smart Menu Management', desc: 'Add, edit, and organize menu items with images, categories, and pricing.' },
  { icon: BarChart3, title: 'Daily Sales Insights', desc: 'Track daily revenue, orders, and top-selling dishes with real-time analytics.' },
  { icon: Package, title: 'Inventory Tracking', desc: 'Monitor ingredient stock levels and receive low-stock alerts.' },
];

export default function RegisterPage() {
  usePageMeta({
    title: 'Create Your DineDesk Account — Restaurant POS from ₹999/month',
    noindex: false,
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState(routeState.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();
  const [step, setStep] = useState(routeState.step === 'otp' && routeState.email ? 'otp' : 'register');
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  // LoginPage can hand us an unverified email: /register {state:{step:'otp', email}}
  // jumps straight back into the verification step.
  const routeState = useLocation().state || {};
  const { dark, toggle } = useTheme();

  // Email OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpRefs = useRef([]);

  // Resend cooldown countdown
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const formatPhone = (val) => {
    if (!val.trim()) return '';
    let cleaned = val.replace(/[^\d]/g, '');
    if (cleaned.startsWith('91') && cleaned.length > 10) cleaned = cleaned.slice(2);
    return `+91${cleaned}`;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      // Step 1: create the account. With email delivery configured the backend
      // sends a 6-digit OTP and returns NO session — we move to the OTP step.
      // Self-host/dev without email: the account is auto-verified and a session
      // comes back immediately.
      const user = await register(name, email.trim().toLowerCase(), password, formatPhone(phone));
      if (user) {
        toast.success(`Welcome to DineDesk, ${user.name}! 🎉`);
        navigate('/onboarding');
      } else {
        setStep('otp');
        setOtpTimer(60);
        setOtp(['', '', '', '', '', '']);
        toast.success(`Verification code sent to ${email.trim().toLowerCase()}`);
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
      verifyOtp(newOtp.join(''));
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
      verifyOtp(pasted);
    }
  };

  const verifyOtp = async (otpValue) => {
    if (otpVerifying) return;
    setOtpVerifying(true);
    try {
      // Step 2: verify the emailed OTP. The account is now activated.
      await authAPI.verifySignupOtp(email.trim().toLowerCase(), otpValue);
      // Step 3: establish the session with the credentials the owner just
      // created — same trust path as a normal login.
      await login(email.trim().toLowerCase(), password);
      toast.success('Email verified! Welcome to DineDesk. 🎉');
      navigate('/onboarding');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid code. Please try again.';
      toast.error(detail);
      if (String(detail).toLowerCase().includes('already verified')) {
        setTimeout(() => navigate('/login'), 1800);
        return;
      }
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authAPI.resendSignupOtp(email.trim().toLowerCase());
      setOtpTimer(60);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      toast.success('New code sent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not resend. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="lp min-h-screen flex flex-col lg:flex-row antialiased" data-testid="register-page">
      {/* LEFT — brand panel (desktop) */}
      <div className="relative hidden lg:flex lg:w-[55%] bg-[var(--lp-surface)] text-[var(--lp-on-dark)] p-10 xl:p-14 flex-col justify-center overflow-hidden">
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-[var(--lp-green-a12)] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[var(--lp-green-a15)] rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <div className="flex flex-col items-start gap-1.5 mb-8">
            <img src={logoUrl} alt="DineDesk" className="lp-logo-white h-10 w-auto" loading="eager" />
            <span className="text-[11px] text-[var(--lp-on-dark-faint)]">by Trident Ventures</span>
          </div>
          <h1 className="font-heading-xl text-3xl sm:text-4xl xl:text-[2.9rem] font-extrabold leading-[1.1] tracking-tight mb-4">
            Smart Restaurant POS
            <br />
            Built for <span className="text-[var(--lp-green)]">Speed and Simplicity</span>
          </h1>
          <p className="text-[var(--lp-on-dark-soft)] text-base xl:text-lg leading-relaxed mb-10 max-w-lg">
            DineDesk helps restaurants manage orders, menus, inventory, and online deliveries from one powerful dashboard.
          </p>
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-[var(--lp-green-a12)] rounded-2xl p-3.5 border border-[var(--lp-green-a30)] hover:bg-[var(--lp-green-a20)] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[var(--lp-green-a20)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-[18px] h-[18px] text-[var(--lp-green)]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5">{f.title}</h3>
                  <p className="text-[12px] text-[var(--lp-on-dark-soft)] leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="font-script text-xl text-[var(--lp-green)] mt-10">Absorbs chaos. Serves calm.</p>
        </div>
      </div>

      {/* RIGHT — form panel on the mint canvas */}
      <div className="flex-1 lg:w-[45%] bg-[var(--lp-bg)] flex flex-col relative">
        {/* Mobile brand row */}
        <div className="lg:hidden flex items-center justify-between px-4 sm:px-6 pt-4 flex-shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            <img src={logoUrl} alt="DineDesk" className="lp-logo lp-logo-nav h-6 w-auto" loading="eager" />
            <span className="text-[9px] text-[var(--lp-ink-faint)] leading-none pr-0.5">by Trident Ventures</span>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to Night Shift'}
            className="w-11 h-11 rounded-xl border border-[var(--lp-card-line)] bg-[var(--lp-card)] inline-flex items-center justify-center text-[var(--lp-ink-soft)] hover:text-[var(--lp-green-deep)] transition-colors"
          >
            {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
        </div>
        {/* Desktop theme toggle */}
        <div className="hidden lg:flex justify-end px-8 xl:px-12 pt-6 flex-shrink-0">
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to Night Shift'}
            className="w-11 h-11 rounded-xl border border-[var(--lp-card-line)] bg-[var(--lp-card)] inline-flex items-center justify-center text-[var(--lp-ink-soft)] hover:text-[var(--lp-green-deep)] transition-colors"
          >
            {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:px-12 lg:pb-12">
        <div className="w-full max-w-sm">

          {/* STEP: Email OTP Verification */}
          {step === 'otp' && (
            <div className="lp-reveal is-visible rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] shadow-[var(--lp-shadow)] p-7 sm:p-8">
              <button
                onClick={() => setStep('register')}
                className="flex items-center gap-1 text-[var(--lp-ink-faint)] hover:text-[var(--lp-ink)] text-sm mb-5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[var(--lp-green-a15)] flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-[var(--lp-green-deep)]" />
                </div>
                <h2 className="font-heading text-xl font-bold text-[var(--lp-ink)] mb-1">Verify your email</h2>
                <p className="text-sm text-[var(--lp-ink-soft)]">
                  Enter the 6-digit code sent to <span className="font-semibold text-[var(--lp-ink)]">{email.trim().toLowerCase()}</span>
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
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold font-numbers border-[1.5px] border-[var(--lp-outline)] rounded-xl focus:border-[var(--lp-green)] focus:ring-0 outline-none transition-colors bg-[var(--lp-bg)] text-[var(--lp-ink)]"
                    disabled={otpVerifying}
                  />
                ))}
              </div>

              {otpVerifying && (
                <p className="text-center text-sm text-[var(--lp-ink-soft)] mb-4">Verifying...</p>
              )}

              {/* Resend OTP */}
              <div className="text-center">
                {otpTimer > 0 ? (
                  <p className="text-sm text-[var(--lp-ink-faint)]">
                    Resend code in <span className="font-semibold text-[var(--lp-ink)]">{otpTimer}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--lp-green-deep)] font-semibold hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    Resend code
                  </button>
                )}
              </div>

              <p className="text-xs text-[var(--lp-ink-faint)] text-center mt-4">Didn't receive the code? Check your spam folder or try again.</p>

              <Link
                to="/login"
                className="w-full h-12 rounded-xl border-[1.5px] border-[var(--lp-outline)] text-[var(--lp-ink)] font-semibold text-sm flex items-center justify-center gap-2 hover:border-[var(--lp-green-a40)] hover:text-[var(--lp-green-deep)] transition-colors mt-4"
              >
                Already verified? Sign in
              </Link>
            </div>
          )}

          {/* STEP: Register Form */}
          {step === 'register' && (
            <div className="lp-reveal is-visible rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] shadow-[var(--lp-shadow)] p-7 sm:p-8">
              <div className="mb-6">
                <h2 className="font-heading text-xl font-bold text-[var(--lp-ink)] mb-1">Create Your Account</h2>
                <p className="text-sm text-[var(--lp-ink-soft)]">Start managing your restaurant today.</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-[var(--lp-ink-soft)] mb-1.5 block">Restaurant Owner Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-ink-faint)]" />
                    <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                      className="pl-10 h-11 rounded-xl bg-[var(--lp-bg)] border-[var(--lp-card-line)] text-sm text-[var(--lp-ink)] focus-visible:ring-[var(--lp-green-a40)] focus-visible:border-[var(--lp-green)]"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--lp-ink-soft)] mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-ink-faint)]" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="pl-10 h-11 rounded-xl bg-[var(--lp-bg)] border-[var(--lp-card-line)] text-sm text-[var(--lp-ink)] focus-visible:ring-[var(--lp-green-a40)] focus-visible:border-[var(--lp-green)]"
                      required />
                  </div>
                  <p className="text-[11px] text-[var(--lp-ink-faint)] mt-1">We'll send a 6-digit verification code here.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--lp-ink-soft)] mb-1.5 block">Phone Number <span className="font-normal text-[var(--lp-ink-faint)]">(optional)</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-ink-faint)]" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98765 43210"
                      className="pl-10 h-11 rounded-xl bg-[var(--lp-bg)] border-[var(--lp-card-line)] text-sm text-[var(--lp-ink)] focus-visible:ring-[var(--lp-green-a40)] focus-visible:border-[var(--lp-green)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--lp-ink-soft)] mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-ink-faint)]" />
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                      className="pl-10 h-11 rounded-xl bg-[var(--lp-bg)] border-[var(--lp-card-line)] text-sm text-[var(--lp-ink)] focus-visible:ring-[var(--lp-green-a40)] focus-visible:border-[var(--lp-green)]"
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--lp-ink-soft)] mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-ink-faint)]" />
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password"
                      className="pl-10 h-11 rounded-xl bg-[var(--lp-bg)] border-[var(--lp-card-line)] text-sm text-[var(--lp-ink)] focus-visible:ring-[var(--lp-green-a40)] focus-visible:border-[var(--lp-green)]"
                      required />
                  </div>
                </div>
                <button
                  type="submit"
                  className="lp-btn-primary w-full mt-1"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Create Account <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <Link
                to="/login"
                className="w-full h-12 rounded-xl border-[1.5px] border-[var(--lp-outline)] text-[var(--lp-ink)] font-semibold text-sm flex items-center justify-center gap-2 hover:border-[var(--lp-green-a40)] hover:text-[var(--lp-green-deep)] transition-colors mt-3"
              >
                Sign In to Existing Account
              </Link>
            </div>
          )}

          <p className="text-center text-[11px] text-[var(--lp-ink-faint)] mt-5">
            By creating an account, you agree to the{' '}
            <Link to="/terms" className="font-semibold text-[var(--lp-green-deep)] hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="font-semibold text-[var(--lp-green-deep)] hover:underline">Privacy Policy</Link>.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
