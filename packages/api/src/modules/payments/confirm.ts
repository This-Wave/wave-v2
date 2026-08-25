import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { issueDeliveryPin } from "../orders/issuePin";
import { announceNewOrderToRiders, notifyGoodsPaid, notifyOrderStatus } from "../notifications/dispatch";

/**
 * Everything that must happen when money for an order actually arrives.
 *
 * There are **two** ways Wave learns a payment succeeded — Paystack's signed
 * webhook (push) and `GET /payments/verify/:ref` asking Paystack directly
 * (pull) — and they must do identically the same thing. Before this existed the
 * work lived inline in the webhook handler, so adding the pull path would have
 * meant a second copy of the PIN issue, the status write and the rider
 * announcement, free to drift.
 *
 * **Idempotent.** Both paths can fire for the same order: Paystack retries
 * webhooks until it gets a 2xx, and the app polls verify throughout checkout.
 * Re-issuing would overwrite the PIN hash and silently invalidate the code
 * already texted to the student, so an already-confirmed order is a no-op.
 */
export async function confirmDeliveryFeePaid(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  /**
   * The reference Paystack actually charged, when it is known.
   *
   * Every `POST /payments/initiate` mints a fresh reference and overwrites
   * `paystackRef`, so the reference that gets paid is not always the one on the
   * row — a student who backs out of checkout and taps Pay again can still
   * complete the *first* Paystack page. Recording the paid one matters beyond
   * bookkeeping: `endOrderWithRefund` refunds `order.paystackRef`, and refunding
   * a reference that was never charged fails.
   */
  reference?: string;
}): Promise<{ confirmed: boolean; alreadyProcessed: boolean }> {
  const { fastify, log, orderId, reference } = args;

  const order = await fastify.prisma.order.findUnique({
    where: { id: orderId },
    include: { student: { select: { phone: true } }, shop: { select: { name: true } } },
  });
  if (!order) return { confirmed: false, alreadyProcessed: false };

  // The claim, and the whole of the idempotency guarantee. `updateMany` with
  // `paidAt: null` in the predicate compiles to a single conditional UPDATE, so
  // the database — not this process — decides which caller wins: exactly one
  // gets `count === 1`, every other concurrent caller gets 0 and returns.
  //
  // Read-then-write was the bug. Webhook and verify-poll routinely land at the
  // same instant, and both could read `paidAt: null` before either wrote, so
  // both proceeded to issue a PIN. The second write clobbered the first's
  // bcrypt hash while the first's plaintext was already in the student's SMS
  // inbox — a PIN that looks right to the student and fails at the door.
  //
  // The claim has to precede PIN generation for the same reason: claiming
  // afterwards would still let two racers both generate and both text.
  const claimed = await fastify.prisma.order.updateMany({
    where: { id: order.id, paidAt: null },
    data: {
      status: "confirmed",
      paidAt: new Date(),
      ...(reference && reference !== order.paystackRef ? { paystackRef: reference } : {}),
    },
  });
  if (claimed.count === 0) {
    // A second *successful* charge on the same order, not a retry of the first.
    // Both are real money and only one can be refunded from the order row, so
    // this has to be loud — it is a student owed a refund nobody knows about.
    if (reference && order.paidAt && order.paystackRef && reference !== order.paystackRef) {
      log.error(
        { orderId: order.id, paidReference: order.paystackRef, duplicateReference: reference },
        "Order was already paid under a different Paystack reference — possible double charge, refund the duplicate by hand",
      );
    }
    // Deliberately *not* widened to `OR: [{ paidAt: null }, { deliveryPinHash:
    // null }]` to also re-issue a missing PIN. Postgres re-evaluates the
    // predicate on the locked row after the winner commits, and the winner sets
    // `paidAt` in the claim but the hash in a later statement — so a loser would
    // still see `deliveryPinHash: null`, match, and text a second PIN. The race
    // would be back.
    //
    // That leaves one stranded state: claim committed, PIN write then failed.
    // It is unreachable by ordinary means (the same DB served the claim a
    // moment earlier) and `POST /orders/:id/resend-pin` recovers it, but it is
    // silent, so say so loudly enough to be alertable.
    if (order.paidAt && !order.deliveryPinHash) {
      log.error(
        { orderId: order.id },
        "Order is paid but has no delivery PIN hash — stranded, student must request a resend",
      );
    }
    return { confirmed: true, alreadyProcessed: true };
  }

  const { smsSent } = await issueDeliveryPin({
    fastify,
    log,
    phone: order.student.phone,
    persist: ({ hash, ciphertext }) =>
      fastify.prisma.order
        .update({
          where: { id: order.id },
          // `deliveryPinAttempts: 0` is belt and braces on a fresh order, but it
          // keeps the invariant in one shape everywhere a PIN is written: a new
          // PIN always arrives with a clean attempt count.
          data: {
            deliveryPinHash: hash,
            deliveryPinCiphertext: ciphertext,
            deliveryPinAttempts: 0,
          },
        })
        .then(() => undefined),
  });

  if (!smsSent) {
    // The order is paid and confirmed either way — never fail the caller. A
    // non-2xx to the webhook makes Paystack retry, and the idempotency guard
    // above would then strand the retry as a no-op. The student recovers via
    // POST /orders/:id/resend-pin.
    log.error(
      { orderId: order.id },
      "Order confirmed but the delivery PIN SMS did not send — student must request a resend",
    );
  }

  // Both are best-effort and never throw.
  await notifyOrderStatus({ fastify, log, orderId: order.id, status: "confirmed" });
  await announceNewOrderToRiders({
    fastify,
    log,
    orderId: order.id,
    universityId: order.universityId,
    shopName: order.shop?.name ?? "a nearby shop",
  });

  return { confirmed: true, alreadyProcessed: false };
}

/**
 * The second charge on a suggested-shop order clearing. Same two-path problem,
 * same idempotency requirement — but no PIN and no rider announcement, because
 * both already happened when the delivery fee was paid.
 */
export async function confirmGoodsPaid(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  /** See `confirmDeliveryFeePaid` — the goods reference is overwritten the same way. */
  reference?: string;
}): Promise<{ confirmed: boolean; alreadyProcessed: boolean }> {
  const { fastify, log, orderId, reference } = args;

  const order = await fastify.prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, goodsPaidAt: true, goodsPaystackRef: true },
  });
  if (!order) return { confirmed: false, alreadyProcessed: false };
  if (order.goodsPaidAt) {
    if (reference && order.goodsPaystackRef && reference !== order.goodsPaystackRef) {
      log.error(
        { orderId: order.id, paidReference: order.goodsPaystackRef, duplicateReference: reference },
        "Goods were already paid under a different Paystack reference — possible double charge, refund the duplicate by hand",
      );
    }
    return { confirmed: true, alreadyProcessed: true };
  }

  await fastify.prisma.order.update({
    where: { id: order.id },
    data: {
      goodsPaidAt: new Date(),
      ...(reference && reference !== order.goodsPaystackRef ? { goodsPaystackRef: reference } : {}),
    },
  });
  await notifyGoodsPaid({ fastify, log, orderId: order.id });

  return { confirmed: true, alreadyProcessed: false };
}
