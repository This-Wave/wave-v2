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
        muted: "#6a6a6a", // secondary text, metadata (Foggy). 5.05:1 on canvas.
        // Icon-only neutral for chevrons and decorative strokes. 3.45:1 on
        // white, 3.22:1 on canvas — clears 1.4.11's 3:1 for meaningful glyphs.
        // Never put text in it.
        icon: "#8a8a8a",
        // Disabled FILLS only. At 1.80:1 on white this is not a text colour and
        // not an icon colour; placeholders moved to `muted`. See UX-A11Y-PLAN.md.
        subtle: "#c1c1c1",
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
        // The reference's scale, with the bottom three sizes raised once.
        //
        // The reference is a desktop site read at arm's length indoors. Wave is
        // read on a phone, outdoors, in Berekuso sun, often on a cheap Android
        // whose screen is dimmer than the one this was designed on. 11px
        // captions and 14px body were the single thing most students would have
        // felt. WCAG sets no minimum here — this is a usability call, not a
        // compliance one — and the larger sizes stay put so the hierarchy keeps
        // its shape.
        caption: ["12px", { lineHeight: "16px" }],
        meta: ["13px", { lineHeight: "18px" }],
        body: ["15px", { lineHeight: "22px" }],
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
