import type { FastifyInstance } from "fastify";
import { createProductSchema, updateProductStatusSchema } from "@wave/shared";

export async function productRoutes(fastify: FastifyInstance) {
  fastify.get("/shops/:shopId/products", async (request, reply) => {
    const { shopId } = request.params as { shopId: string };
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
      const product = await fastify.prisma.product.update({ where: { id }, data: parsed.data });
      return reply.send({ product });
    },
  );

  fastify.delete("/products/:id", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.product.delete({ where: { id } });
    return reply.code(204).send();
  });
}
