import type { FastifyInstance } from "fastify";
import {
  adminCreateShopSchema,
  adminUpdateShopSchema,
  refundOrderSchema,
  rejectShopSuggestionSchema,
  resolveShopSuggestionSchema,
  updateConfigSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "@wave/shared";
import { endOrderWithRefund } from "../payments/refund";
import { announceShopIsLive } from "../suggestions/announce";

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

  fastify.get("/orders/:orderId", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await fastify.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        orderType: true,
        totalAmount: true,
        deliveryFee: true,
        itemPrice: true,
        paidAt: true,
        goodsPaidAt: true,
        paystackRef: true,
        goodsPaystackRef: true,
        scheduledDate: true,
        isSpecialOrder: true,
        itemDescription: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        student: { select: { id: true, fullName: true, phone: true, studentId: true } },
        shop: { select: { id: true, name: true } },
        checkpoint: { select: { name: true } },
        rider: { select: { id: true, fullName: true, phone: true } },
        items: { select: { name: true, quantity: true, unitPrice: true, actualUnitPrice: true } },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { status: true, note: true, createdAt: true, changer: { select: { fullName: true } } },
        },
      },
    });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    return reply.send({ order });
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

  // --- Shop suggestions ---------------------------------------------------
  //
  // The demand signal: which shop should Wave onboard next, ranked by how many
  // students asked for it.

  /**
   * Suggested places, most-wanted first.
   *
   * Grouped on `normalized_name` — never on `name` — so "Melcom", "melcom " and
   * "MELCOM Berekuso" are one row with a count of three rather than three rows
   * with a count of one. That collapsing is the entire value of the page.
   *
   * `students` counts DISTINCT students, not suggestions, so one enthusiastic
   * person cannot outrank a genuine crowd.
   */
  fastify.get("/shop-suggestions", async (request, reply) => {
    const { status = "pending" } = request.query as { status?: string };

    const grouped = await fastify.prisma.shopSuggestion.groupBy({
      by: ["normalizedName", "universityId"],
      where: status === "all" ? {} : { status: status as never },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    // The display name and the campus name are per-group, and groupBy cannot
    // carry them. One follow-up query for the rows in these groups, resolved in
    // memory — the pilot has one campus and a page of suggestions, not a feed.
    const rows = await fastify.prisma.shopSuggestion.findMany({
      where: status === "all" ? {} : { status: status as never },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        universityId: true,
        locationText: true,
        category: true,
        status: true,
        studentId: true,
        createdAt: true,
        university: { select: { id: true, name: true } },
        resolvedShop: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const suggestions = grouped
      .map((g) => {
        const members = rows.filter(
          (r) => r.normalizedName === g.normalizedName && r.universityId === g.universityId,
        );
        const newest = members[0];
        return {
          normalizedName: g.normalizedName,
          universityId: g.universityId,
          // The most recently typed spelling — the closest thing to how people
          // actually write the place's name today.
          displayName: newest?.name ?? g.normalizedName,
          universityName: newest?.university.name ?? null,
          count: g._count._all,
          students: new Set(members.map((m) => m.studentId)).size,
          lastSuggestedAt: g._max.createdAt,
          // The most recent non-empty location anyone gave, which is what an
          // admin needs to go and find the shop.
          locationText: members.find((m) => m.locationText)?.locationText ?? null,
          category: members.find((m) => m.category)?.category ?? null,
          status: newest?.status ?? "pending",
          resolvedShop: members.find((m) => m.resolvedShop)?.resolvedShop ?? null,
        };
      })
      .sort((a, b) => b.students - a.students || b.count - a.count);

    return reply.send({ suggestions });
  });

  /**
   * Onboard a suggested place: link it to a real shop and tell everyone who
   * asked for it.
   *
   * Keyed by normalized name rather than by suggestion id, because onboarding
   * one shop resolves EVERY student who asked for it — and telling only the
   * first person to suggest it, while the other eleven hear nothing, is the
   * failure this endpoint exists to avoid.
   *
   * Notification is best-effort and deliberately after the commit: the shop is
   * live whether or not Resend and Expo are having a good day.
   */
  fastify.post("/shop-suggestions/resolve", async (request, reply) => {
    const parsed = resolveShopSuggestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { normalizedName, universityId, shopId } = parsed.data;

    const shop = await fastify.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, universityId: true },
    });
    if (!shop) return reply.code(404).send({ error: "Shop not found" });
    if (shop.universityId !== universityId) {
      return reply.code(400).send({ error: "That shop is on a different campus" });
    }

    const pending = await fastify.prisma.shopSuggestion.findMany({
      where: { normalizedName, universityId, status: "pending" },
      select: { id: true, studentId: true },
    });
    if (pending.length === 0) {
      return reply.code(404).send({ error: "No pending suggestions for that place" });
    }

    await fastify.prisma.shopSuggestion.updateMany({
      where: { normalizedName, universityId, status: "pending" },
      data: { status: "onboarded", resolvedShopId: shopId, notifiedAt: new Date() },
    });

    const { emailed, pushed } = await announceShopIsLive({
      fastify,
      log: request.log,
      studentIds: [...new Set(pending.map((p) => p.studentId))],
      shopId: shop.id,
      shopName: shop.name,
    });

    return reply.send({ resolved: pending.length, emailed, pushed });
  });

  /** Wave won't be carrying this place. Stops it cluttering the ranking. */
  fastify.post("/shop-suggestions/reject", async (request, reply) => {
    const parsed = rejectShopSuggestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const result = await fastify.prisma.shopSuggestion.updateMany({
      where: {
        normalizedName: parsed.data.normalizedName,
        universityId: parsed.data.universityId,
        status: "pending",
      },
      data: { status: "rejected" },
    });
    return reply.send({ rejected: result.count });
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
