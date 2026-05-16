/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core backgrounds
        void:    '#02040b',   // sidebar
        deep:    '#060a13',   // main bg
        card:    'rgba(255,255,255,0.03)',
        // Accents
        primary: '#3b82f6',
        cyan:    '#06b6d4',
        online:  '#22c55e',
        danger:  '#ef4444',
        warning: '#eab308',
        teal:    '#0d9488',
        // Text
        muted:   '#64748b',
        // Admin
        'admin-base':    '#030609',
        'admin-surface': '#0c1420',
        'admin-sidebar': '#020407',
        'admin-border':  '#2a3650',
        // Legacy aliases
        navy:    '#02040b',
        base:    '#060a13',
        surface: 'rgba(6,12,28,0.82)',
        border:  'rgba(255,255,255,0.07)',
        'admin-border-old': '#484b62',
      },
      boxShadow: {
        'glow':    '0 0 24px rgba(59,130,246,0.22)',
        'glow-sm': '0 0 12px rgba(59,130,246,0.14)',
        'green':   '0 0 16px rgba(34,197,94,0.30)',
        'card':    '0 4px 24px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2.5s ease infinite',
        'fade-in':   'fade-in 0.15s ease',
      },
      keyframes: {
        'pulse-dot': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' },
          '50%':     { boxShadow: '0 0 0 6px rgba(34,197,94,0)' },
        },
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
