import { describe, expect, test, vi, beforeEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Mock } from "vitest";
import type { Role } from "../../../plugins/auth";

const { notifyOrderStatus } = vi.hoisted(() => ({ notifyOrderStatus: vi.fn() }));

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus,
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
// The real one is bcrypt and this suite is about what happens *after* the PIN
// checks out, not about the PIN.
vi.mock("../pin", () => ({
  verifyDeliveryPin: vi.fn().mockResolvedValue(true),
  generateDeliveryPin: vi.fn(),
}));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * `rider_earnings` had a table, a route reading it and a screen rendering it —
 * and nothing anywhere wrote a row. Every rider's Earnings tab was permanently
 * empty, on the app used by the people whose trust the pilot depends on.
 *
 * The row is written when the delivery closes, which is the only moment Wave
 * knows the errand was actually completed.
 */
const RIDER = { id: "rider-1", role: "rider" as Role };

function makePrisma(overrides: { pct?: string | null; earning?: Mock } = {}) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: "order-1",
        riderId: "rider-1",
        studentId: "student-1",
        status: "at_checkpoint",
        orderType: "buy_for_me",
        deliveryFee: "20.00",
        deliveryPinHash: "$2a$10$hash",
        goodsPaidAt: null,
        itemPrice: "0",
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    studentDeliveryStats: { upsert: vi.fn().mockResolvedValue({}) },
    platformConfig: {
      findUnique: vi
        .fn()
        .mockResolvedValue(overrides.pct === null ? null : { value: overrides.pct ?? "80" }),
    },
    riderEarning: {
      create: overrides.earning ?? vi.fn().mockResolvedValue({ id: "earning-1" }),
    },
  };
}

async function deliver(prisma: ReturnType<typeof makePrisma>): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(orderRoutes, { prisma, user: RIDER });
  const res = await app.inject({
    method: "PATCH",
    url: "/order-1/deliver",
    payload: { pin: "123456" },
  });
  await app.close();
  return res;
}

beforeEach(() => {
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
});

describe("rider earnings on delivery", () => {
  test("credits the rider when the delivery closes", async () => {
    const prisma = makePrisma();

    const res = await deliver(prisma);

    expect(res.statusCode).toBe(200);
    expect(prisma.riderEarning.create).toHaveBeenCalledWith({
      data: { orderId: "order-1", riderId: "rider-1", amount: 16, status: "pending" },
    });
  });

  test("pays a share of the delivery fee, from platform_config", async () => {
    const prisma = makePrisma({ pct: "50" });

    await deliver(prisma);

    expect(prisma.riderEarning.create.mock.calls[0]?.[0].data.amount).toBe(10);
  });

  test("falls back to the shared default when the config row is missing", async () => {
    // A production database seeded before this key existed has no row, and a
    // rider being paid 0 because of that would be silent.
    const prisma = makePrisma({ pct: null });

    await deliver(prisma);

    expect(prisma.riderEarning.create.mock.calls[0]?.[0].data.amount).toBe(16);
  });

  test("an unparseable config value falls back rather than paying zero", async () => {
    const prisma = makePrisma({ pct: "eighty" });

    await deliver(prisma);

    expect(prisma.riderEarning.create.mock.calls[0]?.[0].data.amount).toBe(16);
  });

  test("rounds to the cedi's two decimal places", async () => {
    const prisma = makePrisma({ pct: "33" });

    await deliver(prisma);

    // 20 * 0.33 = 6.6000000000000005 in float. A Decimal(10,2) column would
    // take it, but the number the rider reads has to be money-shaped.
    expect(prisma.riderEarning.create.mock.calls[0]?.[0].data.amount).toBe(6.6);
  });

  test("a failure to credit does not fail the delivery", async () => {
    // The rider is standing at a checkpoint with the student in front of them.
    // A missing ledger row is recoverable from the order; a handover they
    // cannot close is not.
    const prisma = makePrisma({
      earning: vi.fn().mockRejectedValue(new Error("unique constraint")),
    });

    const res = await deliver(prisma);

    expect(res.statusCode).toBe(200);
  });

  test("no earning is written when the delivery itself was refused", async () => {
    const prisma = makePrisma();
    prisma.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await deliver(prisma);

    expect(res.statusCode).toBe(409);
    expect(prisma.riderEarning.create).not.toHaveBeenCalled();
  });
});
