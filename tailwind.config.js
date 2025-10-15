/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { mono: ['JetBrains Mono', 'ui-monospace','SFMono-Regular'] },
      colors: {
        primary: '#2563eb', secondary: '#10b981', accent: '#f59e0b',
        danger: '#ef4444', muted: '#6b7280', bg: '#f9fafb', text: '#111827',
      },
    },
  },
  plugins: [],
}
