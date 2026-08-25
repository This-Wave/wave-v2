import { ORDER_STATUSES, type OrderStatus } from "@wave/shared";

/**
 * The order lifecycle, as one table (review 09-architecture, C2).
 *
 * Routes used to encode transitions implicitly — each one checking whichever
 * preconditions its author had in mind — so the rules existed only as the union
 * of every handler, and the gaps were invisible. Two were real:
 *
 *  - `PATCH /:id/status` restricted *which* statuses a rider could set and that
 *    they owned the order, but never the current status. Its predicate was
 *    `{ id, riderId }`, and a delivered order still has a `riderId` — so a
 *    completed, cancelled or refunded order could be pushed back to `en_route`.
 *  - `PATCH /:id/deliver` never checked the current status either, so an order
 *    could be delivered twice. That one costs money: each delivery increments
 *    `studentDeliveryStats.totalDeliveries`, which is what earns the 20%
 *    loyalty discount.
 *
 * Terminal states have no successors, with one deliberate exception:
 * `delivered → refunded`, because an admin can legitimately refund an order
 * after it has been handed over.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ["payment_pending", "cancelled"],
  payment_pending: ["confirmed", "cancelled"],
  confirmed: ["rider_assigned", "cancelled", "refunded"],
  rider_assigned: ["en_route", "cancelled", "refunded"],
  en_route: ["at_checkpoint", "cancelled", "refunded"],
  at_checkpoint: ["delivered", "cancelled", "refunded"],
  // Money can still go back after a handover; nothing else may follow.
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
} as const;

/** Whether the lifecycle permits this move. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The statuses an order may legally be in for `to` to be reachable next.
 *
 * Fed straight into a Prisma `where` so the check is part of the same
 * conditional UPDATE that performs the write — the same reason the rider claim
 * lock and the payment confirm claim are predicates rather than prior reads. A
 * read-then-write here would let two requests both pass the check.
 *
 * `to` is included in its own list so a retry after a dropped response is a
 * no-op rather than a 409: on a campus network the client genuinely cannot tell
 * a lost reply from a rejected request.
 */
export function allowedPredecessors(to: OrderStatus): OrderStatus[] {
  const from = ORDER_STATUSES.filter((status) => canTransition(status, to));
  return [...from, to];
}
