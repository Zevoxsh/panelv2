/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1a1d2e',
        base: '#0f1117',
        primary: '#7c3aed',
        'primary-light': '#a5b4fc',
        border: '#1f2937',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
}
