import { describe, expect, test, vi } from "vitest";
import type { Role } from "../../../plugins/auth";

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * A pause set in the admin stops new orders at the API, not just in the app —
 * an old build, or a request made by hand, must be refused the same way.
 */
const STUDENT = { id: "student-1", role: "student" as Role };
const SHOP = "11111111-1111-1111-1111-111111111111";
const CHECKPOINT = "22222222-2222-2222-2222-222222222222";
const PRODUCT = "33333333-3333-3333-3333-333333333333";

function upcomingSunday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return d.toISOString().slice(0, 10);
}

function makePrisma(switches: unknown[]) {
  return {
    serviceSwitch: { findMany: vi.fn().mockResolvedValue(switches) },
    platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    studentDeliveryStats: { findUnique: vi.fn().mockResolvedValue(null) },
    profile: { findUnique: vi.fn().mockResolvedValue({ universityId: "uni-1" }) },
    checkpoint: { count: vi.fn().mockResolvedValue(1) },
    shop: { findFirst: vi.fn().mockResolvedValue({ id: SHOP }) },
    product: {
      findMany: vi.fn().mockResolvedValue([{ id: PRODUCT, name: "Jollof", price: "30.00", status: "active" }]),
    },
    // `findFirst` is the anti-stacking check on the loyalty reward: the order
    // route refuses a second discounted order while one sits unpaid.
    order: {
      create: vi.fn().mockResolvedValue({ id: "order-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

async function placeBuyForMe(switches: unknown[]) {
  const prisma = makePrisma(switches);
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
      scheduledDate: upcomingSunday(),
    },
  });
  await app.close();
  return { res, prisma };
}

describe("POST /orders while paused", () => {
  test("refuses with the admin's own words and creates nothing", async () => {
    const { res, prisma } = await placeBuyForMe([
      { key: "buy_for_me", universityId: "uni-1", paused: true, message: "Shops closed for Eid", resumeAt: null },
    ]);
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "service_paused", error: "Shops closed for Eid" });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  test("the master switch stops it too", async () => {
    const { res } = await placeBuyForMe([
      { key: "all_orders", universityId: null, paused: true, message: null, resumeAt: null },
    ]);
    expect(res.statusCode).toBe(503);
  });

  test("a pause on pickup leaves buy-for-me alone", async () => {
    const { res, prisma } = await placeBuyForMe([
      { key: "pickup", universityId: null, paused: true, message: null, resumeAt: null },
    ]);
    expect(res.statusCode).not.toBe(503);
    expect(prisma.order.create).toHaveBeenCalled();
  });
});
