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

const PAID_EVENT = { event: "charge.success", data: { reference: "WAVE-order-1-123", status: "success" } };

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    universityId: "uni-1",
    paidAt: null,
    deliveryPinHash: null,
    student: { phone: "+233241234567" },
    shop: { name: "Mama Put Kitchen" },
    ...overrides,
  };
}

function makePrisma(order: unknown) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
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
    issueDeliveryPin.mockResolvedValue({ smsSent: false });
    const prisma = makePrisma(makeOrder());
    const app = await buildTestApp(paymentRoutes, { prisma });

    const res = await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    expect(res.statusCode).toBe(200);
  });

  test("persists the PIN hash and never the plaintext", async () => {
    const prisma = makePrisma(makeOrder());
    // Run the callback the route hands to issueDeliveryPin, which is the only
    // thing that writes the hash.
    issueDeliveryPin.mockImplementation(async ({ persistHash }: { persistHash: (h: string) => Promise<void> }) => {
      await persistHash("$2b$10$hashedvalue");
      return { smsSent: true };
    });
    const app = await buildTestApp(paymentRoutes, { prisma });

    await post(app, PAID_EVENT, sign(JSON.stringify(PAID_EVENT)));

    const written = prisma.order.update.mock.calls[0]?.[0]?.data;
    expect(written).toMatchObject({ status: "confirmed", deliveryPinHash: "$2b$10$hashedvalue" });
    expect(JSON.stringify(written)).not.toMatch(/\b\d{6}\b/);
  });
});
