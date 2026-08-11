import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import axios from "axios";
import { refundPaystackPayment } from "./paystack";
import { clientSafeOrder } from "../orders/select";
import { notifyOrderStatus } from "../notifications/dispatch";

/**
 * Orders whose refund is mid-flight, so a double-click cannot fire two refunds.
 * Per-process only — Paystack rejecting a second refund of the same transaction
 * is the real backstop, this just keeps the common case from reaching it.
 */
const inFlight = new Set<string>();

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

  if (inFlight.has(orderId)) {
    return { ok: false, code: 409, error: "This order is already being cancelled" };
  }
  inFlight.add(orderId);

  try {
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

    return { ok: true, order: updated, refundIssued };
  } finally {
    inFlight.delete(orderId);
  }
}
