/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['Poppins', 'sans-serif'],
        'heading-xl': ['Montserrat', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'numbers': ['Inter', 'sans-serif'],
      },
      colors: {
        // DineDesk Brand Colors
        'dd': {
          'blue': '#1E3A8A',       // Neelakanta Blue (primary accent)
          'blue-light': '#2563EB', // Lighter blue for hover
          'blue-dark': '#1E40AF',  // Darker blue
          'saffron': '#F59E0B',    // Saffron (secondary accent)
          'saffron-light': '#FBBF24',
          'saffron-dark': '#D97706',
          'black': '#0A0A0A',      // Primary surface
          'success': '#059669',
          'warning': '#F59E0B',
          'error': '#DC2626',
        },
        // Semantic aliases
        primary: {
          DEFAULT: '#1E3A8A',
          foreground: '#FFFFFF',
          light: '#2563EB',
          dark: '#1E40AF',
        },
        accent: {
          DEFAULT: '#F59E0B',
          foreground: '#000000',
          light: '#FBBF24',
          dark: '#D97706',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          card: '#FFFFFF',
          dark: '#0A0A0A',
          muted: '#F9FAFB',
        },
        border: '#E5E7EB',
        // Card/system
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#111111',
        },
        muted: {
          DEFAULT: '#F3F4F6',
          foreground: '#6B7280',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
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
        'blue': '0 4px 12px rgba(30,58,138,0.25)',
        'saffron': '0 4px 12px rgba(245,158,11,0.25)',
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
