/** @type {import('tailwindcss').Config} */
// Wave v6 design tokens — Airbnb-derived structure on Wave's own two greens.
//
// The system is achromatic by default: a #f7f7f7 canvas, #ffffff cards, and a
// near-black ink, with exactly ONE accent. Separation comes from whitespace,
// hairlines and canvas-vs-card value contrast — never from borders or shadows
// on content cards.
//
// The two brand colours and why they sit where they do:
//   ink  #083400 — very dark green. ~15.6:1 on white, so it carries every piece
//                  of text, every icon stroke, and the inverse surface.
//   lime #87ea5c — the single accent. Bright: white text on it is ~1.8:1 and
//                  fails outright, so it is ALWAYS a fill with `ink` on top.
//                  Primary CTA = lime pill + ink label. Never lime text.
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- v6 identity ---
        // The only accent. Fill-only; pair with `ink` for anything on top.
        lime: {
          DEFAULT: "#87ea5c",
          500: "#87ea5c",
          600: "#6fd544", // pressed/active state
          faint: "#eafbe3", // tinted wash for selected rows and success grounds
        },
        // Near-black green. Text, icons, inverse surfaces.
        ink: {
          DEFAULT: "#083400",
          900: "#083400",
          700: "#2c4f26", // ink on tinted grounds where full ink is too heavy
        },

        // --- neutrals, straight from the reference ---
        canvas: "#f7f7f7", // page ground (Faint)
        surface: {
          DEFAULT: "#ffffff", // cards, inputs, sheets (White)
          muted: "#dddddd", // skeletons, disabled cards (Deco)
        },
        muted: "#6a6a6a", // secondary text, metadata (Foggy)
        subtle: "#c1c1c1", // placeholder + disabled text (Grey 500)
        hairline: "#ebebeb", // dividers, input underlines (Bebe)

        // --- semantic ---
        // Success reads as the accent itself; there is no second green.
        danger: {
          DEFAULT: "#c1341f",
          bg: "#fdecea",
        },
        warning: {
          DEFAULT: "#8a6017",
          bg: "#fbf3d6",
        },

        // --- v5 legacy aliases ---
        // Rider and shop-owner screens still use `components/ui/*` and v5 class
        // names. These remap those names onto v6 values so those flows degrade
        // to the new neutrals instead of rendering unstyled. Remove once both
        // roles have had their design pass. Do NOT use in new code.
        wave: {
          DEFAULT: "#083400",
          50: "#f7f7f7",
          100: "#ebebeb",
          200: "#87ea5c",
          500: "#083400",
          600: "#2c4f26",
          700: "#083400",
          lime: "#87ea5c",
          hover: "#2c4f26",
        },
        "text-secondary": "#6a6a6a",
        "text-tertiary": "#6a6a6a",
        faint: "#c1c1c1",
        border: {
          DEFAULT: "#ebebeb",
          divider: "#ebebeb",
        },
        success: {
          text: "#083400",
          bg: "#87ea5c",
          "bg-faint": "#eafbe3",
          border: "#87ea5c",
        },
        rider: { text: "#083400", bg: "#87ea5c" },
        admin: { text: "#083400", bg: "#ebebeb" },
        mtn: "#8a6017",
        vodafone: "#c1341f",
        disabled: { bg: "#ebebeb", text: "#c1c1c1" },
        overlay: "#083400",
      },
      fontFamily: {
        // DM Sans — the reference names it as a substitute for Airbnb Cereal.
        // Geometric, same negative-tracking behaviour at display sizes.
        sans: ["DMSans_400Regular"],
        "sans-medium": ["DMSans_500Medium"],
        "sans-semibold": ["DMSans_600SemiBold"],
        "sans-bold": ["DMSans_700Bold"],
      },
      fontSize: {
        // The reference's scale. Line heights are ratios baked to px.
        caption: ["11px", { lineHeight: "13px" }],
        meta: ["12px", { lineHeight: "16px" }],
        body: ["14px", { lineHeight: "20px" }],
        ui: ["16px", { lineHeight: "20px" }],
        subheading: ["20px", { lineHeight: "24px", letterSpacing: "-0.18px" }],
        "heading-sm": ["22px", { lineHeight: "26px", letterSpacing: "-0.44px" }],
        heading: ["28px", { lineHeight: "32px", letterSpacing: "-0.6px" }],
      },
      borderRadius: {
        // Exactly three shapes: card, input, pill. Nothing else.
        card: "12px",
        input: "8px",
        pill: "9999px",
        // v5 legacy names, remapped onto the three v6 shapes.
        control: "9999px",
        well: "12px",
        tile: "12px",
        chip: "8px",
        check: "8px",
      },
      spacing: {
        // 4px base. The reference's compact scale.
        // Runtime gutters also adapt on web via `useLayout()` (24 → 40).
        gutter: "24px", // screen horizontal padding (mobile default)
        section: "32px", // gap between stacked sections
        "section-lg": "48px", // desktop section gap (Airbnb reference)
      },
      maxWidth: {
        page: "1440px",
        narrow: "560px",
        search: "880px",
      },
    },
  },
  plugins: [],
};
