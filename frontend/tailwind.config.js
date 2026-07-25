/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#060812',
          800: '#0A0E1A',
          700: '#0D1220',
          600: '#111729',
        },
        primary: {
          DEFAULT: '#7C5CFC',
          light: '#9B85FF',
          dark: '#4F46E5',
        },
        cyan: {
          glow: '#22D3EE',
        },
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#FB7185',
        ink: {
          100: '#F1F5F9',
          300: '#CBD5E1',
          500: '#94A3B8',
          700: '#475569',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'grid-glow': 'radial-gradient(circle at 20% 20%, rgba(124,92,252,0.15), transparent 40%), radial-gradient(circle at 80% 60%, rgba(34,211,238,0.12), transparent 40%)',
        'aurora': 'linear-gradient(135deg, #4F46E5 0%, #7C5CFC 45%, #22D3EE 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0,0,0,0.45)',
        glow: '0 0 40px rgba(124,92,252,0.35)',
        'glow-cyan': '0 0 40px rgba(34,211,238,0.3)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'pipeline-flow': 'pipelineFlow 6s linear infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.15)' },
        },
        pipelineFlow: {
          '0%': { strokeDashoffset: 0 },
          '100%': { strokeDashoffset: -200 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
