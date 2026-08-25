import { describe, expect, test } from "vitest";
import {
  cancelOrderSchema,
  createOrderSchema,
  deliverOrderSchema,
  orderItemInputSchema,
  orderTotalInputSchema,
  recordGoodsCostSchema,
} from "../order";
import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from "../../constants/platform";

/**
 * `createOrderSchema`'s refinements are the only thing standing between the
 * three order types and a nonsense order — a `pickup` with no origin, a
 * `shop_pickup` that quietly carries catalogue items. They mirror the CHECK
 * constraint in `20260807170100_catalogue_and_suggestions`, so a change here
 * that is not made there is a schema and a database that disagree.
 *
 * (Review 02-qa-engineer, L1 — the shared schemas had no tests at all.)
 */
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";

const buyForMe = (overrides: Record<string, unknown> = {}) => ({
  orderType: "buy_for_me",
  shopId: UUID_A,
  checkpointId: UUID_B,
  items: [{ productId: UUID_C, quantity: 2 }],
  deliveryDay: "sunday",
  scheduledDate: "2026-09-06",
  ...overrides,
});

const pickup = (overrides: Record<string, unknown> = {}) => ({
  orderType: "pickup",
  originCheckpointId: UUID_A,
  checkpointId: UUID_B,
  itemDescription: "A padded envelope from the porter's lodge",
  deliveryDay: "wednesday",
  scheduledDate: "2026-09-09",
  ...overrides,
});

const shopPickup = (overrides: Record<string, unknown> = {}) => ({
  orderType: "shop_pickup",
  suggestionId: UUID_A,
  checkpointId: UUID_B,
  manualItems: [{ name: "Bag of rice", quantity: 1 }],
  deliveryDay: "sunday",
  scheduledDate: "2026-09-06",
  ...overrides,
});

describe("orderItemInputSchema", () => {
  test("carries no price field — the server reads price off the catalogue", () => {
    // The rule from CLAUDE.md ("never trust client-sent price") enforced by the
    // type's shape. A stripped price is silently dropped, never honoured.
    const parsed = orderItemInputSchema.parse({
      productId: UUID_C,
      quantity: 1,
      price: 0.01,
      unitPrice: 0.01,
    });

    expect(parsed).toEqual({ productId: UUID_C, quantity: 1 });
    expect(parsed).not.toHaveProperty("price");
  });

  test.each([0, -1, 1.5, MAX_ITEM_QUANTITY + 1])("rejects quantity %s", (quantity) => {
    expect(orderItemInputSchema.safeParse({ productId: UUID_C, quantity }).success).toBe(false);
  });

  test("rejects a non-uuid productId", () => {
    expect(orderItemInputSchema.safeParse({ productId: "1; DROP TABLE", quantity: 1 }).success).toBe(
      false,
    );
  });
});

describe("createOrderSchema — buy_for_me", () => {
  test("accepts a well-formed order", () => {
    expect(createOrderSchema.safeParse(buyForMe()).success).toBe(true);
  });

  test("defaults orderType to buy_for_me", () => {
    const { orderType: _omitted, ...withoutType } = buyForMe();
    const parsed = createOrderSchema.parse(withoutType);
    expect(parsed.orderType).toBe("buy_for_me");
    expect(parsed.isSpecialOrder).toBe(false);
  });

  test("requires a shop", () => {
    expect(createOrderSchema.safeParse(buyForMe({ shopId: undefined })).success).toBe(false);
  });

  test("requires at least one item", () => {
    expect(createOrderSchema.safeParse(buyForMe({ items: [] })).success).toBe(false);
  });

  test("rejects an origin checkpoint or a suggestion", () => {
    expect(createOrderSchema.safeParse(buyForMe({ originCheckpointId: UUID_D })).success).toBe(false);
    expect(createOrderSchema.safeParse(buyForMe({ suggestionId: UUID_D })).success).toBe(false);
  });

  test("caps the basket", () => {
    const items = Array.from({ length: MAX_ORDER_ITEMS + 1 }, () => ({
      productId: UUID_C,
      quantity: 1,
    }));
    expect(createOrderSchema.safeParse(buyForMe({ items })).success).toBe(false);
  });
});

describe("createOrderSchema — pickup", () => {
  test("accepts a well-formed order", () => {
    expect(createOrderSchema.safeParse(pickup()).success).toBe(true);
  });

  test("requires an origin checkpoint", () => {
    expect(createOrderSchema.safeParse(pickup({ originCheckpointId: undefined })).success).toBe(
      false,
    );
  });

  test("requires a description of the package", () => {
    expect(createOrderSchema.safeParse(pickup({ itemDescription: undefined })).success).toBe(false);
  });

  test("rejects a whitespace-only description", () => {
    // `.min(1)` alone would pass "   " — the refinement trims.
    expect(createOrderSchema.safeParse(pickup({ itemDescription: "   " })).success).toBe(false);
  });

  test.each([
    ["a shop", { shopId: UUID_D }],
    ["a suggestion", { suggestionId: UUID_D }],
    ["catalogue items", { items: [{ productId: UUID_C, quantity: 1 }] }],
    ["manual items", { manualItems: [{ name: "Rice", quantity: 1 }] }],
  ])("rejects %s", (_label, extra) => {
    expect(createOrderSchema.safeParse(pickup(extra)).success).toBe(false);
  });
});

describe("createOrderSchema — shop_pickup", () => {
  test("accepts a well-formed order", () => {
    expect(createOrderSchema.safeParse(shopPickup()).success).toBe(true);
  });

  test("requires a suggestion", () => {
    expect(createOrderSchema.safeParse(shopPickup({ suggestionId: undefined })).success).toBe(false);
  });

  test("requires at least one manual item", () => {
    expect(createOrderSchema.safeParse(shopPickup({ manualItems: [] })).success).toBe(false);
  });

  test.each([
    ["a listed shop", { shopId: UUID_D }],
    ["an origin checkpoint", { originCheckpointId: UUID_D }],
    ["catalogue items", { items: [{ productId: UUID_C, quantity: 1 }] }],
  ])("rejects %s", (_label, extra) => {
    expect(createOrderSchema.safeParse(shopPickup(extra)).success).toBe(false);
  });
});

describe("createOrderSchema — shared rules", () => {
  test("rejects collecting and dropping off at the same checkpoint", () => {
    expect(
      createOrderSchema.safeParse(pickup({ originCheckpointId: UUID_B, checkpointId: UUID_B }))
        .success,
    ).toBe(false);
  });

  test("rejects a scheduledDate that is not a date", () => {
    expect(createOrderSchema.safeParse(buyForMe({ scheduledDate: "next sunday" })).success).toBe(
      false,
    );
    expect(createOrderSchema.safeParse(buyForMe({ scheduledDate: "2026-09-06T10:00:00Z" })).success)
      .toBe(false);
  });

  test("rejects a delivery day outside the standard two", () => {
    expect(createOrderSchema.safeParse(buyForMe({ deliveryDay: "tuesday" })).success).toBe(false);
  });

  test("rejects an unknown order type", () => {
    expect(createOrderSchema.safeParse(buyForMe({ orderType: "free_delivery" })).success).toBe(
      false,
    );
  });

  test("caps notes at 500 characters", () => {
    expect(createOrderSchema.safeParse(buyForMe({ notes: "x".repeat(501) })).success).toBe(false);
  });
});

describe("deliverOrderSchema", () => {
  test("accepts exactly six digits", () => {
    expect(deliverOrderSchema.safeParse({ pin: "004213" }).success).toBe(true);
  });

  test.each(["12345", "1234567", "12345a", "  1234", ""])("rejects %s", (pin) => {
    expect(deliverOrderSchema.safeParse({ pin }).success).toBe(false);
  });

  test("rejects a numeric PIN — leading zeros must survive the wire", () => {
    expect(deliverOrderSchema.safeParse({ pin: 4213 }).success).toBe(false);
  });
});

describe("recordGoodsCostSchema", () => {
  test("accepts a priced line", () => {
    expect(
      recordGoodsCostSchema.safeParse({ lines: [{ itemId: UUID_C, actualUnitPrice: 12.5 }] })
        .success,
    ).toBe(true);
  });

  test("accepts a zero price — a shop can give something away", () => {
    expect(
      recordGoodsCostSchema.safeParse({ lines: [{ itemId: UUID_C, actualUnitPrice: 0 }] }).success,
    ).toBe(true);
  });

  test("rejects an empty list", () => {
    expect(recordGoodsCostSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  test.each([-1, 10001])("rejects an actualUnitPrice of %s", (actualUnitPrice) => {
    expect(
      recordGoodsCostSchema.safeParse({ lines: [{ itemId: UUID_C, actualUnitPrice }] }).success,
    ).toBe(false);
  });
});

describe("orderTotalInputSchema", () => {
  test("defaults the optional parts to zero", () => {
    expect(orderTotalInputSchema.parse({ deliveryFee: 20 })).toEqual({
      itemPrice: 0,
      deliveryFee: 20,
      discountPct: 0,
      surchargePct: 0,
    });
  });

  test.each([
    ["a negative delivery fee", { deliveryFee: -20 }],
    ["a negative item price", { deliveryFee: 20, itemPrice: -1 }],
    ["a discount above 100%", { deliveryFee: 20, discountPct: 101 }],
    ["a negative discount", { deliveryFee: 20, discountPct: -5 }],
    ["a surcharge above 100%", { deliveryFee: 20, surchargePct: 150 }],
  ])("rejects %s", (_label, input) => {
    expect(orderTotalInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("cancelOrderSchema", () => {
  test("requires a reason", () => {
    expect(cancelOrderSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({}).success).toBe(false);
  });

  test("caps the reason at 500 characters", () => {
    expect(cancelOrderSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });
});
