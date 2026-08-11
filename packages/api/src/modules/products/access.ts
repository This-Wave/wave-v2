import type { PrismaClient } from "@wave/db";

/** Ensures the product belongs to a shop owned by this user. */
export async function findOwnedProduct(
  prisma: PrismaClient,
  productId: string,
  ownerId: string,
) {
  return prisma.product.findFirst({
    where: { id: productId, shop: { ownerId } },
  });
}
