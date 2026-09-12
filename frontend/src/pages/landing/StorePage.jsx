import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, ChefHat, ConciergeBell, HeartHandshake,
  BarChart3, Building2, Plug, Layers, Mail,
} from 'lucide-react';
import {
  LandingNav, Footer, SectionHeading, useScrollReveal,
  CONTACT_EMAIL, STORE_MAILTO,
} from './LandingChrome';

/* ────────────────────────────────────────────────────────────────
   DineDesk Store — public catalogue page (/store).
   The expansion layer of DineDesk: restaurants add capabilities from
   here when their business is ready. Honest content only — pricing
   for each module is shown inside the app at activation time, so we
   never quote numbers we can't stand behind on a public page.
   ──────────────────────────────────────────────────────────────── */

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Start with a plan',
    desc: 'Basic or Growth runs your billing and daily operations from day one.',
  },
  {
    step: '02',
    title: 'Pick your modules',
    desc: 'Browse the Store and choose exactly what your business needs next — nothing more.',
  },
  {
    step: '03',
    title: 'Activate instantly',
    desc: 'Modules switch on inside your POS with simple monthly billing. Cancel anytime.',
  },
];

const STORE_CATEGORIES = [
  {
    name: 'Operate',
    icon: ChefHat,
    blurb: 'Run the line and the back room without spreadsheet chaos.',
    modules: [
      { name: 'Kitchen Display System', desc: 'Replace paper KOTs with a live kitchen screen.' },
      { name: 'Inventory', desc: 'Track ingredients and deduct stock with every sale.' },
      { name: 'Purchasing', desc: 'Raise and track purchase orders against stock levels.' },
    ],
  },
  {
    name: 'Serve',
    icon: ConciergeBell,
    blurb: 'Turn tables faster and let guests order on their terms.',
    modules: [
      { name: 'Table Management', desc: 'Floor maps, covers and turn times at a glance.' },
      { name: 'Reservations', desc: 'Bookings with reminders, straight from your website or phone.' },
      { name: 'Captain App', desc: 'Order-at-table for your floor staff, synced live.' },
      { name: 'QR Ordering', desc: 'Guests scan, browse and order — no app install.' },
    ],
  },
  {
    name: 'Grow',
    icon: HeartHandshake,
    blurb: 'Bring guests back more often, without manual follow-up.',
    modules: [
      { name: 'CRM', desc: 'One profile per guest with visit and spend history.' },
      { name: 'Loyalty', desc: 'Points and tiers that keep regulars coming back.' },
      { name: 'Marketing', desc: 'Campaigns and offers via WhatsApp, SMS and email.' },
      { name: 'Customer Feedback', desc: 'Capture ratings after the meal and act on them.' },
    ],
  },
  {
    name: 'Understand',
    icon: BarChart3,
    blurb: 'See what sells, what stalls and what to do next.',
    modules: [
      { name: 'Advanced Analytics', desc: 'Item-level margins, peak hours and cohort views.' },
      { name: 'Reports', desc: 'Scheduled daily, weekly and GST-ready summaries.' },
      { name: 'AI Insights', desc: 'Suggestions on pricing, prep and staffing patterns.' },
    ],
  },
  {
    name: 'Scale',
    icon: Building2,
    blurb: 'One kitchen or twenty — run them from one place.',
    modules: [
      { name: 'Multi-Branch', desc: 'Every outlet in one dashboard with branch switching.' },
      { name: 'Central Kitchen', desc: 'Produce once, distribute across branches.' },
      { name: 'HQ Management', desc: 'Group-wide menus, pricing and permissions.' },
    ],
  },
  {
    name: 'Connect',
    icon: Plug,
    blurb: 'Plug DineDesk into the tools you already rely on.',
    modules: [
      { name: 'Payments', desc: 'Card, UPI and split payments settled to your account.' },
      { name: 'Delivery Integrations', desc: 'Swiggy and Zomato orders land straight in the POS.' },
      { name: 'Accounting', desc: 'Push daily sales to Tally, Zoho Books and more.' },
      { name: 'Third-party APIs', desc: 'Webhooks and REST access for your own workflows.' },
    ],
  },
];

function ModuleCard({ cat }) {
  const enquiry = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`DineDesk Store — ${cat.name} modules`)}`;
  return (
    <article className="lp-reveal group rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 sm:p-7 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 hover:border-[var(--lp-green-a40)] transition-all duration-300 flex flex-col">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[var(--lp-green-tint)] flex items-center justify-center">
          <cat.icon className="w-5 h-5 text-[var(--lp-green-deep)]" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h2 className="font-heading text-sm font-bold tracking-[0.2em] uppercase text-[var(--lp-ink)]">
          {cat.name}
        </h2>
      </div>
      <p className="text-sm text-[var(--lp-ink-soft)] mt-3 leading-relaxed">{cat.blurb}</p>

      <ul className="mt-5 space-y-3 flex-1">
        {cat.modules.map((m) => (
          <li key={m.name} className="flex items-start gap-2.5">
            <span
              className="mt-1 w-[18px] h-[18px] rounded-full bg-[var(--lp-green-tint)] flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <Check className="w-3 h-3 text-[var(--lp-green-deep)]" strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--lp-ink)] leading-snug">{m.name}</span>
              <span className="block text-[13px] text-[var(--lp-ink-soft)] leading-snug mt-0.5">{m.desc}</span>
            </span>
          </li>
        ))}
      </ul>

      <a
        href={enquiry}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--lp-green-deep)] hover:underline"
      >
        Enquire about {cat.name}
        <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
      </a>
    </article>
  );
}

export default function StorePage() {
  const rootRef = useScrollReveal();

  return (
    <div ref={rootRef} className="lp min-h-screen antialiased selection:bg-[var(--lp-green-a25)]">
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden" aria-labelledby="store-hero-heading">
          <div
            className="absolute top-0 right-0 w-[32rem] h-[32rem] rounded-full bg-[var(--lp-green)] opacity-[0.07] blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-14 text-center">
            <span className="lp-eyebrow lp-reveal">DineDesk Store</span>
            <h1
              id="store-hero-heading"
              className="lp-reveal font-heading-xl text-[2.4rem] xs:text-[2.6rem] sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mt-5 text-[var(--lp-ink)]"
            >
              Your restaurant.
              <br />
              <span className="text-[var(--lp-green-deep)]">Your stack.</span>
            </h1>
            <p className="lp-reveal mt-5 text-base sm:text-lg lg:text-xl text-[var(--lp-ink-soft)] leading-relaxed max-w-2xl mx-auto">
              Don't pay for features you don't need. DineDesk Store is the expansion layer of
              DineDesk — add powerful modules whenever your business is ready.
            </p>
            <div className="lp-reveal mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/register" className="lp-btn-primary text-base px-8">
                Get Started
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('DineDesk Store — talk to sales')}`}
                className="lp-btn-outline text-base px-8"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Talk to Sales
              </a>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-10 sm:py-14" aria-labelledby="store-how-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="How it works"
              title={<span id="store-how-heading">Add power when you need it</span>}
            />
            <div className="mt-10 grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {HOW_IT_WORKS.map((s, i) => (
                <article
                  key={s.step}
                  className="lp-reveal rounded-3xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-6 shadow-[var(--lp-shadow)] hover:shadow-[var(--lp-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <span className="w-11 h-11 rounded-2xl bg-[var(--lp-surface)] text-[var(--lp-green)] font-numbers text-lg font-semibold flex items-center justify-center">
                    {s.step}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-[var(--lp-ink)] mt-4">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--lp-ink-soft)] mt-2">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Module catalogue */}
        <section className="py-12 sm:py-16 lg:py-20" aria-labelledby="store-modules-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="The catalogue"
              title={<span id="store-modules-heading">Modules for every stage</span>}
              sub="Examples of the DineDesk ecosystem — enquire about any module and our team will set it up with you. Module pricing appears inside your POS at activation, so you only ever pay for what you switch on."
            />
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 max-w-6xl mx-auto">
              {STORE_CATEGORIES.map((cat, i) => (
                <ModuleCard key={cat.name} cat={cat} />
              ))}
            </div>

            <p className="lp-reveal text-center text-xs text-[var(--lp-ink-faint)] max-w-2xl mx-auto mt-8 leading-relaxed">
              Store modules are optional add-ons — they are never bundled into Basic or Growth
              automatically. You choose what to add, when to add it.
            </p>
          </div>
        </section>

        {/* CTA band */}
        <section className="pb-16 sm:pb-20 lg:pb-24" aria-labelledby="store-cta-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lp-reveal relative overflow-hidden rounded-[2rem] bg-[var(--lp-surface)] border border-[var(--lp-surface-line)] shadow-[var(--lp-shadow-hover)] px-6 py-12 sm:px-12 sm:py-14 text-center">
              <div
                className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[var(--lp-green)] opacity-[0.14] blur-3xl pointer-events-none"
                aria-hidden="true"
              />
              <div className="relative max-w-2xl mx-auto">
                <span className="lp-eyebrow">
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                  DineDesk Store
                </span>
                <h2
                  id="store-cta-heading"
                  className="font-heading-xl text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--lp-on-dark)] mt-4 leading-[1.12]"
                >
                  Start simple today. Add power when you're ready.
                </h2>
                <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--lp-on-dark-soft)]">
                  Create your DineDesk account on Basic or Growth, then grow your stack module by
                  module from the Store inside your POS.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                  <Link to="/register" className="lp-btn-primary text-base px-8">
                    Start with DineDesk
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <a href={STORE_MAILTO} className="lp-btn-ghost-dark text-base px-8">
                    Explore modules with us
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
