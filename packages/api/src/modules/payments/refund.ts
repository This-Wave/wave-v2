import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import axios from "axios";
import { refundPaystackPayment } from "./paystack";
import { clientSafeOrder } from "../orders/select";
import { notifyOrderStatus } from "../notifications/dispatch";

/**
 * How long a claimed refund may sit before another caller may take it over.
 *
 * Without this, a process killed between claiming and finishing would leave
 * `refundStartedAt` set forever and the order permanently unrefundable — the
 * classic failure of a lock with no lease. Comfortably longer than a Paystack
 * refund call, short enough that a human retry is not blocked for long.
 */
const REFUND_CLAIM_TTL_MS = 2 * 60_000;

export interface EndOrderWithRefundArgs {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  reason: string;
  /** Recorded on the OrderStatusHistory row. */
  actorId: string;
  /**
   * `cancel` ends an order that may never have been charged; `refund` is the
   * admin action and requires a captured payment.
   */
  intent: "cancel" | "refund";
}

export type EndOrderWithRefundResult =
  | { ok: true; order: unknown; refundIssued: boolean }
  | { ok: false; code: number; error: string };

/**
 * Ends an order, returning the student's money if any was taken.
 *
 * The ordering is the whole point: Paystack is called *first*, and the order is
 * only marked `refunded` once that call succeeded. An order left at
 * `confirmed` because the refund failed is visibly outstanding; one marked
 * `refunded` with the money still held is invisible, which is the bug this
 * replaces.
 */
export async function endOrderWithRefund(
  args: EndOrderWithRefundArgs,
): Promise<EndOrderWithRefundResult> {
  const { fastify, log, orderId, reason, actorId, intent } = args;

  // Pre-flight checks that do not need the claim. Doing these first keeps a
  // 404 or an already-refunded 409 from taking — and then having to release —
  // a lock it never needed.
  const existing = await fastify.prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { ok: false, code: 404, error: "Order not found" };
  if (existing.status === "refunded") {
    return { ok: false, code: 409, error: "Order has already been refunded" };
  }

  // The claim. A conditional UPDATE means the database picks the winner, so
  // this holds across processes — the previous in-memory Set did not, and two
  // API instances would each have kept their own and enforced nothing. A
  // double-refund is real money, and Paystack rejecting the second call is a
  // backstop we should not be relying on.
  //
  // The staleness arm is the lease: a claim older than the TTL is assumed to
  // belong to a process that died mid-refund and may be taken over.
  const staleBefore = new Date(Date.now() - REFUND_CLAIM_TTL_MS);
  const claim = await fastify.prisma.order.updateMany({
    where: {
      id: orderId,
      OR: [{ refundStartedAt: null }, { refundStartedAt: { lt: staleBefore } }],
    },
    data: { refundStartedAt: new Date() },
  });
  if (claim.count === 0) {
    return { ok: false, code: 409, error: "This order is already being cancelled" };
  }

  let settled = false;
  try {
    // Re-read under the claim: `existing` was fetched before it was held, so a
    // concurrent writer could have moved the order on since.
    const order = await fastify.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { ok: false, code: 404, error: "Order not found" };

    if (order.status === "refunded") {
      return { ok: false, code: 409, error: "Order has already been refunded" };
    }
    if (intent === "cancel" && (order.status === "cancelled" || order.status === "delivered")) {
      return { ok: false, code: 409, error: `Cannot cancel an order that is already ${order.status}` };
    }

    const hasDeliveryPayment = Boolean(order.paidAt && order.paystackRef);
    const hasGoodsPayment = Boolean(order.goodsPaidAt && order.goodsPaystackRef);
    const refsToRefund: string[] = [];
    if (hasDeliveryPayment) refsToRefund.push(order.paystackRef!);
    if (hasGoodsPayment) refsToRefund.push(order.goodsPaystackRef!);

    if (intent === "refund" && refsToRefund.length === 0) {
      return { ok: false, code: 400, error: "Order has no captured payment to refund" };
    }

    let refundIssued = false;
    for (const reference of refsToRefund) {
      try {
        const refund = await refundPaystackPayment(fastify.config.PAYSTACK_SECRET_KEY, {
          reference,
          note: `Wave order ${order.id}: ${reason}`.slice(0, 255),
        });
        log.info(
          { orderId, refundId: refund.id, refundStatus: refund.status, reference },
          "Paystack refund accepted",
        );
        refundIssued = true;
      } catch (err) {
        const providerMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
        log.error(
          {
            orderId,
            reference,
            httpStatus: axios.isAxiosError(err) ? err.response?.status : undefined,
            providerMessage,
          },
          "Paystack refund failed — order status left unchanged",
        );
        return {
          ok: false,
          code: 502,
          error: providerMessage ?? "Refund could not be issued. The order was left unchanged.",
        };
      }
    }

    // `refunded` means money went back; `cancelled` means none was ever taken.
    const nextStatus = refundIssued ? "refunded" : "cancelled";

    const updated = await fastify.prisma.order.update({
      where: { id: orderId },
      data: { status: nextStatus, cancellationReason: reason },
      select: clientSafeOrder,
    });
    await fastify.prisma.orderStatusHistory.create({
      data: { orderId, status: nextStatus, changedBy: actorId, note: reason },
    });

    // Notified here rather than at each call site so all three routes that end
    // an order (student cancel, shop-cancel, admin refund) tell the student the
    // same thing — and so the copy follows `nextStatus`, which is the only
    // place that knows whether money actually moved.
    await notifyOrderStatus({ fastify, log, orderId, status: nextStatus });

    settled = true;
    return { ok: true, order: updated, refundIssued };
  } finally {
    // Released only when the refund did NOT complete, so a retry can re-claim.
    // On success the timestamp stays as a record of when the money moved — the
    // terminal `refunded` / `cancelled` status is what blocks a second attempt
    // from there, not the lock.
    if (!settled) {
      await fastify.prisma.order
        .updateMany({ where: { id: orderId }, data: { refundStartedAt: null } })
        .catch((err: unknown) => {
          // Never mask the real failure with a cleanup failure. The TTL above
          // means a claim we could not clear frees itself.
          log.error({ orderId, err }, "Could not release the refund claim — it will expire via TTL");
        });
    }
  }
}
