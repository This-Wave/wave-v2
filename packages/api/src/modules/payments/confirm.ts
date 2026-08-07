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
}): Promise<{ confirmed: boolean; alreadyProcessed: boolean }> {
  const { fastify, log, orderId } = args;

  const order = await fastify.prisma.order.findUnique({
    where: { id: orderId },
    include: { student: { select: { phone: true } }, shop: { select: { name: true } } },
  });
  if (!order) return { confirmed: false, alreadyProcessed: false };

  if (order.paidAt && order.deliveryPinHash) {
    return { confirmed: true, alreadyProcessed: true };
  }

  const { smsSent } = await issueDeliveryPin({
    fastify,
    log,
    phone: order.student.phone,
    persistHash: (hash) =>
      fastify.prisma.order
        .update({
          where: { id: order.id },
          data: { status: "confirmed", paidAt: new Date(), deliveryPinHash: hash },
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
}): Promise<{ confirmed: boolean; alreadyProcessed: boolean }> {
  const { fastify, log, orderId } = args;

  const order = await fastify.prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, goodsPaidAt: true },
  });
  if (!order) return { confirmed: false, alreadyProcessed: false };
  if (order.goodsPaidAt) return { confirmed: true, alreadyProcessed: true };

  await fastify.prisma.order.update({
    where: { id: order.id },
    data: { goodsPaidAt: new Date() },
  });
  await notifyGoodsPaid({ fastify, log, orderId: order.id });

  return { confirmed: true, alreadyProcessed: false };
}
