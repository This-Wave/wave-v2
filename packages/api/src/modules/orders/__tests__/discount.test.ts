import { describe, expect, test } from "vitest";
import { calculateDiscount, calculateOrderTotal, isStandardDeliveryDay } from "../discount";

describe("Discount Engine", () => {
  test("should not apply discount below threshold", () => {
    expect(calculateDiscount({ totalDeliveries: 5, baseAmount: 10 })).toBe(0);
  });

  test("should apply 20% at 6 deliveries", () => {
    expect(calculateDiscount({ totalDeliveries: 6, baseAmount: 10 })).toBe(2);
  });

  test("should apply 20% above threshold", () => {
    expect(calculateDiscount({ totalDeliveries: 10, baseAmount: 50 })).toBe(10);
  });
});

describe("Delivery Day Validation", () => {
  test("Sunday is standard delivery day", () => {
    expect(isStandardDeliveryDay(new Date("2026-06-28"))).toBe(true);
  });

  test("Wednesday is standard delivery day", () => {
    expect(isStandardDeliveryDay(new Date("2026-07-01"))).toBe(true);
  });

  test("Monday requires special order flag", () => {
    expect(isStandardDeliveryDay(new Date("2026-06-29"))).toBe(false);
  });
});

describe("Order Total Calculation", () => {
  test("standard order with no discount", () => {
    const total = calculateOrderTotal({ itemPrice: 20, deliveryFee: 5, discountPct: 0, surchargePct: 0 });
    expect(total).toBe(25);
  });

  test("special order with surcharge", () => {
    const total = calculateOrderTotal({ itemPrice: 20, deliveryFee: 5, discountPct: 0, surchargePct: 30 });
    expect(total).toBe(26.5);
  });

  test("eligible student discount on delivery fee", () => {
    const total = calculateOrderTotal({ itemPrice: 20, deliveryFee: 5, discountPct: 20, surchargePct: 0 });
    expect(total).toBe(24);
  });
});

/**
 * The loyalty discount and the rush surcharge apply to the **delivery fee
 * only** — never to the items. Wave sets its own delivery fee; item prices
 * belong to the shop, and discounting those would mean subsidising a third
 * party's prices out of Wave's margin.
 *
 * These pin the rule against the arithmetic rather than the comment, and they
 * matter more now that the base fee is GH₵20: at GH₵5 a mistake here was worth
 * a cedi, so it could hide.
 */
describe("discounts and surcharges never touch the item price", () => {
  test("discounts the delivery fee and leaves the items alone", () => {
    // Items 100, fee 20, 20% loyalty => 100 + (20 * 0.8) = 116.
    // If the discount hit the whole order it would be 96.
    expect(
      calculateOrderTotal({ itemPrice: 100, deliveryFee: 20, discountPct: 20, surchargePct: 0 }),
    ).toBe(116);
  });

  test("surcharges the delivery fee and leaves the items alone", () => {
    // Items 100, fee 20, 30% rush => 100 + (20 * 1.3) = 126.
    // If the surcharge hit the whole order it would be 156.
    expect(
      calculateOrderTotal({ itemPrice: 100, deliveryFee: 20, discountPct: 0, surchargePct: 30 }),
    ).toBe(126);
  });

  test("applies both to the fee, and only to the fee", () => {
    // 20 * 1.3 * 0.8 = 20.80, so 100 + 20.80 = 120.80.
    expect(
      calculateOrderTotal({ itemPrice: 100, deliveryFee: 20, discountPct: 20, surchargePct: 30 }),
    ).toBe(120.8);
  });

  test("charges the bare fee when there is nothing to buy (a pickup)", () => {
    expect(
      calculateOrderTotal({ itemPrice: 0, deliveryFee: 20, discountPct: 20, surchargePct: 0 }),
    ).toBe(16);
  });
});
