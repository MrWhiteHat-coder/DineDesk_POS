/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['Fraunces', 'Georgia', 'serif'],
        'heading': ['Fraunces', 'Georgia', 'serif'],
        'heading-xl': ['Fraunces', 'Georgia', 'serif'],
        'body': ['Plus Jakarta Sans', 'sans-serif'],
        'sans': ['Plus Jakarta Sans', 'sans-serif'],
        'numbers': ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#101820',
          soft: '#1A2633',
        },
        navy: {
          DEFAULT: '#1B4F72',
          bright: '#246A96',
        },
        saffron: {
          DEFAULT: '#D4A017',
          deep: '#B8860B',
        },
        terracotta: '#C45C26',
        linen: '#F3EEE6',
        plate: '#FFFCF8',
        forest: '#1A7A54',
        rose: '#C23A2B',
        line: '#E6DDD0',
        dd: {
          blue: '#1B4F72',
          'blue-light': '#246A96',
          'blue-dark': '#163A5F',
          saffron: '#D4A017',
          'saffron-light': '#E8BC4A',
          'saffron-dark': '#B8860B',
          black: '#101820',
          success: '#1A7A54',
          warning: '#D4A017',
          error: '#C23A2B',
        },
        primary: {
          DEFAULT: '#1B4F72',
          foreground: '#FFFCF8',
          light: '#246A96',
          dark: '#163A5F',
        },
        accent: {
          DEFAULT: '#D4A017',
          foreground: '#101820',
          light: '#E8BC4A',
          dark: '#B8860B',
        },
        surface: {
          DEFAULT: '#FFFCF8',
          card: '#FFFCF8',
          dark: '#101820',
          muted: '#F3EEE6',
        },
        border: '#E6DDD0',
        card: {
          DEFAULT: '#FFFCF8',
          foreground: '#101820',
        },
        muted: {
          DEFAULT: '#F3EEE6',
          foreground: '#6B6258',
        },
        destructive: {
          DEFAULT: '#C23A2B',
          foreground: '#FFFFFF',
        },
      },
      borderRadius: {
        'card': '14px',
        'btn': '10px',
        'input': '10px',
        'modal': '18px',
        'pill': '999px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(16,24,32,0.04), 0 8px 24px rgba(16,24,32,0.04)',
        'card-hover': '0 8px 28px rgba(16,24,32,0.10)',
        'elevated': '0 12px 32px rgba(16,24,32,0.12)',
        'blue': '0 8px 20px rgba(27,79,114,0.22)',
        'saffron': '0 8px 20px rgba(212,160,23,0.25)',
        'ink': '0 10px 24px rgba(16,24,32,0.18)',
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
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
