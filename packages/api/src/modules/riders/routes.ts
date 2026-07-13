import type { FastifyInstance } from "fastify";
import { setAvailabilitySchema, submitVerificationSchema, reviewVerificationSchema } from "@wave/shared";

export async function riderRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/verification",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const parsed = submitVerificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const verification = await fastify.prisma.riderVerification.create({
        data: { ...parsed.data, riderId: request.user!.id },
      });
      return reply.code(201).send({ verification });
    },
  );

  fastify.get(
    "/verification/status",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const verification = await fastify.prisma.riderVerification.findFirst({
        where: { riderId: request.user!.id },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ verification });
    },
  );

  fastify.get(
    "/earnings",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const earnings = await fastify.prisma.riderEarning.findMany({
        where: { riderId: request.user!.id },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { id: true, createdAt: true, shop: { select: { name: true } } } } },
      });
      return reply.send({ earnings });
    },
  );

  fastify.patch(
    "/availability",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const parsed = setAvailabilitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const profile = await fastify.prisma.profile.update({
        where: { id: request.user!.id },
        data: { isActive: parsed.data.isActive },
      });
      return reply.send({ profile });
    },
  );

  fastify.get(
    "/admin/riders",
    { preHandler: [fastify.authenticate, fastify.requireRole("admin")] },
    async (request, reply) => {
      const { status } = request.query as { status?: "pending" | "approved" | "rejected" };
      const verifications = await fastify.prisma.riderVerification.findMany({
        where: { status: status ?? "pending" },
        orderBy: { createdAt: "desc" },
        include: { rider: { select: { id: true, fullName: true, phone: true } } },
      });
      return reply.send({ verifications });
    },
  );

  fastify.patch(
    "/admin/riders/:id/verify",
    { preHandler: [fastify.authenticate, fastify.requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = reviewVerificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const verification = await fastify.prisma.riderVerification.update({
        where: { id },
        data: {
          status: parsed.data.status,
          rejectionReason: parsed.data.rejectionReason,
          reviewedBy: request.user!.id,
          reviewedAt: new Date(),
        },
      });
      if (parsed.data.status === "approved") {
        await fastify.prisma.profile.update({ where: { id: verification.riderId }, data: { isVerified: true } });
      }
      return reply.send({ verification });
    },
  );
}
