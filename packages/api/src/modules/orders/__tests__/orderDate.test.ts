import { describe, expect, test, vi, beforeEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Role } from "../../../plugins/auth";

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * `scheduledDate` was validated for its **day of the week** and nothing else, so
 * "last Sunday" was a perfectly acceptable delivery date. The rider feed filters
 * on status and campus, not on date, so such an order went live immediately —
 * for a Wave that had already happened.
 */
const STUDENT = { id: "student-1", role: "student" as Role };
const SHOP = "11111111-1111-1111-1111-111111111111";
const CHECKPOINT = "22222222-2222-2222-2222-222222222222";
const PRODUCT = "33333333-3333-3333-3333-333333333333";

/** The next occurrence of `weekday` strictly after today, as YYYY-MM-DD (UTC). */
function upcoming(weekday: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== weekday);
  return d.toISOString().slice(0, 10);
}

/** The most recent occurrence of `weekday` strictly before today. */
function past(weekday: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() !== weekday);
  return d.toISOString().slice(0, 10);
}

function makePrisma() {
  return {
    platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    studentDeliveryStats: { findUnique: vi.fn().mockResolvedValue(null) },
    profile: { findUnique: vi.fn().mockResolvedValue({ universityId: "uni-1" }) },
    checkpoint: { count: vi.fn().mockResolvedValue(1) },
    shop: { findFirst: vi.fn().mockResolvedValue({ id: SHOP }) },
    product: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: PRODUCT, name: "Jollof", price: "30.00", status: "active" }]),
    },
    order: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
  };
}

async function place(scheduledDate: string): Promise<LightMyRequestResponse> {
  const prisma = makePrisma();
  const app = await buildTestApp(orderRoutes, { prisma, user: STUDENT });
  const res = await app.inject({
    method: "POST",
    url: "/",
    payload: {
      orderType: "buy_for_me",
      shopId: SHOP,
      checkpointId: CHECKPOINT,
      items: [{ productId: PRODUCT, quantity: 1 }],
      deliveryDay: "sunday",
      isSpecialOrder: false,
      scheduledDate,
    },
  });
  await app.close();
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /orders — the scheduled date has to be in the future", () => {
  test("refuses a Wave day that has already been and gone", async () => {
    const res = await place(past(0));

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/already passed/i);
  });

  test("refuses a past Wednesday too — it is the date, not the day, that is wrong", async () => {
    expect((await place(past(3))).statusCode).toBe(400);
  });

  test("accepts the next Sunday", async () => {
    expect((await place(upcoming(0))).statusCode).toBe(201);
  });

  test("accepts the next Wednesday", async () => {
    expect((await place(upcoming(3))).statusCode).toBe(201);
  });

  test("a future non-Wave day is still refused, for the original reason", async () => {
    // The past-date guard runs first but must not swallow the standard-day rule.
    const res = await place(upcoming(2));

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/special order/i);
  });
});
