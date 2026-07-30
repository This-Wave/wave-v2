// Wave v5 raw tokens — for places className can't reach (SVG strokes, shadows,
// navigator options). Mirrors tailwind.config.js exactly.
import type { ViewStyle } from "react-native";

export const colors = {
  primary: "#009933",
  lime: "#b0e892",
  ink: "#10210B",
  canvas: "#F3F7EF",
  surface: "#FFFFFF",
  border: "#DCE8D3",
  muted: "#6B7D63",
  faint: "#B7C4AE",
  skeleton: "#E3EBDB",
  danger: "#B3453A",
  dangerBg: "#F3E3E1",
  warning: "#A9791E",
  warningBg: "#FBF3D6",
  overlay: "#0A1707",
  white: "#FFFFFF",
} as const;

export const radii = {
  card: 24,
  control: 18,
  tile: 14,
  check: 7,
} as const;

/**
 * The v5 card elevation:
 * `0 0 0 1px rgba(16,33,11,0.04), 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.08)`
 * The hairline ring is drawn as the card border; this covers the drop shadow.
 * Neutral (never colored) — per the Wave design rules.
 */
export const shadowCard: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
};
