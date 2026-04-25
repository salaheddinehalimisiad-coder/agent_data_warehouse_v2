// tailwind.config.js — Prism Dark v1.0
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Navy surfaces
        navy: {
          950: '#060810',
          900: '#0a0d1a',
          800: '#111525',
          700: '#181c2f',
          600: '#1f2440',
          500: '#263055',
        },
        // Cobalt blue primary
        cobalt: {
          700: '#1e3fa8',
          600: '#2952d8',
          500: '#3d6ae8',
          400: '#4d7ef7',
          300: '#7aa3ff',
          200: '#adc5ff',
        },
        // Teal secondary
        teal: {
          600: '#0284c7',
          500: '#0ea5e9',
          400: '#38bdf8',
          300: '#7dd3fc',
        },
        // AI / model accent
        ai: {
          600: '#7c3aed',
          500: '#8b5cf6',
          400: '#a78bfa',
        },
      },
      backgroundImage: {
        'grad-primary':  'linear-gradient(135deg, #3d6ae8 0%, #0ea5e9 100%)',
        'grad-ai':       'linear-gradient(135deg, #8b5cf6 0%, #3d6ae8 100%)',
        'grad-success':  'linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)',
        'grad-warm':     'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        'grad-aurora':   'linear-gradient(135deg, #22c55e 0%, #0ea5e9 50%, #8b5cf6 100%)',
        // Legacy compat
        'grad-violet':   'linear-gradient(135deg, #8b5cf6 0%, #3d6ae8 100%)',
        'grad-ocean':    'linear-gradient(135deg, #3d6ae8 0%, #0ea5e9 100%)',
        'grad-ember':    'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        'grad-nebula':   'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f59e0b 100%)',
      },
      boxShadow: {
        'glow-blue':   '0 0 24px -4px rgba(61,106,232,0.55)',
        'glow-teal':   '0 0 24px -4px rgba(14,165,233,0.5)',
        'glow-purple': '0 0 24px -4px rgba(139,92,246,0.5)',
        'glow-green':  '0 0 24px -4px rgba(34,197,94,0.45)',
        'glow-amber':  '0 0 24px -4px rgba(245,158,11,0.45)',
        'glow-red':    '0 0 24px -4px rgba(239,68,68,0.45)',
        // Legacy aliases
        'glow-violet':  '0 0 24px -4px rgba(139,92,246,0.5)',
        'glow-cyan':    '0 0 24px -4px rgba(14,165,233,0.5)',
        'glow-pink':    '0 0 24px -4px rgba(236,72,153,0.45)',
        'glow-emerald': '0 0 24px -4px rgba(34,197,94,0.45)',
        'premium':      '0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 32px -16px rgba(0,0,0,0.7)',
        'premium-hi':   '0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 48px -24px rgba(0,0,0,0.85)',
      },
      keyframes: {
        'pulse-soft':     { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        'shimmer':        { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        'scan-v':         { '0%': { transform: 'translateY(-2%)' }, '100%': { transform: 'translateY(102vh)' } },
        'float-slow':     { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
        'twinkle':        { '0%,100%': { opacity: 0.15 }, '50%': { opacity: 0.7 } },
        'rotate-slow':    { 'to': { transform: 'rotate(360deg)' } },
        'gradient-shift': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'fade-in-up':     { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'slide-in-left':  { '0%': { opacity: 0, transform: 'translateX(-12px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      },
      animation: {
        'pulse-soft':     'pulse-soft 2.2s ease-in-out infinite',
        'shimmer':        'shimmer 2.5s infinite',
        'scan-v':         'scan-v 8s linear infinite',
        'float-slow':     'float-slow 4s ease-in-out infinite',
        'twinkle':        'twinkle 3s ease-in-out infinite',
        'rotate-slow':    'rotate-slow 28s linear infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'fade-in-up':     'fade-in-up 0.35s ease forwards',
        'slide-in-left':  'slide-in-left 0.25s ease forwards',
      },
      backdropBlur: {
        '3xl': '40px',
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'DEFAULT': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
