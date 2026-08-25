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
  goodsPaidAt?: Date | null;
  goodsPaystackRef?: string | null;
  refundStartedAt?: Date | null;
}

function harness(order: FakeOrder | null) {
  const calls: string[] = [];
  const update = vi.fn(async (_args: { data: Record<string, unknown> }) => {
    calls.push("update");
    return { id: order?.id };
  });
  const historyCreate = vi.fn(async () => ({}));

  // Stands in for the conditional `UPDATE … WHERE refund_started_at IS NULL OR
  // refund_started_at < :stale` that replaced the in-process Set, and for the
  // release that nulls it again. Mutates the fake row so a second call in the
  // same test sees the claim the first one took.
  const updateMany = vi.fn(async (args: { data: Record<string, unknown>; where: Record<string, unknown> }) => {
    calls.push("updateMany");
    if (args.data.refundStartedAt === null) {
      if (order) order.refundStartedAt = null;
      return { count: 1 };
    }
    const held = order?.refundStartedAt;
    const stale = (args.where.OR as { refundStartedAt?: { lt?: Date } }[] | undefined)?.[1]
      ?.refundStartedAt?.lt;
    if (held && !(stale && held < stale)) return { count: 0 };
    if (order) order.refundStartedAt = args.data.refundStartedAt as Date;
    return { count: 1 };
  });

  const fastify = {
    config: { PAYSTACK_SECRET_KEY: "sk_test" },
    prisma: {
      order: { findUnique: vi.fn(async () => order), update, updateMany },
      orderStatusHistory: { create: historyCreate },
    },
  } as unknown as FastifyInstance;

  const log = { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;
  return { fastify, log, update, updateMany, historyCreate, calls, order };
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
    expect(h.calls).toEqual(["updateMany", "paystack", "update"]);
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

  test("refunds both delivery and goods charges when both were captured", async () => {
    const h = harness({
      ...paidOrder("o9"),
      goodsPaidAt: new Date(),
      goodsPaystackRef: "WAVEGOODS-o9-1",
    });
    const callOrder: string[] = [];
    refundMock.mockImplementation(async (_key, params: { reference: string }) => {
      callOrder.push(params.reference);
      return { id: 1, status: "processed", amount: 1500, currency: "GHS" };
    });

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o9",
      reason: "shop closed",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result.ok).toBe(true);
    expect(refundMock).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual(["WAVE-o9-1", "WAVEGOODS-o9-1"]);
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

  test("a claim held by another instance blocks this one", async () => {
    // The case the in-process Set could not see: instance A is mid-refund, so
    // the row carries its claim. Instance B has an empty Set and would have
    // sailed through to Paystack.
    const order = { ...paidOrder("o10"), refundStartedAt: new Date() };
    const h = harness(order);

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o10",
      reason: "double click",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: false, code: 409 });
    expect(refundMock).not.toHaveBeenCalled();
  });

  test("a claim older than the TTL is taken over", async () => {
    // Otherwise a process killed mid-refund leaves the order permanently
    // unrefundable — a lock with no lease.
    const order = { ...paidOrder("o11"), refundStartedAt: new Date(Date.now() - 5 * 60_000) };
    const h = harness(order);

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o11",
      reason: "retry after crash",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: true, refundIssued: true });
    expect(refundMock).toHaveBeenCalledTimes(1);
  });

  test("releases the claim when Paystack fails, so a retry can re-claim", async () => {
    const h = harness(paidOrder("o12"));
    refundMock.mockRejectedValue(new Error("Paystack down"));

    const result = await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o12",
      reason: "shop closed",
      actorId: "admin-1",
      intent: "refund",
    });

    expect(result).toMatchObject({ ok: false, code: 502 });
    // Last updateMany nulls the claim.
    const releases = h.updateMany.mock.calls.filter(
      (c) => (c[0] as { data: Record<string, unknown> }).data.refundStartedAt === null,
    );
    expect(releases).toHaveLength(1);
    expect(h.order?.refundStartedAt).toBeNull();
  });

  test("keeps the claim on success — the terminal status is what blocks a rerun", async () => {
    const h = harness(paidOrder("o13"));

    await endOrderWithRefund({
      fastify: h.fastify,
      log: h.log,
      orderId: "o13",
      reason: "shop closed",
      actorId: "admin-1",
      intent: "refund",
    });

    const releases = h.updateMany.mock.calls.filter(
      (c) => (c[0] as { data: Record<string, unknown> }).data.refundStartedAt === null,
    );
    expect(releases).toHaveLength(0);
  });
});
