/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — extends the existing landing page tokens.
        cream: '#F8F1E4',
        offwhite: '#FFFCF7',
        charcoal: '#1F1815',
        ovenred: '#8B1A1A',
        ovenredDeep: '#6F1414',
        // Customer-portal accents
        ember: '#E94B1F',
        basil: '#5A7A2C',
        crust: '#D9B382',
        // Neutrals
        slateLine: '#E5E9F0',
        slateMuted: '#64748B',
        slateSoft: '#1E293B',
        // States
        danger: '#B33A3A',
        warning: '#D9871F',
      },
      fontFamily: {
        // Display: Playfair (loaded via Google Fonts in index.html)
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Body: Inter
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Mobile ramp from the design spec; line-height is built in
        'display-xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        'display-lg': ['28px', { lineHeight: '32px', letterSpacing: '-0.015em' }],
        'display-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        'body-lg':    ['17px', { lineHeight: '26px' }],
        'body':       ['15px', { lineHeight: '22px' }],
        'body-sm':    ['13px', { lineHeight: '18px' }],
        'label':      ['12px', { lineHeight: '16px', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '24px',
      },
      boxShadow: {
        'soft':   '0 1px 2px rgba(31,24,21,0.04), 0 8px 24px -12px rgba(31,24,21,0.10)',
        'lifted': '0 4px 8px rgba(31,24,21,0.06), 0 24px 48px -16px rgba(31,24,21,0.18)',
        'cta':    '0 8px 20px -8px rgba(139,26,26,0.45)',
        'cta-hover': '0 12px 28px -8px rgba(139,26,26,0.55)',
      },
      transitionTimingFunction: {
        'std': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'shimmer': 'shimmer 1.6s linear infinite',
        'pulse-soft': 'pulse-soft 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
      },
    },
  },
  plugins: [],
}
