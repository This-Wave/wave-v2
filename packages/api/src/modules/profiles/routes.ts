import type { FastifyInstance } from "fastify";

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const profile = await fastify.prisma.profile.findUnique({
      where: { id: request.user!.id },
    });
    return reply.send({ profile });
  });

  fastify.put("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const profile = await fastify.prisma.profile.update({
      where: { id: request.user!.id },
      data: {
        fullName: body.fullName as string | undefined,
        avatarUrl: body.avatarUrl as string | undefined,
      },
    });
    return reply.send({ profile });
  });

  // Avatar upload goes through Supabase Storage from the client;
  // this endpoint just persists the resulting public/signed URL.
  fastify.post("/avatar", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as { avatarUrl?: string };
    if (!body.avatarUrl) {
      return reply.code(400).send({ error: "avatarUrl is required" });
    }
    const profile = await fastify.prisma.profile.update({
      where: { id: request.user!.id },
      data: { avatarUrl: body.avatarUrl },
    });
    return reply.send({ profile });
  });
}
