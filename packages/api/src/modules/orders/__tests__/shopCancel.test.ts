import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";
import type { LightMyRequestResponse } from "fastify";

const { notifyOrderStatus, endOrderWithRefund } = vi.hoisted(() => ({
  notifyOrderStatus: vi.fn(),
  endOrderWithRefund: vi.fn(),
}));

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus,
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * `PATCH /orders/:id/shop-cancel` — a shop rejecting a paid order, which
 * refunds the student.
 *
 * The route had no tests at all, and carried the multi-shop bug from review
 * 09-architecture H2: ownership was resolved with
 * `findFirst({ where: { ownerId } })` — no `orderBy` — and compared against
 * `order.shopId`. An owner with several shops could only reject orders on
 * whichever shop Postgres happened to return, and *which* one that was could
 * change between requests.
 */
const OWNER = { id: "owner-1", role: "shop_owner" as Role };

function makePrisma(order: unknown) {
  return {
    order: {
      // Mirrors the fixed predicate: the query itself is scoped by ownership,
      // so a non-matching order simply is not found.
      findFirst: vi.fn().mockResolvedValue(order),
      findUnique: vi.fn(),
    },
    shop: { findFirst: vi.fn() },
  };
}

async function cancel(
  prisma: unknown,
  payload: Record<string, unknown> = { reason: "Out of stock" },
): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(orderRoutes, { prisma, user: OWNER });
  const res = await app.inject({
    method: "PATCH",
    url: "/order-1/shop-cancel",
    payload,
  });
  await app.close();
  return res;
}

beforeEach(() => {
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
  endOrderWithRefund
    .mockReset()
    .mockResolvedValue({ ok: true, order: { id: "order-1" }, refundIssued: true });
});

describe("PATCH /orders/:id/shop-cancel — ownership (H2)", () => {
  test("scopes ownership in the query rather than resolving one shop first", () => {
    // The shape of the fix, asserted directly: nothing may read `shop.findFirst`
    // to pick an owner's shop, because an owner can have several.
    const prisma = makePrisma({ id: "order-1" });

    return cancel(prisma).then(() => {
      expect(prisma.shop.findFirst).not.toHaveBeenCalled();
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: "order-1", shop: { ownerId: "owner-1" } },
        select: { id: true },
      });
    });
  });

  test("an owner can reject an order on any of their shops, not just one", async () => {
    // The bug: with several shops and an unordered findFirst, this 404'd for
    // every shop except the arbitrary one Postgres returned.
    const prisma = makePrisma({ id: "order-1" });

    const res = await cancel(prisma);

    expect(res.statusCode).toBe(200);
    expect(endOrderWithRefund).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", intent: "cancel", actorId: "owner-1" }),
    );
  });

  test("404s for an order belonging to someone else's shop", async () => {
    const prisma = makePrisma(null);

    const res = await cancel(prisma);

    expect(res.statusCode).toBe(404);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("404s rather than 403 — a stranger cannot probe order ids", async () => {
    const prisma = makePrisma(null);

    const res = await cancel(prisma);

    expect(res.json()).toEqual({ error: "Order not found" });
  });
});

describe("PATCH /orders/:id/shop-cancel — payload and refund", () => {
  test("requires a reason", async () => {
    const prisma = makePrisma({ id: "order-1" });

    const res = await cancel(prisma, {});

    expect(res.statusCode).toBe(400);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("rejects an empty reason", async () => {
    const prisma = makePrisma({ id: "order-1" });

    const res = await cancel(prisma, { reason: "" });

    expect(res.statusCode).toBe(400);
  });

  test("validates the payload before touching the database", async () => {
    const prisma = makePrisma({ id: "order-1" });

    await cancel(prisma, {});

    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });

  test("surfaces a refund failure with its own status and message", async () => {
    // `endOrderWithRefund` calls Paystack before touching the order, so a 502
    // here means nothing changed — the shop must be told, not silently 200'd.
    endOrderWithRefund.mockResolvedValue({
      ok: false,
      code: 502,
      error: "Refund could not be issued. The order was left unchanged.",
    });
    const prisma = makePrisma({ id: "order-1" });

    const res = await cancel(prisma);

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: "Refund could not be issued. The order was left unchanged.",
    });
  });

  test("reports whether money actually moved", async () => {
    endOrderWithRefund.mockResolvedValue({
      ok: true,
      order: { id: "order-1" },
      refundIssued: false,
    });
    const prisma = makePrisma({ id: "order-1" });

    const res = await cancel(prisma);

    expect(res.json()).toMatchObject({ refundIssued: false });
  });
});
