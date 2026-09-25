/**
 * Tailwind for the web build only (postcss + the NativeWind babel plugin when
 * the platform is web). PLAN-THEMES.md §3.
 *
 * Identical to tailwind.config.js except that every colour reads a CSS
 * variable, so the theme can change at runtime by setting `data-wave-mode` /
 * `data-wave-palette` on <html>. The variables' defaults on bare `:root` are
 * v6 light — today's hex — so with no attribute set nothing changes.
 *
 * NativeWind v2 cannot parse `rgb(var(...))` and drops those colours from its
 * compiled style sheet; on web the same classes arrive as real CSS from
 * global.css, which is where the colour then comes from. Native builds keep
 * using tailwind.config.js and are untouched.
 */
const base = require("./tailwind.config.js");
const { themeCss, twColor } = require("@wave/shared/palettes.cjs");

const c = twColor;

module.exports = {
  ...base,
  theme: {
    ...base.theme,
    extend: {
      ...base.theme.extend,
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
    },
  },
  plugins: [
    ...(base.plugins ?? []),
    ({ addBase }) => addBase(themeCss()),
  ],
};
