/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        secondary: '#1A1A2E',
        accent: '#FFD700',
        success: '#00C853',
        whatsapp: '#25D366',
        bg: {
          DEFAULT: '#0F0F23',
          surface: '#16213E',
          card: '#1A1A3E',
        },
        // Landing-page warm palette
        cream: '#F8F1E4',
        offwhite: '#FFFCF7',
        charcoal: '#1F1815',
        ovenred: '#8B1A1A',
        glass: {
          border: 'rgba(255,255,255,0.12)',
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
        'glass-gradient':
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        'primary-gradient':
          'linear-gradient(135deg, #FF6B35 0%, #FFD700 100%)',
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
        'glow-primary': '0 0 24px rgba(255,107,53,0.35)',
        'glow-accent': '0 0 24px rgba(255,215,0,0.35)',
      },
    },
  },
  plugins: [],
}
