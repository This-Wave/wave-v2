import crypto from "node:crypto";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";

// vi.hoisted so the mock factories below (which vitest lifts above the imports)
// can reference these without a temporal-dead-zone error. The alternative,
// top-level `await import(...)`, is not valid under this package's CommonJS
// target and fails `npm run type-check`.
const {
  notifyOrderStatus,
  announceNewOrderToRiders,
  notifyGoodsPaid,
  issueDeliveryPin,
  capturePaymentIssue,
} = vi.hoisted(() => ({
  notifyOrderStatus: vi.fn(),
  announceNewOrderToRiders: vi.fn(),
  notifyGoodsPaid: vi.fn(),
  issueDeliveryPin: vi.fn(),
  capturePaymentIssue: vi.fn(),
}));

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus,
  announceNewOrderToRiders,
  notifyGoodsPaid,
}));
vi.mock("../../orders/issuePin", () => ({ issueDeliveryPin }));
vi.mock("../../../lib/sentry", () => ({
  capturePaymentError: vi.fn(),
  capturePaymentIssue,
}));

import { paymentRoutes } from "../routes";
import { buildTestApp, TEST_PAYSTACK_SECRET } from "../../../test/harness";

function sign(body: string): string {
  return crypto.createHmac("sha512", TEST_PAYSTACK_SECRET).update(body).digest("hex");
}

const PAID_EVENT = {
  event: "charge.success",
  data: { reference: "WAVE-order-1-123", status: "success", amount: 4000, currency: "GHS" },
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    universityId: "uni-1",
    totalAmount: "40.00",
    paidAt: null,
    deliveryPinHash: null,
    student: { phone: "+233241234567" },
    shop: { name: "Mama Put Kitchen" },
    ...overrides,
  };
}

function makePrisma(order: unknown) {
  const fullOrder = typeof order === "object" && order !== null ? { ...makeOrder(), ...order } : makeOrder();
  return {
    order: {
      findUnique: vi.fn(async (args: { where: Record<string, unknown> }) => {
        if ("goodsPaystackRef" in args.where) return null;
        if ("paystackRef" in args.where) {
          return order === null ? null : { id: fullOrder.id, totalAmount: fullOrder.totalAmount };
        }
        if ("id" in args.where) return order === null ? null : fullOrder;
        return order;
      }),
      // Stands in for the conditional `UPDATE … WHERE paid_at IS NULL` that is
      // the real idempotency guard: matches only while the row is unpaid, so
      // `count` is what tells confirm.ts whether it won the claim.
      updateMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
        if ("paidAt" in args.where && args.where.paidAt === null && fullOrder.paidAt) {
          return { count: 0 };
        }
        return { count: 1 };
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

async function post(app: FastifyInstance, body: unknown, signature?: string) {
  const payload = JSON.stringify(body);
  return app.inject({
    method: "POST",
    url: "/webhook",
    payload,
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-paystack-signature": signature } : {}),
    },
  });
}

beforeEach(() => {
  notifyOrderStatus.mockReset().mockResolvedValue(undefined);
  announceNewOrderToRiders.mockReset().mockResolvedValue(undefined);
  issueDeliveryPin.mockReset().mockResolvedValue({ smsSent: true });
  capturePaymentIssue.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /payments/webhook — signature verification", () => {
  test("rejects a request with no signature header", async () => {
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });
    const res = await post(app, PAID_EVENT);

    expect(res.statusCode).toBe(401);
    // Nothing may be read or written before the signature is trusted.
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  test("rejects a signature computed with the wrong secret", async () => {
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });
    const payload = JSON.stringify(PAID_EVENT);
    const forged = crypto.createHmac("sha512", "sk_test_attacker").update(payload).digest("hex");

    const res = await post(app, PAID_EVENT, forged);

    expect(res.statusCode).toBe(401);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  test("rejects a valid signature for a different body", async () => {
    // The attack this blocks: replaying a real signature over a swapped payload.
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });
    const signatureForOtherBody = sign(JSON.stringify({ event: "charge.success", data: { reference: "x" } }));

    const res = await post(app, PAID_EVENT, signatureForOtherBody);

    expect(res.statusCode).toBe(401);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  test("accepts a correctly signed body", async () => {
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });
    const payload = JSON.stringify(PAID_EVENT);

    const res = await post(app, PAID_EVENT, sign(payload));

    expect(res.statusCode).toBe(200);
    expect(issueDeliveryPin).toHaveBeenCalledTimes(1);
  });
});

describe("POST /payments/webhook — event handling", () => {
  test("ignores events other than charge.success without touching the order", async () => {
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });
    const event = { event: "charge.failed", data: { reference: "WAVE-order-1-123", status: "failed" } };

    const res = await post(app, event, sign(JSON.stringify(event)));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(issueDeliveryPin).not.toHaveBeenCalled();
  });

  /**
   * 200, not 404, when nothing matches.
   *
   * A non-2xx makes Paystack retry a payload that will never match, and after
   * the final retry the event is gone — a real charge with no record anywhere
   * that it went unclaimed. Acknowledging plus a Sentry issue is the only
   * version where a human finds out.
   */
  test("acknowledges an unmatched charge instead of making Paystack retry it", async () => {
    const prisma = makePrisma(null);
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true, matched: false });
    expect(issueDeliveryPin).not.toHaveBeenCalled();
    expect(capturePaymentIssue).toHaveBeenCalledWith(
      "Paystack webhook matched no order",
      expect.objectContaining({ phase: "webhook_unmatched", reference: PAID_EVENT.data.reference }),
    );
  });

  test("rejects a webhook whose amount does not match the order total", async () => {
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });
    const tampered = {
      ...PAID_EVENT,
      data: { ...PAID_EVENT.data, amount: 100, currency: "GHS" },
    };

    const res = await post(app, tampered, sign(JSON.stringify(tampered)));

    expect(res.statusCode).toBe(400);
    expect(issueDeliveryPin).not.toHaveBeenCalled();
  });

  test("a retry of an already-confirmed order does not re-issue the PIN", async () => {
    // Paystack retries until it gets a 2xx. Re-issuing would overwrite the hash
    // and invalidate the PIN already texted to the student.
    const prisma = makePrisma(makeOrder({ paidAt: new Date(), deliveryPinHash: "$2b$10$alreadyset" }));
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true, alreadyProcessed: true });
    expect(issueDeliveryPin).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  test("confirms the order and announces it to riders", async () => {
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });

    await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(notifyOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", status: "confirmed" }),
    );
    expect(announceNewOrderToRiders).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", universityId: "uni-1" }),
    );
  });

  test("still returns 2xx when the PIN SMS could not be sent", async () => {
    // A non-2xx makes Paystack retry, and the idempotency guard would then
    // strand the retry as a no-op — leaving the order paid but unconfirmed.
    issueDeliveryPin.mockResolvedValue({ smsSent: false, pin: "123456" });
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(res.statusCode).toBe(200);
  });

  test("persists the PIN hash + ciphertext and never the plaintext", async () => {
    const prisma = makePrisma(makeOrder());
    // Run the callback the route hands to issueDeliveryPin, which is the only
    // thing that writes the secrets.
    issueDeliveryPin.mockImplementation(
      async ({
        persist,
      }: {
        persist: (s: { hash: string; ciphertext: string }) => Promise<void>;
      }) => {
        await persist({ hash: "$2b$10$hashedvalue", ciphertext: "cipher-blob" });
        return { smsSent: true, pin: "123456" };
      },
    );
    const app = await buildTestApp(paymentRoutes, { prisma });

    await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    // `status` / `paidAt` now ride on the claim, not this write.
    expect(prisma.order.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "order-1", paidAt: null },
      data: { status: "confirmed" },
    });

    const written = prisma.order.update.mock.calls[0]?.[0]?.data;
    expect(written).toMatchObject({
      deliveryPinHash: "$2b$10$hashedvalue",
      deliveryPinCiphertext: "cipher-blob",
    });
    expect(JSON.stringify(written)).not.toMatch(/\b\d{6}\b/);
  });

  test("the claim precedes PIN generation, so a loser never texts a PIN", async () => {
    // The ordering is the fix. Claiming after issuing would still let two
    // concurrent callers both generate and both send.
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });

    await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(prisma.order.updateMany).toHaveBeenCalled();
    const claimOrder = prisma.order.updateMany.mock.invocationCallOrder[0]!;
    const issueOrder = issueDeliveryPin.mock.invocationCallOrder[0]!;
    expect(claimOrder).toBeLessThan(issueOrder);
  });

  test("a caller that loses the claim issues no PIN, even with the hash unwritten", async () => {
    // The concurrent case the old read-then-write guard missed: both callers
    // read `paidAt: null`, both issued, and the second clobbered the first's
    // hash after the first had already texted its PIN.
    const prisma = makePrisma(makeOrder({ paidAt: new Date(), deliveryPinHash: null }));
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true, alreadyProcessed: true });
    expect(issueDeliveryPin).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

/**
 * `POST /payments/initiate` mints a new reference and overwrites `paystackRef`
 * every time it is called. A student who opens checkout, backs out, and taps
 * Pay again still has the FIRST Paystack page live — and paying on it produces
 * a webhook whose reference is on no row at all.
 *
 * Before the metadata fallback that was a 404: Paystack retried, gave up, and
 * the order sat `payment_pending` with the card charged.
 */
describe("POST /payments/webhook — a charge paid on a superseded reference", () => {
  const STALE_REF = "WAVE-order-1-111";
  const CURRENT_REF = "WAVE-order-1-999";

  const staleEvent = {
    event: "charge.success",
    data: {
      reference: STALE_REF,
      status: "success",
      amount: 4000,
      currency: "GHS",
      metadata: { order_id: "order-1", student_id: "student-1" },
    },
  };

  /** Nothing matches by reference; only `id` resolves — the real shape of this bug. */
  function makeOrphanedPrisma() {
    const order = { ...makeOrder(), paystackRef: CURRENT_REF };
    return {
      order: {
        findUnique: vi.fn(async (args: { where: Record<string, unknown> }) => {
          if ("goodsPaystackRef" in args.where) return null;
          if ("paystackRef" in args.where) return null;
          if ("id" in args.where) return order;
          return null;
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
  }

  test("confirms the order via metadata.order_id when the reference no longer matches", async () => {
    const prisma = makeOrphanedPrisma();
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, staleEvent, sign(JSON.stringify(staleEvent)));

    expect(res.statusCode).toBe(200);
    expect(issueDeliveryPin).toHaveBeenCalledTimes(1);
  });

  test("records the reference that actually paid, so a later refund targets it", async () => {
    const prisma = makeOrphanedPrisma();
    const app = await buildTestApp(paymentRoutes, { prisma });

    await post(app, staleEvent, sign(JSON.stringify(staleEvent)));

    // `endOrderWithRefund` refunds `order.paystackRef`. Leaving the superseded
    // reference on the row would send Paystack a transaction it never charged.
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paystackRef: STALE_REF, status: "confirmed" }),
      }),
    );
  });

  test("raises an alert — a second checkout was opened and may also have been paid", async () => {
    const prisma = makeOrphanedPrisma();
    const app = await buildTestApp(paymentRoutes, { prisma });

    await post(app, staleEvent, sign(JSON.stringify(staleEvent)));

    expect(capturePaymentIssue).toHaveBeenCalledWith(
      "Paystack charge paid on a superseded reference",
      expect.objectContaining({ orderId: "order-1", reference: STALE_REF }),
    );
  });

  test("still asserts the amount — metadata is not a way around reconciliation", async () => {
    const prisma = makeOrphanedPrisma();
    const app = await buildTestApp(paymentRoutes, { prisma });
    const tampered = { ...staleEvent, data: { ...staleEvent.data, amount: 100 } };

    const res = await post(app, tampered, sign(JSON.stringify(tampered)));

    expect(res.statusCode).toBe(400);
    expect(issueDeliveryPin).not.toHaveBeenCalled();
  });

  test("accepts metadata delivered as a JSON string", async () => {
    const prisma = makeOrphanedPrisma();
    const app = await buildTestApp(paymentRoutes, { prisma });
    const stringified = {
      ...staleEvent,
      data: { ...staleEvent.data, metadata: JSON.stringify(staleEvent.data.metadata) },
    };

    const res = await post(app, stringified, sign(JSON.stringify(stringified)));

    expect(res.statusCode).toBe(200);
    expect(issueDeliveryPin).toHaveBeenCalledTimes(1);
  });
});
