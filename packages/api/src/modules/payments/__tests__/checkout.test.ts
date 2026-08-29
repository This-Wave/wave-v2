import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.hoisted so the mock factory below (lifted above the imports) can reference
// these; top-level `await import(...)` is invalid for this package's CommonJS
// target and fails `npm run type-check`.
const { initiatePaystackPayment, fetchPaystackTransaction } = vi.hoisted(() => ({
  initiatePaystackPayment: vi.fn(),
  fetchPaystackTransaction: vi.fn(),
}));

vi.mock("../paystack", async () => {
  const actual = await vi.importActual<typeof import("../paystack")>("../paystack");
  return { ...actual, initiatePaystackPayment, fetchPaystackTransaction };
});
vi.mock("../confirm", () => ({
  confirmDeliveryFeePaid: vi.fn().mockResolvedValue({ confirmed: true, alreadyProcessed: false }),
  confirmGoodsPaid: vi.fn().mockResolvedValue({ confirmed: true, alreadyProcessed: false }),
}));

import { paymentRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

const STUDENT = { id: "student-1", role: "student" as const };

function makePrisma(order: Record<string, unknown> | null) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue({}),
    },
    profile: { findUnique: vi.fn().mockResolvedValue({ phone: "+233241234567" }) },
  };
}

const ownOrder = {
  id: "order-1",
  studentId: "student-1",
  totalAmount: "40.00",
  paystackRef: null,
  status: "payment_pending",
  paidAt: null,
};

const paidOrder = {
  ...ownOrder,
  paystackRef: "WAVE-order-1-123",
  status: "confirmed",
  paidAt: new Date("2026-08-03T10:00:00Z"),
};

beforeEach(() => {
  initiatePaystackPayment
    .mockReset()
    .mockResolvedValue({ authorization_url: "https://checkout.paystack.com/x", reference: "r" });
  fetchPaystackTransaction.mockReset().mockResolvedValue(null);
});

describe("POST /payments/initiate — channel selection", () => {
  test("momo restricts Paystack to mobile money", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(ownOrder), user: STUDENT });
    await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1", method: "momo" } });

    expect(initiatePaystackPayment.mock.calls[0]?.[1]).toMatchObject({ channels: ["mobile_money"] });
  });

  test("card restricts Paystack to card", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(ownOrder), user: STUDENT });
    await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1", method: "card" } });

    expect(initiatePaystackPayment.mock.calls[0]?.[1]).toMatchObject({ channels: ["card"] });
  });

  test("no method offers both, rather than silently picking one", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(ownOrder), user: STUDENT });
    await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(initiatePaystackPayment.mock.calls[0]?.[1]?.channels).toBeUndefined();
  });

  test("strips + from E.164 phone before sending Paystack the customer email", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(ownOrder), user: STUDENT });
    await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(initiatePaystackPayment.mock.calls[0]?.[1]).toMatchObject({
      email: "233241234567@wave.app",
    });
  });

  test("the callback URL points at a route that exists", async () => {
    // It used to be APP_URL/payment/callback, which was never implemented — so
    // every student who paid was redirected to a 404.
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(ownOrder), user: STUDENT });
    await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    const { callbackUrl } = initiatePaystackPayment.mock.calls[0]![1] as { callbackUrl: string };
    const path = callbackUrl.replace("http://localhost:4000", "");
    const landing = await app.inject({ method: "GET", url: path.replace("/v1/payments", "") });
    expect(landing.statusCode).toBe(200);
  });

  test("a student cannot start payment for someone else's order", async () => {
    const prisma = makePrisma({ ...ownOrder, studentId: "someone-else" });
    const app = await buildTestApp(paymentRoutes, { prisma, user: STUDENT });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(res.statusCode).toBe(403);
    expect(initiatePaystackPayment).not.toHaveBeenCalled();
  });

  test("a student cannot re-initiate payment on an already-paid order", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(paidOrder), user: STUDENT });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(res.statusCode).toBe(409);
    expect(initiatePaystackPayment).not.toHaveBeenCalled();
  });
});

describe("GET /payments/verify/:ref — ownership", () => {
  test("the owner sees the payment status", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(paidOrder), user: STUDENT });
    const res = await app.inject({ method: "GET", url: "/verify/WAVE-order-1-123" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "confirmed" });
  });

  test("another user gets 404, not the status", async () => {
    // Previously this route looked the order up by reference with no ownership
    // check at all, so any authenticated user could read any order's status.
    const prisma = makePrisma({ ...paidOrder, studentId: "someone-else" });
    const app = await buildTestApp(paymentRoutes, { prisma, user: STUDENT });
    const res = await app.inject({ method: "GET", url: "/verify/WAVE-order-1-123" });

    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.json())).not.toContain("confirmed");
  });

  test("an unknown reference is indistinguishable from someone else's", async () => {
    // Same 404 either way, so a reference cannot be probed for existence.
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(null), user: STUDENT });
    const res = await app.inject({ method: "GET", url: "/verify/WAVE-nope-1" });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /payments/callback", () => {
  test("renders an HTML landing page without authentication", async () => {
    // Paystack redirects the student's browser here; it carries no token.
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(null), user: null });
    const res = await app.inject({ method: "GET", url: "/callback" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Payment received");
  });

  test("is inert — it reads no order and confirms nothing", async () => {
    // Anyone can visit a redirect URL. Only the signed webhook may confirm.
    const prisma = makePrisma(paidOrder);
    const app = await buildTestApp(paymentRoutes, { prisma, user: null });
    await app.inject({ method: "GET", url: "/callback" });

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});


/**
 * Re-initiating checkout orphans the previous Paystack reference — the row
 * holds only one — while the previous checkout page is still open in the
 * student's browser or WebView.
 *
 * So before abandoning a reference, ask Paystack whether it was paid. This is
 * what stops a student paying twice for one order, and it is the reason the
 * webhook's metadata fallback is a net rather than the primary defence.
 */
describe("POST /payments/initiate — re-initiating an order that already has a reference", () => {
  const retriedOrder = { ...ownOrder, paystackRef: "WAVE-order-1-111" };

  test("checks the existing reference with Paystack before overwriting it", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(retriedOrder), user: STUDENT });
    await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(fetchPaystackTransaction.mock.calls[0]?.[1]).toBe("WAVE-order-1-111");
  });

  test("refuses a second checkout when the first reference was already paid", async () => {
    fetchPaystackTransaction.mockResolvedValue({
      status: "success",
      reference: "WAVE-order-1-111",
      amount: 4000,
      currency: "GHS",
      paid_at: "2026-08-25T10:00:00Z",
    });
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(retriedOrder), user: STUDENT });

    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(res.statusCode).toBe(409);
    expect(initiatePaystackPayment).not.toHaveBeenCalled();
  });

  test("proceeds normally when the old reference was never paid", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(retriedOrder), user: STUDENT });

    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(res.statusCode).toBe(200);
    expect(initiatePaystackPayment).toHaveBeenCalledTimes(1);
  });

  test("a Paystack outage does not block checkout — the webhook fallback covers it", async () => {
    fetchPaystackTransaction.mockRejectedValue(new Error("gateway timeout"));
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(retriedOrder), user: STUDENT });

    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: "order-1" } });

    expect(res.statusCode).toBe(200);
    expect(initiatePaystackPayment).toHaveBeenCalledTimes(1);
  });
});

/**
 * `returnOrigin` is client-supplied and ends up as Paystack's `callback_url` —
 * the address a student's browser is sent to seconds after they type a MoMo
 * PIN. The old guard ended in `origin.startsWith("https://")`, which accepts
 * every host on the internet, immediately under a comment promising it accepted
 * none. It is now the `CORS_ORIGINS` allowlist: one list, already maintained.
 */
describe("POST /payments/initiate — where Paystack sends the student back", () => {
  const CORS_ORIGINS = "https://wave-admin.onrender.com,https://wave.vercel.app";

  async function callbackFor(returnOrigin: string | undefined, env: Record<string, unknown> = {}) {
    const app = await buildTestApp(paymentRoutes, {
      prisma: makePrisma(ownOrder),
      user: STUDENT,
      env: { CORS_ORIGINS, NODE_ENV: "production", ...env } as never,
    });
    await app.inject({
      method: "POST",
      url: "/initiate",
      payload: { orderId: "order-1", ...(returnOrigin ? { returnOrigin } : {}) },
    });
    await app.close();
    return (initiatePaystackPayment.mock.calls[0]?.[1] as { callbackUrl: string }).callbackUrl;
  }

  test("an allowlisted origin is honoured", async () => {
    expect(await callbackFor("https://wave.vercel.app/checkout")).toBe(
      "https://wave.vercel.app/?wave_payment=1",
    );
  });

  test("an arbitrary https host falls back to Wave's own landing page", async () => {
    // The whole finding in one assertion.
    expect(await callbackFor("https://attacker.example/steal")).toBe(
      "http://localhost:4000/v1/payments/callback",
    );
  });

  test("a lookalike host is not a prefix match", async () => {
    expect(await callbackFor("https://wave.vercel.app.attacker.example")).toBe(
      "http://localhost:4000/v1/payments/callback",
    );
  });

  test("localhost is refused in production", async () => {
    expect(await callbackFor("http://localhost:8081")).toBe(
      "http://localhost:4000/v1/payments/callback",
    );
  });

  test("localhost still works in development, where the tunnel is the point", async () => {
    expect(await callbackFor("http://localhost:8081", { NODE_ENV: "development" })).toBe(
      "http://localhost:8081/?wave_payment=1",
    );
  });

  test("no returnOrigin means the API's own landing page", async () => {
    expect(await callbackFor(undefined)).toBe("http://localhost:4000/v1/payments/callback");
  });
});

