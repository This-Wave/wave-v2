/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Wave v6 — ink + lime (aligns with mobile student system)
        wave: {
          DEFAULT: "#87ea5c",
          50: "#f7f7f7",
          100: "#eefce6",
          200: "#d9f7c8",
          500: "#87ea5c",
          600: "#6fd943",
          700: "#154b3e",
          lime: "#87ea5c",
        },
        ink: "#154b3e",
        canvas: "#fafbf9",
        muted: "#5e6d66",
        faint: "#a8a8a8",
        border: {
          DEFAULT: "#e6e9e4",
          divider: "#eeede7",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#f7f7f7",
          subtle: "#f7f7f7",
        },
        success: {
          text: "#0b2a21",
          bg: "#87ea5c",
        },
        danger: {
          // Was #B3453A, which measures 4.41:1 on `danger.bg` — under AA by a
          // margin too small to see and too real to keep. These pills carry
          // "Cancelled" and "Refunded" at 11px, so they are normal text and owe
          // 4.5:1. #A63E33 is 5.03:1 on the tint and 6.25:1 on white.
          text: "#A63E33",
          bg: "#F3E3E1",
          border: "#E0BEB9",
        },
        warning: {
          text: "#8A6A24",
          bg: "#FDF4E3",
          border: "#EFE0C2",
        },
        admin: {
          text: "#0b2a21",
          bg: "#87ea5c",
        },
        lime: {
          DEFAULT: "#87ea5c",
          faint: "#eefce6",
          edge: "#6cc947",
        },
        // v7 canvas
        wash: "#eafbe3",
        line: "#d9ded9",
        info: { bg: "#e7effb", text: "#1f4e8c" },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Sans", "monospace"],
        display: ["Nunito", "DM Sans", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        control: "12px",
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
  plugins: [],
};
