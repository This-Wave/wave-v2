import type { FastifyInstance } from "fastify";
import { refundOrderSchema, updateConfigSchema } from "@wave/shared";

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("admin"));

  fastify.get("/stats", async (_request, reply) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalOrders, totalUsers, totalShops, pendingRiders, ordersToday, activeRiders, revenueTodayResult] =
      await Promise.all([
        fastify.prisma.order.count(),
        fastify.prisma.profile.count(),
        fastify.prisma.shop.count(),
        fastify.prisma.riderVerification.count({ where: { status: "pending" } }),
        fastify.prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
        fastify.prisma.profile.count({ where: { role: "rider", isActive: true } }),
        fastify.prisma.order.aggregate({
          where: {
            createdAt: { gte: startOfToday },
            status: { notIn: ["cancelled", "refunded", "payment_pending", "pending"] },
          },
          _sum: { totalAmount: true },
        }),
      ]);

    return reply.send({
      totalOrders,
      totalUsers,
      totalShops,
      pendingRiders,
      ordersToday,
      activeRiders,
      revenueToday: revenueTodayResult._sum.totalAmount ?? 0,
    });
  });

  fastify.get("/orders", async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const orders = await fastify.prisma.order.findMany({
      take: limit ? Math.min(Number(limit), 100) : 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        student: { select: { fullName: true } },
        shop: { select: { name: true } },
        checkpoint: { select: { name: true } },
      },
    });
    return reply.send({ orders });
  });

  fastify.get("/users", async (request, reply) => {
    const { role } = request.query as { role?: string };
    const users = await fastify.prisma.profile.findMany({ where: role ? { role: role as never } : undefined });
    return reply.send({ users });
  });

  fastify.put("/config", async (request, reply) => {
    const parsed = updateConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const config = await fastify.prisma.platformConfig.upsert({
      where: { key: parsed.data.key },
      create: { key: parsed.data.key, value: parsed.data.value },
      update: { value: parsed.data.value },
    });
    return reply.send({ config });
  });

  // TODO(Phase 3): call Paystack refund API, not just mark the order.
  fastify.post("/refund/:orderId", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const parsed = refundOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const order = await fastify.prisma.order.update({
      where: { id: orderId },
      data: { status: "refunded", cancellationReason: parsed.data.reason },
    });
    return reply.send({ order });
  });
}
