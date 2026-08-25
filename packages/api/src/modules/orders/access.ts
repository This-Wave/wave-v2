import type { PrismaClient } from "@wave/db";
import type { Role } from "../../plugins/auth";
import { clientSafeOrder } from "./select";

export type OrderAccessUser = { id: string; role: Role };

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
  return order;
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
