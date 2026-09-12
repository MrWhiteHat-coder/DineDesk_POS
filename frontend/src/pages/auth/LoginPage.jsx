import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getPostAuthPath } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { authAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import logoUrl from '../../assets/dinedesk-logo.png';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, Monitor, ConciergeBell, UtensilsCrossed,
  Package, BarChart3, ShieldCheck, Headphones, Rocket, QrCode, Globe, ChevronRight,
  AlertTriangle, RefreshCw, Sparkles,
} from 'lucide-react';

/* Feature tiles — icons drawn in DineDesk green, matching the reference */
const features = [
  { icon: Monitor, label: 'Lightning\nPOS' },
  { icon: ConciergeBell, label: 'Online\nOrders' },
  { icon: UtensilsCrossed, label: 'Menu\nManagement' },
  { icon: Package, label: 'Inventory\n& CRM' },
  { icon: BarChart3, label: 'Real-time\nAnalytics' },
];

/* Honest stats only — no invented customer counts (product brief rule 26) */
const stats = [
  { icon: ShieldCheck, value: '99.9%', label: 'Uptime' },
  { icon: Headphones, value: '24/7', label: 'Dedicated Support' },
  { icon: Rocket, value: 'New Product', label: 'Building Together' },
];

function MicrosoftLogo() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  // Must come from the build environment (Vercel). No hard-coded fallback:
  // without an explicit client id the shared button shows "not configured".
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);
  // Busy only while the Google credential is actually being exchanged with the
  // backend. A cancelled popup never sets it, so no indefinite spinner.
  const [googleBusy, setGoogleBusy] = useState(false);

  // Prefill the remembered email ("Keep me signed in" stores the email only —
  // never the password).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dd-login-email');
      if (saved) setEmail(saved);
    } catch (e) { /* storage unavailable */ }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnverifiedEmail('');
    try {
      const user = await login(email, password);
      try {
        if (remember) localStorage.setItem('dd-login-email', email);
        else localStorage.removeItem('dd-login-email');
      } catch (err) { /* storage unavailable */ }
      toast.success('Welcome back!');
      if (user.role === 'admin') navigate('/admin');
      else if (!user.restaurant_id) navigate('/onboarding');
      else navigate('/pos');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed';
      if (err.response?.status === 403 && detail.includes('verify')) {
        setUnverifiedEmail(email);
      } else {
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await authAPI.resendVerification(unverifiedEmail);
      toast.success('Verification email sent! Check your inbox.');
    } catch (err) {
      toast.error('Could not resend. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  // Called by the shared Google button once the popup returns a credential.
  const handleGoogleCredential = async (credential) => {
    if (googleBusy) return; // ignore duplicate callbacks while exchanging
    setGoogleBusy(true);
    try {
      const { user: userData, restaurant: restaurantData } = await googleLogin(credential);
      toast.success('Welcome back! Signed in with Google.');
      navigate(getPostAuthPath(userData, restaurantData));
    } catch (err) {
      // Keep the failure visible on the page instead of forcing a reload —
      // the api layer no longer redirects anonymous 401s.
      toast.error(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen lg:h-screen lg:overflow-hidden w-full flex flex-col lg:flex-row bg-[#F5F6F3] dark:bg-[#0A0C0F] text-gray-900 dark:text-white"
      data-testid="login-page"
    >
      {/* ══════════ LEFT — Brand Panel (desktop) ══════════ */}
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-between p-10 xl:p-14 overflow-y-auto lg:border-r border-gray-200/70 dark:border-white/5">
        {/* Ambience glows */}
        <div className="absolute top-0 right-0 w-[30rem] h-[30rem] rounded-full bg-[#2E9E5B]/[0.06] dark:bg-[#34C77B]/[0.05] blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-[#2E9E5B]/[0.04] dark:bg-white/[0.03] blur-3xl translate-y-1/3 pointer-events-none" />

        {/* Logo row */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex items-center gap-3.5">
            <img src={logoUrl} alt="DineDesk" className="lp-logo-nav h-11 w-auto" loading="eager" />
            <div>
              <span className="text-2xl font-heading font-bold tracking-tight">DineDesk</span>
              <p className="text-[11px] text-gray-500 dark:text-white/40 -mt-0.5">by Trident Ventures</p>
            </div>
          </div>
          <div className="hidden xl:block h-9 w-px bg-gray-200 dark:bg-white/10 ml-2" aria-hidden="true" />
          <p className="hidden xl:block text-[10px] font-bold tracking-[0.22em] text-gray-400 dark:text-white/35 leading-relaxed">
            RESTAURANT OPERATIONS<br />SIMPLIFIED
          </p>
        </div>

        {/* Headline + features + honest stats */}
        <div className="relative z-10 max-w-2xl py-8">
          <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 dark:text-white/40 mb-4">
            ALL-IN-ONE RESTAURANT MANAGEMENT PLATFORM
          </p>
          <h1 className="font-heading-xl text-5xl xl:text-[3.6rem] font-extrabold leading-[1.05] tracking-tight mb-5">
            Absorbs chaos.
            <br />
            <span className="relative inline-block text-[#268A4E] dark:text-[#3FCE85]">
              Serves calm.
              <svg className="absolute -bottom-2.5 left-1 w-11/12 h-3 text-[#268A4E]/50 dark:text-[#3FCE85]/60" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M3 9C40 3 120 2 197 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="text-gray-500 dark:text-white/55 text-base xl:text-lg leading-relaxed max-w-md">
            POS + KDS + CRM + Inventory + Analytics<br />Built for teams that never slow down.
          </p>

          {/* Feature tiles */}
          <div className="grid grid-cols-5 gap-3 mt-9 max-w-xl">
            {features.map((f) => (
              <div
                key={f.label}
                className="bg-white/70 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-[#2E9E5B]/50 dark:hover:border-[#34C77B]/40 hover:shadow-sm transition-all"
              >
                <f.icon className="w-6 h-6 text-[#268A4E] dark:text-[#3FCE85]" strokeWidth={1.8} />
                <span className="text-[11px] font-semibold text-gray-700 dark:text-white/80 text-center leading-tight whitespace-pre-line">
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-8 mt-9 pt-7 border-t border-gray-200/80 dark:border-white/[0.07] max-w-xl">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-5 h-5 text-[#268A4E] dark:text-[#3FCE85]" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-base font-heading font-bold leading-tight">{s.value}</p>
                  <p className="text-[11px] text-gray-500 dark:text-white/45 leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Script quote + footer strip */}
        <div className="relative z-10 flex items-end justify-between gap-6">
          <div>
            <p className="font-script text-2xl xl:text-[1.7rem] text-gray-800 dark:text-white/85 leading-tight -rotate-1">
              " Great food.<br />builds better people. "
            </p>
            <p className="text-xs text-gray-500 dark:text-white/45 mt-1.5 ml-1">— DineDesk</p>
          </div>
          <div className="flex flex-col items-center gap-2 pb-1">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="w-4 h-1 rounded-full bg-[#2E9E5B]" />
              <span className="w-1.5 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
              <span className="w-1.5 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
            </div>
            <p className="text-[9px] font-bold tracking-[0.24em] text-gray-400 dark:text-white/35">
              FROM FIRST ORDER TO LASTING RELATIONSHIPS
            </p>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT — Auth Panel ══════════ */}
      <div className="relative flex-1 lg:w-[45%] flex flex-col p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto bg-[#F5F6F3] dark:bg-[#0A0C0F]">
        {/* Top bar: theme toggle + script tagline */}
        <div className="flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-0.5 bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-full p-1 shadow-sm hover:shadow transition-all"
            data-testid="login-theme-toggle"
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${!dark ? 'bg-[#2E9E5B] text-white' : 'text-gray-400 dark:text-white/40'}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            </span>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${dark ? 'bg-white/15 text-white' : 'text-gray-400'}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            </span>
          </button>
          <p className="font-script text-xl xl:text-2xl text-gray-700 dark:text-white/80 -rotate-1">
            Good food.{' '}
            <span className="relative inline-block text-[#268A4E] dark:text-[#3FCE85]">
              Better business.
              <svg className="absolute -bottom-1 left-0 w-full h-1.5 text-[#2E9E5B]/50 dark:text-[#3FCE85]/50" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M3 5C60 2 140 2 197 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </span>
          </p>
        </div>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center py-5">
          <div className="relative w-full max-w-md bg-white dark:bg-[#12151B]/90 border border-gray-200/90 dark:border-white/[0.08] rounded-3xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-6 sm:p-8">
            {/* Decorative script note (reference detail) */}
            <p className="hidden sm:block absolute top-5 right-6 font-script text-base text-gray-400 dark:text-white/45 rotate-2 leading-tight text-right pointer-events-none">
              " Same team<br />Stronger everyday "
            </p>

            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img src={logoUrl} alt="DineDesk" className="lp-logo-nav h-12 w-auto" loading="eager" />
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-heading font-bold mb-1">Welcome back!</h2>
              <p className="text-sm text-gray-500 dark:text-white/50">Sign in to your DineDesk dashboard.</p>
            </div>

            {/* Unverified Email Warning */}
            {unverifiedEmail && (
              <div className="mb-4 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/25 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">Email not verified</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-200/70 mb-3">
                      Please verify <span className="font-semibold">{unverifiedEmail}</span> before logging in. Check your inbox for the verification link.
                    </p>
                    <button
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                      {resending ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60 mb-1.5 block">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/35" />
                  <Input
                    type="email" value={email} onChange={(e) => { setEmail(e.target.value); setUnverifiedEmail(''); }}
                    placeholder="you@restaurant.com"
                    className="pl-10 h-11 rounded-xl bg-gray-50 dark:bg-white/[0.05] border-gray-200 dark:border-white/10 text-sm focus-visible:ring-[#2E9E5B]/50 focus-visible:border-[#2E9E5B]/60"
                    required data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-white/60 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/35" />
                  <Input
                    type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-11 rounded-xl bg-gray-50 dark:bg-white/[0.05] border-gray-200 dark:border-white/10 text-sm focus-visible:ring-[#2E9E5B]/50 focus-visible:border-[#2E9E5B]/60"
                    required data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:text-white/40 dark:hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me + forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#2E9E5B] cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 dark:text-white/60">Keep me signed in</span>
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-[#268A4E] hover:text-[#1F6E3E] dark:text-[#3FCE85] dark:hover:text-[#6BDD9E] transition-colors">
                  Forgot password?
                </Link>
              </div>

              {/* Demo credentials — one-tap fill for product walkthroughs */}
              <button
                type="button"
                onClick={() => { setEmail('demo@dinedesk.in'); setPassword('123456'); }}
                className="w-full h-9 rounded-lg border border-dashed border-[#2E9E5B]/40 bg-[#2E9E5B]/[0.06] dark:border-[#3FCE85]/40 dark:bg-[#3FCE85]/[0.08] text-xs font-semibold text-[#268A4E] dark:text-[#3FCE85] hover:bg-[#2E9E5B]/[0.12] dark:hover:bg-[#3FCE85]/[0.14] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                title="Fill demo credentials"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Try the demo — demo@dinedesk.in
              </button>

              {/* Green CTA */}
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#2E9E5B] to-[#268A4E] dark:from-[#31A862] dark:to-[#2A9155] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#2E9E5B]/25 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60"
                disabled={loading} data-testid="login-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.08]" />
              <span className="text-[10px] text-gray-400 dark:text-white/40 font-semibold uppercase tracking-widest">or continue with</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.08]" />
            </div>

            {/* Social sign-in */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <GoogleSignInButton
                clientId={GOOGLE_CLIENT_ID}
                onSuccess={handleGoogleCredential}
                onError={(message) => toast.error(message)}
                disabled={googleBusy}
              />
              <button
                type="button"
                onClick={() => toast.info('Microsoft sign-in is coming soon.')}
                className="h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-800 dark:text-white/80 font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-gray-300 dark:hover:border-white/20 transition-all"
              >
                <MicrosoftLogo />
                Continue with Microsoft
              </button>
            </div>
            {googleBusy && (
              <div className="flex items-center justify-center gap-2 mt-2" data-testid="google-busy">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                <span className="text-xs text-gray-500 dark:text-white/50">Signing in with Google…</span>
              </div>
            )}

            {/* Quick Login row (reference) */}
            <button
              type="button"
              onClick={() => toast.info('Quick Login QR arrives with the DineDesk mobile app.')}
              className="mt-2.5 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] p-3.5 flex items-center gap-3.5 hover:border-[#2E9E5B]/50 dark:hover:border-[#34C77B]/40 hover:bg-white dark:hover:bg-white/[0.07] transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-5 h-5 text-[#268A4E] dark:text-[#3FCE85]" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Quick Login</p>
                <p className="text-[11px] text-gray-500 dark:text-white/45 leading-tight mt-0.5">Scan with DineDesk mobile app</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-white/35 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Card footer — legal + language */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-[11px] text-gray-400 dark:text-white/35 hover:text-gray-700 dark:hover:text-white/70 transition-colors">Privacy</Link>
                <Link to="/login" className="text-[11px] text-gray-400 dark:text-white/35 hover:text-gray-700 dark:hover:text-white/70 transition-colors">Terms</Link>
                <Link to="/login" className="text-[11px] text-gray-400 dark:text-white/35 hover:text-gray-700 dark:hover:text-white/70 transition-colors">Support</Link>
              </div>
              <button
                type="button"
                onClick={() => toast.info('More languages are on the roadmap.')}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-white/50 border border-gray-200 dark:border-white/10 rounded-full px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Globe className="w-3 h-3" />
                English
                <ChevronRight className="w-3 h-3 rotate-90" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-only compact brand footer (left panel is desktop-only) */}
        <div className="lg:hidden text-center pb-1 flex-shrink-0">
          <p className="font-script text-lg text-gray-500 dark:text-white/50">" Great food. builds better people. "</p>
        </div>
      </div>
    </div>
  );
}
