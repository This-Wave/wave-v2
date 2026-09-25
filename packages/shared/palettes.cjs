/**
 * Wave's colour themes: the brand palette in light and dark. PLAN-THEMES.md.
 *
 * Plain CommonJS on purpose — the Tailwind configs of both apps require it at
 * build time, before TypeScript is anywhere near.
 *
 * `light` must equal apps/mobile/tailwind.config.js exactly (a test holds the
 * two together): native builds compile those hex values in, and the web build
 * falls back to them on bare `:root`.
 *
 * Adopted 2026-09-25, replacing v6 (ink #083400 on #f7f7f7): Sacramento text
 * and header panel, near-white stroked cards on a white page, and the v6 lime
 * kept as the accent. Keys are roles, not colours — `lime` means "the accent";
 * see PLAN-THEMES.md §2 for why `ink`, `onInk` and `panel` are separate.
 */
const themes = {
  light: {
    canvas: "#ffffff",
    surface: "#fdfcf8",
    surfaceMuted: "#f2f1ec",
    ink: "#154b3e",
    inkSoft: "#30473f",
    muted: "#5e6d66",
    icon: "#7d8a83",
    subtle: "#d6d5cf",
    hairline: "#eeede7",
    lime: "#87ea5c",
    limePressed: "#6fd544",
    limeFaint: "#eafbe3",
    onAccent: "#0b2a21",
    onInk: "#fdfcf8",
    onDanger: "#ffffff",
    panel: "#154b3e",
    onPanel: "#fdfcf8",
    danger: "#c1341f",
    dangerBg: "#fdecea",
    warning: "#8a6017",
    warningBg: "#fbf3d6",
    link: "#02833f",
  },
  dark: {
    canvas: "#0f1c18",
    surface: "#182a24",
    surfaceMuted: "#22362f",
    ink: "#fdfcf8",
    inkSoft: "#d9e0da",
    muted: "#a9b7b0",
    icon: "#8fa099",
    subtle: "#3a4d46",
    hairline: "#263b34",
    lime: "#87ea5c",
    limePressed: "#6fd544",
    limeFaint: "#173a2a",
    onAccent: "#0b2a21",
    onInk: "#0f1c18",
    onDanger: "#2a0d08",
    panel: "#154b3e",
    onPanel: "#fdfcf8",
    danger: "#ff8a7a",
    dangerBg: "#3a1a15",
    warning: "#f0c46a",
    warningBg: "#33280f",
    link: "#87ea5c",
  },
};

/** "#083400" -> "8 52 0", the form Tailwind's `<alpha-value>` needs. */
function triplet(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

/** camelCase role -> CSS custom property name. */
function varName(role) {
  return `--wave-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** The CSS for both themes: light on bare `:root`, dark behind `data-wave-mode`. */
function themeCss() {
  const block = (set) =>
    Object.fromEntries(Object.entries(set).map(([role, hex]) => [varName(role), triplet(hex)]));
  return {
    ":root": block(themes.light),
    ':root[data-wave-mode="dark"]': block(themes.dark),
  };
}

/** `rgb(var(--wave-ink) / <alpha-value>)` for a role, for a Tailwind colour. */
function twColor(role) {
  return `rgb(var(${varName(role)}) / <alpha-value>)`;
}

module.exports = { themes, triplet, varName, themeCss, twColor };
