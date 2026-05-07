/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Crisp SaaS palette — Indigo primary with a Violet partner used in
        // gradients (matches the reference dashboard's blue-→-purple chart
        // fills and CTA buttons). Status colors are bumped to the vivid
        // Tailwind defaults so green/orange/red read as "live" data.
        primary: '#4F46E5',         // Indigo-600
        primaryDeep: '#4338CA',     // Indigo-700
        violet: '#A855F7',          // Violet-500 — gradient partner
        violetDeep: '#9333EA',
        secondary: '#0F172A',
        accent: '#F97316',          // Orange-500 — was warm amber
        success: '#10B981',         // Emerald-500
        warning: '#F59E0B',
        danger: '#EF4444',
        whatsapp: '#25D366',
        // Cool light theme — was cream, now slate-tinted off-white.
        bg: {
          DEFAULT: '#F7F8FB',       // page BG, very faint cool tint
          surface: '#FFFFFF',
          card: '#FFFFFF',
          dark: '#0F172A',          // slate-900 for any contrast panels
        },
        // Slate scale for text + borders. Replaces the navy.* family.
        slate: {
          line: '#E5E9F0',          // hairline borders / dividers
          subtle: '#94A3B8',         // tertiary text
          muted: '#64748B',          // secondary text
          soft: '#1E293B',
          DEFAULT: '#0F172A',        // primary text
        },
        // Landing-page warm palette (kept for /landing & /login compatibility)
        cream: '#F8F1E4',
        offwhite: '#FFFCF7',
        charcoal: '#1F1815',
        ovenred: '#8B1A1A',
        glass: {
          // Crisp slate hairline — matches the reference's card borders.
          border: '#E5E9F0',
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
        // Cards are pure white now — no warm tint. The previous cream
        // gradient pulled the page towards "bakery" rather than "SaaS".
        'glass-gradient':
          'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)',
        // Indigo → Violet, matches the reference dashboard's CTA gradient
        // and the blue-purple chart fills.
        'primary-gradient':
          'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        // Pastel surface tints for stat-card backgrounds (mirror the
        // reference's faint blue/purple/green/orange wash on each tile).
        'tint-blue':
          'linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 100%)',
        'tint-violet':
          'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)',
        'tint-emerald':
          'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)',
        'tint-orange':
          'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)',
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
        // Indigo halo for the primary CTA, slate elevation drops for cards
        // — same vocabulary as the reference SaaS site.
        'glow-primary': '0 10px 28px -10px rgba(79,70,229,0.45)',
        'glow-accent':  '0 10px 28px -10px rgba(249,115,22,0.40)',
        'card':         '0 1px 2px rgba(15,23,42,0.04), 0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 20px -10px rgba(15,23,42,0.08)',
        'card-hover':   '0 4px 8px rgba(15,23,42,0.06), 0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 32px -16px rgba(15,23,42,0.14)',
      },
    },
  },
  plugins: [],
}
