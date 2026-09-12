import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check,
  Receipt, Package, ChefHat, BarChart3, HeartHandshake, Building2,
  Plug, Store as StoreIcon, Mail, Phone, ConciergeBell, LayoutGrid,
  Bell, Flame, Clock, Leaf,
} from 'lucide-react';
import {
  LandingNav, Footer, SectionHeading, useScrollReveal,
  CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL,
} from './LandingChrome';

/* ────────────────────────────────────────────────────────────────
   DineDesk public landing page.
   Green brand language on the token layer defined in index.css
   (.lp scope) — Light Mode: soft mint canvas / deep dark-green
   surfaces. Night Shift: charcoal canvas / dark-green elevation.
   Honest product only: no stats, logos, ratings or testimonials.
   Nav, footer and shared chrome live in LandingChrome.jsx.
   ──────────────────────────────────────────────────────────────── */

/* ─────────────────── Hero product preview ─────────────────── */

const PREVIEW_ORDERS = [
  { id: '#241', items: '2 × Ghee Roast, Filter Coffee', dest: 'Table 6', status: 'Preparing', tone: 'live' },
  { id: '#240', items: '1 × Idli Combo, 1 × Vada', dest: 'Takeaway', status: 'Ready', tone: 'ok' },
  { id: '#239', items: '3 × Meals, 1 × Curd Rice', dest: 'Table 2', status: 'Served', tone: 'done' },
];

const PREVIEW_KPI = [
  { label: 'Sales today', value: '₹18,420', sub: '64 orders' },
  { label: 'Tables', value: '8 / 12', sub: 'occupied' },
  { label: 'Kitchen', value: '4 active', sub: 'avg 9 min' },
];

const PREVIEW_STOCK = [
  { name: 'Dosa batter', pct: 72, low: false },
  { name: 'Filter coffee powder', pct: 58, low: false },
  { name: 'Sambar dal', pct: 18, low: true },
];

function HeroPreview() {
  return (
    <div className="relative" aria-label="Preview of the DineDesk restaurant operating interface with sample data">
      {/* soft green ambience behind the frame */}
      <div
        className="absolute -inset-6 sm:-inset-10 rounded-[2.5rem] bg-[var(--lp-green)] opacity-[0.09] blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative rounded-3xl bg-[var(--lp-surface)] border border-[var(--lp-surface-line)] shadow-[var(--lp-shadow-hover)] overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--lp-surface-line)]">
          {/* macOS traffic lights: close · minimize · maximize */}
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] ring-1 ring-black/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] ring-1 ring-black/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840] ring-1 ring-black/10" />
          </span>
          <span className="text-[11px] sm:text-xs font-semibold text-[var(--lp-on-dark-soft)] truncate">
            DineDesk — Control Room
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--lp-green-a15)] text-[var(--lp-green)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--lp-green)] animate-calm-pulse" aria-hidden="true" />
            LIVE SERVICE
          </span>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {PREVIEW_KPI.map((k) => (
              <div key={k.label} className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3 sm:p-4">
                <p className="text-[9px] sm:text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--lp-on-dark-faint)]">
                  {k.label}
                </p>
                <p className="font-numbers text-xl sm:text-3xl font-semibold text-[var(--lp-on-dark)] mt-1 leading-none">
                  {k.value}
                </p>
                <p className="text-[10px] sm:text-[11px] text-[var(--lp-on-dark-faint)] mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-5 gap-3">
            {/* Live orders */}
            <div className="sm:col-span-3 rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--lp-on-dark-soft)]">
                  Live orders
                </p>
                <Clock className="w-3.5 h-3.5 text-[var(--lp-on-dark-faint)]" aria-hidden="true" />
              </div>
              <ul className="space-y-2">
                {PREVIEW_ORDERS.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5"
                  >
                    <span className="font-numbers text-sm font-semibold text-[var(--lp-green)] flex-shrink-0">
                      {o.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-[var(--lp-on-dark)] truncate">
                        {o.items}
                      </span>
                      <span className="block text-[10px] text-[var(--lp-on-dark-faint)]">{o.dest}</span>
                    </span>
                    <span
                      className={`flex-shrink-0 text-[9px] font-bold px-2 py-1 rounded-full ${
                        o.tone === 'ok'
                          ? 'bg-[var(--lp-green-a15)] text-[var(--lp-green)]'
                          : o.tone === 'done'
                          ? 'bg-white/10 text-[var(--lp-on-dark-soft)]'
                          : 'bg-[var(--lp-green-a25)] text-[var(--lp-on-dark)]'
                      }`}
                    >
                      {o.status.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kitchen + inventory */}
            <div className="sm:col-span-2 space-y-3">
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--lp-on-dark-soft)]">
                    Kitchen
                  </p>
                  <Flame className="w-3.5 h-3.5 text-[var(--lp-green)]" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-[var(--lp-green)]" />
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-1/2 rounded-full bg-[var(--lp-green)] opacity-70" />
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-2/5 rounded-full bg-[var(--lp-green)] opacity-45" />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--lp-on-dark-soft)]">
                    Inventory
                  </p>
                  <Bell className="w-3.5 h-3.5 text-[var(--lp-on-dark-faint)]" aria-hidden="true" />
                </div>
                <ul className="space-y-2.5">
                  {PREVIEW_STOCK.map((s) => (
                    <li key={s.name}>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[var(--lp-on-dark-soft)] font-medium truncate">{s.name}</span>
                        <span className={s.low ? 'text-[var(--lp-green)] font-bold' : 'text-[var(--lp-on-dark-faint)]'}>
                          {s.low ? 'LOW' : `${s.pct}%`}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.low ? 'bg-[var(--lp-green)]' : 'bg-[var(--lp-green)] opacity-60'}`}
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* honest sample-data note */}
        <p className="px-4 sm:px-5 pb-3 text-[9px] tracking-[0.18em] uppercase font-bold text-[var(--lp-on-dark-faint)]">
          Interface preview · sample data
        </p>
      </div>
    </div>
  );
}

/* ─────────────────── Hero ─────────────────── */

function Hero() {
  return (
    <section id="product" className="relative overflow-hidden">
      {/* ambient green washes */}
      <div
        className="absolute top-0 right-0 w-[36rem] h-[36rem] rounded-full bg-[var(--lp-green)] opacity-[0.07] blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 w-[28rem] h-[28rem] rounded-full bg-[var(--lp-green)] opacity-[0.05] blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 lg:pt-20 pb-16 sm:pb-20 lg:pb-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <span className="lp-eyebrow lp-reveal">Restaurant POS that grows with you</span>

          <h1 className="lp-reveal font-heading-xl text-[2.4rem] xs:text-[2.6rem] leading-[1.04] sm:text-5xl lg:text-[3.75rem] font-extrabold tracking-tight mt-5 text-[var(--lp-ink)]">
            Start small.
            <br />
            <span className="text-[var(--lp-green-deep)]">Grow without limits.</span>
          </h1>

          <p className="lp-reveal mt-5 text-lg sm:text-xl font-semibold text-[var(--lp-ink)]">
            Simple billing for your first counter.
            <br className="hidden sm:block" />
            Powerful restaurant operations when you're ready.
          </p>

          <p className="lp-reveal mt-4 text-base sm:text-lg leading-relaxed text-[var(--lp-ink-soft)] max-w-xl">
            DineDesk gives every restaurant a simple place to start, with powerful tools available
            whenever your business needs them.
          </p>

          <div className="lp-reveal mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
            <Link to="/register" className="lp-btn-primary text-base px-8">
              Start with DineDesk
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a href="#plans" className="lp-btn-outline text-base px-8">
              Explore Plans
            </a>
          </div>

          <p className="lp-reveal mt-7 flex items-center gap-2 text-sm text-[var(--lp-ink-faint)]">
            <Leaf className="w-4 h-4 text-[var(--lp-green-deep)]" aria-hidden="true" />
            Absorbs chaos. Serves calm.
          </p>
        </div>

        <div className="lp-reveal">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── How DineDesk grows ─────────────────── */

const GROW_STEPS = [
  {
    step: '01',
    title: 'Start Small',
    price: '₹999',
    plan: 'Basic',
    desc: 'For your first billing counter.',
  },
  {
    step: '02',
    title: 'Grow Smarter',
    price: '₹3,999',
    plan: 'Growth',
    desc: 'Add inventory automation and operational control.',
  },
  {
    step: '03',
    title: 'Scale Your Way',
    price: 'Enterprise',
    plan: '+ DineDesk Store',
    desc: 'Choose the advanced capabilities your business actually needs.',
  },
];

function HowItGrows() {
  return (
    <section className="py-16 sm:py-20 lg:py-24" aria-labelledby="grows-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How DineDesk grows"
          title={<span id="grows-heading">One platform. Three natural steps.</span>}
          sub="Start with simple billing and add power only when your restaurant needs it."
        />

        <div className="relative mt-12 grid md:grid-cols-3 gap-5 lg:gap-6">
          {/* connector line (desktop) */}
          <div
            className="hidden md:block absolute top-[52px] left-[16%] right-[16%] h-px bg-[var(--lp-card-line)]"
            aria-hidden="true"
          />
          {GROW_STEPS.map((s, i) => (
            <article
              key={s.step}
              className="lp-reveal relative rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 sm:p-7 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="w-11 h-11 rounded-2xl bg-[var(--lp-surface)] text-[var(--lp-green)] font-numbers text-lg font-semibold flex items-center justify-center">
                  {s.step}
                </span>
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--lp-ink-faint)]">
                  {s.plan}
                </span>
              </div>
              <h3 className="font-heading text-xl font-bold text-[var(--lp-ink)] mt-5">{s.title}</h3>
              <p className="font-numbers text-4xl font-semibold text-[var(--lp-green-deep)] mt-2 leading-none">
                {s.price}
              </p>
              <p className="text-sm leading-relaxed text-[var(--lp-ink-soft)] mt-3">{s.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Pricing ─────────────────── */

const BASIC_FEATURES = [
  'POS Billing',
  'Basic Menu Management',
  'Order Management',
  'Dine-in / Takeaway Billing',
  'Basic Customer Management',
  'Receipt Generation',
  'Basic Sales Reports',
  'Essential Restaurant Dashboard',
];

const GROWTH_EXTRA_FEATURES = [
  'Inventory Tracking',
  'Ingredient Stock Management',
  'Automatic Inventory Deduction',
  'Stock Deduction Based on Sales',
  'Low Stock Alerts',
  'Purchase / Stock Management',
  'Inventory Reports',
  'Better Sales & Operational Insights',
];

const ENTERPRISE_FEATURES = [
  'Advanced Restaurant Operations',
  'Multi-Outlet Management',
  'Advanced Permissions',
  'Centralized Management',
  'Advanced Analytics',
  'Enterprise Workflows',
  'Custom Integrations',
  'Scalable Architecture',
  'Dedicated Business Support',
  'Advanced Operational Capabilities',
];

function FeatureItem({ children, dark = false }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 ${
          dark ? 'bg-[var(--lp-green-a20)]' : 'bg-[var(--lp-green-tint)]'
        }`}
        aria-hidden="true"
      >
        <Check className="w-3 h-3 text-[var(--lp-green-deep)]" strokeWidth={3} />
      </span>
      <span
        className={`text-sm leading-relaxed ${dark ? 'text-[var(--lp-on-dark-soft)]' : 'text-[var(--lp-ink-soft)]'}`}
      >
        {children}
      </span>
    </li>
  );
}

function Pricing() {
  return (
    <section id="plans" className="py-16 sm:py-20 lg:py-24" aria-labelledby="plans-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Plans"
          title={<span id="plans-heading">Simple pricing that starts small</span>}
          sub="Every plan runs on the same reliable DineDesk core. Add power when you need it — never before."
        />

        <div className="mt-12 grid lg:grid-cols-3 gap-5 lg:gap-6 items-stretch max-w-6xl mx-auto">
          {/* ── BASIC ── */}
          <article
            className="lp-reveal rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 sm:p-8 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
          >
            <h3 className="font-heading text-sm font-bold tracking-[0.2em] uppercase text-[var(--lp-ink)]">
              Basic
            </h3>
            <p className="text-sm text-[var(--lp-ink-faint)] mt-1.5">
              Built for roadside carts and small local restaurants.
            </p>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="font-numbers text-5xl font-semibold text-[var(--lp-ink)] leading-none">₹999</span>
              <span className="text-sm text-[var(--lp-ink-faint)]">/ month</span>
            </p>
            <p className="text-sm leading-relaxed text-[var(--lp-ink-soft)] mt-4">
              Perfect for roadside carts, small Chennai hotels, cafés and local food businesses that
              simply need reliable billing.
            </p>

            <ul className="mt-6 space-y-2.5 flex-1">
              {BASIC_FEATURES.map((f) => (
                <FeatureItem key={f}>{f}</FeatureItem>
              ))}
            </ul>

            <p className="mt-6 text-sm font-semibold text-[var(--lp-ink)]">
              Everything you need to start billing.
            </p>
            <Link to="/register" className="lp-btn-outline w-full mt-5">
              Start with Basic
            </Link>
          </article>

          {/* ── GROWTH (highlighted) ── */}
          <article
            className="lp-reveal relative rounded-3xl bg-[var(--lp-surface)] border border-[var(--lp-surface-line)] p-6 sm:p-8 shadow-[var(--lp-shadow-hover)] transition-all duration-300 flex flex-col"
          >
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap lp-badge-green">
              <ConciergeBell className="w-3 h-3" aria-hidden="true" />
              For growing restaurants
            </span>

            <h3 className="font-heading text-sm font-bold tracking-[0.2em] uppercase text-[var(--lp-on-dark)] mt-2">
              Growth
            </h3>
            <p className="text-sm text-[var(--lp-on-dark-soft)] mt-1.5">
              Everything in Basic, plus smarter inventory control.
            </p>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="font-numbers text-5xl font-semibold text-[var(--lp-on-dark)] leading-none">₹3,999</span>
              <span className="text-sm text-[var(--lp-on-dark-faint)]">/ month</span>
            </p>

            {/* recipe-based deduction callout */}
            <div className="mt-5 rounded-2xl bg-[var(--lp-green-a12)] border border-[var(--lp-green-a30)] p-4">
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] uppercase text-[var(--lp-green)]">
                <Package className="w-3.5 h-3.5" aria-hidden="true" />
                Automatic inventory deduction
              </p>
              <p className="text-[13px] leading-relaxed text-[var(--lp-on-dark-soft)] mt-2">
                When an item is sold, DineDesk automatically deducts the required inventory based on
                the configured recipe. Your stock stays true without extra work.
              </p>
            </div>

            <p className="text-xs font-bold tracking-[0.14em] uppercase text-[var(--lp-on-dark-faint)] mt-6">
              All Basic features, plus
            </p>
            <ul className="mt-3 space-y-2.5 flex-1">
              {GROWTH_EXTRA_FEATURES.map((f) => (
                <FeatureItem key={f} dark>
                  {f}
                </FeatureItem>
              ))}
            </ul>

            <Link to="/register" className="lp-btn-primary w-full mt-7">
              Choose Growth
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </article>

          {/* ── ENTERPRISE ── */}
          <article
            id="enterprise"
            className="lp-reveal rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 sm:p-8 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 transition-all duration-300 flex flex-col scroll-mt-24"
          >
            <h3 className="font-heading text-sm font-bold tracking-[0.2em] uppercase text-[var(--lp-ink)]">
              Enterprise
            </h3>
            <p className="text-sm text-[var(--lp-ink-faint)] mt-1.5">
              For restaurant groups, multi-outlet businesses and enterprise operations.
            </p>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="font-numbers text-4xl font-semibold text-[var(--lp-ink)] leading-none">
                Contact Sales
              </span>
            </p>
            <p className="text-sm leading-relaxed text-[var(--lp-ink-soft)] mt-4">
              Build your DineDesk around your business. Choose the advanced capabilities your
              operation actually needs.
            </p>

            <ul className="mt-6 space-y-2.5 flex-1">
              {ENTERPRISE_FEATURES.map((f) => (
                <FeatureItem key={f}>{f}</FeatureItem>
              ))}
            </ul>

            <p className="mt-6 text-sm leading-relaxed text-[var(--lp-ink-soft)]">
              Not every capability is automatic — add what fits from{' '}
              <a href="#store" className="font-semibold text-[var(--lp-green-deep)] hover:underline">
                DineDesk Store
              </a>{' '}
              according to your exact operational requirements.
            </p>

            <div className="mt-5 space-y-2.5">
              <a
                href="#contact"
                className="lp-btn-outline w-full"
                aria-label="Contact Sales about Enterprise"
              >
                Contact Sales
              </a>
              <Link
                to="/store"
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-[var(--lp-green-deep)] hover:bg-[var(--lp-green-tint)] transition-colors px-6"
              >
                Explore DineDesk Store
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── DineDesk Store ─────────────────── */

const STORE_CATEGORIES = [
  {
    name: 'Operate',
    icon: ChefHat,
    modules: ['Kitchen Display System', 'Inventory', 'Purchasing'],
  },
  {
    name: 'Serve',
    icon: ConciergeBell,
    modules: ['Table Management', 'Reservations', 'Captain App', 'QR Ordering'],
  },
  {
    name: 'Grow',
    icon: HeartHandshake,
    modules: ['CRM', 'Loyalty', 'Marketing', 'Customer Feedback'],
  },
  {
    name: 'Understand',
    icon: BarChart3,
    modules: ['Advanced Analytics', 'Reports', 'AI Insights'],
  },
  {
    name: 'Scale',
    icon: Building2,
    modules: ['Multi-Branch', 'Central Kitchen', 'HQ Management'],
  },
  {
    name: 'Connect',
    icon: Plug,
    modules: ['Payments', 'Delivery Integrations', 'Accounting', 'Third-party APIs'],
  },
];

function StoreSection() {
  return (
    <section id="store" className="py-16 sm:py-20 lg:py-24" aria-labelledby="store-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="DineDesk Store"
          title={<span id="store-heading">Your restaurant. Your stack.</span>}
          sub="Don't pay for features you don't need. Add powerful DineDesk Store modules whenever your business is ready."
        />

        <p className="lp-reveal text-center text-sm sm:text-base text-[var(--lp-ink-soft)] max-w-2xl mx-auto mt-6 leading-relaxed">
          DineDesk Store is the expansion layer of DineDesk — add capabilities based on your actual
          business requirements, at your own pace.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {STORE_CATEGORIES.map((c, i) => (
            <article
              key={c.name}
              className="lp-reveal group rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 hover:border-[var(--lp-green-a40)] transition-all duration-300"
              style={{ transitionDelay: `${(i % 3) * 70}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[var(--lp-green-tint)] flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-[var(--lp-green-deep)]" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <h3 className="font-heading text-sm font-bold tracking-[0.2em] uppercase text-[var(--lp-ink)]">
                  {c.name}
                </h3>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">
                {c.modules.map((m) => (
                  <li
                    key={m}
                    className="text-xs font-semibold text-[var(--lp-ink-soft)] bg-[var(--lp-green-tint)] border border-[var(--lp-card-line)] rounded-full px-3 py-1.5 group-hover:border-[var(--lp-green-a30)] transition-colors"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="lp-reveal text-center mt-10">
          <Link to="/store" className="lp-btn-primary">
            Explore DineDesk Store
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Why DineDesk ─────────────────── */

const WHY_PRINCIPLES = [
  {
    num: '01',
    title: 'Simple to start',
    desc: 'No complicated enterprise setup for a small restaurant.',
  },
  {
    num: '02',
    title: 'Powerful when needed',
    desc: 'Advanced capabilities are available when the restaurant grows.',
  },
  {
    num: '03',
    title: 'Pay for what you need',
    desc: 'Add DineDesk Store modules based on your actual requirements.',
  },
  {
    num: '04',
    title: 'One ecosystem',
    desc: 'Billing, operations, inventory, analytics and future capabilities can live inside one restaurant platform.',
  },
];

function WhySection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24" aria-labelledby="why-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why DineDesk"
          title={<span id="why-heading">Calm software for busy restaurants</span>}
        />

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {WHY_PRINCIPLES.map((p, i) => (
            <article
              key={p.num}
              className="lp-reveal rounded-3xl bg-[var(--lp-surface)] border border-[var(--lp-surface-line)] p-6 hover:-translate-y-1 transition-all duration-300"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <p className="font-numbers text-3xl font-semibold text-[var(--lp-green)] leading-none">
                {p.num}
              </p>
              <h3 className="font-heading text-base font-bold text-[var(--lp-on-dark)] mt-4">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--lp-on-dark-soft)] mt-2">{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Restaurant size fit ─────────────────── */

const SIZE_FITS = [
  {
    icon: Receipt,
    name: 'Roadside cart',
    question: 'Just need billing?',
    answer: 'Basic',
  },
  {
    icon: LayoutGrid,
    name: 'Local restaurant',
    question: 'Need billing + inventory?',
    answer: 'Growth',
  },
  {
    icon: Building2,
    name: 'Restaurant group',
    question: 'Need centralized operations?',
    answer: 'Enterprise',
  },
];

function SizeSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24" aria-labelledby="size-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Fits every size"
          title={<span id="size-heading">From one cart to many kitchens</span>}
          sub="Wherever you are today, there is a starting point that fits — and a clear path forward."
        />

        <div className="mt-12 grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {SIZE_FITS.map((s, i) => (
            <article
              key={s.name}
              className="lp-reveal rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 sm:p-7 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[var(--lp-surface)] flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-[var(--lp-green)]" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--lp-ink-faint)]">
                  {s.name}
                </p>
              </div>
              <p className="font-heading text-lg font-bold text-[var(--lp-ink)] mt-5">"{s.question}"</p>
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--lp-green-deep)]">
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                {s.answer}
              </p>
            </article>
          ))}
        </div>

        {/* extra-needs band */}
        <div className="lp-reveal mt-6 max-w-6xl mx-auto rounded-3xl bg-[var(--lp-surface)] border border-[var(--lp-surface-line)] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-[var(--lp-green-a15)] flex items-center justify-center flex-shrink-0">
              <StoreIcon className="w-5 h-5 text-[var(--lp-green)]" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-lg font-bold text-[var(--lp-on-dark)]">
                Need something extra?
              </p>
              <p className="text-sm text-[var(--lp-on-dark-soft)] mt-1 leading-relaxed">
                Pick exactly the modules your operation needs — nothing more.
              </p>
            </div>
          </div>
          <a
            href="#store"
            className="lp-btn-ghost-dark w-full sm:w-auto flex-shrink-0"
            aria-label="Explore DineDesk Store modules"
          >
            DineDesk Store
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Contact sales ─────────────────── */

function ContactSection() {
  return (
    <section id="contact" className="py-16 sm:py-20 lg:py-24 scroll-mt-20" aria-labelledby="contact-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lp-reveal relative overflow-hidden rounded-[2rem] bg-[var(--lp-surface)] border border-[var(--lp-surface-line)] shadow-[var(--lp-shadow-hover)] px-6 py-12 sm:px-12 sm:py-16">
          {/* ambient glow */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[var(--lp-green)] opacity-[0.14] blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative max-w-2xl">
            <span className="lp-eyebrow">Contact Sales</span>
            <h2
              id="contact-heading"
              className="font-heading-xl text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--lp-on-dark)] mt-4 leading-[1.12]"
            >
              Let's talk about your restaurant.
            </h2>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--lp-on-dark-soft)]">
              Need a larger setup, multiple outlets, custom integrations, or specific DineDesk Store
              modules? Talk to our team.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-3.5 max-w-xl">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group flex items-center gap-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 sm:px-5 min-h-[64px] hover:border-[var(--lp-green-a40)] hover:bg-white/[0.07] transition-all"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--lp-green-a15)] flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-[var(--lp-green)]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--lp-on-dark-faint)]">
                    Email
                  </span>
                  <span className="block text-sm font-semibold text-[var(--lp-on-dark)] truncate group-hover:text-[var(--lp-green)] transition-colors">
                    {CONTACT_EMAIL}
                  </span>
                </span>
              </a>

              <a
                href={CONTACT_PHONE_TEL}
                className="group flex items-center gap-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 sm:px-5 min-h-[64px] hover:border-[var(--lp-green-a40)] hover:bg-white/[0.07] transition-all"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--lp-green-a15)] flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-[var(--lp-green)]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--lp-on-dark-faint)]">
                    Phone
                  </span>
                  <span className="block text-sm font-semibold text-[var(--lp-on-dark)] group-hover:text-[var(--lp-green)] transition-colors">
                    {CONTACT_PHONE_DISPLAY}
                  </span>
                </span>
              </a>
            </div>

            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Enterprise — Contact Sales')}`}
              className="lp-btn-primary mt-8"
            >
              Contact Sales
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Final CTA ─────────────────── */

function FinalCTA() {
  return (
    <section className="pb-16 sm:pb-20 lg:pb-24" aria-labelledby="finalcta-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lp-reveal text-center max-w-3xl mx-auto">
          <h2
            id="finalcta-heading"
            className="font-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-[var(--lp-ink)] leading-[1.12]"
          >
            Whatever you serve,{' '}
            <span className="text-[var(--lp-green-deep)]">DineDesk grows with you.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--lp-ink-soft)]">
            Start simple today. Add more power when your restaurant needs it.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" className="lp-btn-primary text-base px-8">
              Start with Basic
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a href="#contact" className="lp-btn-outline text-base px-8">
              Talk to Sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Page ─────────────────── */

export default function LandingPage() {
  const rootRef = useScrollReveal();

  return (
    <div ref={rootRef} className="lp min-h-screen antialiased selection:bg-[var(--lp-green-a25)]">
      <a href="#product" className="lp-skip">
        Skip to content
      </a>

      <LandingNav />

      <main>
        <Hero />
        <HowItGrows />
        <Pricing />
        <StoreSection />
        <WhySection />
        <SizeSection />
        <ContactSection />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
