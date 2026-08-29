import { describe, expect, test, vi, beforeEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Mock } from "vitest";
import type { Role } from "../../../plugins/auth";

const { notifyOrderStatus, verifyDeliveryPin } = vi.hoisted(() => ({
  notifyOrderStatus: vi.fn(),
  verifyDeliveryPin: vi.fn(),
}));

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus,
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
vi.mock("../pin", () => ({ verifyDeliveryPin, generateDeliveryPin: vi.fn() }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * The delivery PIN is how a rider proves they handed the order to the right
 * person — so guessing it is the rider asserting a delivery that did not
 * happen. `PATCH /orders/:id/deliver` had no attempt counter and no rate limit,
 * and the assigned rider may call it as often as they like. bcrypt makes a
 * 6-digit search slow; it does not make it impossible.
 *
 * The counter lives on the order rather than in this process, because a count
 * that resets on deploy caps nothing.
 */
const RIDER = { id: "rider-1", role: "rider" as Role };

function makePrisma(attempts = 0, update?: Mock) {
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
        deliveryPinAttempts: attempts,
        goodsPaidAt: null,
        itemPrice: "0",
      }),
      update: update ?? vi.fn().mockResolvedValue({ deliveryPinAttempts: attempts + 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    studentDeliveryStats: { upsert: vi.fn().mockResolvedValue({}) },
    platformConfig: { findUnique: vi.fn().mockResolvedValue({ value: "80" }) },
    riderEarning: { create: vi.fn().mockResolvedValue({}) },
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
  verifyDeliveryPin.mockReset().mockResolvedValue(false);
});

describe("delivery PIN attempt cap", () => {
  test("a wrong PIN increments the counter in the database", async () => {
    const prisma = makePrisma(0);

    await deliver(prisma);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { deliveryPinAttempts: { increment: 1 } },
      select: { deliveryPinAttempts: true },
    });
  });

  test("tells the rider how many tries are left", async () => {
    const prisma = makePrisma(1, vi.fn().mockResolvedValue({ deliveryPinAttempts: 2 }));

    const res = await deliver(prisma);

    expect(res.statusCode).toBe(403);
    expect(res.json().attemptsRemaining).toBe(3);
    expect(res.json().error).toMatch(/3 tries left/);
  });

  test("locks the order once the cap is reached", async () => {
    const prisma = makePrisma(5);

    const res = await deliver(prisma);

    expect(res.statusCode).toBe(429);
    expect(res.json().error).toMatch(/resend pin/i);
  });

  test("a locked order costs no bcrypt comparison at all", async () => {
    // The check sits above the verify for exactly this reason: an attacker who
    // has burned their attempts must not still be able to make the API work.
    const prisma = makePrisma(5);

    await deliver(prisma);

    expect(verifyDeliveryPin).not.toHaveBeenCalled();
  });

  test("a correct PIN delivers and clears the counter", async () => {
    verifyDeliveryPin.mockResolvedValue(true);
    const prisma = makePrisma(3);

    const res = await deliver(prisma);

    expect(res.statusCode).toBe(200);
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "delivered", deliveryPinAttempts: 0 }),
      }),
    );
  });

  test("the cap does not block a delivery on an order with no failures", async () => {
    verifyDeliveryPin.mockResolvedValue(true);
    const prisma = makePrisma(0);

    expect((await deliver(prisma)).statusCode).toBe(200);
  });
});
