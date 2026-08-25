import crypto from "node:crypto";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";

// vi.hoisted so the mock factories below (which vitest lifts above the imports)
// can reference these without a temporal-dead-zone error. The alternative,
// top-level `await import(...)`, is not valid under this package's CommonJS
// target and fails `npm run type-check`.
const { notifyOrderStatus, announceNewOrderToRiders, notifyGoodsPaid, issueDeliveryPin } =
  vi.hoisted(() => ({
    notifyOrderStatus: vi.fn(),
    announceNewOrderToRiders: vi.fn(),
    notifyGoodsPaid: vi.fn(),
    issueDeliveryPin: vi.fn(),
  }));

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus,
  announceNewOrderToRiders,
  notifyGoodsPaid,
}));
vi.mock("../../orders/issuePin", () => ({ issueDeliveryPin }));

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

  test("404s when no order matches the reference", async () => {
    const prisma = makePrisma(null);
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(res.statusCode).toBe(404);
    expect(issueDeliveryPin).not.toHaveBeenCalled();
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
