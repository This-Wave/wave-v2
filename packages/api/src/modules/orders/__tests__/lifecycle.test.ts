import bcrypt from "bcrypt";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

// vi.hoisted so the mock factories below (which vitest lifts above the imports)
// can reference these without a temporal-dead-zone error. The alternative,
// top-level `await import(...)`, is not valid under this package's CommonJS
// target and fails `npm run type-check`.
const { notifyOrderStatus, endOrderWithRefund } = vi.hoisted(() => ({
  notifyOrderStatus: vi.fn(),
  endOrderWithRefund: vi.fn(),
}));

vi.mock("../../notifications/dispatch", () => ({ notifyOrderStatus }));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

const RIDER = { id: "rider-1", role: "rider" as Role };
const STUDENT = { id: "student-1", role: "student" as Role };

function makePrisma(overrides: Record<string, unknown> = {}) {
  const acceptCandidate = { universityId: "uni-1", status: "confirmed", riderId: null };
  return {
    order: {
      findUnique: vi.fn().mockImplementation(async (args: { select?: Record<string, boolean> }) => {
        if (args.select?.universityId && args.select?.status) return acceptCandidate;
        return null;
      }),
      update: vi.fn().mockResolvedValue({ id: "order-1" }),
      ...(overrides.order as object),
    },
    profile: {
      findUnique: vi.fn().mockResolvedValue({ isVerified: true, universityId: "uni-1" }),
      ...(overrides.profile as object),
    },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    studentDeliveryStats: { upsert: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function app(prisma: unknown, user: { id: string; role: Role } | null) {
  return buildTestApp(orderRoutes, { prisma, user });
}

beforeEach(() => {
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
  endOrderWithRefund.mockReset().mockResolvedValue({ ok: true, order: { id: "order-1" }, refundIssued: false });
});

describe("PATCH /:id/accept", () => {
  test("a student cannot accept a delivery", async () => {
    const prisma = makePrisma();
    const res = await (await app(prisma, STUDENT)).inject({ method: "PATCH", url: "/order-1/accept" });

    expect(res.statusCode).toBe(403);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  test("claiming is scoped to an unclaimed, confirmed order", async () => {
    // The riderId/status predicate in the WHERE clause is what stops two riders
    // racing to accept the same order — it must not be dropped.
    const prisma = makePrisma();
    await (await app(prisma, RIDER)).inject({ method: "PATCH", url: "/order-1/accept" });

    expect(prisma.order.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "order-1", riderId: null, status: "confirmed", universityId: "uni-1" },
      data: { riderId: "rider-1", status: "rider_assigned" },
    });
  });

  test("losing the race returns 409, not a 500", async () => {
    // When the claim predicate matches nothing — because another rider got there
    // first — Prisma throws P2025 rather than returning null. Found against a real
    // database: the second accept surfaced as a 500. Two riders tapping the same
    // feed entry is ordinary contention, not a server fault.
    const prisma = makePrisma();
    prisma.order.update.mockRejectedValueOnce(
      Object.assign(new Error("Record to update not found."), { code: "P2025" }),
    );

    const res = await (await app(prisma, RIDER)).inject({ method: "PATCH", url: "/order-1/accept" });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/already been accepted/i);
    expect(notifyOrderStatus).not.toHaveBeenCalled();
  });
});

describe("PATCH /:id/status", () => {
  test.each(["delivered", "refunded", "cancelled", "confirmed"])(
    "a rider may not set status to %s directly",
    async (status) => {
      const prisma = makePrisma();
      const res = await (await app(prisma, RIDER)).inject({
        method: "PATCH",
        url: "/order-1/status",
        payload: { status },
      });

      expect(res.statusCode).toBe(400);
      expect(prisma.order.update).not.toHaveBeenCalled();
    },
  );

  test.each(["en_route", "at_checkpoint"])("a rider may set status to %s", async (status) => {
    const prisma = makePrisma();
    const res = await (await app(prisma, RIDER)).inject({
      method: "PATCH",
      url: "/order-1/status",
      payload: { status },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.order.update.mock.calls[0]?.[0]).toMatchObject({
      // Scoped to the rider the order is assigned to, not just the id.
      where: { id: "order-1", riderId: "rider-1" },
      data: { status },
    });
  });

  test("a transition on someone else's order 404s and writes no history", async () => {
    const prisma = makePrisma({
      order: { update: vi.fn().mockRejectedValue(new Error("record not found")) },
    });
    const res = await (await app(prisma, RIDER)).inject({
      method: "PATCH",
      url: "/order-1/status",
      payload: { status: "en_route" },
    });

    expect(res.statusCode).toBe(404);
    expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(notifyOrderStatus).not.toHaveBeenCalled();
  });
});

describe("PATCH /:id/deliver — PIN", () => {
  const PIN = "482915";

  async function deliverWith(pin: string, hash: string | null) {
    const prisma = makePrisma({
      order: {
        findUnique: vi.fn().mockResolvedValue(
          hash === null
            ? null
            : {
                id: "order-1",
                studentId: "student-1",
                riderId: "rider-1",
                orderType: "shop_catalog",
                deliveryPinHash: hash,
              },
        ),
        update: vi.fn().mockResolvedValue({ id: "order-1", status: "delivered" }),
      },
    });
    const res = await (await app(prisma, RIDER)).inject({
      method: "PATCH",
      url: "/order-1/deliver",
      payload: { pin },
    });
    return { res, prisma };
  }

  test("the correct PIN completes the delivery and credits the loyalty counter", async () => {
    const hash = await bcrypt.hash(PIN, 10);
    const { res, prisma } = await deliverWith(PIN, hash);

    expect(res.statusCode).toBe(200);
    expect(prisma.order.update.mock.calls[0]?.[0]?.data).toMatchObject({ status: "delivered" });
    expect(prisma.studentDeliveryStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "student-1" } }),
    );
  });

  test("a wrong PIN is refused and marks nothing delivered", async () => {
    const hash = await bcrypt.hash(PIN, 10);
    const { res, prisma } = await deliverWith("000000", hash);

    expect(res.statusCode).toBe(403);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.studentDeliveryStats.upsert).not.toHaveBeenCalled();
  });

  test("an order with no PIN issued cannot be delivered", async () => {
    const { res } = await deliverWith(PIN, null);
    expect(res.statusCode).toBe(404);
  });

  test("a malformed PIN is rejected by validation before any lookup", async () => {
    const prisma = makePrisma();
    const res = await (await app(prisma, RIDER)).inject({
      method: "PATCH",
      url: "/order-1/deliver",
      payload: { pin: "12" },
    });

    expect(res.statusCode).toBe(400);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  test("a student cannot mark their own order delivered", async () => {
    const prisma = makePrisma();
    const res = await (await app(prisma, STUDENT)).inject({
      method: "PATCH",
      url: "/order-1/deliver",
      payload: { pin: "482915" },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /:id/cancel — ownership", () => {
  test("a student cannot cancel an order that is not theirs", async () => {
    // Before Phase 3 this route had no ownership check at all, so any
    // authenticated user could cancel — and thereby refund — any order.
    const prisma = makePrisma({
      order: { findUnique: vi.fn().mockResolvedValue({ studentId: "someone-else", status: "confirmed" }) },
    });
    const res = await (await app(prisma, STUDENT)).inject({
      method: "PATCH",
      url: "/order-1/cancel",
      payload: { reason: "changed my mind" },
    });

    expect(res.statusCode).toBe(404);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("a rider cannot cancel a student's order", async () => {
    const prisma = makePrisma();
    const res = await (await app(prisma, RIDER)).inject({
      method: "PATCH",
      url: "/order-1/cancel",
      payload: { reason: "changed my mind" },
    });

    expect(res.statusCode).toBe(403);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("cancellation is closed once the order is en_route", async () => {
    const prisma = makePrisma({
      order: { findUnique: vi.fn().mockResolvedValue({ studentId: "student-1", status: "en_route" }) },
    });
    const res = await (await app(prisma, STUDENT)).inject({
      method: "PATCH",
      url: "/order-1/cancel",
      payload: { reason: "changed my mind" },
    });

    expect(res.statusCode).toBe(409);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("the owner may cancel a confirmed order", async () => {
    const prisma = makePrisma({
      order: { findUnique: vi.fn().mockResolvedValue({ studentId: "student-1", status: "confirmed" }) },
    });
    const res = await (await app(prisma, STUDENT)).inject({
      method: "PATCH",
      url: "/order-1/cancel",
      payload: { reason: "changed my mind" },
    });

    expect(res.statusCode).toBe(200);
    expect(endOrderWithRefund).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", actorId: "student-1", intent: "cancel" }),
    );
  });
});

describe("authentication", () => {
  test("an unauthenticated request never reaches a handler", async () => {
    const prisma = makePrisma();
    const res = await (await app(prisma, null)).inject({ method: "PATCH", url: "/order-1/accept" });

    expect(res.statusCode).toBe(401);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
