import { describe, expect, it } from "vitest";
import {
  FEATURE_KEYS,
  allFeaturesOff,
  isFeatureKey,
  resolveFeature,
  resolveFeatures,
} from "../features";

const ASHESI = "u-ashesi";
const OTHER = "u-other";

describe("resolveFeature", () => {
  it("is off when no row exists", () => {
    expect(resolveFeature("group_orders", ASHESI, [])).toBe(false);
  });

  it("uses the global row when there is no override", () => {
    expect(
      resolveFeature("group_orders", ASHESI, [
        { key: "group_orders", universityId: null, enabled: true },
      ]),
    ).toBe(true);
  });

  it("lets a university override the global default in both directions", () => {
    const rows = [
      { key: "group_orders", universityId: null, enabled: true },
      { key: "group_orders", universityId: ASHESI, enabled: false },
    ];
    expect(resolveFeature("group_orders", ASHESI, rows)).toBe(false);
    expect(resolveFeature("group_orders", OTHER, rows)).toBe(true);
  });

  it("ignores rows belonging to another university", () => {
    expect(
      resolveFeature("group_orders", ASHESI, [
        { key: "group_orders", universityId: OTHER, enabled: true },
      ]),
    ).toBe(false);
  });

  it("ignores rows for a different key", () => {
    expect(
      resolveFeature("group_orders", ASHESI, [
        { key: "referrals", universityId: ASHESI, enabled: true },
      ]),
    ).toBe(false);
  });

  it("falls back to the global row for a caller with no university", () => {
    const rows = [
      { key: "reorder", universityId: null, enabled: true },
      { key: "reorder", universityId: ASHESI, enabled: false },
    ];
    expect(resolveFeature("reorder", null, rows)).toBe(true);
    expect(resolveFeature("reorder", undefined, rows)).toBe(true);
  });
});

describe("resolveFeatures", () => {
  it("returns every known key, not just the ones with rows", () => {
    const map = resolveFeatures(ASHESI, [
      { key: "reorder", universityId: null, enabled: true },
    ]);
    expect(Object.keys(map).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(map.reorder).toBe(true);
    expect(map.group_orders).toBe(false);
  });

  it("silently ignores a row whose key the code does not know", () => {
    const map = resolveFeatures(ASHESI, [
      { key: "not_a_real_flag", universityId: ASHESI, enabled: true },
    ]);
    expect(map).toEqual(allFeaturesOff());
  });
});

describe("the off-by-default guarantee", () => {
  /**
   * This is the property the whole design rests on — it is what makes it safe
   * to merge a half-finished feature. If someone ever makes a flag default to
   * true, this fails and they have to say so out loud.
   */
  it("every flag is off with an empty database", () => {
    expect(resolveFeatures(ASHESI, [])).toEqual(allFeaturesOff());
    expect(Object.values(allFeaturesOff()).every((v) => v === false)).toBe(true);
  });
});

describe("isFeatureKey", () => {
  it("accepts known keys and rejects anything else", () => {
    expect(isFeatureKey("group_orders")).toBe(true);
    expect(isFeatureKey("groupOrders")).toBe(false);
    expect(isFeatureKey("")).toBe(false);
  });
});
