/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary CTA — bright blue, matches the reference SaaS site.
        primary: '#2563EB',
        primaryDeep: '#1D4ED8',
        secondary: '#0E1626',
        accent: '#F59E0B',
        success: '#16A34A',
        whatsapp: '#25D366',
        // Light theme: cream BG, white cards, navy accent panels.
        bg: {
          DEFAULT: '#F4EFE5',  // cream — page background
          surface: '#FFFFFF',  // white — top-level panels
          card: '#FFFFFF',     // white — card surface
          dark: '#0E1626',     // deep navy — accent/contrast panels
        },
        navy: {
          DEFAULT: '#0E1626',
          soft: '#1A2236',
          line: 'rgba(14,22,38,0.08)',
        },
        // Landing-page warm palette (kept for /landing & /login compatibility)
        cream: '#F8F1E4',
        offwhite: '#FFFCF7',
        charcoal: '#1F1815',
        ovenred: '#8B1A1A',
        glass: {
          // In light theme glass.border is a soft charcoal hairline.
          border: 'rgba(14,22,38,0.10)',
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
        // In the new light theme glass-gradient becomes a near-white card
        // surface with a hint of warmth from the cream BG.
        'glass-gradient':
          'linear-gradient(180deg, #FFFFFF 0%, #FBF6EE 100%)',
        // Primary CTA gradient — solid-feeling blue, matches the reference
        // SaaS site's bright blue button (Tailwind blue-600 → blue-700).
        'primary-gradient':
          'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)',
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
        // Light-theme shadows replace the old "glow" rings — now it's a
        // soft elevation drop, not a colored halo.
        'glow-primary': '0 8px 22px -6px rgba(37,99,235,0.35)',
        'glow-accent': '0 8px 22px -6px rgba(245,158,11,0.35)',
        'card': '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(14,22,38,0.04), 0 6px 18px -8px rgba(14,22,38,0.10)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.8) inset, 0 4px 8px rgba(14,22,38,0.06), 0 18px 36px -16px rgba(14,22,38,0.18)',
      },
    },
  },
  plugins: [],
}
