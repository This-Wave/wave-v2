/**
 * Admin's colour tokens, light and dark. PLAN-THEMES.md.
 *
 * Admin keeps its own token names, so this table says which role of
 * @wave/shared/palettes.cjs each one takes, or gives explicit light/dark values
 * where no shared role fits.
 */
const { themes, triplet } = require("@wave/shared/palettes.cjs");

/** token → shared role | { light, dark } */
const TOKENS = {
  wave: "lime",
  "wave-50": "canvas",
  "wave-100": "limeFaint",
  "wave-200": "limeFaint",
  "wave-500": "lime",
  "wave-600": "limePressed",
  "wave-700": "ink",
  "wave-lime": "lime",
  ink: "ink",
  canvas: "canvas",
  muted: "muted",
  faint: "icon",
  border: "hairline",
  "border-divider": "hairline",
  surface: "surface",
  // The page ground behind the sidebar and content (app/(app)/layout.tsx), and
  // wells inside cards — the canvas role in every theme, as it is in v6 today.
  "surface-muted": "canvas",
  "surface-subtle": "canvas",
  "success-text": "onAccent",
  "success-bg": "lime",
  "danger-text": "danger",
  "danger-bg": "dangerBg",
  "danger-border": { light: "#e0beb9", dark: "#5a2a22" },
  "warning-text": "warning",
  "warning-bg": "warningBg",
  "warning-border": { light: "#efe0c2", dark: "#4a3a17" },
  "admin-text": "onAccent",
  "admin-bg": "lime",
  lime: "lime",
  "lime-faint": "limeFaint",
  "on-ink": "onInk",
  "on-danger": "onDanger",
  // Behind a modal. Ink in light mode; in dark mode ink is light, so the scrim is not.
  scrim: { light: "#154b3e", dark: "#000000" },
};

const varOf = (token) => `--wa-${token}`;

function adminThemeCss() {
  const block = (mode) =>
    Object.fromEntries(
      Object.entries(TOKENS).map(([token, source]) => [
        varOf(token),
        triplet(typeof source === "string" ? themes[mode][source] : source[mode]),
      ]),
    );
  return { ":root": block("light"), ':root[data-wave-mode="dark"]': block("dark") };
}

/** Tailwind's nested colour object, every leaf reading its variable. */
function adminTailwindColors() {
  const v = (token) => `rgb(var(${varOf(token)}) / <alpha-value>)`;
  return {
    wave: {
      DEFAULT: v("wave"), 50: v("wave-50"), 100: v("wave-100"), 200: v("wave-200"),
      500: v("wave-500"), 600: v("wave-600"), 700: v("wave-700"), lime: v("wave-lime"),
    },
    ink: v("ink"),
    canvas: v("canvas"),
    muted: v("muted"),
    faint: v("faint"),
    border: { DEFAULT: v("border"), divider: v("border-divider") },
    surface: { DEFAULT: v("surface"), muted: v("surface-muted"), subtle: v("surface-subtle") },
    success: { text: v("success-text"), bg: v("success-bg") },
    danger: { text: v("danger-text"), bg: v("danger-bg"), border: v("danger-border") },
    warning: { text: v("warning-text"), bg: v("warning-bg"), border: v("warning-border") },
    admin: { text: v("admin-text"), bg: v("admin-bg") },
    lime: { DEFAULT: v("lime"), faint: v("lime-faint") },
    "on-ink": v("on-ink"),
    "on-danger": v("on-danger"),
    scrim: v("scrim"),
  };
}

module.exports = { TOKENS, adminThemeCss, adminTailwindColors };
