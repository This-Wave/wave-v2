import type { PrismaClient } from "@wave/db";
import type { Role } from "../../plugins/auth";
import { clientSafeOrder } from "./select";

export type OrderAccessUser = { id: string; role: Role };

/**
 * Removes the student's contact details from an order a **shop owner** is
 * looking at (review 07-privacy, H3).
 *
 * `clientSafeOrder` carries `student.phone` and `student.studentId` because the
 * student and the assigned rider both legitimately need them — the rider has to
 * coordinate a handover. A shop is preparing an order; the handover is
 * rider-to-student and never involves them. Nothing in the shop UI reads either
 * field.
 *
 * Left as-is, this is the same harvesting risk `feedOrder` was written to close,
 * one step later in the flow: get verified as a shop owner and every order that
 * arrives hands you a student's phone number and Ashesi ID. `fullName` stays —
 * a shop reasonably sees whose order they are packing.
 *
 * Applied only when access derives *solely* from shop ownership. A shop owner
 * who is also the student on the order is looking at their own data.
 */
export function redactStudentContactForShop<
  T extends { studentId: string; student?: { phone?: string; studentId?: string | null } | null },
>(order: T, user: OrderAccessUser): T {
  if (user.role !== "shop_owner") return order;
  if (order.studentId === user.id) return order;
  if (!order.student) return order;

  // `order.studentId` above is the FK column; `student.studentId` here is the
  // Ashesi institutional ID. Same name, different things — do not conflate.
  const { phone: _phone, studentId: _institutionalId, ...safeStudent } = order.student;
  return { ...order, student: safeStudent } as T;
}

/**
 * Returns the order for this user, or null if missing / forbidden.
 * Callers should answer 404 in both cases so strangers cannot probe order ids.
 */
export async function findOrderForUser(
  prisma: PrismaClient,
  orderId: string,
  user: OrderAccessUser,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: clientSafeOrder });
  if (!order) return null;
  if (!(await canUserAccessOrder(prisma, order, user))) return null;
  return redactStudentContactForShop(order, user);
}

export async function canUserAccessOrder(
  prisma: PrismaClient,
  order: { studentId: string; riderId: string | null; shopId: string | null },
  user: OrderAccessUser,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (order.studentId === user.id) return true;
  if (order.riderId === user.id) return true;
  if (user.role === "shop_owner" && order.shopId) {
    const shop = await prisma.shop.findFirst({
      where: { id: order.shopId, ownerId: user.id },
      select: { id: true },
    });
    return !!shop;
  }
  return false;
}
