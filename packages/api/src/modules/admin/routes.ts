import type { FastifyInstance } from "fastify";
import { refundOrderSchema, updateConfigSchema } from "@wave/shared";
import { endOrderWithRefund } from "../payments/refund";

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

  const ADMIN_ORDER_SELECT = {
    id: true,
    status: true,
    totalAmount: true,
    createdAt: true,
    student: { select: { fullName: true, phone: true } },
    shop: { select: { name: true } },
    checkpoint: { select: { name: true } },
    rider: { select: { fullName: true } },
  } as const;

  // `limit` (legacy, used by the Dashboard's Recent Orders widget) returns a
  // flat list capped at 100, no total count needed for a "recent N" view.
  // Everything else (the Orders page) uses page/pageSize/status.
  fastify.get("/orders", async (request, reply) => {
    const { limit, page, pageSize, status } = request.query as {
      limit?: string;
      page?: string;
      pageSize?: string;
      status?: string;
    };

    if (limit) {
      const orders = await fastify.prisma.order.findMany({
        take: Math.min(Number(limit), 100),
        orderBy: { createdAt: "desc" },
        select: ADMIN_ORDER_SELECT,
      });
      return reply.send({ orders });
    }

    const where = status ? { status: status as never } : undefined;
    const take = Math.min(Number(pageSize) || 20, 100);
    const currentPage = Math.max(Number(page) || 1, 1);

    const [orders, total] = await Promise.all([
      fastify.prisma.order.findMany({
        where,
        take,
        skip: (currentPage - 1) * take,
        orderBy: { createdAt: "desc" },
        select: ADMIN_ORDER_SELECT,
      }),
      fastify.prisma.order.count({ where }),
    ]);

    return reply.send({ orders, total, page: currentPage, pageSize: take });
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

  fastify.post("/refund/:orderId", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const parsed = refundOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const result = await endOrderWithRefund({
      fastify,
      log: request.log,
      orderId,
      reason: parsed.data.reason,
      actorId: request.user!.id,
      intent: "refund",
    });
    if (!result.ok) return reply.code(result.code).send({ error: result.error });

    return reply.send({ order: result.order, refundIssued: result.refundIssued });
  });
}
