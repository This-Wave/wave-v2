/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wave: {
          DEFAULT: "#2EA64E",
          50: "#EAF8EE",
          100: "#D0F0D9",
          500: "#2EA64E",
          600: "#25873F",
          700: "#1D6931",
        },
      },
    },
  },
  plugins: [],
};
