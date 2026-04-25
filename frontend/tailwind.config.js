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
        bg: {
          DEFAULT: '#0F0F23',
          surface: '#16213E',
          card: '#1A1A3E',
        },
        glass: {
          border: 'rgba(255,255,255,0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
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
