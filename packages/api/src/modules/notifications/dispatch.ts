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
 * The shop owner hears about the two things that change what they should be
 * doing: a paid order that now needs preparing, and an order that has been
 * called off so they can stop.
 *
 * Deliberately silent on rider_assigned / en_route / at_checkpoint / delivered
 * — the shop's involvement ends when the runner collects, and four more pushes
 * per order would train them to ignore all of them.
 */
const SHOP_COPY: Partial<Record<NotifiableStatus, (c: CopyContext) => PushPayload | null>> = {
  confirmed: () => ({
    title: "New paid order",
    body: "A student has paid for an order. Open Wave to accept it.",
  }),
  cancelled: (c) => ({
    title: "Order cancelled",
    body: c.reason ? `An order was cancelled: ${c.reason}.` : "An order was cancelled.",
  }),
  refunded: (c) => ({
    title: "Order cancelled",
    body: c.reason
      ? `An order was cancelled and refunded: ${c.reason}.`
      : "An order was cancelled and refunded.",
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
        orderType: true,
        // ownerId, so the shop owner can be told what is happening to an order
        // they are fulfilling. Nothing before this ever notified them.
        shop: { select: { name: true, ownerId: true } },
        checkpoint: { select: { name: true } },
        rider: { select: { fullName: true } },
      },
    });
    if (!order) return;

    const context: CopyContext = {
      // A pickup has no shop, so the copy has to name the thing generically or
      // it reads as "Your your shop order is in".
      shopName: order.shop?.name ?? (order.orderType === "pickup" ? "package" : "your shop"),
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

    // Shop owners were told nothing at all — they had to open the app and look.
    // Only the statuses that require them to act or stop acting.
    const shopCopyFor = SHOP_COPY[status as NotifiableStatus];
    if (shopCopyFor && order.shop?.ownerId) {
      const owner = shopCopyFor(context);
      if (owner) {
        await pushToProfiles({
          fastify,
          log,
          profileIds: [order.shop.ownerId],
          payload: { ...owner, data },
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

/**
 * Tells riders at the order's university that a new order is up for grabs.
 *
 * This used to also publish a Supabase Realtime broadcast so an open feed
 * refreshed instantly. That was removed (2026-08-03): it had never once
 * succeeded, it was the only thing keeping Wave on Supabase Realtime, and
 * `useAvailableOrders` already polls. A rider now sees a new order on the next
 * poll, or immediately if they tap the push.
 *
 * Best-effort: a push failure must not fail the webhook that triggered it.
 */
export async function announceNewOrderToRiders(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  universityId: string;
  shopName: string;
}): Promise<void> {
  const { fastify, log, orderId, universityId, shopName } = args;

  try {
    // `isActive` is what the rider app's online/offline toggle writes
    // (PATCH /riders/availability), so going offline really does stop these.
    // `isVerified` keeps un-approved riders out of the announcements the same
    // way `GET /orders/available` would refuse them the orders.
    const riders = await fastify.prisma.profile.findMany({
      where: {
        role: "rider",
        isActive: true,
        isVerified: true,
        universityId,
        pushToken: { not: null },
      },
      select: { id: true },
    });
    if (riders.length === 0) return;

    await pushToProfiles({
      fastify,
      log,
      profileIds: riders.map((r) => r.id),
      payload: {
        title: "New delivery available",
        body: `An order from ${shopName} is ready to be picked up.`,
        data: { type: "new_order", orderId },
      },
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : "unknown", orderId },
      "Rider new-order fan-out failed",
    );
  }
}
