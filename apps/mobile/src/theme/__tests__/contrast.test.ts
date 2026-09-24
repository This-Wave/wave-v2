import { describe, expect, it } from "vitest";
import { colors } from "../tokens";

/**
 * Contrast is the one part of the v6 palette that can regress silently: a
 * colour gets nudged for aesthetic reasons and nothing fails until a user with
 * low vision hits it. #c1c1c1 sat in `tailwind.config.js` labelled "placeholder
 * + disabled text" at 1.80:1 for a whole design cycle before this pass caught
 * it, which is precisely the failure mode this file exists to prevent.
 *
 * Ratios per WCAG 2.2: 4.5:1 for body text (1.4.3), 3:1 for large text and for
 * meaningful non-text like icon strokes (1.4.11).
 */

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const srgb = parseInt(value.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const GROUNDS = [
  ["white surface", colors.surface],
  ["canvas", colors.canvas],
] as const;

describe("text contrast (WCAG 1.4.3, 4.5:1)", () => {
  for (const [groundName, ground] of GROUNDS) {
    it(`ink reads on ${groundName}`, () => {
      expect(contrast(colors.ink, ground)).toBeGreaterThanOrEqual(4.5);
    });

    it(`muted reads on ${groundName}`, () => {
      expect(contrast(colors.muted, ground)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("danger reads on white", () => {
    expect(contrast(colors.danger, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("warning reads on its own ground", () => {
    expect(contrast(colors.warning, colors.warningBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("ink reads on lime, which is why lime is fill-only", () => {
    expect(contrast(colors.ink, colors.lime)).toBeGreaterThanOrEqual(4.5);
  });

  it("white does NOT read on lime — the rule the palette is built around", () => {
    expect(contrast(colors.white, colors.lime)).toBeLessThan(3);
  });
});

describe("icon contrast (WCAG 1.4.11, 3:1)", () => {
  for (const [groundName, ground] of GROUNDS) {
    it(`icon neutral reads on ${groundName}`, () => {
      expect(contrast(colors.icon, ground)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("subtle is a fill, not a foreground", () => {
  /**
   * Guards the intent rather than the value: if someone raises `subtle` to a
   * legible ratio they have made it a text colour, and the two-token split
   * (`muted` for text, `icon` for glyphs) should collapse back into it
   * deliberately rather than by drift.
   */
  it("stays below the text threshold on white", () => {
    expect(contrast(colors.subtle, colors.surface)).toBeLessThan(4.5);
  });
});
