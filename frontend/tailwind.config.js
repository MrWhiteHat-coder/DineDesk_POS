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
        'display': ['Poppins', 'Nunito Sans', 'sans-serif'],
        'heading': ['Poppins', 'Nunito Sans', 'sans-serif'],
        'heading-xl': ['Poppins', 'Nunito Sans', 'sans-serif'],
        'body': ['Nunito Sans', 'sans-serif'],
        'sans': ['Nunito Sans', 'sans-serif'],
        'numbers': ['Nunito Sans', 'sans-serif'],
      },
      colors: {
        zomato: {
          DEFAULT: '#E23744',
          dark: '#CB202D',
          soft: '#FFF5F6',
        },
        ink: {
          DEFAULT: '#1C1C1C',
          soft: '#CB202D',
        },
        navy: {
          DEFAULT: '#E23744',
          bright: '#CB202D',
        },
        saffron: {
          DEFAULT: '#E23744',
          deep: '#CB202D',
        },
        terracotta: '#E23744',
        linen: '#F8F8F8',
        plate: '#FFFFFF',
        forest: '#267E3E',
        rose: '#E23744',
        line: '#E8E8E8',
        dd: {
          blue: '#E23744',
          'blue-light': '#EF4F5F',
          'blue-dark': '#CB202D',
          saffron: '#E23744',
          black: '#1C1C1C',
          success: '#267E3E',
          warning: '#F5A623',
          error: '#E23744',
        },
        primary: {
          DEFAULT: '#E23744',
          foreground: '#FFFFFF',
          light: '#EF4F5F',
          dark: '#CB202D',
        },
        accent: {
          DEFAULT: '#E23744',
          foreground: '#FFFFFF',
          light: '#FFF5F6',
          dark: '#CB202D',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          card: '#FFFFFF',
          dark: '#1C1C1C',
          muted: '#F8F8F8',
        },
        border: '#E8E8E8',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1C1C1C',
        },
        muted: {
          DEFAULT: '#F8F8F8',
          foreground: '#696969',
        },
        destructive: {
          DEFAULT: '#E23744',
          foreground: '#FFFFFF',
        },
      },
      borderRadius: {
        'card': '16px',
        'btn': '12px',
        'input': '12px',
        'modal': '20px',
        'pill': '999px',
      },
      boxShadow: {
        'card': '0 1px 4px rgba(28,28,28,0.06)',
        'card-hover': '0 8px 24px rgba(226,55,68,0.12)',
        'elevated': '0 16px 40px rgba(28,28,28,0.12)',
        'blue': '0 8px 20px rgba(226,55,68,0.22)',
        'saffron': '0 8px 20px rgba(226,55,68,0.22)',
        'ink': '0 8px 20px rgba(226,55,68,0.22)',
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
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' }
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
