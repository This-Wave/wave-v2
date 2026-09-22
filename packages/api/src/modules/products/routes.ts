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
