/**
 * The routes a student has sent a package along before.
 *
 * Pure so it can be tested: the app hands over the orders it already has and
 * gets back a short list of distinct routes, newest first. Nothing is fetched
 * for this.
 */
export interface RouteOrder {
  id: string;
  orderType: string;
  createdAt: string | Date;
  originCheckpoint?: { id: string; name: string } | null;
  checkpoint?: { id: string; name: string } | null;
}

export interface RecentRoute {
  /** `${originId}->${destinationId}`, and the list key. */
  key: string;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  /** When this route was last used, for "sent 3 days ago". */
  lastUsedAt: string;
  /** How many times it has been sent, including the most recent. */
  timesUsed: number;
}

/** Newest first, one entry per route, at most `limit`. */
export function recentPickupRoutes(orders: RouteOrder[], limit = 3): RecentRoute[] {
  const byKey = new Map<string, RecentRoute>();

  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const order of sorted) {
    // Only a pickup has two checkpoints. A buy-for-me order has a destination
    // and a shop, which is not a route anyone can repeat from here.
    if (order.orderType !== "pickup") continue;
    const from = order.originCheckpoint;
    const to = order.checkpoint;
    if (!from || !to || from.id === to.id) continue;

    const key = `${from.id}->${to.id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.timesUsed += 1;
      continue;
    }
    byKey.set(key, {
      key,
      originId: from.id,
      originName: from.name,
      destinationId: to.id,
      destinationName: to.name,
      lastUsedAt: new Date(order.createdAt).toISOString(),
      timesUsed: 1,
    });
  }

  return [...byKey.values()].slice(0, limit);
}
