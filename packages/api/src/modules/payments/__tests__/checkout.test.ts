import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.hoisted so the mock factory below (lifted above the imports) can reference
// these; top-level `await import(...)` is invalid for this package's CommonJS
// target and fails `npm run type-check`.
const { initiatePaystackPayment } = vi.hoisted(() => ({ initiatePaystackPayment: vi.fn() }));

vi.mock("../paystack", async () => {
  const actual = await vi.importActual<typeof import("../paystack")>("../paystack");
  return { ...actual, initiatePaystackPayment };
});

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
  paystackRef: "WAVE-order-1-123",
  status: "confirmed",
  paidAt: new Date("2026-08-03T10:00:00Z"),
};

beforeEach(() => {
  initiatePaystackPayment
    .mockReset()
    .mockResolvedValue({ authorization_url: "https://checkout.paystack.com/x", reference: "r" });
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
});

describe("GET /payments/verify/:ref — ownership", () => {
  test("the owner sees the payment status", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: makePrisma(ownOrder), user: STUDENT });
    const res = await app.inject({ method: "GET", url: "/verify/WAVE-order-1-123" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "confirmed" });
  });

  test("another user gets 404, not the status", async () => {
    // Previously this route looked the order up by reference with no ownership
    // check at all, so any authenticated user could read any order's status.
    const prisma = makePrisma({ ...ownOrder, studentId: "someone-else" });
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
    const prisma = makePrisma(ownOrder);
    const app = await buildTestApp(paymentRoutes, { prisma, user: null });
    await app.inject({ method: "GET", url: "/callback" });

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
