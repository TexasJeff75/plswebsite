/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'midnight': '#0B1426',
        'midnight-light': '#1A2332',
        'platinum': '#E5E7EB',
        'platinum-light': '#F9FAFB',
        'champagne': '#D4AF37',
        'champagne-light': '#F4E6A1',
        'electric': '#00D4FF',
        'electric-dim': '#0099CC',
        'bright-blue': '#00A8FF',
        'logo-purple': '#6B46C1',
        'vibrant-blue': '#0EA5E9',
        'logo-accent': '#8B5CF6'
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
};
