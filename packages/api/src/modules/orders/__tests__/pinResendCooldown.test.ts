import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

const { notifyOrderStatus, endOrderWithRefund, issueDeliveryPin } = vi.hoisted(() => ({
  notifyOrderStatus: vi.fn(),
  endOrderWithRefund: vi.fn(),
  issueDeliveryPin: vi.fn(),
}));

vi.mock("../../notifications/dispatch", () => ({ notifyOrderStatus }));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund }));
vi.mock("../issuePin", () => ({ issueDeliveryPin }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

const STUDENT = { id: "student-1", role: "student" as Role };
const COOLDOWN_MS = 60_000;

/**
 * The per-order delivery-PIN resend cooldown (review 01-cybersecurity, M6).
 *
 * It used to live in a module-level `Map<orderId, timestamp>`, which enforced
 * nothing once the API ran as more than one instance: each process kept its own
 * and a student could resend once per instance per window. Every SMS costs
 * money. It is now a conditional UPDATE on `lastPinResendAt`.
 */
function makePrisma(order: Record<string, unknown> | null, claimCount = 1) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
      update: vi.fn().mockResolvedValue({ id: "order-1" }),
    },
    profile: { findUnique: vi.fn().mockResolvedValue({ isVerified: true, universityId: "uni-1" }) },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    studentDeliveryStats: { upsert: vi.fn().mockResolvedValue({}) },
  };
}

const liveOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  studentId: STUDENT.id,
  status: "confirmed",
  lastPinResendAt: null,
  student: { phone: "+233241234567" },
  ...overrides,
});

async function resend(prisma: unknown, user: { id: string; role: Role } | null = STUDENT) {
  const app = await buildTestApp(orderRoutes, { prisma, user });
  const res = await app.inject({ method: "POST", url: "/order-1/resend-pin" });
  await app.close();
  return res;
}

beforeEach(() => {
  issueDeliveryPin.mockReset().mockResolvedValue({ smsSent: true, pin: "123456" });
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
});

describe("POST /orders/:id/resend-pin — cooldown (M6)", () => {
  test("claims the cooldown with a conditional update, not an in-process Map", async () => {
    const prisma = makePrisma(liveOrder());

    const res = await resend(prisma);

    expect(res.statusCode).toBe(200);
    const claim = prisma.order.updateMany.mock.calls[0]![0] as {
      where: { id: string; OR: unknown[] };
      data: { lastPinResendAt: Date };
    };
    expect(claim.where.id).toBe("order-1");
    // Null (never resent) or older than the window — the two ways to be eligible.
    expect(claim.where.OR).toHaveLength(2);
    expect(claim.data.lastPinResendAt).toBeInstanceOf(Date);
  });

  test("claims before sending, so a lost race never costs an SMS", async () => {
    const prisma = makePrisma(liveOrder());

    await resend(prisma);

    const claimOrder = prisma.order.updateMany.mock.invocationCallOrder[0]!;
    const sendOrder = issueDeliveryPin.mock.invocationCallOrder[0]!;
    expect(claimOrder).toBeLessThan(sendOrder);
  });

  test("429s and sends nothing when another caller holds the window", async () => {
    // count === 0 is the database saying someone else claimed — including this
    // student's own double-tap, and including a claim taken on another instance.
    const prisma = makePrisma(liveOrder({ lastPinResendAt: new Date() }), 0);

    const res = await resend(prisma);

    expect(res.statusCode).toBe(429);
    expect(issueDeliveryPin).not.toHaveBeenCalled();
  });

  test("reports the remaining wait in seconds", async () => {
    const prisma = makePrisma(
      liveOrder({ lastPinResendAt: new Date(Date.now() - COOLDOWN_MS / 2) }),
      0,
    );

    const res = await resend(prisma);

    expect(res.statusCode).toBe(429);
    const seconds = Number(/(\d+)s/.exec(res.json().error as string)?.[1]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(30);
  });

  test("never reports a negative wait for a stale timestamp", async () => {
    // count === 0 with a long-past timestamp shouldn't happen, but the clamp
    // keeps the copy sane rather than printing "wait -412s".
    const prisma = makePrisma(
      liveOrder({ lastPinResendAt: new Date(Date.now() - 10 * COOLDOWN_MS) }),
      0,
    );

    const res = await resend(prisma);

    expect(res.json().error).toContain("0s");
    expect(res.json().error).not.toContain("-");
  });

  test("allows a resend once the window has passed", async () => {
    const prisma = makePrisma(liveOrder({ lastPinResendAt: new Date(Date.now() - 2 * COOLDOWN_MS) }));

    const res = await resend(prisma);

    expect(res.statusCode).toBe(200);
    expect(issueDeliveryPin).toHaveBeenCalledTimes(1);
  });

  test("404s for an order belonging to another student, without claiming", async () => {
    const prisma = makePrisma(liveOrder({ studentId: "someone-else" }));

    const res = await resend(prisma);

    expect(res.statusCode).toBe(404);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(issueDeliveryPin).not.toHaveBeenCalled();
  });

  test("409s for an order with no active delivery PIN, without claiming", async () => {
    const prisma = makePrisma(liveOrder({ status: "delivered" }));

    const res = await resend(prisma);

    expect(res.statusCode).toBe(409);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(issueDeliveryPin).not.toHaveBeenCalled();
  });
});
