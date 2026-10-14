/** @type {import('tailwindcss').Config} */
// Tailwind config. Light-theme only (no `dark:` variants are used anywhere in
// the app, per the product decision). The palette below is the EasyPeasy
// "notebook" look: warm paper background, soft gray cards, a friendly indigo
// accent, and highlight colors that double as card colors.
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#faf9f6',
        card: '#eeeeee',
        ink: '#1f2933',
        subtle: '#6b7280',
        accent: {
          DEFAULT: '#4f46e5',
          soft: '#eef2ff'
        },
        highlight: {
          yellow: '#ffe066',
          green: '#b2f2bb',
          blue: '#a5d8ff',
          pink: '#ffc9c9',
          purple: '#d0bfff'
        }
      },
      borderRadius: {
        card: '10px'
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
}
