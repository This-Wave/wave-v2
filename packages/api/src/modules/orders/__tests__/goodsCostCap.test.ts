import { describe, expect, test, vi, beforeEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Role } from "../../../plugins/auth";

const { notifyGoodsCostRecorded, notifyOrderStatus } = vi.hoisted(() => ({
  notifyGoodsCostRecorded: vi.fn(),
  notifyOrderStatus: vi.fn(),
}));

vi.mock("../../notifications/dispatch", () => ({ notifyGoodsCostRecorded, notifyOrderStatus }));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * `POST /orders/:id/goods-cost` — the rider reports what they paid at the till,
 * and the student is charged that amount automatically.
 *
 * Before this cap the only limit was `actualUnitPrice <= 10000` in the Zod
 * schema, which across a 20-line basket of 20-unit lines permits a charge in the
 * millions (review 11-campus, M2). One slipped decimal point is a real debit
 * from a student's MoMo wallet.
 */
const RIDER = { id: "rider-1", role: "rider" as Role };
const ITEM = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

function makePrisma({
  quantity = 1,
  maxGhs = "1000.00",
}: { quantity?: number; maxGhs?: string | null } = {}) {
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue({
        id: "order-1",
        orderType: "shop_pickup",
        status: "en_route",
        deliveryFee: "20.00",
        discountApplied: "0",
        surchargeApplied: "0",
        goodsPaidAt: null,
        items: [{ id: ITEM, quantity, actualUnitPrice: null }],
      }),
      update: vi.fn().mockResolvedValue({ id: "order-1" }),
    },
    orderItem: { update: vi.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue(maxGhs === null ? null : { value: maxGhs }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        orderItem: { update: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({ id: "order-1" }) },
        orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      }),
    ),
  };
}

async function record(
  prisma: unknown,
  actualUnitPrice: number,
): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(orderRoutes, { prisma, user: RIDER });
  const res = await app.inject({
    method: "POST",
    url: "/order-1/goods-cost",
    payload: { lines: [{ itemId: ITEM, actualUnitPrice }] },
  });
  await app.close();
  return res;
}

beforeEach(() => {
  notifyGoodsCostRecorded.mockReset().mockResolvedValue(undefined);
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
});

describe("goods cost cap (M2)", () => {
  test("accepts a plausible campus total", async () => {
    const prisma = makePrisma();

    const res = await record(prisma, 85.5);

    expect(res.statusCode).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  test("accepts a total exactly at the cap", async () => {
    const prisma = makePrisma();

    const res = await record(prisma, 1000);

    expect(res.statusCode).toBe(200);
  });

  test("rejects a total one pesewa over the cap", async () => {
    const prisma = makePrisma();

    const res = await record(prisma, 1000.01);

    expect(res.statusCode).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("charges nothing and notifies nobody when over the cap", async () => {
    // The failure mode this prevents is a student being debited, so the
    // important assertion is that no write and no charge notification happen.
    const prisma = makePrisma();

    await record(prisma, 5000);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
    expect(notifyGoodsCostRecorded).not.toHaveBeenCalled();
  });

  test("the cap applies to the line total, not the unit price", async () => {
    // 20 x GH₵60 = GH₵1,200. Each unit is unremarkable; the total is not.
    const prisma = makePrisma({ quantity: 20 });

    const res = await record(prisma, 60);

    expect(res.statusCode).toBe(400);
  });

  test("the same unit price passes at a smaller quantity", async () => {
    const prisma = makePrisma({ quantity: 2 });

    const res = await record(prisma, 60);

    expect(res.statusCode).toBe(200);
  });

  test("tells the rider the amount, so they can check it against the receipt", async () => {
    const prisma = makePrisma();

    const res = await record(prisma, 1500);

    expect(res.json().error).toContain("1500.00");
    expect(res.json().error).toMatch(/too high/i);
  });

  test("reads the ceiling from platform_config, not a hardcoded literal", async () => {
    const prisma = makePrisma({ maxGhs: "2500.00" });

    const res = await record(prisma, 2000);

    expect(prisma.platformConfig.findUnique).toHaveBeenCalledWith({
      where: { key: "goods_cost_max_ghs" },
    });
    expect(res.statusCode).toBe(200);
  });

  test("a tightened ceiling takes effect without a deploy", async () => {
    const prisma = makePrisma({ maxGhs: "100.00" });

    const res = await record(prisma, 150);

    expect(res.statusCode).toBe(400);
  });

  test("falls back to the shared default when the config row is missing", async () => {
    // An unseeded database must not mean an unlimited charge.
    const prisma = makePrisma({ maxGhs: null });

    expect((await record(prisma, 999)).statusCode).toBe(200);
    expect((await record(makePrisma({ maxGhs: null }), 1001)).statusCode).toBe(400);
  });
});
