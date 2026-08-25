import { describe, expect, test, vi, beforeEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Role } from "../../../plugins/auth";

const { endOrderWithRefund } = vi.hoisted(() => ({ endOrderWithRefund: vi.fn() }));

vi.mock("../../payments/refund", () => ({ endOrderWithRefund }));
vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
}));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * A student may cancel their own order up to `rider_assigned`.
 *
 * On a `shop_pickup` that window was too wide. The rider pays cash at the till,
 * and `POST /:id/goods-cost` records what they paid **without moving the
 * status** — `en_route` is a separate tap the rider may not have made yet. So a
 * student could self-serve a full refund over a basket that had already been
 * bought, and the rider ate it.
 *
 * Status is the wrong question here. Money spent is the right one.
 */
const STUDENT = { id: "student-1", role: "student" as Role };

function makePrisma(order: Record<string, unknown>) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue({
        studentId: "student-1",
        status: "rider_assigned",
        orderType: "buy_for_me",
        itemPrice: "0",
        ...order,
      }),
    },
  };
}

async function cancel(prisma: ReturnType<typeof makePrisma>): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(orderRoutes, { prisma, user: STUDENT });
  const res = await app.inject({
    method: "PATCH",
    url: "/order-1/cancel",
    payload: { reason: "changed my mind" },
  });
  await app.close();
  return res;
}

beforeEach(() => {
  endOrderWithRefund
    .mockReset()
    .mockResolvedValue({ ok: true, order: { id: "order-1" }, refundIssued: true });
});

describe("PATCH /orders/:id/cancel — after the runner has paid", () => {
  test("refuses once a goods cost has been recorded on a shop_pickup", async () => {
    const prisma = makePrisma({ orderType: "shop_pickup", itemPrice: "85.00" });

    const res = await cancel(prisma);

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/already bought/i);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("still allows cancelling a shop_pickup before the runner reaches the till", async () => {
    const prisma = makePrisma({ orderType: "shop_pickup", itemPrice: "0" });

    const res = await cancel(prisma);

    expect(res.statusCode).toBe(200);
    expect(endOrderWithRefund).toHaveBeenCalledTimes(1);
  });

  test("a null itemPrice reads as nothing spent, not as a block", async () => {
    const prisma = makePrisma({ orderType: "shop_pickup", itemPrice: null });

    expect((await cancel(prisma)).statusCode).toBe(200);
  });

  test("a priced buy_for_me order is unaffected — Wave never fronted that cash", async () => {
    // itemPrice is set at checkout on a catalogue order and the student has
    // already paid it, so a refund returns their own money. Nobody is out of
    // pocket and the guard must not fire.
    const prisma = makePrisma({ orderType: "buy_for_me", itemPrice: "85.00" });

    const res = await cancel(prisma);

    expect(res.statusCode).toBe(200);
    expect(endOrderWithRefund).toHaveBeenCalledTimes(1);
  });

  test("someone else's order is still a 404", async () => {
    const prisma = makePrisma({ studentId: "student-2" });

    expect((await cancel(prisma)).statusCode).toBe(404);
  });

  test("a delivered order is still refused on status", async () => {
    const prisma = makePrisma({ status: "delivered" });

    expect((await cancel(prisma)).statusCode).toBe(409);
  });
});
