import type { FastifyInstance } from "fastify";
import { createCheckpointSchema, updateCheckpointSchema } from "@wave/shared";

// Covers both /universities and /checkpoints per Wave_Technical_Document.md Section 8.3.
export async function universityRoutes(fastify: FastifyInstance) {
  fastify.get("/universities", async (_request, reply) => {
    const universities = await fastify.prisma.university.findMany({ where: { isActive: true } });
    return reply.send({ universities });
  });

  fastify.get("/universities/:id/checkpoints", async (request, reply) => {
    const { id } = request.params as { id: string };
    const checkpoints = await fastify.prisma.checkpoint.findMany({
      where: { universityId: id, isActive: true },
    });
    return reply.send({ checkpoints });
  });

  fastify.post(
    "/checkpoints",
    { preHandler: [fastify.authenticate, fastify.requireRole("admin")] },
    async (request, reply) => {
      const parsed = createCheckpointSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const checkpoint = await fastify.prisma.checkpoint.create({ data: parsed.data });
      return reply.code(201).send({ checkpoint });
    },
  );

  fastify.put(
    "/checkpoints/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateCheckpointSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const checkpoint = await fastify.prisma.checkpoint.update({ where: { id }, data: parsed.data });
      return reply.send({ checkpoint });
    },
  );
}
