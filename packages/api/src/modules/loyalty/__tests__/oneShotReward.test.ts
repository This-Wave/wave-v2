import { describe, expect, test, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { loyaltyRoutes } from "../routes";
import { calculateDiscount } from "../../orders/discount";

/**
 * The reward became one-shot on 2026-09-23: a full card takes 20% off the
 * delivery fee of the next order, then the stamps reset.
 *
 * The thing these guard is the difference between the two counters.
 * `totalDeliveries` is lifetime history; `rewardStamps` is what the discount
 * spends. Reading the first is what made the discount permanent, and it is a
 * one-word mistake to make again.
 */
function prismaWith({
  rewardStamps,
  totalDeliveries,
  heldOpenOrder = null,
}: {
  rewardStamps: number;
  totalDeliveries: number;
  heldOpenOrder?: { id: string } | null;
}) {
  return {
    studentDeliveryStats: {
      findUnique: vi.fn().mockResolvedValue({ rewardStamps, totalDeliveries }),
    },
    platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    order: { findFirst: vi.fn().mockResolvedValue(heldOpenOrder) },
  };
}

const STUDENT = { id: "student-1", role: "student" as const };

describe("GET /loyalty", () => {
  test("reports the spendable stamps, not the lifetime count", async () => {
    // 11 lifetime deliveries, 5 stamps: one card already spent.
    const app = await buildTestApp(loyaltyRoutes, {
      prisma: prismaWith({ rewardStamps: 5, totalDeliveries: 11 }),
      user: STUDENT,
    });

    const res = await app.inject({ method: "GET", url: "/loyalty" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      stamps: 5,
      threshold: 6,
      totalDeliveries: 11,
      rewardReady: false,
    });
    await app.close();
  });

  test("a full card is a ready reward", async () => {
    const app = await buildTestApp(loyaltyRoutes, {
      prisma: prismaWith({ rewardStamps: 6, totalDeliveries: 6 }),
      user: STUDENT,
    });

    expect(res200(await app.inject({ method: "GET", url: "/loyalty" }))).toMatchObject({
      rewardReady: true,
      rewardPending: false,
    });
    await app.close();
  });

  test("a full card already priced into an unpaid order is pending, not ready", async () => {
    // Otherwise the profile promises a discount the next order will not get,
    // because the order route refuses to apply a second one while that is open.
    const app = await buildTestApp(loyaltyRoutes, {
      prisma: prismaWith({
        rewardStamps: 6,
        totalDeliveries: 6,
        heldOpenOrder: { id: "order-unpaid" },
      }),
      user: STUDENT,
    });

    expect(res200(await app.inject({ method: "GET", url: "/loyalty" }))).toMatchObject({
      rewardReady: false,
      rewardPending: true,
    });
    await app.close();
  });

  test("a student with no stats row reads as an empty card", async () => {
    const prisma = prismaWith({ rewardStamps: 0, totalDeliveries: 0 });
    prisma.studentDeliveryStats.findUnique = vi.fn().mockResolvedValue(null);
    const app = await buildTestApp(loyaltyRoutes, { prisma, user: STUDENT });

    expect(res200(await app.inject({ method: "GET", url: "/loyalty" }))).toMatchObject({
      stamps: 0,
      totalDeliveries: 0,
      rewardReady: false,
    });
    await app.close();
  });

  test("the configured threshold wins over the default", async () => {
    const prisma = prismaWith({ rewardStamps: 3, totalDeliveries: 3 });
    prisma.platformConfig.findUnique = vi.fn(async ({ where }: { where: { key: string } }) =>
      where.key === "loyalty_threshold" ? { key: where.key, value: "3" } : null,
    );
    const app = await buildTestApp(loyaltyRoutes, { prisma, user: STUDENT });

    expect(res200(await app.inject({ method: "GET", url: "/loyalty" }))).toMatchObject({
      stamps: 3,
      threshold: 3,
      rewardReady: true,
    });
    await app.close();
  });

  test("is refused without a token", async () => {
    const app = await buildTestApp(loyaltyRoutes, {
      prisma: prismaWith({ rewardStamps: 6, totalDeliveries: 6 }),
      user: null,
    });

    expect((await app.inject({ method: "GET", url: "/loyalty" })).statusCode).toBe(401);
    await app.close();
  });
});

describe("calculateDiscount takes stamps", () => {
  test("nothing below the threshold, the full percentage at it", () => {
    expect(calculateDiscount({ stamps: 5, baseAmount: 20 })).toBe(0);
    expect(calculateDiscount({ stamps: 6, baseAmount: 20 })).toBe(4);
  });

  test("a spent card stops discounting", () => {
    // The regression the rename guards: passing a lifetime count here made the
    // discount permanent, because that number never goes down.
    expect(calculateDiscount({ stamps: 0, baseAmount: 20 })).toBe(0);
  });
});

function res200(res: { statusCode: number; json: () => unknown }): unknown {
  expect(res.statusCode).toBe(200);
  return res.json();
}
