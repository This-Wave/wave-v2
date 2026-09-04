import type { Role } from "../../plugins/auth";

/**
 * Take the other party's phone number back once an order is over.
 *
 * A student and the rider carrying their order need each other's numbers — "I'm
 * at the gate, where are you?" is the most common thing that happens in
 * delivery, and both apps already have a call button for it.
 *
 * What they do not need is to keep those numbers forever. `clientSafeOrder`
 * returns both phones on every read of the order regardless of its state, so a
 * rider who has delivered to fifty students ends up holding fifty numbers with
 * no ongoing reason to have any of them, and every one of those students holds
 * the rider's. Nothing in the app grants that; it is simply never withdrawn.
 *
 * So: while the order is live, contact works exactly as before. Once it reaches
 * a state where nobody is still carrying anything, each side stops seeing the
 * other's number.
 *
 * Three things are deliberately NOT redacted:
 * - **Names.** A student needs to recognise "delivered by Kofi" in their history,
 *   and a rider's own delivery list is meaningless without who it went to.
 * - **Your own record.** A student always sees their own phone on their own order.
 * - **Anything an admin reads.** Disputes are worked after the fact, and support
 *   cannot resolve "the wrong person took my order" against a redacted row.
 *
 * Shops are covered separately and more strictly by `redactStudentContactForShop`.
 */
const CLOSED_STATUSES = ["delivered", "cancelled", "refunded"] as const;

type ContactParty = { phone?: string | null } | null | undefined;

export interface RedactableOrder {
  status?: string | null;
  student?: ContactParty;
  rider?: ContactParty;
}

export function isClosed(status: string | null | undefined): boolean {
  return !!status && (CLOSED_STATUSES as readonly string[]).includes(status);
}

/**
 * @param viewer the role reading this order. `admin` is returned untouched.
 */
export function redactClosedOrderContacts<T extends RedactableOrder>(order: T, viewer: Role): T {
  if (viewer === "admin" || !isClosed(order.status)) return order;

  // Each side loses the *other* party's number, not their own.
  const next: T = { ...order };
  if (viewer === "student" && next.rider) {
    next.rider = { ...next.rider, phone: null };
  }
  if (viewer === "rider" && next.student) {
    next.student = { ...next.student, phone: null };
  }
  // Shops are not handled here: `redactStudentContactForShop` in access.ts
  // already strips a student's phone and institutional ID from every shop read,
  // live or closed, which is the stronger rule.
  return next;
}

/** The list form. */
export function redactClosedOrderContactsAll<T extends RedactableOrder>(
  orders: T[],
  viewer: Role,
): T[] {
  return orders.map((order) => redactClosedOrderContacts(order, viewer));
}
