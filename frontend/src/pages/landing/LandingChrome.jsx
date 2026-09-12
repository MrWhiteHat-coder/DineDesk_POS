import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import logoUrl from '../../assets/dinedesk-logo.png';
import { Menu, X, Moon, Sun, Mail, Phone } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   Shared chrome for the public marketing pages (landing + store):
   nav, footer, logo, theme toggle, section heading, scroll reveal.
   ──────────────────────────────────────────────────────────────── */

export const CONTACT_EMAIL = 'support@dinedesk.in';
export const CONTACT_PHONE_DISPLAY = '+91 98403 93658';
export const CONTACT_PHONE_TEL = 'tel:+919840393658';
export const STORE_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('DineDesk Store — module enquiry')}`;

export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Plans', href: '#plans' },
  { label: 'DineDesk Store', href: '/store' },
  { label: 'Enterprise', href: '#enterprise' },
  { label: 'Contact', href: '#contact' },
];

/* Adds .is-visible to .lp-reveal elements as they enter the viewport */
export function useScrollReveal() {
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('.lp-reveal');
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return rootRef;
}

export function LogoMark({ size = 'md', onDark = false }) {
  /* Bare brand lockup. `onDark` renders the white variant for tinted
     surfaces (footer in both themes); the nav variant flips to white in
     Night Shift via CSS. */
  const img = size === 'lg' ? 'h-10' : 'h-7';
  return (
    <img
      src={logoUrl}
      alt=""
      className={`lp-logo ${onDark ? 'lp-logo-white' : 'lp-logo-nav'} ${img} w-auto`}
      loading="eager"
    />
  );
}

export function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to Night Shift'}
      title={dark ? 'Light Mode' : 'Night Shift'}
      className={`lp-theme-toggle ${className}`}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function SectionHeading({ eyebrow, title, sub, dark = false, center = true }) {
  return (
    <div className={`${center ? 'text-center mx-auto' : ''} max-w-2xl`}>
      <span className="lp-eyebrow">{eyebrow}</span>
      <h2
        className={`font-heading-xl text-3xl sm:text-4xl font-extrabold tracking-tight mt-4 leading-[1.12] ${
          dark ? 'text-[var(--lp-on-dark)]' : 'text-[var(--lp-ink)]'
        }`}
      >
        {title}
      </h2>
      {sub && (
        <p
          className={`mt-4 text-base sm:text-lg leading-relaxed ${
            dark ? 'text-[var(--lp-on-dark-soft)]' : 'text-[var(--lp-ink-soft)]'
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─────────────────── Navigation ─────────────────── */

function NavItem({ item, hashPrefix, className, onClick }) {
  if (item.href.startsWith('#')) {
    return (
      <a href={`${hashPrefix}${item.href}`} className={className} onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className} onClick={onClick}>
      {item.label}
    </Link>
  );
}

export function LandingNav({ hashPrefix = '' }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet whenever a link is used
  const close = () => setOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'lp-nav-scrolled'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav
        className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px]"
        aria-label="Main"
      >
        <Link to="/" className="flex flex-col items-end gap-1 min-w-0" aria-label="DineDesk home">
          <LogoMark />
          <span className="text-[10px] text-[var(--lp-ink-faint)] leading-none pr-0.5 whitespace-nowrap">
            by Trident Ventures
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <NavItem
              key={l.href}
              item={l}
              hashPrefix={hashPrefix}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-[var(--lp-ink-soft)] hover:text-[var(--lp-ink)] hover:bg-[var(--lp-green-tint)] transition-colors"
            />
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            to="/login"
            className="h-12 px-5 inline-flex items-center rounded-xl text-sm font-semibold text-[var(--lp-ink)] hover:bg-[var(--lp-green-tint)] transition-colors"
          >
            Sign In
          </Link>
          <Link to="/register" className="lp-btn-primary text-sm">
            Get Started
          </Link>
        </div>

        {/* Mobile controls */}
        <div className="flex lg:hidden items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="w-12 h-12 rounded-xl inline-flex items-center justify-center text-[var(--lp-ink)] hover:bg-[var(--lp-green-tint)] transition-colors"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      {open && (
        <div id="lp-mobile-menu" className="lg:hidden lp-mobile-sheet">
          <div className="px-4 sm:px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <NavItem
                key={l.href}
                item={l}
                hashPrefix={hashPrefix}
                onClick={close}
                className="px-4 py-3.5 rounded-xl text-[15px] font-semibold text-[var(--lp-ink)] hover:bg-[var(--lp-green-tint)] transition-colors"
              />
            ))}
            <div className="grid grid-cols-2 gap-2.5 mt-3 pb-2">
              <Link to="/login" onClick={close} className="lp-btn-outline text-sm">
                Sign In
              </Link>
              <Link to="/register" onClick={close} className="lp-btn-primary text-sm">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────── Footer ─────────────────── */

function FooterLink({ href, children, hashPrefix = '' }) {
  const cls =
    'text-sm text-[var(--lp-on-dark-soft)] hover:text-[var(--lp-on-dark)] transition-colors py-1.5 inline-flex items-center gap-1';
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={`${hashPrefix}${href}`} className={cls}>
      {children}
    </a>
  );
}

export function Footer({ hashPrefix = '' }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[var(--lp-surface)] border-t border-[var(--lp-surface-line)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid gap-10 sm:gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
          {/* brand */}
          <div>
            <Link to="/" className="inline-flex flex-col items-end gap-1.5" aria-label="DineDesk home">
              <LogoMark size="lg" onDark />
              <span className="text-[11px] text-[var(--lp-on-dark-faint)] leading-none pr-0.5 whitespace-nowrap">
                by Trident Ventures
              </span>
            </Link>
            <p className="font-script text-xl text-[var(--lp-green)] mt-4 leading-tight">
              Absorbs chaos. Serves calm.
            </p>
            <p className="text-xs text-[var(--lp-on-dark-faint)] mt-3 max-w-xs leading-relaxed">
              A restaurant operating system by Trident Ventures. Start small. Add power when you
              need it.
            </p>
          </div>

          {/* product */}
          <nav aria-label="Product">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--lp-on-dark-faint)]">
              Product
            </p>
            <ul className="mt-4 space-y-1">
              <li><FooterLink hashPrefix={hashPrefix} href="#product">POS</FooterLink></li>
              <li><FooterLink hashPrefix={hashPrefix} href="#plans">Plans</FooterLink></li>
              <li><FooterLink href="/store">DineDesk Store</FooterLink></li>
              <li><FooterLink hashPrefix={hashPrefix} href="#enterprise">Enterprise</FooterLink></li>
            </ul>
          </nav>

          {/* company */}
          <nav aria-label="Company">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--lp-on-dark-faint)]">
              Company
            </p>
            <ul className="mt-4 space-y-1">
              <li><FooterLink hashPrefix={hashPrefix} href="#why">About</FooterLink></li>
              <li><FooterLink hashPrefix={hashPrefix} href="#contact">Contact</FooterLink></li>
              <li>
                <FooterLink href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Support request')}`}>
                  Support
                </FooterLink>
              </li>
            </ul>
          </nav>

          {/* legal */}
          <nav aria-label="Legal">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--lp-on-dark-faint)]">
              Legal
            </p>
            <ul className="mt-4 space-y-1">
              <li>
                <FooterLink
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Privacy Policy request')}`}
                >
                  Privacy Policy
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Terms of Service request')}`}
                >
                  Terms
                </FooterLink>
              </li>
            </ul>
          </nav>

          {/* contact */}
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--lp-on-dark-faint)]">
              Contact
            </p>
            <ul className="mt-4 space-y-1">
              <li>
                <FooterLink href={`mailto:${CONTACT_EMAIL}`}>
                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  {CONTACT_EMAIL}
                </FooterLink>
              </li>
              <li>
                <FooterLink href={CONTACT_PHONE_TEL}>
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                  {CONTACT_PHONE_DISPLAY}
                </FooterLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--lp-surface-line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-[var(--lp-on-dark-faint)]">
            © {year} Trident Ventures. All rights reserved.
          </p>
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--lp-on-dark-faint)]">
            Start small. Add power when you need it.
          </p>
        </div>
      </div>
    </footer>
  );
}
