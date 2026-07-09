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
