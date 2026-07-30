import type { FastifyInstance } from "fastify";
import {
  adminCreateShopSchema,
  adminUpdateShopSchema,
  refundOrderSchema,
  updateConfigSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "@wave/shared";

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

  fastify.get("/config", async (_request, reply) => {
    const config = await fastify.prisma.platformConfig.findMany({ orderBy: { key: "asc" } });
    return reply.send({ config });
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

  // --- Users -------------------------------------------------------------
  // Role reassignment is what promotes a verified student to rider. It is kept
  // separate from any general profile update so it can never be changed as a
  // side effect of editing something else.
  fastify.patch("/users/:id/role", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You cannot change your own role" });
    }
    const user = await fastify.prisma.profile.update({
      where: { id },
      data: { role: parsed.data.role },
    });
    return reply.send({ user });
  });

  fastify.patch("/users/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You cannot deactivate your own account" });
    }
    const user = await fastify.prisma.profile.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
    });
    return reply.send({ user });
  });

  // --- Shops -------------------------------------------------------------
  // Shop owners manage their own storefront through /v1/shops. These are the
  // admin-scoped equivalents: create on an owner's behalf, and suspend.
  fastify.get("/shops", async (_request, reply) => {
    const shops = await fastify.prisma.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, fullName: true, phone: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    return reply.send({ shops });
  });

  fastify.post("/shops", async (request, reply) => {
    const parsed = adminCreateShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const owner = await fastify.prisma.profile.findUnique({ where: { id: parsed.data.ownerId } });
    if (!owner) return reply.code(404).send({ error: "Owner not found" });
    if (owner.role !== "shop_owner") {
      return reply.code(400).send({ error: "Owner must have the shop_owner role" });
    }
    const shop = await fastify.prisma.shop.create({ data: parsed.data });
    return reply.code(201).send({ shop });
  });

  fastify.patch("/shops/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminUpdateShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const shop = await fastify.prisma.shop.update({ where: { id }, data: parsed.data });
    return reply.send({ shop });
  });

  // --- Checkpoints -------------------------------------------------------
  // Create/update already live on /v1/checkpoints behind requireRole("admin").
  // This is the cross-university listing the admin table needs, with the order
  // count that decides whether a checkpoint may be deactivated rather than kept.
  fastify.get("/checkpoints", async (_request, reply) => {
    const checkpoints = await fastify.prisma.checkpoint.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } } },
    });
    return reply.send({ checkpoints });
  });
}
