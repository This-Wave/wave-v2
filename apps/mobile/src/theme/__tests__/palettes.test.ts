import { describe, expect, it } from "vitest";
import { themes } from "@wave/shared/palettes.cjs";
import { colors } from "../tokens.base";

/**
 * The themes in @wave/shared/palettes.cjs (PLAN-THEMES.md).
 *
 * The light theme exists twice: as hex in tailwind.config.js / tokens.base.ts,
 * which native builds compile in, and as the CSS-variable defaults the web
 * build falls back to. If they drift, the web app quietly stops matching
 * native — so they are held equal here.
 */

function luminance(hex: string): number {
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("light on web equals native", () => {
  it("every raw token matches the palette table", () => {
    for (const [role, hex] of Object.entries(colors)) {
      if (role === "white") continue;
      expect(themes.light[role as keyof typeof themes.light], role).toBe(hex);
    }
  });
});

describe.each(["light", "dark"] as const)("%s contrast", (mode) => {
  const t = themes[mode];
  it.each([
    ["ink", "canvas", 4.5],
    ["ink", "surface", 4.5],
    ["muted", "surface", 4.5],
    ["muted", "canvas", 4.5],
    ["icon", "surface", 3],
    ["onAccent", "lime", 4.5],
    ["onInk", "ink", 4.5],
    ["onPanel", "panel", 4.5],
    ["onDanger", "danger", 4.5],
    ["danger", "surface", 4.5],
    ["link", "surface", 4.5],
    ["ink", "limeFaint", 4.5],
  ] as const)("%s on %s ≥ %s", (fg, bg, min) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});
