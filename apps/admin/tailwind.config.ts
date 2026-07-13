import type { Config } from "tailwindcss";

// Palette mirrors apps/mobile/tailwind.config.js (same design-import-spec.md
// source) plus the Admin-specific violet accent. No gradients, no colored
// shadows, no emoji per the design commandments.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
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
        ink: "#1A1A1A",
        muted: "#9E9E9E",
        faint: "#BDBDBD",
        border: {
          DEFAULT: "#E0E0E0",
          divider: "#B8B8B8",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F5F5F5",
          subtle: "#FAFAFA",
        },
        success: {
          text: "#2EA64E",
          bg: "#EDF7F1",
        },
        danger: {
          text: "#D32F2F",
          bg: "#FEECEC",
        },
        warning: {
          text: "#C2410C",
          bg: "#FFF7ED",
          border: "#FED7AA",
        },
        admin: {
          text: "#7C3AED",
          bg: "#F5F3FF",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        // Neutral shadows only — no colored shadows per design commandments.
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
