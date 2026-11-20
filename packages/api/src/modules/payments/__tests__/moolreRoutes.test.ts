import crypto from "node:crypto";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { moolreCollect, moolreCollectionStatus, initiatePaystackPayment, confirmDeliveryFeePaid, capturePaymentIssue } =
  vi.hoisted(() => ({
    moolreCollect: vi.fn(),
    moolreCollectionStatus: vi.fn(),
    initiatePaystackPayment: vi.fn(),
    confirmDeliveryFeePaid: vi.fn(),
    capturePaymentIssue: vi.fn(),
  }));

vi.mock("../moolre", async () => {
  const actual = await vi.importActual<typeof import("../moolre")>("../moolre");
  return { ...actual, moolreCollect, moolreCollectionStatus };
});
vi.mock("../paystack", async () => {
  const actual = await vi.importActual<typeof import("../paystack")>("../paystack");
  return { ...actual, initiatePaystackPayment, fetchPaystackTransaction: vi.fn().mockResolvedValue(null) };
});
vi.mock("../confirm", () => ({ confirmDeliveryFeePaid, confirmGoodsPaid: vi.fn() }));
vi.mock("../../../lib/sentry", () => ({ capturePaymentError: vi.fn(), capturePaymentIssue }));

import { paymentRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";
import type { Env } from "../../../config/env";

const ORDER_ID = "3f2a8c1e-1111-4222-8333-944455556666";
const STUDENT = { id: "student-1", role: "student" as const };
const MOOLRE_ENV: Partial<Env> = {
  MOMO_PROVIDER: "moolre",
  MOOLRE_API_USER: "wave",
  MOOLRE_PUBLIC_KEY: "pub",
  MOOLRE_PRIVATE_KEY: "priv",
  MOOLRE_ACCOUNT_NUMBER: "10001",
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    studentId: "student-1",
    universityId: "uni-1",
    orderType: "parcel",
    totalAmount: "40.00",
    status: "payment_pending",
    paidAt: null,
    paystackRef: null,
    momoPayer: null,
    momoNetwork: null,
    ...overrides,
  };
}

function prismaFor(row: Record<string, unknown> | null) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({}),
    },
    profile: { findUnique: vi.fn().mockResolvedValue({ phone: "+233241234567" }) },
  };
}

beforeEach(() => {
  moolreCollect.mockReset();
  moolreCollectionStatus.mockReset().mockResolvedValue({ state: "not_found" });
  initiatePaystackPayment.mockReset().mockResolvedValue({ authorization_url: "https://paystack/x", reference: "r" });
  confirmDeliveryFeePaid.mockReset().mockResolvedValue({ confirmed: true, alreadyProcessed: false });
  capturePaymentIssue.mockReset();
});

describe("POST /initiate with Moolre MoMo", () => {
  test("prompts the phone and saves reference, number and network first", async () => {
    moolreCollect.mockResolvedValue({ kind: "prompt_sent" });
    const prisma = prismaFor(order());
    const app = await buildTestApp(paymentRoutes, { prisma, user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({
      method: "POST",
      url: "/initiate",
      payload: { orderId: ORDER_ID, method: "momo", payerPhone: "050 123 4567", network: "telecel" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ provider: "moolre", next: "approve", payer: "0501234567", network: "TELECEL" });
    expect(body.reference).toMatch(new RegExp(`^WAVEM-${ORDER_ID}-\\d+$`));
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { paystackRef: body.reference, momoPayer: "0501234567", momoNetwork: "TELECEL" },
    });
    expect(moolreCollect.mock.calls[0]![1]).toMatchObject({ amountGhs: 40, payer: "0501234567", channel: "TELECEL" });
    expect(initiatePaystackPayment).not.toHaveBeenCalled();
  });

  test("falls back to the profile number and guesses the network", async () => {
    moolreCollect.mockResolvedValue({ kind: "prompt_sent" });
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(order()), user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "momo" } });
    expect(res.json()).toMatchObject({ payer: "0241234567", network: "MTN" });
  });

  test("asks for the SMS code when Moolre wants one", async () => {
    moolreCollect.mockResolvedValue({ kind: "otp_required" });
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(order()), user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "momo" } });
    expect(res.json()).toMatchObject({ next: "otp" });
  });

  test("a bad number is refused before Moolre is called", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(order()), user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({
      method: "POST",
      url: "/initiate",
      payload: { orderId: ORDER_ID, method: "momo", payerPhone: "12345" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("bad_number");
    expect(moolreCollect).not.toHaveBeenCalled();
  });

  test("without keys it says MoMo is not ready instead of crashing", async () => {
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order()),
      user: STUDENT,
      env: { MOMO_PROVIDER: "moolre" },
    });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "momo" } });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("momo_not_ready");
  });

  test("a prompt from a moment ago is not sent twice", async () => {
    const recent = `WAVEM-${ORDER_ID}-${Date.now() - 30_000}`;
    moolreCollectionStatus.mockResolvedValue({ state: "pending" });
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: recent })),
      user: STUDENT,
      env: MOOLRE_ENV,
    });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "momo" } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: "prompt_pending", reference: recent });
    expect(moolreCollect).not.toHaveBeenCalled();
  });

  test("an earlier Moolre charge that was paid stops a second one", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "40.00" });
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: `WAVEM-${ORDER_ID}-1` })),
      user: STUDENT,
      env: MOOLRE_ENV,
    });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "momo" } });
    expect(res.statusCode).toBe(409);
    expect(confirmDeliveryFeePaid).toHaveBeenCalled();
    expect(moolreCollect).not.toHaveBeenCalled();
  });

  test("card still goes to Paystack", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(order()), user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "card" } });
    expect(res.json()).toMatchObject({ payment_url: "https://paystack/x" });
    expect(moolreCollect).not.toHaveBeenCalled();
  });

  test("card can be switched off", async () => {
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order()),
      user: STUDENT,
      env: { ...MOOLRE_ENV, CARD_PAYMENTS: "off" },
    });
    const res = await app.inject({ method: "POST", url: "/initiate", payload: { orderId: ORDER_ID, method: "card" } });
    expect(res.statusCode).toBe(409);
    expect(initiatePaystackPayment).not.toHaveBeenCalled();
  });
});

describe("POST /momo/otp", () => {
  const ref = `WAVEM-${ORDER_ID}-1763640000000`;
  const pending = order({ paystackRef: ref, momoPayer: "0241234567", momoNetwork: "MTN" });

  test("verifies the code, then sends the prompt on the same reference", async () => {
    moolreCollect.mockResolvedValueOnce({ kind: "otp_verified" }).mockResolvedValueOnce({ kind: "prompt_sent" });
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(pending), user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({ method: "POST", url: "/momo/otp", payload: { reference: ref, code: "123 456" } });

    expect(res.json()).toMatchObject({ next: "approve", reference: ref });
    expect(moolreCollect.mock.calls[0]![1]).toMatchObject({ reference: ref, otpCode: "123456" });
    expect(moolreCollect.mock.calls[1]![1]).toMatchObject({ reference: ref });
    expect(moolreCollect.mock.calls[1]![1].otpCode).toBeUndefined();
    // Distinct keys, or Moolre would replay the first step's answer.
    expect(moolreCollect.mock.calls[0]![1].idempotencyKey).not.toBe(moolreCollect.mock.calls[1]![1].idempotencyKey);
  });

  test("a wrong code says so", async () => {
    moolreCollect.mockResolvedValue({ kind: "otp_wrong", message: "bad" });
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(pending), user: STUDENT, env: MOOLRE_ENV });
    const res = await app.inject({ method: "POST", url: "/momo/otp", payload: { reference: ref, code: "111111" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("otp_wrong");
  });

  test("someone else's order is not found", async () => {
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor({ ...pending, studentId: "other" }),
      user: STUDENT,
      env: MOOLRE_ENV,
    });
    const res = await app.inject({ method: "POST", url: "/momo/otp", payload: { reference: ref, code: "123456" } });
    expect(res.statusCode).toBe(404);
    expect(moolreCollect).not.toHaveBeenCalled();
  });
});

describe("POST /webhook/moolre", () => {
  const ref = `WAVEM-${ORDER_ID}-1763640000000`;
  const payload = { event: "payment.succeeded", data: { externalref: ref, amount: "40.00", txstatus: 1 } };

  test("confirms only after Moolre's status API agrees", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "40.00" });
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: ref })),
      user: null,
      env: MOOLRE_ENV,
    });
    const res = await app.inject({ method: "POST", url: "/webhook/moolre", payload });
    expect(res.statusCode).toBe(200);
    expect(moolreCollectionStatus).toHaveBeenCalledWith(expect.anything(), ref);
    expect(confirmDeliveryFeePaid).toHaveBeenCalledWith(expect.objectContaining({ orderId: ORDER_ID, reference: ref }));
  });

  test("a forged 'succeeded' body confirms nothing", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "failed" });
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: ref })),
      user: null,
      env: MOOLRE_ENV,
    });
    await app.inject({ method: "POST", url: "/webhook/moolre", payload });
    expect(confirmDeliveryFeePaid).not.toHaveBeenCalled();
  });

  test("the wrong amount confirms nothing and raises an alert", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "4.00" });
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: ref })),
      user: null,
      env: MOOLRE_ENV,
    });
    await app.inject({ method: "POST", url: "/webhook/moolre", payload });
    expect(confirmDeliveryFeePaid).not.toHaveBeenCalled();
    expect(capturePaymentIssue).toHaveBeenCalled();
  });

  test("with a secret set, a bad signature is refused", async () => {
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: ref })),
      user: null,
      env: { ...MOOLRE_ENV, MOOLRE_WEBHOOK_SECRET: "whsec" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhook/moolre",
      payload,
      headers: { "x-moolre-signature": "t=1,v1=00" },
    });
    expect(res.statusCode).toBe(401);
    expect(moolreCollectionStatus).not.toHaveBeenCalled();
  });

  test("with a secret set, a good signature over the raw body is accepted", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "40.00" });
    const raw = JSON.stringify(payload);
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac("sha256", "whsec").update(`${t}.${raw}`).digest("hex");
    const app = await buildTestApp(paymentRoutes, {
      prisma: prismaFor(order({ paystackRef: ref })),
      user: null,
      env: { ...MOOLRE_ENV, MOOLRE_WEBHOOK_SECRET: "whsec" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhook/moolre",
      payload: raw,
      headers: { "content-type": "application/json", "x-moolre-signature": `t=${t},v1=${v1}` },
    });
    expect(res.statusCode).toBe(200);
    expect(confirmDeliveryFeePaid).toHaveBeenCalled();
  });

  test("a superseded reference still finds its order by the id inside it", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "40.00" });
    const prisma = prismaFor(null);
    prisma.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(order({ paystackRef: `WAVEM-${ORDER_ID}-1763649999999` }));
    const app = await buildTestApp(paymentRoutes, { prisma, user: null, env: MOOLRE_ENV });
    await app.inject({ method: "POST", url: "/webhook/moolre", payload });
    expect(prisma.order.findUnique.mock.calls[1]![0]).toEqual({ where: { id: ORDER_ID } });
    expect(confirmDeliveryFeePaid).toHaveBeenCalledWith(expect.objectContaining({ reference: ref }));
  });

  test("a second paid charge on a paid order is flagged for a refund, not confirmed again", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "40.00" });
    const prisma = prismaFor(null);
    prisma.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(order({ paystackRef: "WAVEM-other-1", paidAt: new Date(), status: "confirmed" }));
    const app = await buildTestApp(paymentRoutes, { prisma, user: null, env: MOOLRE_ENV });
    await app.inject({ method: "POST", url: "/webhook/moolre", payload });
    expect(capturePaymentIssue).toHaveBeenCalledWith(
      expect.stringContaining("twice"),
      expect.objectContaining({ orderId: ORDER_ID }),
    );
  });
});

describe("GET /options", () => {
  test("tells the app which flow to show", async () => {
    const app = await buildTestApp(paymentRoutes, { prisma: prismaFor(null), user: null, env: MOOLRE_ENV });
    const res = await app.inject({ method: "GET", url: "/options" });
    expect(res.json()).toEqual({ momo: { provider: "moolre", ready: true }, card: true });
  });
});
