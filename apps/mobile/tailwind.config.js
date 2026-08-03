/** @type {import('tailwindcss').Config} */
// Wave v5 design tokens — shadcn structure, lime/green identity.
// Source: claude.ai/design project `wave-v5`.
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- v5 core identity ---
        wave: {
          DEFAULT: "#009933",
          50: "#F3F7EF",
          100: "#DCE8D3",
          200: "#b0e892",
          500: "#009933",
          600: "#008A2E",
          700: "#007526",
          lime: "#b0e892",
          hover: "#008A2E",
        },
        ink: "#10210B",
        canvas: "#F3F7EF",
        "text-secondary": "#6B7D63",
        "text-tertiary": "#6B7D63",
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
          skeleton: "#E3EBDB",
        },
        success: {
          text: "#009933",
          bg: "#b0e892",
          "bg-faint": "#F3F7EF",
          border: "#009933",
        },
        danger: {
          text: "#B3453A",
          bg: "#F3E3E1",
          border: "#E0BEB9",
        },
        warning: {
          text: "#A9791E",
          "text-dark": "#8A6017",
          bg: "#FBF3D6",
          border: "#EEDDA4",
        },
        // Role accents kept for rider/shop surfaces, retuned to the v5 palette.
        rider: {
          text: "#009933",
          bg: "#b0e892",
        },
        admin: {
          text: "#10210B",
          bg: "#DCE8D3",
        },
        mtn: "#A9791E",
        vodafone: "#B3453A",
        disabled: {
          bg: "#DCE8D3",
          text: "#B7C4AE",
        },
        dark: {
          bg: "#0A1707",
          card: "#12210D",
          cell: "#1B2E15",
        },
        overlay: "#0A1707",
      },
      fontFamily: {
        sans: ["Geist_400Regular"],
        "sans-medium": ["Geist_500Medium"],
        "sans-semibold": ["Geist_600SemiBold"],
        "sans-bold": ["Geist_600SemiBold"],
        "sans-extrabold": ["Geist_700Bold"],
        // v5 has no separate numeric face — order IDs and PINs render in Geist.
        mono: ["Geist_500Medium"],
        "mono-semibold": ["Geist_600SemiBold"],
      },
      borderRadius: {
        card: "24px",
        control: "18px",
        pill: "18px",
        well: "18px",
        tile: "14px",
        chip: "8px",
        check: "7px",
      },
    },
  },
  plugins: [],
};
