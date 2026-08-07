import type { FastifyInstance } from "fastify";
import { createShopSuggestionSchema, normalizeShopName } from "@wave/shared";

/**
 * Student-facing shop suggestions.
 *
 * The admin half — ranking by demand and onboarding — lives in
 * `modules/admin/routes.ts`, because it is gated on the admin role and belongs
 * with the rest of the dashboard's endpoints.
 */
export async function suggestionRoutes(fastify: FastifyInstance) {
  /**
   * "You should stock X."
   *
   * Returns the *existing* suggestion when this student has already asked for
   * the same place and it is still pending, rather than creating a second row.
   * Two reasons: the ranking counts students, not taps, so one person asking
   * five times must not outvote five people asking once — and the client uses
   * the returned id to attach an order, so an idempotent create is what lets
   * "suggest, then order" be safely retried.
   */
  fastify.post(
    "/",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const parsed = createShopSuggestionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const input = parsed.data;

      const profile = await fastify.prisma.profile.findUnique({
        where: { id: request.user!.id },
        select: { universityId: true },
      });
      if (!profile?.universityId) {
        return reply.code(400).send({ error: "Your profile has no campus set" });
      }

      const normalizedName = normalizeShopName(input.name);
      if (!normalizedName) {
        return reply.code(400).send({ error: "Give the shop a name we can read" });
      }

      // If the place is already on Wave, say so instead of collecting a
      // suggestion nobody will action. Matched in JS on the same normalization
      // the ranking uses — `shops.name` has no normalized column to index, and
      // at pilot scale one campus holds tens of shops, not thousands.
      const campusShops = await fastify.prisma.shop.findMany({
        where: { universityId: profile.universityId, isActive: true },
        select: { id: true, name: true },
      });
      const existingShop = campusShops.find((s) => normalizeShopName(s.name) === normalizedName);
      if (existingShop) {
        return reply.code(409).send({
          error: `${existingShop.name} is already on Wave`,
          shopId: existingShop.id,
        });
      }

      const existing = await fastify.prisma.shopSuggestion.findFirst({
        where: {
          studentId: request.user!.id,
          universityId: profile.universityId,
          normalizedName,
          status: "pending",
        },
      });
      if (existing) return reply.send({ suggestion: existing, alreadySuggested: true });

      const suggestion = await fastify.prisma.shopSuggestion.create({
        data: {
          studentId: request.user!.id,
          universityId: profile.universityId,
          name: input.name.trim(),
          normalizedName,
          locationText: input.locationText?.trim(),
          category: input.category?.trim(),
        },
      });
      return reply.code(201).send({ suggestion });
    },
  );

  /** The student's own suggestions, so they can see what they asked for. */
  fastify.get(
    "/mine",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const suggestions = await fastify.prisma.shopSuggestion.findMany({
        where: { studentId: request.user!.id },
        orderBy: { createdAt: "desc" },
        include: { resolvedShop: { select: { id: true, name: true, logoUrl: true } } },
      });
      return reply.send({ suggestions });
    },
  );
}
