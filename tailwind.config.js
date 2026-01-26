/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          400: '#00d4aa',
          500: '#00b894',
        },
      },
    },
  },
  plugins: [],
};
