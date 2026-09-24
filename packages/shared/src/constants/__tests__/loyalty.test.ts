import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOYALTY_THRESHOLD,
  loyaltyProgress,
  loyaltyProgressLabel,
} from "../platform";

describe("loyaltyProgress", () => {
  it("counts down to the threshold", () => {
    expect(loyaltyProgress(0).remaining).toBe(DEFAULT_LOYALTY_THRESHOLD);
    expect(loyaltyProgress(2).remaining).toBe(DEFAULT_LOYALTY_THRESHOLD - 2);
  });

  it("is earned at the threshold and stays earned past it", () => {
    expect(loyaltyProgress(DEFAULT_LOYALTY_THRESHOLD).earned).toBe(true);
    expect(loyaltyProgress(DEFAULT_LOYALTY_THRESHOLD + 5).earned).toBe(true);
    expect(loyaltyProgress(DEFAULT_LOYALTY_THRESHOLD + 5).remaining).toBe(0);
  });

  it("never reports a negative or fractional remainder", () => {
    expect(loyaltyProgress(-3).remaining).toBe(DEFAULT_LOYALTY_THRESHOLD);
    expect(loyaltyProgress(2.7).completed).toBe(2);
  });
});

describe("loyaltyProgressLabel", () => {
  it("says how many are left, with the right plural", () => {
    expect(loyaltyProgressLabel(loyaltyProgress(DEFAULT_LOYALTY_THRESHOLD - 1))).toBe(
      "1 more delivery for 20% off delivery.",
    );
    expect(loyaltyProgressLabel(loyaltyProgress(DEFAULT_LOYALTY_THRESHOLD - 2))).toContain(
      "2 more deliveries",
    );
  });

  it("switches to the earned sentence once it applies", () => {
    expect(loyaltyProgressLabel(loyaltyProgress(DEFAULT_LOYALTY_THRESHOLD))).toBe(
      "You get 20% off delivery on every order.",
    );
  });
});
