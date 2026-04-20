// tailwind.config.js — Premium Dark v5.0
// Expose les tokens du design system v5 en classes utilitaires Tailwind.
// Rétro-compatible : toute classe v4 continue de fonctionner.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Surfaces (sombres profondes)
        ink: {
          950: '#03040a',
          900: '#060811',
          800: '#0b0d18',
          700: '#11131f',
          600: '#181a2a',
          500: '#1e2033',
        },
        // Accent cyan électrique (complémentaire du violet)
        electric: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      backgroundImage: {
        'grad-violet': 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #06b6d4 100%)',
        'grad-nebula': 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)',
        'grad-ocean':  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
        'grad-ember':  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        'grad-aurora': 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
      },
      boxShadow: {
        'glow-violet':  '0 0 40px -8px rgba(139,92,246,0.55)',
        'glow-cyan':    '0 0 40px -8px rgba(6,182,212,0.55)',
        'glow-pink':    '0 0 40px -8px rgba(236,72,153,0.50)',
        'glow-emerald': '0 0 40px -8px rgba(16,185,129,0.45)',
        'glow-amber':   '0 0 40px -8px rgba(251,191,36,0.45)',
        'premium':      '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.8)',
        'premium-hi':   '0 1px 0 rgba(255,255,255,0.08) inset, 0 30px 60px -30px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'pulse-soft':     { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        'shimmer':        { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        'scan-v':         { '0%': { transform: 'translateY(-2%)' }, '100%': { transform: 'translateY(102vh)' } },
        'float-slow':     { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
        'twinkle':        { '0%,100%': { opacity: 0.15 }, '50%': { opacity: 0.7 } },
        'rotate-slow':    { 'to': { transform: 'rotate(360deg)' } },
        'gradient-shift': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        'pulse-soft':     'pulse-soft 2.2s ease-in-out infinite',
        'shimmer':        'shimmer 2.5s infinite',
        'scan-v':         'scan-v 8s linear infinite',
        'float-slow':     'float-slow 4s ease-in-out infinite',
        'twinkle':        'twinkle 3s ease-in-out infinite',
        'rotate-slow':    'rotate-slow 28s linear infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
      },
      backdropBlur: {
        '3xl': '40px',
      },
    },
  },
  plugins: [],
};
