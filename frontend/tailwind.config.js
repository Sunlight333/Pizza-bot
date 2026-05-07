/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-able tokens reference CSS variables — flipping the
        // [data-theme] attribute on <html> swaps every usage at once.
        // Defaults (when --c-* aren't set) match the light theme so SSR /
        // pre-hydration renders look right.
        primary: 'var(--c-primary, #4F46E5)',
        primaryDeep: 'var(--c-primary-deep, #4338CA)',
        secondary: 'var(--c-secondary, #0F172A)',
        // Static (theme-agnostic) accents — these read fine on both
        // backgrounds, no need to swap.
        violet: '#A855F7',
        violetDeep: '#9333EA',
        accent: '#F97316',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        whatsapp: '#25D366',
        bg: {
          DEFAULT: 'var(--c-bg, #F7F8FB)',
          surface: 'var(--c-bg-surface, #FFFFFF)',
          card: 'var(--c-bg-card, #FFFFFF)',
          dark: '#0F172A',
        },
        slate: {
          line: '#E5E9F0',
          subtle: '#94A3B8',
          muted: '#64748B',
          soft: '#1E293B',
          DEFAULT: '#0F172A',
        },
        // Landing-page warm palette (kept for /landing & /login compatibility)
        cream: '#F8F1E4',
        offwhite: '#FFFCF7',
        charcoal: '#1F1815',
        ovenred: '#8B1A1A',
        glass: {
          border: 'var(--c-glass-border, #E5E9F0)',
        },
      },
      fontFamily: {
        // Admin uses a single sans-serif system (Geist + Inter) for a clean,
        // modern SaaS feel. font-display is the heavy headline weight.
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        // Landing page keeps its Space Grotesk + Playfair pair via direct
        // class usage / inline CSS variables; not exposed as a Tailwind name.
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      letterSpacing: {
        'display': '-0.02em',     // tight tracking on big headlines
        'display-tight': '-0.03em',
        'eyebrow': '0.14em',      // wide tracking on uppercase labels
      },
      backgroundImage: {
        // Theme-driven gradients — flip with [data-theme].
        'glass-gradient': 'var(--c-glass-gradient, linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%))',
        'primary-gradient': 'var(--c-primary-gradient, linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%))',
        // Pastel stat-card tints — light theme only; in dark mode they read
        // as faint glass on dark, which still works.
        'tint-blue':    'linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 100%)',
        'tint-violet':  'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)',
        'tint-emerald': 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)',
        'tint-orange':  'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      boxShadow: {
        'glow-primary': 'var(--c-glow-primary, 0 10px 28px -10px rgba(79,70,229,0.45))',
        'glow-accent':  '0 10px 28px -10px rgba(249,115,22,0.40)',
        'card':         '0 1px 2px rgba(15,23,42,0.04), 0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 20px -10px rgba(15,23,42,0.08)',
        'card-hover':   '0 4px 8px rgba(15,23,42,0.06), 0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 32px -16px rgba(15,23,42,0.14)',
      },
    },
  },
  plugins: [],
}
