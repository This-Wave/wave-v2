import type { FastifyInstance } from "fastify";
import { createProductSchema, updateProductStatusSchema } from "@wave/shared";
import { findOwnedProduct } from "./access";
import { buyForMeHidden, pausedReply } from "../switches/routes";

export async function productRoutes(fastify: FastifyInstance) {
  // A shop's menu is Buy for me's catalogue, so it closes with it while Buy
  // for me has not launched — see the note in modules/shops/routes.ts.
  fastify.get("/shops/:shopId/products", async (request, reply) => {
    const { shopId } = request.params as { shopId: string };
    const shop = await fastify.prisma.shop.findUnique({ where: { id: shopId }, select: { universityId: true } });
    const hidden = await buyForMeHidden(fastify, shop?.universityId ?? null);
    if (hidden) return reply.code(503).send({ ...pausedReply(hidden), products: [] });
    const products = await fastify.prisma.product.findMany({ where: { shopId } });
    return reply.send({ products });
  });

  /**
   * The owner's own view of their menu — the one the shop app's Menu tab reads.
   *
   * It exists because the public route above closes with Buy for me, and that
   * gate was catching the shop owner too: during the pre-launch window, which
   * is there precisely so vendors can be onboarded, an owner could add items
   * (the POST below is ungated) and then never see them back. The menu they are
   * being onboarded to build was the one thing they could not read.
   *
   * Separate route rather than an exemption inside the public one: that route is
   * unauthenticated, so telling an owner apart from a student there would mean
   * making its auth optional and its response depend on who asked. A named,
   * authenticated, ownership-checked route is the same shape as `/shops/my`.
   *
   * Deliberately not open to admins — nothing needs it yet, and this is the
   * owner's own data.
   */
  fastify.get(
    "/shops/:shopId/products/manage",
    { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] },
    async (request, reply) => {
      const { shopId } = request.params as { shopId: string };
      const shop = await fastify.prisma.shop.findFirst({
        where: { id: shopId, ownerId: request.user!.id },
        select: { id: true },
      });
      if (!shop) return reply.code(403).send({ error: "Not your shop" });

      // Every status, as the public route also does: `out_of_stock` and
      // `not_serving` are display states the owner needs to see in order to
      // change them.
      const products = await fastify.prisma.product.findMany({ where: { shopId } });
      return reply.send({ products });
    },
  );

  fastify.post(
    "/shops/:shopId/products",
    { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] },
    async (request, reply) => {
      const { shopId } = request.params as { shopId: string };
      const parsed = createProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const shop = await fastify.prisma.shop.findFirst({ where: { id: shopId, ownerId: request.user!.id } });
      if (!shop) return reply.code(403).send({ error: "Not your shop" });

      const product = await fastify.prisma.product.create({ data: { ...parsed.data, shopId } });
      return reply.code(201).send({ product });
    },
  );

  fastify.put("/products/:id", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createProductSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const owned = await findOwnedProduct(fastify.prisma, id, request.user!.id);
    if (!owned) return reply.code(404).send({ error: "Product not found" });
    const product = await fastify.prisma.product.update({ where: { id }, data: parsed.data });
    return reply.send({ product });
  });

  fastify.patch(
    "/products/:id/status",
    { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateProductStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const owned = await findOwnedProduct(fastify.prisma, id, request.user!.id);
      if (!owned) return reply.code(404).send({ error: "Product not found" });
      const product = await fastify.prisma.product.update({ where: { id }, data: parsed.data });
      return reply.send({ product });
    },
  );

  fastify.delete("/products/:id", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await findOwnedProduct(fastify.prisma, id, request.user!.id);
    if (!owned) return reply.code(404).send({ error: "Product not found" });
    await fastify.prisma.product.delete({ where: { id } });
    return reply.code(204).send();
  });
}
