import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import axios from "axios";
import { pushToProfiles } from "./dispatch";

/**
 * Realtime topic riders subscribe to for "the available-order feed changed".
 * One channel per university so a rider at Ashesi is not woken by an order at
 * another campus. The mobile client builds the same string.
 */
export function riderFeedTopic(universityId: string): string {
  return `riders:${universityId}`;
}

export const NEW_ORDER_EVENT = "orders:changed";

/**
 * Publishes a Realtime broadcast over Supabase's HTTP API.
 *
 * A **broadcast channel**, not a table subscription — Supabase Realtime watches
 * Supabase's own Postgres, and Wave's orders live in Neon (ADR-002), so there
 * is no table for it to watch. The API is the publisher instead.
 *
 * HTTP rather than a websocket because Fastify handlers are stateless and this
 * fires a handful of times an hour; holding an open socket to send them would
 * be more moving parts than the feature is worth.
 *
 * Never throws — a missed live refresh degrades to pull-to-refresh.
 */
export async function publishBroadcast(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<{ published: boolean }> {
  const { fastify, log, topic, event, payload } = args;

  try {
    await axios.post(
      `${fastify.config.SUPABASE_URL}/realtime/v1/api/broadcast`,
      { messages: [{ topic, event, payload }] },
      {
        headers: {
          apikey: fastify.config.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${fastify.config.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 5_000,
      },
    );
    return { published: true };
  } catch (err) {
    log.warn(
      {
        topic,
        event,
        httpStatus: axios.isAxiosError(err) ? err.response?.status : undefined,
      },
      "Realtime broadcast failed — riders will see this order on next refresh",
    );
    return { published: false };
  }
}

/**
 * Tells riders at the order's university that a new order is up for grabs:
 * a Realtime nudge for anyone with the feed open, and a push for everyone else.
 *
 * The broadcast payload deliberately carries **no order detail** — only the
 * university and a bare orderId. Any client holding the anon key can subscribe
 * to a broadcast topic, so the channel is treated as public: it says "the feed
 * changed", and the rider app refetches `GET /orders/available` under its own
 * authenticated session to find out what actually changed.
 *
 * Best-effort throughout; never throws.
 */
export async function announceNewOrderToRiders(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  universityId: string;
  shopName: string;
}): Promise<void> {
  const { fastify, log, orderId, universityId, shopName } = args;

  await publishBroadcast({
    fastify,
    log,
    topic: riderFeedTopic(universityId),
    event: NEW_ORDER_EVENT,
    payload: { orderId, universityId },
  });

  try {
    // `isActive` is what the rider app's online/offline toggle writes
    // (PATCH /riders/availability), so going offline really does stop these.
    // `isVerified` keeps un-approved riders out of the feed announcements the
    // same way `GET /orders/available` would refuse them the orders.
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
