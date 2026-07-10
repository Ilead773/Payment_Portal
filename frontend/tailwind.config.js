/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f3ff',
          100: '#e1e7fe',
          200: '#c7d3fd',
          300: '#9fb1fc',
          400: '#7088fa',
          500: '#4c61f7',
          600: '#3440ee',
          700: '#272ed8',
          800: '#2328af',
          900: '#22278b',
          950: '#151752',
        },
      },
    },
  },
  plugins: [],
}
