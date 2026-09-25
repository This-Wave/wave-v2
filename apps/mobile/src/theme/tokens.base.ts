// Wave v6 raw tokens — for places className cannot reach (SVG strokes, shadow
// styles, navigator options). Mirrors tailwind.config.js exactly.
//
// Imported through `./tokens` (native: these values) or `./tokens.web`
// (web: the same names as CSS variables, so the theme can change at runtime).
import type { ViewStyle } from "react-native";

export const colors = {
  /** The single accent. Fill-only — always pair with `ink` on top. */
  lime: "#87ea5c",
  limePressed: "#6fd544",
  limeFaint: "#eafbe3",
  /** Near-black green. Text, icon strokes, inverse surfaces. */
  ink: "#154b3e",
  inkSoft: "#30473f",

  canvas: "#ffffff",
  surface: "#fdfcf8",
  surfaceMuted: "#f2f1ec",
  muted: "#5e6d66",
  /**
   * Icon-only neutral: chevrons, decorative strokes. 3.45:1 on white and
   * 3.22:1 on canvas, so it clears WCAG 1.4.11's 3:1 for meaningful glyphs.
   * Not a text colour — text at this size needs 4.5:1, use `muted`.
   */
  icon: "#7d8a83",
  /**
   * Disabled fills only. 1.80:1 on white — it is not legible as text or as an
   * icon, and placeholders that used to sit here moved to `muted`.
   */
  subtle: "#d6d5cf",
  hairline: "#eeede7",

  danger: "#c1341f",
  dangerBg: "#fdecea",
  warning: "#8a6017",
  warningBg: "#fbf3d6",

  white: "#ffffff",

  /** Roles that diverge in dark mode — see tailwind.config.js and PLAN-THEMES.md. */
  onAccent: "#0b2a21",
  onInk: "#fdfcf8",
  onDanger: "#ffffff",
  panel: "#154b3e",
  onPanel: "#fdfcf8",

} as const;

export const radii = {
  card: 12,
  input: 8,
  pill: 9999,
} as const;

/**
 * The ONLY elevation in the system, and it belongs to the search capsule and to
 * sheets — never to a content card.
 *
 * Listing cards get no shadow. Their separation comes from the card colour
 * against the canvas, plus a hairline stroke in light mode (global.css). If you
 * are reaching for this on a card, the card is wrong.
 *
 * Web equivalent: 0 0 0 1px rgba(0,0,0,.02), 0 2px 6px rgba(0,0,0,.04),
 * 0 4px 8px rgba(0,0,0,.10)
 */
export const shadowFloating: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

/** Overlay scrim for sheets and dialogs. */
export const shadowOverlay: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.28,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
};
