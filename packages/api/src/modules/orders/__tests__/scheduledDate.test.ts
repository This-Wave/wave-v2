import { describe, expect, it } from "vitest";
import { createOrderSchema } from "@wave/shared";

/**
 * Regression guard for the bug that made **every** order placed from the app
 * fail with a 400.
 *
 * `scheduledDate` is `z.string().date()`, which accepts `YYYY-MM-DD` and
 * nothing else. Every student screen sent `date.toISOString()` — a full ISO
 * datetime — so `POST /orders` rejected the payload before it did anything.
 * It survived from the initial scaffold because the money path was only ever
 * exercised by hand-written requests and webhook tests, which pass a date-only
 * string.
 *
 * The client now sends a **local** calendar date via `toApiDate`. These tests
 * pin the contract from the server's side so a future screen cannot quietly go
 * back to `toISOString()`.
 */
describe("createOrderSchema.scheduledDate", () => {
  const base = {
    orderType: "buy_for_me" as const,
    shopId: "11111111-1111-1111-1111-111111111111",
    checkpointId: "22222222-2222-2222-2222-222222222222",
    items: [{ productId: "33333333-3333-3333-3333-333333333333", quantity: 1 }],
    deliveryDay: "sunday" as const,
    isSpecialOrder: false,
  };

  it("accepts a plain calendar date, which is what the column stores", () => {
    const result = createOrderSchema.safeParse({ ...base, scheduledDate: "2026-08-09" });
    expect(result.success).toBe(true);
  });

  it("rejects a full ISO datetime — the shape that broke every order", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      scheduledDate: "2026-08-09T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.scheduledDate).toBeDefined();
  });

  it("rejects a date that is not a real day", () => {
    expect(createOrderSchema.safeParse({ ...base, scheduledDate: "2026-02-30" }).success).toBe(
      false,
    );
    expect(createOrderSchema.safeParse({ ...base, scheduledDate: "not-a-date" }).success).toBe(
      false,
    );
  });
});
