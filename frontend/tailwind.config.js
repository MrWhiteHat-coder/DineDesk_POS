/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['Manrope', 'sans-serif'],
        'heading-xl': ['Manrope', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'numbers': ['Barlow Condensed', 'sans-serif'],
      },
      colors: {
        // DineDesk Brand Colors (White + Black)
        'dd': {
          'ink': '#111827',        // primary CTA / emphasis
          'ink-soft': '#1F2937',   // hover state of ink
          'ink-mid': '#374151',
          'ink-light': '#6B7280',
          'ink-faint': '#9CA3AF',
          'paper': '#FFFFFF',      // primary surface
          'paper-dim': '#F9FAFB',
          'line': '#E5E7EB',
          'night': '#0F1115',      // Night Shift background
          'night-card': '#161A20', // Night Shift card surface
          'success': '#059669',
          'warning': '#F59E0B',
          'error': '#DC2626',
        },
        // shadcn semantic tokens — wired to CSS vars so components (Card,
        // Dialog, Dropdown, Switch, Badge, Button...) adapt to Night Shift.
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
        'input': '6px',
        'modal': '16px',
        'pill': '999px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        'elevated': '0 4px 12px rgba(0,0,0,0.12)',
        'ink': '0 4px 12px rgba(17,24,39,0.25)',
        // Dark-mode shims: opaque shadows over #0F1115 canvas (default
        // rgba shadows wash out on dark backgrounds)
        'card-dark': '0 1px 3px rgba(0,0,0,0.45)',
        'card-hover-dark': '0 4px 12px rgba(0,0,0,0.5)',
        'elevated-dark': '0 4px 12px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' }
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' }
        },
        'calm-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'calm-pulse': 'calm-pulse 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
