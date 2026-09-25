/** @type {import('tailwindcss').Config} */
// Wave design tokens. Colours come from packages/shared/palettes.cjs — change
// them there, never here — and are CSS variables on every platform, so Light /
// Dark switch at runtime (NativeWind v4 `vars()`). PLAN-THEMES.md.
//
//   ink  #154b3e — Sacramento. Text, icon strokes, the header panel.
//   lime #87ea5c — the single accent. Fill-only: white on it is ~1.5:1, so it
//                  always carries `on-accent` (#0b2a21). Never lime text.
const { themeCss, twColor: c } = require("@wave/shared/palettes.cjs");

module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Every colour is a CSS variable (packages/shared/palettes.cjs), on every
      // platform: NativeWind v4 resolves `var()` natively, and the app root sets
      // the light or dark set with `vars()` (src/theme/ThemeRoot.tsx). The
      // role split — on-accent, on-ink, panel — is explained in PLAN-THEMES.md.
      colors: {
        lime: { DEFAULT: c("lime"), 500: c("lime"), 600: c("limePressed"), faint: c("limeFaint") },
        ink: { DEFAULT: c("ink"), 900: c("ink"), 700: c("inkSoft") },
        canvas: c("canvas"),
        surface: { DEFAULT: c("surface"), muted: c("surfaceMuted") },
        muted: c("muted"),
        icon: c("icon"),
        subtle: c("subtle"),
        hairline: c("hairline"),
        danger: { DEFAULT: c("danger"), bg: c("dangerBg") },
        warning: { DEFAULT: c("warning"), bg: c("warningBg") },
        "on-accent": c("onAccent"),
        "on-ink": c("onInk"),
        "on-danger": c("onDanger"),
        panel: { DEFAULT: c("panel"), on: c("onPanel") },
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
  // The theme variables, on bare :root (light) and under data-wave-mode="dark"
  // for the web page itself; the app root re-applies them with vars().
  plugins: [({ addBase }) => addBase(themeCss())],
};
