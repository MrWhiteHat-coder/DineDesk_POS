import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Mail, Phone, ArrowLeft } from 'lucide-react';
import { LandingNav, Footer, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from './LandingChrome';
import usePageMeta from '../../lib/usePageMeta';

/* ────────────────────────────────────────────────────────────────
   Public legal pages: Terms of Service and Privacy Policy.
   Drafted for Indian law — the Information Technology Act, 2000
   (incl. the 2011 Reasonable Security Practices Rules) and the
   Digital Personal Data Protection Act, 2023 (DPDP).
   Owner: Trident Ventures, Chennai. Effective date: 12 Sep 2026.
   ──────────────────────────────────────────────────────────────── */

const EFFECTIVE_DATE = '12 September 2026';
const SITE_URL = 'https://www.revontechnologies.in';

function LegalShell({ children }) {
  return (
    <div className="lp min-h-screen antialiased selection:bg-[var(--lp-green-a25)]">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--lp-green-deep)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to home
        </Link>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Section({ num, title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg font-bold text-[var(--lp-ink)] flex items-baseline gap-2.5">
        <span className="font-numbers text-[var(--lp-green-deep)]">{num}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--lp-ink-soft)]">{children}</div>
    </section>
  );
}

/* ═══════════════════ TERMS OF SERVICE ═══════════════════ */

export function TermsPage() {
  usePageMeta({
    title: 'Terms of Service — DineDesk POS | Trident Ventures',
    description: 'Terms of Service for DineDesk POS, the restaurant billing and operations software by Trident Ventures, Chennai, India. Governed by Indian law.',
    noindex: false,
  });

  return (
    <LegalShell>
      <div className="mt-6 flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[var(--lp-green-tint)] flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--lp-green-deep)]" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading-xl text-3xl font-extrabold tracking-tight text-[var(--lp-ink)]">Terms of Service</h1>
          <p className="text-sm text-[var(--lp-ink-faint)] mt-0.5">Effective date: {EFFECTIVE_DATE} · Governing law: India</p>
        </div>
      </div>

      <p className="mt-6 text-[15px] leading-relaxed text-[var(--lp-ink-soft)]">
        These Terms of Service ("Terms") govern your access to and use of <strong>DineDesk POS</strong>, a
        restaurant billing and operations platform operated by <strong>Trident Ventures</strong>, Chennai, Tamil
        Nadu, India ("we", "us", "our"), through <a href={SITE_URL} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{SITE_URL}</a>.
        By creating an account, subscribing to a plan, or using DineDesk POS, you agree to these Terms.
      </p>

      <Section num="1." title="Eligibility and the establishment">
        <p>
          You must be at least 18 years of age and legally competent under the Indian Contract Act, 1872 to enter
          into these Terms. You represent that you own or are authorised to operate the restaurant, café, food
          stall or food business ("Establishment") for which you create an account, and that all information you
          provide (including your food business registration, where applicable under the FSSAI Act, 2006, and
          GST registration under the CGST Act, 2017) is accurate and kept current.
        </p>
      </Section>

      <Section num="2." title="Your account">
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and for all activity
          under your account, including accounts created for your staff (cashier, captain, chef roles). Notify us
          immediately of any unauthorised use. We may suspend accounts engaged in fraud, unlawful activity, abuse
          of the service, or non-payment, with reasonable notice where practicable.
        </p>
      </Section>

      <Section num="3." title="Subscriptions, plans and billing">
        <p>
          DineDesk POS is offered on the plans published on our pricing page, currently Basic (₹999 per month)
          and Growth (₹3,999 per month), together with optional DineDesk Store add-on modules priced separately.
          Prices are stated in Indian Rupees and are exclusive of GST, which is added at the applicable rate.
        </p>
        <p>
          Subscriptions are billed in advance on a monthly basis and renew automatically until cancelled. You may
          cancel at any time from your account settings; cancellation stops future renewals, and access continues
          until the end of the paid period. Fees already paid are non-refundable except where required by law or
          where we fail to provide the service. We may change prices with at least 30 days' prior notice.
        </p>
      </Section>

      <Section num="4." title="Your data and your restaurant content">
        <p>
          All menu items, orders, inventory records, customer information, sales data and other content you enter
          into DineDesk POS ("Your Content") remains <strong>yours</strong>. You grant us a limited licence to
          process and store Your Content solely to operate, secure, support and improve the service for you. We
          do not sell Your Content. You may export or request deletion of Your Content at any time by writing to
          us; we will complete verified deletion requests within 30 days, subject to applicable statutory
          retention obligations (such as tax and accounting records under Indian law).
        </p>
      </Section>

      <Section num="5." title="Acceptable use">
        <p>
          You agree not to: use the service for any unlawful purpose; process fraudulent transactions; attempt to
          access other tenants' data; reverse engineer, resell or provide the service to third parties as your
          own product; upload malicious code; or interfere with the service's integrity or security. You are
          responsible for obtaining any licences required to run your food business and for the accuracy of
          taxes, prices and GST settings you configure.
        </p>
      </Section>

      <Section num="6." title="Availability, support and changes">
        <p>
          We work to keep DineDesk POS available and reliable, and we provide support through{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_EMAIL}</a> and{' '}
          <a href={CONTACT_PHONE_TEL} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_PHONE_DISPLAY}</a>.
          The service may be unavailable for maintenance or events beyond our reasonable control (force majeure).
          We may add, modify or retire features; material reductions to a paid plan will be communicated in
          advance.
        </p>
      </Section>

      <Section num="7." title="Intellectual property">
        <p>
          DineDesk, the DineDesk logo and the platform software are the intellectual property of Trident
          Ventures and are protected by Indian and international law. "Your Content" remains yours as set out in
          Section 4. Trident Ventures™ and associated marks may not be used without our written permission.
        </p>
      </Section>

      <Section num="8." title="Disclaimers and limitation of liability">
        <p>
          The service is provided on an "as is" and "as available" basis. To the fullest extent permitted by law,
          we disclaim warranties not expressly stated in these Terms. Our total liability for any claim relating
          to the service is limited to the subscription fees you paid to us in the twelve (12) months preceding
          the claim. We are not liable for indirect, incidental or consequential losses, including loss of
          profits or data caused by your failure to maintain backups of Your Content. Nothing in these Terms
          limits liability that cannot be limited under applicable Indian law.
        </p>
      </Section>

      <Section num="9." title="Indemnity">
        <p>
          You agree to indemnify and hold us harmless from claims, damages and reasonable legal costs arising
          from your breach of these Terms or your use of the service in violation of law, including disputes
          arising from taxes you collect or products you sell through the platform.
        </p>
      </Section>

      <Section num="10." title="Termination">
        <p>
          You may stop using the service and delete your account at any time. We may terminate or suspend access
          for material breach of these Terms after notice and a reasonable opportunity to cure, or immediately
          where required to prevent unlawful activity or harm. On termination, Section 4 (data export/deletion)
          and this Section survive.
        </p>
      </Section>

      <Section num="11." title="Governing law and dispute resolution">
        <p>
          These Terms are governed by the laws of India, including the Information Technology Act, 2000. The
          courts at Chennai, Tamil Nadu shall have exclusive jurisdiction, subject to mandatory consumer
          protection provisions applicable to you under the Consumer Protection Act, 2019. Before litigating,
          the parties will attempt good-faith resolution by writing to us at the contact below.
        </p>
      </Section>

      <Section num="12." title="Grievance officer (required under the IT Act, 2000)">
        <p>
          Under Rule 5(9) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code)
          Rules, 2021, our grievance officer can be contacted for any complaints regarding the service or
          content, and will acknowledge your complaint within 72 hours and resolve it within one month:
        </p>
        <div className="mt-4 rounded-2xl bg-[var(--lp-card)] border border-[var(--lp-card-line)] p-5 space-y-2">
          <p className="font-semibold text-[var(--lp-ink)]">Grievance Officer — Trident Ventures</p>
          <p className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-[var(--lp-green-deep)]" aria-hidden="true" />
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_EMAIL}</a>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-[var(--lp-green-deep)]" aria-hidden="true" />
            <a href={CONTACT_PHONE_TEL} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_PHONE_DISPLAY}</a>
          </p>
          <p className="text-sm text-[var(--lp-ink-faint)]">Trident Ventures, Chennai, Tamil Nadu, India</p>
        </div>
      </Section>

      <Section num="13." title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. Material changes will be notified by email or in-product
          notice at least 15 days before taking effect. Continued use after the effective date constitutes
          acceptance. The current version is always available on this page.
        </p>
      </Section>

      <p className="mt-10 text-sm text-[var(--lp-ink-faint)]">
        Questions? Write to <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_EMAIL}</a>.
        See also our <Link to="/privacy" className="font-semibold text-[var(--lp-green-deep)] hover:underline">Privacy Policy</Link>.
      </p>
    </LegalShell>
  );
}

/* ═══════════════════ PRIVACY POLICY ═══════════════════ */

export function PrivacyPage() {
  usePageMeta({
    title: 'Privacy Policy — DineDesk POS | Trident Ventures',
    description: 'How DineDesk POS by Trident Ventures collects, uses and protects personal data, in compliance with the Digital Personal Data Protection Act, 2023 and the IT Act, 2000.',
    noindex: false,
  });

  return (
    <LegalShell>
      <div className="mt-6 flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[var(--lp-green-tint)] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[var(--lp-green-deep)]" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading-xl text-3xl font-extrabold tracking-tight text-[var(--lp-ink)]">Privacy Policy</h1>
          <p className="text-sm text-[var(--lp-ink-faint)] mt-0.5">Effective date: {EFFECTIVE_DATE} · Compliant with the DPDP Act, 2023 & IT Act, 2000</p>
        </div>
      </div>

      <p className="mt-6 text-[15px] leading-relaxed text-[var(--lp-ink-soft)]">
        This Privacy Policy explains how <strong>Trident Ventures</strong>, Chennai, India ("we", "us"), the
        operator of <strong>DineDesk POS</strong>, collects, uses, stores and protects personal data — yours as a
        restaurant operator, and that of the customers whose information your restaurant records in the platform.
        We process personal data in accordance with the <strong>Digital Personal Data Protection Act, 2023
        (DPDP)</strong> and the <strong>Information Technology Act, 2000</strong> together with its Reasonable
        Security Practices Rules, 2011.
      </p>

      <Section num="1." title="Who we are and how to reach us">
        <p>
          Data Fiduciary: Trident Ventures, Chennai, Tamil Nadu, India. For any privacy question, data request or
          grievance, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_EMAIL}</a> or{' '}
          <a href={CONTACT_PHONE_TEL} className="font-semibold text-[var(--lp-green-deep)] hover:underline">{CONTACT_PHONE_DISPLAY}</a>.
          We acknowledge privacy complaints within 72 hours and resolve them within one month, as required by law.
        </p>
      </Section>

      <Section num="2." title="Whose data we process">
        <p>
          <strong>(a) Restaurant operators and staff:</strong> name, business email, phone number, restaurant
          details, and account credentials you provide when registering or inviting team members.
        </p>
        <p>
          <strong>(b) Your customers (end customers of your restaurant):</strong> name, phone number, email and
          order history that your restaurant enters or collects through features such as billing, CRM, loyalty or
          feedback. For this data, your restaurant determines the purpose and we act as instructed by you;
          Operators using our platform are responsible for meeting their own obligations towards their customers.
        </p>
        <p>
          <strong>(c) Website visitors:</strong> limited technical data (device, browser, pages visited) needed
          to operate and secure this website.
        </p>
      </Section>

      <Section num="3." title="What we collect and why (purpose of processing)">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Providing the service:</strong> accounts, authentication, billing operations, orders, inventory, reports.</li>
          <li><strong>Subscription management:</strong> processing plan payments through our payment partner, invoicing and GST-compliant receipts.</li>
          <li><strong>Support and communication:</strong> responding to enquiries, service notices, verification emails.</li>
          <li><strong>Security and abuse prevention:</strong> login rate limiting, audit logs of actions inside the POS.</li>
          <li><strong>Service improvement:</strong> aggregated, de-identified usage statistics to improve reliability and features.</li>
        </ul>
        <p>We do not sell personal data, and we do not use your restaurant's customer data for our own marketing.</p>
      </Section>

      <Section num="4." title="Legal basis under the DPDP Act, 2023">
        <p>
          We process personal data on the basis of your <strong>consent</strong> (given when you create an account
          or your restaurant collects its customers' data through the platform) and for <strong>legitimate
          uses</strong> permitted by the DPDP Act, such as providing the service you have requested, complying
          with Indian law, and responding to emergencies. You may withdraw consent at any time by writing to us;
          withdrawal does not affect processing already completed.
        </p>
      </Section>

      <Section num="5." title="Where data is stored and how it is secured">
        <p>
          Data is stored on managed cloud infrastructure. Passwords are stored only as salted bcrypt hashes, all
          traffic is encrypted in transit (HTTPS/TLS), and access to production data is restricted to authorised
          personnel on a need-to-know basis. We follow reasonable security practices as required by the IT
          (Reasonable Security Practices and Procedures) Rules, 2011, and review these measures regularly.
        </p>
      </Section>

      <Section num="6." title="Sharing and processors">
        <p>
          We share personal data only with service providers who help us run DineDesk POS — cloud hosting
          (Render/Atlas infrastructure), email delivery, payment gateways for subscription charges, and
          authentication providers (Google/Microsoft sign-in, if you use them) — each bound by contractual
          confidentiality and security obligations. We may also disclose data where required by Indian law, court
          order or government authority with lawful jurisdiction.
        </p>
      </Section>

      <Section num="7." title="Your rights as a Data Principal (DPDP Act)">
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Access a summary of your personal data and the processing done with it;</li>
          <li>Correction, completion or updating of inaccurate data;</li>
          <li>Erasure of your data, subject to statutory retention requirements;</li>
          <li>Nominate another individual to exercise your rights if you are unable to;</li>
          <li>Grievance redressal — acknowledged within 72 hours, resolved within one month.</li>
        </ul>
        <p>
          To exercise any right, write to us at the contact in Section 1. If you are a customer of a restaurant
          using DineDesk POS, please first contact that restaurant, which manages your data as its record; we
          will assist them in fulfilling your request.
        </p>
      </Section>

      <Section num="8." title="Retention">
        <p>
          We keep account and billing data for as long as your subscription is active and for statutory periods
          thereafter (tax and accounting records are retained as required by Indian law, typically 8 years).
          Restaurant operational data is retained while the account is active; on verified deletion request we
          erase it within 30 days, except where law requires longer retention.
        </p>
      </Section>

      <Section num="9." title="Children's data">
        <p>
          DineDesk POS is a business tool and is not directed at individuals under 18. We do not knowingly
          process children's personal data. Under the DPDP Act, verifiable parental consent is required before
          processing a child's data; if you believe such data has been provided, contact us and we will delete it.
        </p>
      </Section>

      <Section num="10." title="Cookies and tracking">
        <p>
          We use only strictly necessary cookies and browser storage (session tokens, theme preference) to run
          the application. We do not use third-party advertising trackers or sell behavioural data. Google
          sign-in sets its own cookies when you use that option, governed by Google's policy.
        </p>
      </Section>

      <Section num="11." title="Data breach notification">
        <p>
          In the event of a personal data breach likely to cause harm, we will notify affected users and the Data
          Protection Board of India as required under the DPDP Act, and take immediate steps to contain and
          remediate the breach.
        </p>
      </Section>

      <Section num="12." title="Changes to this policy">
        <p>
          We may update this Privacy Policy as the service evolves. Material changes will be notified by email or
          in-product notice before they take effect, and the effective date above will be updated.
        </p>
      </Section>

      <p className="mt-10 text-sm text-[var(--lp-ink-faint)]">
        See also our <Link to="/terms" className="font-semibold text-[var(--lp-green-deep)] hover:underline">Terms of Service</Link>.
        Last reviewed: {EFFECTIVE_DATE}.
      </p>
    </LegalShell>
  );
}
