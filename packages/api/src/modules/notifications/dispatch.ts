import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { DEVICE_NOT_REGISTERED, isExpoPushToken, sendExpoPush, type ExpoPushMessage } from "./expo";

/**
 * Android requires notifications to name a channel the app created, or they
 * arrive silently. The mobile client creates exactly this one at startup
 * (`apps/mobile/src/lib/notifications.ts`) — the two strings must match.
 */
export const ORDERS_CHANNEL_ID = "orders";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends one notification to each given profile that has a registered device.
 *
 * **Never throws.** A notification is an accelerator — every state it announces
 * is also visible by opening the app — so a push failure must not fail the
 * order transition that triggered it. Callers can safely `await` this in the
 * middle of a route handler.
 */
export async function pushToProfiles(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  profileIds: string[];
  payload: PushPayload;
}): Promise<{ sent: number }> {
  const { fastify, log, payload } = args;
  const profileIds = args.profileIds.filter(Boolean);
  if (profileIds.length === 0) return { sent: 0 };

  try {
    const profiles = await fastify.prisma.profile.findMany({
      where: { id: { in: profileIds }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });

    const recipients = profiles.filter((p) => isExpoPushToken(p.pushToken!));
    if (recipients.length === 0) return { sent: 0 };

    const messages: ExpoPushMessage[] = recipients.map((p) => ({
      to: p.pushToken!,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      channelId: ORDERS_CHANNEL_ID,
      priority: "high",
    }));

    const tickets = await sendExpoPush(messages);

    // Expo returns one ticket per message, in order. A DeviceNotRegistered
    // ticket means the app is gone from that device; keeping the token would
    // mean paying for a failed send on every future order.
    const stale = recipients
      .filter((_, i) => tickets[i]?.details?.error === DEVICE_NOT_REGISTERED)
      .map((p) => p.id);

    if (stale.length > 0) {
      await fastify.prisma.profile.updateMany({
        where: { id: { in: stale } },
        data: { pushToken: null },
      });
      log.info({ count: stale.length }, "Cleared push tokens for unregistered devices");
    }

    const failed = tickets.filter((t) => t.status === "error").length;
    if (failed > 0) {
      log.warn(
        { failed, total: tickets.length, errors: tickets.filter((t) => t.status === "error").map((t) => t.details?.error) },
        "Some push notifications were rejected",
      );
    }

    return { sent: tickets.filter((t) => t.status === "ok").length };
  } catch (err) {
    // Curated log only — see PushSendError. Swallowed on purpose.
    log.error(
      { err: err instanceof Error ? err.message : "unknown", profileCount: profileIds.length },
      "Push dispatch failed",
    );
    return { sent: 0 };
  }
}

type NotifiableStatus =
  | "confirmed"
  | "rider_assigned"
  | "en_route"
  | "at_checkpoint"
  | "delivered"
  | "cancelled"
  | "refunded";

interface CopyContext {
  shopName: string;
  checkpointName: string;
  riderName: string;
  reason: string | null;
}

/**
 * What the student is told at each transition.
 *
 * Two rules the copy follows. It never contains the delivery PIN — the PIN goes
 * by SMS only, and a push notification renders on a locked screen. And it never
 * claims money moved unless it did: `refunded` and `cancelled` are deliberately
 * different messages, because after Phase 3 they mean different things.
 */
const STUDENT_COPY: Record<NotifiableStatus, (c: CopyContext) => PushPayload | null> = {
  confirmed: (c) => ({
    title: "Payment confirmed",
    body: `Your ${c.shopName} order is in. Your delivery PIN has been sent by SMS — keep it for the rider.`,
  }),
  rider_assigned: (c) => ({
    title: "A rider took your order",
    body: `${c.riderName} is picking up from ${c.shopName}.`,
  }),
  en_route: (c) => ({
    title: "On the way",
    body: `Your order is heading to ${c.checkpointName}.`,
  }),
  at_checkpoint: (c) => ({
    title: "Your order has arrived",
    body: `${c.riderName} is at ${c.checkpointName}. Have your delivery PIN ready.`,
  }),
  delivered: () => ({
    title: "Delivered",
    body: "Enjoy. Thanks for using Wave.",
  }),
  cancelled: (c) => ({
    title: "Order cancelled",
    body: c.reason ? `Your order was cancelled: ${c.reason}` : "Your order was cancelled.",
  }),
  refunded: (c) => ({
    title: "Order cancelled and refunded",
    body:
      (c.reason ? `Your order was cancelled: ${c.reason}. ` : "Your order was cancelled. ") +
      "Your money is on its way back — refunds can take a few days to show.",
  }),
};

/** The rider only hears about the end of a delivery they are actually carrying. */
const RIDER_COPY: Partial<Record<NotifiableStatus, (c: CopyContext) => PushPayload | null>> = {
  cancelled: (c) => ({
    title: "Delivery cancelled",
    body: c.reason
      ? `The ${c.shopName} order was cancelled: ${c.reason}. Stand down.`
      : `The ${c.shopName} order was cancelled. Stand down.`,
  }),
  refunded: (c) => ({
    title: "Delivery cancelled",
    body: c.reason
      ? `The ${c.shopName} order was cancelled and refunded: ${c.reason}. Stand down.`
      : `The ${c.shopName} order was cancelled and refunded. Stand down.`,
  }),
};

/**
 * Announces an order's new status to the people it affects.
 *
 * Best-effort by design (see `pushToProfiles`). Reads the order fresh rather
 * than taking it as an argument so the copy always reflects committed state —
 * callers invoke this *after* the status write, never before.
 */
export async function notifyOrderStatus(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  status: string;
}): Promise<void> {
  const { fastify, log, orderId, status } = args;

  const studentCopy = STUDENT_COPY[status as NotifiableStatus];
  if (!studentCopy) return; // pending / payment_pending have nothing to say

  try {
    const order = await fastify.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        studentId: true,
        riderId: true,
        status: true,
        cancellationReason: true,
        shop: { select: { name: true } },
        checkpoint: { select: { name: true } },
        rider: { select: { fullName: true } },
      },
    });
    if (!order) return;

    const context: CopyContext = {
      shopName: order.shop?.name ?? "your shop",
      checkpointName: order.checkpoint?.name ?? "your checkpoint",
      riderName: order.rider?.fullName ?? "Your rider",
      reason: order.cancellationReason,
    };

    const data = { type: "order_status", orderId: order.id, status };

    const student = studentCopy(context);
    if (student) {
      await pushToProfiles({
        fastify,
        log,
        profileIds: [order.studentId],
        payload: { ...student, data },
      });
    }

    const riderCopyFor = RIDER_COPY[status as NotifiableStatus];
    if (riderCopyFor && order.riderId) {
      const rider = riderCopyFor(context);
      if (rider) {
        await pushToProfiles({
          fastify,
          log,
          profileIds: [order.riderId],
          payload: { ...rider, data },
        });
      }
    }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : "unknown", orderId, status },
      "Order status notification failed",
    );
  }
}
