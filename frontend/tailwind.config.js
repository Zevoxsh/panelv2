/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Client panel
        base:    '#0f1117',
        navy:    '#181b2d',
        surface: 'rgba(14,16,30,0.88)',
        // Admin panel
        'admin-base':    '#2f3241',
        'admin-surface': '#383b4f',
        'admin-sidebar': '#1e2030',
        // Accents
        primary: '#3b82f6',
        danger:  '#ef4444',
        teal:    '#0d9488',
        online:  '#22c55e',
        // Common
        border:  '#2a2d3e',
        muted:   '#6b7280',
        'admin-border': '#484b62',
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
