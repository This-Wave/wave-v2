import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { endOrderWithRefund } from "../refund";
import { refundPaystackPayment } from "../paystack";

vi.mock("../paystack", () => ({ refundPaystackPayment: vi.fn() }));

const refundMock = vi.mocked(refundPaystackPayment);

interface FakeOrder {
  id: string;
  status: string;
  paidAt: Date | null;
  paystackRef: string | null;
}

function harness(order: FakeOrder | null) {
  const calls: string[] = [];
  const update = vi.fn(async (_args: { data: Record<string, unknown> }) => {
    calls.push("update");
    return { id: order?.id };
  });
  const historyCreate = vi.fn(async () => ({}));

  const fastify = {
    config: { PAYSTACK_SECRET_KEY: "sk_test" },
    prisma: {
      order: { findUnique: vi.fn(async () => order), update },
      orderStatusHistory: { create: historyCreate },
    },
  } as unknown as FastifyInstance;

  const log = { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;
  return { fastify, log, update, historyCreate, calls };
}

const paidOrder = (id: string, status = "confirmed"): FakeOrder => ({
  id,
  status,
  paidAt: new Date(),
  paystackRef: `WAVE-${id}-1`,
});

const unpaidOrder = (id: string, status = "payment_pending"): FakeOrder => ({
  id,
  status,
  paidAt: null,
  paystackRef: null,
});

beforeEach(() => {
  refundMock.mockReset();
  refundMock.mockImplementation(async () => {
    return { id: 1, status: "processed", amount: 1500, currency: "GHS" };
  });
});

describe("endOrderWithRefund", () => {
  test("refunds a paid order and only then marks it refunded", async () => {
    const h = harness(paidOrder("o1"));
    refundMock.mockImplementation(async () => {
      h.calls.push("paystack");
      return { id: 1, status: "processed", amount: 1500, currency: "GHS" };
    });

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o1",
      reason: "shop closed",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ refundIssued: true });
    // Paystack is called before the status write, never after.
    expect(h.calls).toEqual(["paystack", "update"]);
    expect(h.update.mock.calls[0]![0]).toMatchObject({
      data: { status: "refunded", cancellationReason: "shop closed" },
    });
    expect(h.historyCreate).toHaveBeenCalledTimes(1);
  });

  test("leaves the order untouched when Paystack rejects the refund", async () => {
    const h = harness(paidOrder("o2"));
    refundMock.mockRejectedValue(new Error("Paystack down"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o2",
      reason: "student changed mind",
      actorId: "student-1",
      intent: "cancel",
    });

    expect(result).toMatchObject({ ok: false, code: 502 });
    // The critical assertion: money was NOT returned, so the order must not
    // claim it was.
    expect(h.update).not.toHaveBeenCalled();
    expect(h.historyCreate).not.toHaveBeenCalled();
  });

  test("cancelling an unpaid order takes the cancelled status and calls no provider", async () => {
    const h = harness(unpaidOrder("o3"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o3",
      reason: "changed mind",
      actorId: "student-1",
      intent: "cancel",
    });

    expect(result).toMatchObject({ ok: true, refundIssued: false });
    expect(refundMock).not.toHaveBeenCalled();
    expect(h.update.mock.calls[0]![0]).toMatchObject({ data: { status: "cancelled" } });
  });

  test("refusing to refund an order that was never charged", async () => {
    const h = harness(unpaidOrder("o4"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o4",
      reason: "complaint",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: false, code: 400 });
    expect(refundMock).not.toHaveBeenCalled();
  });

  test("a second refund of the same order is rejected before reaching Paystack", async () => {
    const h = harness(paidOrder("o5", "refunded"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o5",
      reason: "duplicate",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: false, code: 409 });
    expect(refundMock).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  test("a delivered order cannot be cancelled", async () => {
    const h = harness(paidOrder("o6", "delivered"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o6",
      reason: "too late",
      actorId: "student-1",
      intent: "cancel",
    });

    expect(result).toMatchObject({ ok: false, code: 409 });
    expect(refundMock).not.toHaveBeenCalled();
  });

  test("an admin can still refund a delivered order", async () => {
    const h = harness(paidOrder("o7", "delivered"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o7",
      reason: "item was wrong",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: true, refundIssued: true });
  });

  test("a missing order is a 404", async () => {
    const h = harness(null);

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "nope",
      reason: "x",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: false, code: 404 });
  });

  test("concurrent refunds of one order: only the first reaches Paystack", async () => {
    const h = harness(paidOrder("o8"));
    let release: () => void = () => {};
    refundMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ id: 1, status: "processed", amount: 1500, currency: "GHS" });
        }),
    );

    const args = {
      fastify: h.fastify,
      log: h.log,
      orderId: "o8",
      reason: "double click",
      actorId: "admin-1",
      intent: "refund" as const,
    };

    const first = endOrderWithRefund(args);
    const second = await endOrderWithRefund(args);
    release();

    expect(second).toMatchObject({ ok: false, code: 409 });
    expect(await first).toMatchObject({ ok: true, refundIssued: true });
    expect(refundMock).toHaveBeenCalledTimes(1);
  });
});
