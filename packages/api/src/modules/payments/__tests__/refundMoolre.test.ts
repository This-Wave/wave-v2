import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

const { moolreCollectionStatus, moolrePayout, refundPaystackPayment } = vi.hoisted(() => ({
  moolreCollectionStatus: vi.fn(),
  moolrePayout: vi.fn(),
  refundPaystackPayment: vi.fn(),
}));
vi.mock("../moolre", async () => {
  const actual = await vi.importActual<typeof import("../moolre")>("../moolre");
  return { ...actual, moolreCollectionStatus, moolrePayout };
});
vi.mock("../paystack", () => ({ refundPaystackPayment }));
vi.mock("../../notifications/dispatch", () => ({ notifyOrderStatus: vi.fn() }));
vi.mock("../../../lib/audit", () => ({ recordAudit: vi.fn() }));

import { endOrderWithRefund } from "../refund";

const REF = "WAVEM-order-1-1763640000000";

function harness(overrides: Record<string, unknown> = {}) {
  const order = {
    id: "order-1",
    status: "confirmed",
    universityId: "uni-1",
    paidAt: new Date(),
    paystackRef: REF,
    momoPayer: "0501234567",
    momoNetwork: "TELECEL",
    goodsPaidAt: null,
    goodsPaystackRef: null,
    discountApplied: "0",
    refundStartedAt: null,
    ...overrides,
  };
  const update = vi.fn(async () => ({ id: order.id }));
  const fastify = {
    config: { PAYSTACK_SECRET_KEY: "sk_test" },
    prisma: {
      order: { findUnique: vi.fn(async () => order), update, updateMany: vi.fn(async () => ({ count: 1 })) },
      orderStatusHistory: { create: vi.fn(async () => ({})) },
    },
  } as unknown as FastifyInstance;
  const log = { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;
  return { fastify, log, update };
}

const args = (h: ReturnType<typeof harness>) => ({
  fastify: h.fastify,
  log: h.log,
  orderId: "order-1",
  reason: "Shop closed",
  actorId: "admin-1",
  intent: "refund" as const,
  failureReason: "shop_unavailable" as never,
});

beforeEach(() => {
  moolreCollectionStatus.mockReset().mockResolvedValue({ state: "paid", amount: "40.00", payer: "0501234567" });
  moolrePayout.mockReset().mockResolvedValue({ state: "paid", reference: `RF-${REF}` });
  refundPaystackPayment.mockReset();
});

describe("refunding a Moolre MoMo payment", () => {
  test("pays the collected amount back to the number and network that paid", async () => {
    const h = harness();
    const result = await endOrderWithRefund(args(h));
    expect(result).toMatchObject({ ok: true, refundIssued: true });
    expect(moolrePayout).toHaveBeenCalledWith(expect.anything(), {
      chargeReference: REF,
      amountGhs: 40,
      receiver: "0501234567",
      channel: "TELECEL",
    });
    expect(refundPaystackPayment).not.toHaveBeenCalled();
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "refunded" }) }));
  });

  test("falls back to Moolre's 233… payer, sent in local form", async () => {
    const h = harness({ momoPayer: null, momoNetwork: null });
    moolreCollectionStatus.mockResolvedValue({ state: "paid", amount: "1.00", payer: "233550076503" });
    await endOrderWithRefund(args(h));
    expect(moolrePayout).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ receiver: "0550076503", channel: "MTN", amountGhs: 1 }));
  });

  test("a payout Moolre has not confirmed leaves the order unchanged", async () => {
    moolrePayout.mockResolvedValue({ state: "pending", reference: `RF-${REF}` });
    const h = harness();
    const result = await endOrderWithRefund(args(h));
    expect(result).toMatchObject({ ok: false, code: 409 });
    expect(h.update).not.toHaveBeenCalled();
  });

  test("nothing is paid out when Moolre does not show the charge as received", async () => {
    moolreCollectionStatus.mockResolvedValue({ state: "failed" });
    const h = harness();
    const result = await endOrderWithRefund(args(h));
    expect(result).toMatchObject({ ok: false });
    expect(moolrePayout).not.toHaveBeenCalled();
  });

  test("an old Paystack order still refunds through Paystack", async () => {
    refundPaystackPayment.mockResolvedValue({ id: 1, status: "processed", amount: 4000, currency: "GHS" });
    const h = harness({ paystackRef: "WAVE-order-1-1" });
    await endOrderWithRefund(args(h));
    expect(refundPaystackPayment).toHaveBeenCalled();
    expect(moolrePayout).not.toHaveBeenCalled();
  });
});
