/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wave: {
          DEFAULT: "#009933",
          50: "#F3F7EF",
          100: "#DCE8D3",
          200: "#b0e892",
          500: "#009933",
          600: "#008A2E",
          700: "#007526",
          lime: "#b0e892",
        },
        ink: "#10210B",
        canvas: "#F3F7EF",
        muted: "#6B7D63",
        faint: "#B7C4AE",
        border: {
          DEFAULT: "#DCE8D3",
          divider: "#DCE8D3",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F3F7EF",
          subtle: "#F3F7EF",
        },
        success: {
          text: "#009933",
          bg: "#b0e892",
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
          text: "#009933",
          bg: "#b0e892",
        },
      },
      fontFamily: {
        sans: ["Geist", "sans-serif"],
        mono: ["Geist", "monospace"],
      },
      borderRadius: {
        card: "24px",
        control: "18px",
        pill: "18px",
        well: "18px",
        tile: "14px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 0 0 1px rgb(16 33 11 / 0.04), 0 1px 3px rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};
