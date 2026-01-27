/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './*.html'],
  darkMode: 'class',
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
        'logo-accent': '#8B5CF6',
        'teal': {
          DEFAULT: '#00d4aa',
          50: '#e6faf6',
          100: '#ccf5ee',
          200: '#99ebdc',
          300: '#66e1cb',
          400: '#33d7b9',
          500: '#00d4aa',
          600: '#00a988',
          700: '#007f66',
          800: '#005544',
          900: '#002a22',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace']
      },
      backgroundImage: {
        'luxury-gradient': 'linear-gradient(135deg, #0B1426 0%, #1A2332 35%, #2D3748 70%, #1A2332 100%)',
        'platinum-gradient': 'linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 50%, #D1D5DB 100%)',
        'electric-gradient': 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
        'champagne-gradient': 'linear-gradient(135deg, #F4E6A1 0%, #D4AF37 100%)',
        'neural-pattern': "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><radialGradient id=\"g\"><stop offset=\"0%\" stop-color=\"%23ffffff\" stop-opacity=\"0.03\"/><stop offset=\"100%\" stop-color=\"%23ffffff\" stop-opacity=\"0\"/></radialGradient></defs><circle cx=\"20\" cy=\"20\" r=\"2\" fill=\"url(%23g)\"/><circle cx=\"80\" cy=\"30\" r=\"1.5\" fill=\"url(%23g)\"/><circle cx=\"40\" cy=\"70\" r=\"1\" fill=\"url(%23g)\"/><circle cx=\"90\" cy=\"80\" r=\"2.5\" fill=\"url(%23g)\"/></svg>')"
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-elegant': 'pulseElegant 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'neural-glow': 'neuralGlow 4s ease-in-out infinite alternate',
        'liquid-metal': 'liquidMetal 8s ease-in-out infinite'
      }
    },
  },
  plugins: [],
};
