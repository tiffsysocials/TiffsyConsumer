/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        orange: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FE8733',
          400: '#FE8733',
          500: '#FF6636',
          600: '#E55A2E',
          700: '#CC4E27',
          800: '#993A1D',
          900: '#662713',
        },
      },
    },
  },
  plugins: [],
}
