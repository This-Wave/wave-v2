/**
 * Admin colours read CSS variables so Light / Dark can change at runtime
 * (PLAN-THEMES.md). The variables and both themes come from
 * `src/theme/adminTheme.cjs`.
 */
const { adminTailwindColors, adminThemeCss } = require("./src/theme/adminTheme.cjs");

const ADMIN_COLORS = adminTailwindColors();

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: ADMIN_COLORS,
      fontFamily: {
        sans: ["Geist", "sans-serif"],
        mono: ["Geist", "monospace"],
      },
      borderRadius: {
        card: "12px",
        control: "8px",
        pill: "9999px",
        well: "8px",
        tile: "8px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 0 0 1px rgb(8 52 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [({ addBase }) => addBase(adminThemeCss())],
};
