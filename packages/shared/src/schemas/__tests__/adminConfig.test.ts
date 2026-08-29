import { describe, expect, test } from "vitest";
import { updateConfigSchema, PLATFORM_CONFIG_KEYS } from "../admin";

/**
 * `platform_config` is where the delivery fee, the loyalty threshold, the goods
 * ceiling and the rider's cut live, editable from the admin dashboard with no
 * deploy. The schema was `{ key: string, value: string }` — any key, any value.
 *
 * Every consumer then does `Number(row.value)`. So `delivery_fee_base = "20 GHS"`
 * gives `NaN`, which flows through `calculateOrderTotal` into `totalAmount`, and
 * the student gets a checkout that fails with Paystack's "Invalid Amount Sent"
 * while nothing anywhere names the field that caused it. One typo, platform-wide.
 */
const ok = (key: string, value: string) => updateConfigSchema.safeParse({ key, value }).success;
const message = (key: string, value: string) => {
  const result = updateConfigSchema.safeParse({ key, value });
  return result.success ? null : result.error.issues[0]?.message;
};

describe("updateConfigSchema", () => {
  test("accepts every key the platform actually reads", () => {
    for (const key of Object.keys(PLATFORM_CONFIG_KEYS)) {
      expect(ok(key, "1"), key).toBe(true);
    }
  });

  test("rejects a key nothing reads", () => {
    // A typo'd key used to write a row that looked saved and changed nothing.
    expect(ok("delivery_fee", "20")).toBe(false);
    expect(message("delivery_fee", "20")).toMatch(/Unknown setting/);
  });

  test("rejects a value that is not a number", () => {
    expect(ok("delivery_fee_base", "20 GHS")).toBe(false);
    expect(ok("delivery_fee_base", "abc")).toBe(false);
    expect(message("delivery_fee_base", "abc")).toMatch(/Base delivery fee.*must be a number/);
  });

  test("names the field in the message, so the admin can fix it", () => {
    expect(message("rider_earning_pct", "eighty")).toMatch(/Rider share/);
  });

  test("accepts a decimal fee and surrounding whitespace", () => {
    expect(ok("delivery_fee_base", "20.50")).toBe(true);
    expect(ok("delivery_fee_base", " 20.50 ")).toBe(true);
  });

  test("rejects an empty or whitespace-only value", () => {
    // `Number("")` is 0, which would silently make delivery free.
    expect(ok("delivery_fee_base", "   ")).toBe(false);
    expect(updateConfigSchema.safeParse({ key: "delivery_fee_base", value: "" }).success).toBe(false);
  });

  test("rejects a percentage above 100", () => {
    expect(ok("loyalty_discount_pct", "150")).toBe(false);
    expect(ok("rider_earning_pct", "150")).toBe(false);
    expect(ok("loyalty_discount_pct", "100")).toBe(true);
  });

  test("rejects a negative value", () => {
    expect(ok("delivery_fee_base", "-20")).toBe(false);
  });

  test("rejects a fractional delivery count", () => {
    // 6.5 deliveries is not a thing, and `>= threshold` would round it silently.
    expect(ok("loyalty_threshold", "6.5")).toBe(false);
    expect(ok("loyalty_threshold", "6")).toBe(true);
  });

  test("catches a slipped decimal point on the goods ceiling", () => {
    expect(ok("goods_cost_max_ghs", "1000")).toBe(true);
    expect(ok("goods_cost_max_ghs", "1000000")).toBe(false);
  });
});
