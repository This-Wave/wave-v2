import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

// vi.hoisted for the same reason as webhook.test.ts: vitest lifts the mock
// factories above the imports, and this package's CommonJS target rules out a
// top-level `await import(...)`.
const { fetchPaystackTransaction, confirmDeliveryFeePaid, notifyOrderStatus, capturePaymentIssue } =
  vi.hoisted(() => ({
    fetchPaystackTransaction: vi.fn(),
    confirmDeliveryFeePaid: vi.fn(),
    notifyOrderStatus: vi.fn(),
    capturePaymentIssue: vi.fn(),
  }));

vi.mock("../paystack", () => ({ fetchPaystackTransaction }));
vi.mock("../confirm", () => ({ confirmDeliveryFeePaid, confirmGoodsPaid: vi.fn() }));
vi.mock("../../notifications/dispatch", () => ({ notifyOrderStatus }));
vi.mock("../../../lib/sentry", () => ({
  capturePaymentError: vi.fn(),
  capturePaymentIssue,
}));

import {
  ABANDONED_CANCELLATION_REASON,
  ABANDONED_CHECKOUT_TTL_MS,
  sweepAbandonedCheckouts,
} from "../sweepAbandoned";
import { testEnv } from "../../../test/harness";

const NOW = new Date("2026-08-29T12:00:00Z");

type StaleOrder = { id: string; paystackRef: string | null; totalAmount: string };

/**
 * Only the two calls the sweep makes. `updateMany` returns `{ count: 1 }` by
 * default — the caller overrides it to `{ count: 0 }` to stand in for the
 * conditional UPDATE losing to a webhook that landed first.
 */
function makeFastify(orders: StaleOrder[], updateCount = 1) {
  const findMany = vi.fn().mockResolvedValue(orders);
  const updateMany = vi.fn().mockResolvedValue({ count: updateCount });
  return {
    config: testEnv(),
    prisma: { order: { findMany, updateMany } },
    findMany,
    updateMany,
  } as unknown as FastifyInstance & {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
}

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as FastifyBaseLogger;

function run(fastify: FastifyInstance) {
  return sweepAbandonedCheckouts({ fastify, log, now: NOW });
}

const paid = (amountGhs: number) => ({
  status: "success",
  amount: Math.round(amountGhs * 100),
  currency: "GHS",
  reference: "WAVE-order-1-1",
  paid_at: NOW.toISOString(),
});

beforeEach(() => {
  fetchPaystackTransaction.mockReset();
  confirmDeliveryFeePaid.mockReset().mockResolvedValue({ confirmed: true, alreadyProcessed: false });
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
  capturePaymentIssue.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sweepAbandonedCheckouts — which rows it selects", () => {
  test("only looks at unpaid orders older than the TTL", async () => {
    const fastify = makeFastify([]);
    await run(fastify);

    expect(fastify.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ["pending", "payment_pending"] },
          paidAt: null,
          createdAt: { lt: new Date(NOW.getTime() - ABANDONED_CHECKOUT_TTL_MS) },
        },
      }),
    );
  });

  test("caps the batch and takes the oldest first", async () => {
    const fastify = makeFastify([]);
    await run(fastify);

    const args = fastify.findMany.mock.calls[0]![0];
    expect(args.take).toBeGreaterThan(0);
    expect(args.orderBy).toEqual({ createdAt: "asc" });
  });

  test("does nothing at all when there is nothing stale", async () => {
    const fastify = makeFastify([]);
    const result = await run(fastify);

    expect(result).toEqual({ examined: 0, recovered: 0, cancelled: 0, skipped: 0 });
    expect(fetchPaystackTransaction).not.toHaveBeenCalled();
    expect(fastify.updateMany).not.toHaveBeenCalled();
  });
});

describe("sweepAbandonedCheckouts — cancelling what was never paid", () => {
  test("cancels an order that never reached Paystack without asking Paystack", async () => {
    const fastify = makeFastify([{ id: "order-1", paystackRef: null, totalAmount: "51.00" }]);
    const result = await run(fastify);

    expect(fetchPaystackTransaction).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
    expect(fastify.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: { in: ["pending", "payment_pending"] }, paidAt: null },
      data: { status: "cancelled", cancellationReason: ABANDONED_CANCELLATION_REASON },
    });
  });

  test("cancels a checkout Paystack reports as abandoned", async () => {
    fetchPaystackTransaction.mockResolvedValue({ ...paid(51), status: "abandoned" });
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    const result = await run(fastify);

    expect(result.cancelled).toBe(1);
    expect(confirmDeliveryFeePaid).not.toHaveBeenCalled();
  });

  test("cancels when Paystack has never heard of the reference", async () => {
    fetchPaystackTransaction.mockResolvedValue(null);
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    expect((await run(fastify)).cancelled).toBe(1);
  });

  test("tells the student their order was closed", async () => {
    const fastify = makeFastify([{ id: "order-1", paystackRef: null, totalAmount: "51.00" }]);
    await run(fastify);

    expect(notifyOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", status: "cancelled" }),
    );
  });
});

/**
 * The invariant the whole module exists to protect. Each of these is a way an
 * order can have taken money, and none of them may end in `cancelled`.
 */
describe("sweepAbandonedCheckouts — never cancels an order that took money", () => {
  test("confirms a paid order the webhook never delivered, and does not cancel it", async () => {
    fetchPaystackTransaction.mockResolvedValue(paid(51));
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    const result = await run(fastify);

    expect(result).toMatchObject({ recovered: 1, cancelled: 0 });
    expect(fastify.updateMany).not.toHaveBeenCalled();
    expect(confirmDeliveryFeePaid).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", reference: "WAVE-order-1-1" }),
    );
  });

  test("recovery goes through confirmDeliveryFeePaid, so the PIN is issued the same way", async () => {
    fetchPaystackTransaction.mockResolvedValue(paid(51));
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    await run(fastify);

    // Not a bespoke status write — the one function the webhook and the verify
    // poll both call, which is what issues the PIN and announces to riders.
    expect(confirmDeliveryFeePaid).toHaveBeenCalledTimes(1);
  });

  test("leaves the order alone when Paystack cannot be reached", async () => {
    fetchPaystackTransaction.mockRejectedValue(new Error("ECONNRESET"));
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    const result = await run(fastify);

    expect(result).toMatchObject({ skipped: 1, cancelled: 0, recovered: 0 });
    expect(fastify.updateMany).not.toHaveBeenCalled();
  });

  test("a paid charge for the wrong amount is neither confirmed nor cancelled, and is alerted", async () => {
    fetchPaystackTransaction.mockResolvedValue(paid(5));
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    const result = await run(fastify);

    expect(result).toMatchObject({ skipped: 1, cancelled: 0, recovered: 0 });
    expect(confirmDeliveryFeePaid).not.toHaveBeenCalled();
    expect(fastify.updateMany).not.toHaveBeenCalled();
    expect(capturePaymentIssue).toHaveBeenCalledWith(
      "Abandoned-checkout sweep amount mismatch",
      expect.objectContaining({ orderId: "order-1" }),
    );
  });

  test("a charge in the wrong currency does not count as paid", async () => {
    fetchPaystackTransaction.mockResolvedValue({ ...paid(51), currency: "NGN" });
    const fastify = makeFastify([{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }]);

    expect(await run(fastify)).toMatchObject({ skipped: 1, cancelled: 0 });
  });

  test("a webhook landing mid-sweep wins: the conditional UPDATE matches nothing", async () => {
    // Paystack said "not paid", but the row was confirmed between that lookup
    // and the write. `paidAt: null` in the predicate is what catches it, so the
    // student keeps a confirmed order instead of losing it to the sweep.
    fetchPaystackTransaction.mockResolvedValue(null);
    const fastify = makeFastify(
      [{ id: "order-1", paystackRef: "WAVE-order-1-1", totalAmount: "51.00" }],
      0,
    );

    const result = await run(fastify);

    expect(result).toMatchObject({ skipped: 1, cancelled: 0 });
    expect(notifyOrderStatus).not.toHaveBeenCalled();
  });
});

describe("sweepAbandonedCheckouts — a mixed batch", () => {
  test("settles each order on its own merits and counts them", async () => {
    fetchPaystackTransaction.mockImplementation(async (_secret: string, ref: string) => {
      if (ref === "ref-paid") return paid(51);
      if (ref === "ref-blip") throw new Error("503");
      return null;
    });
    const fastify = makeFastify([
      { id: "paid", paystackRef: "ref-paid", totalAmount: "51.00" },
      { id: "blip", paystackRef: "ref-blip", totalAmount: "51.00" },
      { id: "gone", paystackRef: "ref-gone", totalAmount: "51.00" },
      { id: "never", paystackRef: null, totalAmount: "51.00" },
    ]);

    const result = await run(fastify);

    expect(result).toEqual({ examined: 4, recovered: 1, cancelled: 2, skipped: 1 });
  });

  test("a failed notification does not abort the rest of the batch", async () => {
    // The order is already cancelled by the time the push is attempted, so a
    // dead push service must cost that one student a notification — not every
    // order behind it in the batch.
    notifyOrderStatus.mockRejectedValueOnce(new Error("push service down"));
    const fastify = makeFastify([
      { id: "first", paystackRef: null, totalAmount: "51.00" },
      { id: "second", paystackRef: null, totalAmount: "51.00" },
    ]);

    const result = await run(fastify);

    expect(result).toMatchObject({ examined: 2, cancelled: 2 });
    expect(fastify.updateMany).toHaveBeenCalledTimes(2);
  });
});
