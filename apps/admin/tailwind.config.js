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
          700: "#083400",
          lime: "#87ea5c",
        },
        ink: "#083400",
        canvas: "#f7f7f7",
        muted: "#6a6a6a",
        faint: "#a8a8a8",
        border: {
          DEFAULT: "#ebebeb",
          divider: "#ebebeb",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#f7f7f7",
          subtle: "#f7f7f7",
        },
        success: {
          text: "#083400",
          bg: "#87ea5c",
        },
        danger: {
          text: "#B3453A",
          bg: "#F3E3E1",
          border: "#E0BEB9",
        },
        warning: {
          text: "#8A6A24",
          bg: "#FDF4E3",
          border: "#EFE0C2",
        },
        admin: {
          text: "#083400",
          bg: "#87ea5c",
        },
        lime: {
          DEFAULT: "#87ea5c",
          faint: "#eefce6",
        },
      },
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
  plugins: [],
};
