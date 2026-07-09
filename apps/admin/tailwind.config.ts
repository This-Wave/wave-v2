import type { Config } from "tailwindcss";

// Wave Green is the only brand color baked in here — everything else
// defers to design.md once the prototype is finalized. No gradients,
// no colored shadows, no emoji per the design commandments.
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
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
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
