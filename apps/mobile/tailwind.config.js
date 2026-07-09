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
          hover: "#1f7a38",
        },
        ink: "#1A1A1A",
        "text-secondary": "#555555",
        "text-tertiary": "#666666",
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
          "bg-faint": "#FAFFFE",
          border: "#C8EDD5",
        },
        danger: {
          text: "#D32F2F",
          bg: "#FEECEC",
          border: "#FCA5A5",
        },
        warning: {
          text: "#C2410C",
          "text-dark": "#9A3412",
          bg: "#FFF7ED",
          border: "#FED7AA",
        },
        rider: {
          text: "#2563EB",
          bg: "#EFF6FF",
        },
        admin: {
          text: "#7C3AED",
          bg: "#F5F3FF",
        },
        mtn: "#FFC107",
        vodafone: "#E53935",
        disabled: {
          bg: "#D0D0D0",
          text: "#888888",
        },
        dark: {
          bg: "#1A1A1A",
          card: "#252525",
          cell: "#333333",
        },
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        "sans-extrabold": ["Inter_800ExtraBold"],
        mono: ["JetBrainsMono_500Medium"],
        "mono-semibold": ["JetBrainsMono_600SemiBold"],
      },
      borderRadius: {
        pill: "20px",
        card: "14px",
        control: "12px",
        well: "10px",
        chip: "8px",
      },
    },
  },
  plugins: [],
};
