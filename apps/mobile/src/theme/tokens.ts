// Wave v6 raw tokens — for places className cannot reach (SVG strokes, shadow
// styles, navigator options). Mirrors tailwind.config.js exactly.
import type { ViewStyle } from "react-native";

export const colors = {
  /** The single accent. Fill-only — always pair with `ink` on top. */
  lime: "#87ea5c",
  limePressed: "#6fd544",
  limeFaint: "#eafbe3",
  /** Near-black green. Text, icon strokes, inverse surfaces. */
  ink: "#083400",
  inkSoft: "#2c4f26",

  canvas: "#f7f7f7",
  surface: "#ffffff",
  surfaceMuted: "#dddddd",
  muted: "#6a6a6a",
  subtle: "#c1c1c1",
  hairline: "#ebebeb",

  danger: "#c1341f",
  dangerBg: "#fdecea",
  warning: "#8a6017",
  warningBg: "#fbf3d6",

  white: "#ffffff",

  // --- v5 legacy aliases -----------------------------------------------------
  // Rider and shop-owner screens still run on `components/ui/*` and will until
  // their own design pass. These keep them compiling and rendering in v6
  // neutrals rather than unstyled. Do NOT use them in new code.
  /** @deprecated v5 accent. Use `ink` for strokes, `lime` for fills. */
  primary: "#083400",
  /** @deprecated v5 tertiary text. Use `subtle`. */
  faint: "#c1c1c1",
  /** @deprecated v5 card border. Use `hairline`. */
  border: "#ebebeb",
  /** @deprecated v5 skeleton. Use `surfaceMuted`. */
  skeleton: "#dddddd",
  /** @deprecated v5 scrim. */
  overlay: "#083400",
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
 * The reference is explicit: listing cards get no shadow and no border. Their
 * separation comes from the white card sitting on the #f7f7f7 canvas. If you
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

/**
 * @deprecated v5 card elevation. v6 content cards carry no shadow at all —
 * they separate by sitting white on the canvas. Kept only so `components/ui/*`
 * compiles until the rider and shop-owner passes land.
 */
export const shadowCard: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
};

/** Overlay scrim for sheets and dialogs. */
export const shadowOverlay: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.28,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
};
