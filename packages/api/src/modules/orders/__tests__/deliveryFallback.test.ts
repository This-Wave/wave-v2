import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

const { notifyOrderStatus } = vi.hoisted(() => ({ notifyOrderStatus: vi.fn() }));

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus,
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
vi.mock("../pin", () => ({
  verifyDeliveryPin: vi.fn().mockResolvedValue(true),
  generateDeliveryPin: vi.fn(),
}));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * Closing a delivery when the SMS never arrived.
 *
 * The delivery PIN is the only way an order could be completed, and it arrives
 * by text — which makes SMS a single point of failure on every order. The
 * student confirming receipt in their own app is the fix; the danger is that any
 * second door is also a way to close a delivery that never happened.
 *
 * So these are mostly tests about who may NOT walk through it.
 */
const STUDENT = { id: "student-1", role: "student" as Role };
const OTHER_STUDENT = { id: "student-2", role: "student" as Role };
const RIDER = { id: "rider-1", role: "rider" as Role };

function makePrisma(orderOverrides: Record<string, unknown> = {}) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: "order-1",
        studentId: "student-1",
        riderId: "rider-1",
        status: "at_checkpoint",
        orderType: "buy_for_me",
        deliveryFee: "20.00",
        deliveryPinHash: "$2a$10$hash",
        goodsPaidAt: null,
        itemPrice: "0",
        ...orderOverrides,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    studentDeliveryStats: { upsert: vi.fn().mockResolvedValue({}) },
    profile: { findUnique: vi.fn().mockResolvedValue({ riderType: "student" }) },
    platformConfig: { findUnique: vi.fn().mockResolvedValue({ value: "80" }) },
    riderEarning: { create: vi.fn().mockResolvedValue({ id: "earning-1" }) },
  };
}

async function confirm(prisma: ReturnType<typeof makePrisma>, user = STUDENT) {
  const app = await buildTestApp(orderRoutes, { prisma, user });
  const res = await app.inject({ method: "POST", url: "/order-1/confirm-receipt" });
  await app.close();
  return res;
}

beforeEach(() => {
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
});

describe("a student confirming they received their order", () => {
  test("closes the delivery", async () => {
    const prisma = makePrisma();

    const res = await confirm(prisma);

    expect(res.statusCode).toBe(200);
    expect(prisma.order.updateMany).toHaveBeenCalled();
  });

  test("pays the rider, exactly as the PIN path does", async () => {
    // A delivery that finished because the student confirmed it is still a
    // delivery the rider made. Forgetting this is how the rider silently loses
    // money whenever SMS fails.
    const prisma = makePrisma();

    await confirm(prisma);

    expect(prisma.riderEarning.create).toHaveBeenCalled();
  });

  test("counts towards the loyalty discount, exactly as the PIN path does", async () => {
    const prisma = makePrisma();

    await confirm(prisma);

    expect(prisma.studentDeliveryStats.upsert).toHaveBeenCalled();
  });

  test("records how it was closed", async () => {
    // "How was this closed?" is only ever asked when something went wrong, which
    // is exactly when a missing record costs the most.
    const prisma = makePrisma();

    await confirm(prisma);

    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: expect.stringMatching(/student/i) }),
    });
  });

  test("another student cannot close someone else's order", async () => {
    const prisma = makePrisma();

    const res = await confirm(prisma, OTHER_STUDENT);

    expect(res.statusCode).toBe(403);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  test("a rider cannot use this door", async () => {
    // The whole point of the PIN is that the rider cannot close a delivery on
    // their own say-so. A rider-side confirm would end that.
    const prisma = makePrisma();

    const app = await buildTestApp(orderRoutes, { prisma, user: RIDER });
    const res = await app.inject({ method: "POST", url: "/order-1/confirm-receipt" });
    await app.close();

    expect(res.statusCode).toBe(403);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  test("an order nobody has collected cannot be confirmed", async () => {
    // Otherwise a student closes an order no rider ever touched and still moves
    // closer to a loyalty discount.
    const prisma = makePrisma({ riderId: null });

    const res = await confirm(prisma);

    expect(res.statusCode).toBe(409);
    expect(prisma.studentDeliveryStats.upsert).not.toHaveBeenCalled();
  });

  test("a shop-pickup order with the goods unpaid cannot be confirmed", async () => {
    // Same rule the PIN path enforces: handing over goods Wave paid for, before
    // the student's second charge clears, gives them away.
    const prisma = makePrisma({ orderType: "shop_pickup", goodsPaidAt: null });

    const res = await confirm(prisma);

    expect(res.statusCode).toBe(409);
  });

  test("an already-delivered order is not delivered twice", async () => {
    // The loyalty counter increments on delivery, so a second pass would move a
    // student towards a discount they did not earn.
    const prisma = makePrisma();
    prisma.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await confirm(prisma);

    expect(res.statusCode).toBe(409);
    expect(prisma.riderEarning.create).not.toHaveBeenCalled();
  });
});
