import type { FastifyInstance } from "fastify";
import {
  FEATURE_FLAGS,
  isFeatureKey,
  resolveFeatures,
  type FeatureKey,
} from "@wave/shared";

/**
 * Feature flags, resolved per university with a global fallback.
 *
 * Two audiences, deliberately separate routes. Any signed-in caller reads the
 * *resolved* map for their own university and gets booleans and nothing else —
 * no rows, no other universities, no hint that a flag is on somewhere they are
 * not. Admins read and write the rows themselves.
 *
 * Nothing here is a security boundary. The client reads flags to decide what to
 * draw; every feature behind one must check it again on the server before doing
 * the thing, because a flag a client can read is a flag a client can lie about.
 */
export async function featureRoutes(fastify: FastifyInstance) {
  fastify.get("/features", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const profile = await fastify.prisma.profile.findUnique({
      where: { id: request.user!.id },
      select: { universityId: true },
    });

    const rows = await fastify.prisma.featureFlag.findMany({
      select: { key: true, universityId: true, enabled: true },
    });

    return reply.send({ features: resolveFeatures(profile?.universityId, rows) });
  });
}

export async function adminFeatureRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("admin"));

  /**
   * Everything the admin UI needs to render the toggles in one call: the
   * catalogue of flags that exist in code, the rows that exist in the database,
   * and the universities to scope them to. Three round-trips for one screen was
   * the alternative.
   */
  fastify.get("/features", async (_request, reply) => {
    const [rows, universities] = await Promise.all([
      fastify.prisma.featureFlag.findMany({
        select: { key: true, universityId: true, enabled: true, updatedAt: true },
      }),
      fastify.prisma.university.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return reply.send({ catalogue: FEATURE_FLAGS, rows, universities });
  });

  fastify.put("/features", async (request, reply) => {
    const body = request.body as {
      key?: unknown;
      universityId?: unknown;
      enabled?: unknown;
    };

    if (typeof body.key !== "string" || !isFeatureKey(body.key)) {
      // A key the code does not know about would be a row nothing ever reads —
      // worse than an error, because the switch would look like it worked.
      return reply.code(400).send({ error: "Unknown feature key" });
    }
    if (typeof body.enabled !== "boolean") {
      return reply.code(400).send({ error: "`enabled` must be a boolean" });
    }

    const universityId =
      body.universityId === null || body.universityId === undefined
        ? null
        : typeof body.universityId === "string"
          ? body.universityId
          : undefined;

    if (universityId === undefined) {
      return reply.code(400).send({ error: "`universityId` must be a string or null" });
    }

    if (universityId !== null) {
      const exists = await fastify.prisma.university.findUnique({
        where: { id: universityId },
        select: { id: true },
      });
      if (!exists) {
        return reply.code(400).send({ error: "Unknown university" });
      }
    }

    const key: FeatureKey = body.key;

    // Postgres treats NULLs as distinct in a unique index, so the composite
    // unique cannot enforce one global row per key and `upsert` cannot target
    // it either. The global row is found and updated by hand.
    if (universityId === null) {
      const existing = await fastify.prisma.featureFlag.findFirst({
        where: { key, universityId: null },
        select: { id: true },
      });
      const flag = existing
        ? await fastify.prisma.featureFlag.update({
            where: { id: existing.id },
            data: { enabled: body.enabled },
          })
        : await fastify.prisma.featureFlag.create({
            data: { key, universityId: null, enabled: body.enabled },
          });
      return reply.send({ flag });
    }

    const flag = await fastify.prisma.featureFlag.upsert({
      where: { key_universityId: { key, universityId } },
      update: { enabled: body.enabled },
      create: { key, universityId, enabled: body.enabled },
    });
    return reply.send({ flag });
  });

  /** Clear a university override so the flag falls back to the global default. */
  fastify.delete("/features", async (request, reply) => {
    const body = request.body as { key?: unknown; universityId?: unknown };

    if (typeof body.key !== "string" || !isFeatureKey(body.key)) {
      return reply.code(400).send({ error: "Unknown feature key" });
    }
    if (typeof body.universityId !== "string") {
      return reply.code(400).send({ error: "`universityId` is required" });
    }

    await fastify.prisma.featureFlag.deleteMany({
      where: { key: body.key, universityId: body.universityId },
    });
    return reply.code(204).send();
  });
}
