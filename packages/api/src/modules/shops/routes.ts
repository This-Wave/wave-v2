import type { FastifyInstance } from "fastify";
import { createShopSchema, updateShopSchema } from "@wave/shared";

export async function shopRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    const shops = await fastify.prisma.shop.findMany({ where: { isActive: true, isVerified: true } });
    return reply.send({ shops });
  });

  // An owner may hold several shops (product decision, 2026-08-04). This used to
  // be a `findFirst` returning `{ shop }`, which silently picked an arbitrary one
  // — with no ordering, not even consistently the same one between requests.
  // Ordered by name so the client's default selection is stable.
  fastify.get("/my", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const shops = await fastify.prisma.shop.findMany({
      where: { ownerId: request.user!.id },
      orderBy: { name: "asc" },
    });
    return reply.send({ shops });
  });

  // Public and unauthenticated, so it carries the same `isActive`/`isVerified`
  // gate as the list above. It used to be a bare `findUnique` on the id, which
  // meant deactivating or un-verifying a shop hid it from the listing while
  // leaving it fully readable to anyone who already had — or guessed — its id.
  // `findFirst` rather than `findUnique` because the extra predicates are not
  // part of a unique index. Owners reach their own inactive shops via /my.
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const shop = await fastify.prisma.shop.findFirst({
      where: { id, isActive: true, isVerified: true },
      // Products are returned whole, including `out_of_stock` / `not_serving`:
      // those are display states the storefront greys out, not hidden rows.
      include: { products: true },
    });
    if (!shop) return reply.code(404).send({ error: "Shop not found" });
    return reply.send({ shop });
  });

  fastify.post("/", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const parsed = createShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const profile = await fastify.prisma.profile.findUnique({ where: { id: request.user!.id } });
    const shop = await fastify.prisma.shop.create({
      data: { ...parsed.data, ownerId: request.user!.id, universityId: profile!.universityId! },
    });
    return reply.code(201).send({ shop });
  });

  fastify.put("/:id", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    // Scoped to the caller's own shop. A non-owner matches no row, and Prisma
    // throws P2025 rather than returning null — without this catch that surfaces
    // as a 500 for what is really "not yours". 404 rather than 403 so the route
    // cannot be used to discover which shop ids exist.
    let shop;
    try {
      shop = await fastify.prisma.shop.update({ where: { id, ownerId: request.user!.id }, data: parsed.data });
    } catch {
      return reply.code(404).send({ error: "Shop not found" });
    }
    return reply.send({ shop });
  });
}
