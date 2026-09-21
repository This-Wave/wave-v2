import type { OrderStatus } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  forceDeliverSchema,
  setRiderTypeSchema,
  adminCreateShopSchema,
  adminUpdateShopSchema,
  refundOrderSchema,
  rejectShopSuggestionSchema,
  resolveShopSuggestionSchema,
  updateConfigSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "@wave/shared";
import { hasPermission } from "@wave/shared";
import { maskPhone } from "../../lib/audit";
import { endOrderWithRefund } from "../payments/refund";
import { sweepAbandonedCheckouts } from "../payments/sweepAbandoned";
import { announceShopIsLive } from "../suggestions/announce";

/**
 * Where a stuck delivery may be forced from.
 *
 * Only the states in which a rider is actually holding the goods. Forcing from
 * `confirmed` would close an order nobody has collected, and from `cancelled` or
 * `refunded` would mark delivered something the student has already been paid
 * back for.
 */
const FORCE_DELIVERABLE_FROM: OrderStatus[] = ["rider_assigned", "en_route", "at_checkpoint"];

/**
 * Phone numbers, masked for staff whose role does not include `pii.read`.
 *
 * An accountant reconciling payments needs to see that an order exists and
 * what it cost, not how to ring the student. Applied to whole response objects
 * so a nested `student.phone` or `owner.phone` cannot be missed.
 */
function maskPhonesUnlessAllowed<T>(request: FastifyRequest, value: T): T {
  if (hasPermission(request.user?.staffRole, "pii.read")) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && !(v instanceof Date) && !("toFixed" in v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => [
          k,
          k === "phone" && typeof x === "string" ? maskPhone(x) : walk(x),
        ]),
      );
    }
    return v;
  };
  return walk(value) as T;
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("admin"));
  // Each route below also names the one permission it needs — see
  // ROLE_PERMISSIONS in @wave/shared. A route added without one is still
  // staff-only, but every staff role can use it, so don't.

  /**
   * Why orders ended without a delivery, over a window.
   *
   * The point of the column is that this exists: a count of cancelled orders
   * tells you there is a problem, and only the breakdown tells you whether to
   * chase shops about stock, riders about coverage, or Paystack about drop-offs.
   *
   * `unrecorded` is orders that failed before the column existed, or through a
   * path that forgot to set it. Shown rather than hidden — a silently
   * mis-attributed bucket is worse than an honest gap.
   */
  fastify.get("/order-failures", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
    const days = Math.min(90, Math.max(1, Number((request.query as { days?: string })?.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [grouped, unrecorded, delivered] = await Promise.all([
      fastify.prisma.order.groupBy({
        by: ["failureReason"],
        where: { createdAt: { gte: since }, failureReason: { not: null } },
        _count: { _all: true },
      }),
      fastify.prisma.order.count({
        where: {
          createdAt: { gte: since },
          status: { in: ["cancelled", "refunded"] },
          failureReason: null,
        },
      }),
      fastify.prisma.order.count({
        where: { createdAt: { gte: since }, status: "delivered" },
      }),
    ]);

    return reply.send({
      days,
      delivered,
      unrecorded,
      failures: grouped
        .map((g) => ({ reason: g.failureReason, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
    });
  });

  fastify.get("/stats", { preHandler: fastify.requirePermission("ops.read") }, async (_request, reply) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      totalUsers,
      totalShops,
      pendingRiders,
      pendingShops,
      oldestPendingRider,
      oldestPendingShop,
      ordersToday,
      activeRiders,
      revenueTodayResult,
    ] = await Promise.all([
      fastify.prisma.order.count(),
      fastify.prisma.profile.count(),
      fastify.prisma.shop.count(),
      fastify.prisma.riderVerification.count({ where: { status: "pending" } }),
      // Shops a shop owner registered in the app that no admin has approved.
      // Without a count here the only way to notice one is to scan the Shops
      // table, and an unapproved shop is invisible to students — so a missed
      // one looks to its owner like Wave simply never opened.
      fastify.prisma.shop.count({ where: { isVerified: false } }),
      // The oldest thing in each queue, so the dashboard can say how long
      // somebody has actually been stuck rather than only how many are stuck.
      // A count of 3 looks the same on day one and on day nine.
      fastify.prisma.riderVerification.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      fastify.prisma.shop.findFirst({
        where: { isVerified: false },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
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
      pendingShops,
      oldestPendingRiderAt: oldestPendingRider?.createdAt ?? null,
      oldestPendingShopAt: oldestPendingShop?.createdAt ?? null,
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
  fastify.get("/orders", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
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
      return reply.send({ orders: maskPhonesUnlessAllowed(request, orders) });
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

    return reply.send({ orders: maskPhonesUnlessAllowed(request, orders), total, page: currentPage, pageSize: take });
  });

  fastify.get("/orders/:orderId", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
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
    if (!hasPermission(request.user?.staffRole, "pii.read")) {
      return reply.send({ order: maskPhonesUnlessAllowed(request, order) });
    }
    // Full phone numbers and a student id number, for both parties.
    await request.audit({
      action: "pii.order_contacts_viewed",
      category: "pii",
      entityType: "order",
      entityId: order.id,
      metadata: { studentId: order.student.id, riderId: order.rider?.id ?? null },
    });
    return reply.send({ order });
  });

  /**
   * The user list behind admin → Users.
   *
   * Two things were wrong with the previous one-line version. It returned every
   * profile in the database in a single unpaginated response — fine at pilot
   * scale, a standing export of the whole user base later. And it selected the
   * entire row, so every request shipped `email`, `studentId`, `avatarUrl` and
   * `pushToken` to a page that renders none of them.
   *
   * Search is server-side for the same reason: the page used to filter the full
   * list in the browser, which only works while the full list is what arrives.
   */
  const ADMIN_USER_SELECT = {
    id: true,
    fullName: true,
    phone: true,
    role: true,
    isActive: true,
    isVerified: true,
    createdAt: true,
  } as const;

  fastify.get("/users", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
    const { role, page, pageSize, search } = request.query as {
      role?: string;
      page?: string;
      pageSize?: string;
      search?: string;
    };

    const take = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const term = search?.trim();

    const where = {
      ...(role ? { role: role as never } : {}),
      // Phone is stored E.164; someone searching "0241234567" or "241234567"
      // should still find "+233241234567", so match on a contains rather than
      // an exact equality.
      ...(term
        ? {
            OR: [
              { fullName: { contains: term, mode: "insensitive" as const } },
              { phone: { contains: term.replace(/[\s()-]/g, "") } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      fastify.prisma.profile.findMany({
        where,
        take,
        skip: (currentPage - 1) * take,
        orderBy: { createdAt: "desc" },
        select: ADMIN_USER_SELECT,
      }),
      fastify.prisma.profile.count({ where }),
    ]);

    if (!hasPermission(request.user?.staffRole, "pii.read")) {
      return reply.send({ users: maskPhonesUnlessAllowed(request, users), total, page: currentPage, pageSize: take });
    }
    if (users.length > 0) {
      await request.audit({
        action: "pii.user_list_viewed",
        category: "pii",
        metadata: { role: role ?? "all", search: term ?? null, page: currentPage, rows: users.length },
      });
    }
    return reply.send({ users, total, page: currentPage, pageSize: take });
  });

  fastify.get("/config", { preHandler: fastify.requirePermission("ops.read") }, async (_request, reply) => {
    const config = await fastify.prisma.platformConfig.findMany({ orderBy: { key: "asc" } });
    return reply.send({ config });
  });

  fastify.put("/config", { preHandler: fastify.requirePermission("config.write") }, async (request, reply) => {
    const parsed = updateConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      // Lead with the specific message rather than "Invalid payload": these are
      // typed into a form by a person, and "Base delivery fee (GH₵) must be a
      // number" is the whole difference between a fixable mistake and a
      // mysterious one.
      const first = parsed.error.issues[0]?.message ?? "Invalid payload";
      return reply.code(400).send({ error: first, details: parsed.error.flatten() });
    }
    const previous = await fastify.prisma.platformConfig.findUnique({ where: { key: parsed.data.key } });
    const config = await fastify.prisma.platformConfig.upsert({
      where: { key: parsed.data.key },
      create: { key: parsed.data.key, value: parsed.data.value },
      update: { value: parsed.data.value },
    });
    await request.audit({
      action: "config.changed",
      category: "config",
      entityType: "platform_config",
      entityId: parsed.data.key,
      before: previous ? { value: previous.value } : null,
      after: { value: config.value },
    });
    return reply.send({ config });
  });

  fastify.post("/refund/:orderId", { preHandler: fastify.requirePermission("refunds.issue") }, async (request, reply) => {
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
      failureReason: "admin_refunded",
      request,
    });
    if (!result.ok) return reply.code(result.code).send({ error: result.error });

    return reply.send({ order: result.order, refundIssued: result.refundIssued });
  });

  /**
   * Runs the abandoned-checkout sweep now, instead of waiting for the timer.
   *
   * Two uses. An admin who can see a stranded `payment_pending` order in the
   * dashboard can settle it on the spot rather than waiting up to ten minutes;
   * and if the API is ever moved to a plan with a cron service, this is the
   * endpoint that service calls, with `SWEEP_ENABLED=false` to retire the timer.
   *
   * Safe to hammer: everything the sweep does is idempotent, and an order
   * younger than the TTL is never touched however often this is called.
   */
  fastify.post("/payments/sweep-abandoned", { preHandler: fastify.requirePermission("payments.sweep") }, async (request, reply) => {
    const result = await sweepAbandonedCheckouts({ fastify, log: request.log });
    await request.audit({ action: "payment.sweep_run_manually", category: "payment", metadata: result });
    return reply.send(result);
  });

  /**
   * Move a rider between student and external.
   *
   * The case this exists for is a student graduating: their tie to the campus
   * ends, but their account does not. Kept off the rider's own profile update
   * for the same reason `role` is — a rider able to set this could choose
   * whichever type pays better or asks for the weaker document.
   *
   * Deliberately does not re-open verification. The documents on file may well
   * no longer satisfy the new type (a graduate verified with a student ID is
   * now an external rider holding an unacceptable document), so an admin
   * changing the type should look at whether to require a fresh submission.
   * Forcing it here would silently take a working rider offline mid-shift.
   */
  fastify.patch("/riders/:id/type", { preHandler: fastify.requirePermission("riders.verify") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = setRiderTypeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const target = await fastify.prisma.profile.findUnique({
      where: { id },
      select: { role: true, riderType: true },
    });
    if (!target) return reply.code(404).send({ error: "Profile not found" });
    if (target.role !== "rider") {
      return reply.code(400).send({ error: "Only a rider has a rider type" });
    }
    const profile = await fastify.prisma.profile.update({
      where: { id },
      data: { riderType: parsed.data.riderType },
    });
    request.log.info(
      { riderId: id, riderType: parsed.data.riderType, by: request.user!.id },
      "Rider type changed",
    );
    await request.audit({
      action: "rider.type_changed",
      category: "rider",
      entityType: "profile",
      entityId: id,
      before: { riderType: target.riderType },
      after: { riderType: profile.riderType },
    });
    return reply.send({ profile });
  });

  /**
   * Close a delivery an admin has confirmed happened, without a PIN.
   *
   * The delivery PIN arrives by SMS, and SMS on Ghanaian networks is not 100%.
   * The student confirming receipt in their own app covers most of the gap, but
   * not a dead phone or a number that has stopped receiving anything — and in
   * those cases a rider who genuinely handed over the goods cannot close the job
   * or be paid for it.
   *
   * Deliberately admin-only and deliberately noisy. It marks goods handed over on
   * nothing but a person's word, so it demands a written reason, records who did
   * it, and logs at warn level. A rider-side version of this button would be the
   * end of the PIN meaning anything at all.
   */
  fastify.post("/orders/:orderId/force-deliver", { preHandler: fastify.requirePermission("orders.force_deliver") }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const parsed = forceDeliverSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const order = await fastify.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    if (!order.riderId) {
      return reply.code(409).send({ error: "No rider has picked this order up" });
    }
    if (order.status === "delivered") {
      return reply.code(409).send({ error: "This order is already delivered" });
    }

    const deliverable = await fastify.prisma.order.updateMany({
      where: { id: orderId, status: { in: FORCE_DELIVERABLE_FROM } },
      data: { status: "delivered", deliveredAt: new Date(), deliveryPinAttempts: 0 },
    });
    if (deliverable.count === 0) {
      return reply
        .code(409)
        .send({ error: `This order is ${order.status} — it can't be marked delivered` });
    }

    await fastify.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: "delivered",
        changedBy: request.user!.id,
        note: `Closed by admin without a PIN: ${parsed.data.reason}`,
      },
    });
    await fastify.prisma.studentDeliveryStats.upsert({
      where: { studentId: order.studentId },
      create: { studentId: order.studentId, totalDeliveries: 1 },
      update: { totalDeliveries: { increment: 1 } },
    });

    request.log.warn(
      { orderId, adminId: request.user!.id, reason: parsed.data.reason },
      "Delivery closed by an admin without a PIN",
    );

    await request.audit({
      action: "order.force_delivered",
      category: "order",
      entityType: "order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: "delivered" },
      metadata: { reason: parsed.data.reason, riderId: order.riderId, studentId: order.studentId },
    });

    const updated = await fastify.prisma.order.findUnique({ where: { id: orderId } });
    return reply.send({ order: updated });
  });

  // --- Users -------------------------------------------------------------
  // Role reassignment is what promotes a verified student to rider. It is kept
  // separate from any general profile update so it can never be changed as a
  // side effect of editing something else.
  fastify.patch("/users/:id/role", { preHandler: fastify.requirePermission("users.role") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You cannot change your own role" });
    }
    const before = await fastify.prisma.profile.findUnique({ where: { id }, select: { role: true } });
    if (!before) return reply.code(404).send({ error: "User not found" });
    // Making someone staff, or un-making them, is a Staff-page action: it needs
    // a staff role alongside it, and `staff.manage` rather than `users.role`.
    // Without this, Support could promote anyone to a full owner.
    if (parsed.data.role === "admin" || before.role === "admin") {
      return reply.code(403).send({ error: "Staff accounts are managed on the Staff page" });
    }
    const user = await fastify.prisma.profile.update({
      where: { id },
      data: { role: parsed.data.role },
    });
    await request.audit({
      action: "user.role_changed",
      category: "user",
      entityType: "profile",
      entityId: id,
      before: { role: before.role },
      after: { role: user.role },
    });
    return reply.send({ user });
  });

  fastify.patch("/users/:id/status", { preHandler: fastify.requirePermission("users.ban") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You cannot deactivate your own account" });
    }
    const before = await fastify.prisma.profile.findUnique({
      where: { id },
      select: { isActive: true, role: true },
    });
    if (!before) return reply.code(404).send({ error: "User not found" });
    // Support may ban customers, not colleagues — otherwise one Support login
    // could lock every owner out.
    if (before.role === "admin" && !hasPermission(request.user?.staffRole, "staff.manage")) {
      return reply.code(403).send({ error: "Only an owner can deactivate a staff account" });
    }
    const user = await fastify.prisma.profile.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
    });
    await request.audit({
      action: user.isActive ? "user.reactivated" : "user.banned",
      category: "user",
      entityType: "profile",
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: user.isActive },
    });
    return reply.send({ user });
  });

  // --- Shops -------------------------------------------------------------
  // Shop owners manage their own storefront through /v1/shops. These are the
  // admin-scoped equivalents: create on an owner's behalf, and suspend.
  fastify.get("/shops", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
    const shops = await fastify.prisma.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, fullName: true, phone: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    return reply.send({ shops: maskPhonesUnlessAllowed(request, shops) });
  });

  fastify.post("/shops", { preHandler: fastify.requirePermission("shops.manage") }, async (request, reply) => {
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
    await request.audit({
      action: "shop.created_by_staff",
      category: "shop",
      entityType: "shop",
      entityId: shop.id,
      universityId: shop.universityId,
      after: parsed.data,
    });
    return reply.code(201).send({ shop });
  });

  fastify.patch("/shops/:id", { preHandler: fastify.requirePermission("shops.manage") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminUpdateShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const previous = await fastify.prisma.shop.findUnique({ where: { id } });
    if (!previous) return reply.code(404).send({ error: "Shop not found" });
    const shop = await fastify.prisma.shop.update({ where: { id }, data: parsed.data });
    const changed = Object.keys(parsed.data) as (keyof typeof previous)[];
    await request.audit({
      action: "shop.updated_by_staff",
      category: "shop",
      entityType: "shop",
      entityId: id,
      universityId: shop.universityId,
      before: Object.fromEntries(changed.map((k) => [k, previous[k]])),
      after: Object.fromEntries(changed.map((k) => [k, shop[k]])),
    });
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
  fastify.get("/shop-suggestions", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
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
  fastify.post("/shop-suggestions/resolve", { preHandler: fastify.requirePermission("suggestions.manage") }, async (request, reply) => {
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

    await request.audit({
      action: "suggestion.onboarded",
      category: "suggestion",
      entityType: "shop",
      entityId: shop.id,
      universityId,
      metadata: { normalizedName, resolved: pending.length, emailed, pushed },
    });
    return reply.send({ resolved: pending.length, emailed, pushed });
  });

  /** Wave won't be carrying this place. Stops it cluttering the ranking. */
  fastify.post("/shop-suggestions/reject", { preHandler: fastify.requirePermission("suggestions.manage") }, async (request, reply) => {
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
    await request.audit({
      action: "suggestion.rejected",
      category: "suggestion",
      universityId: parsed.data.universityId,
      metadata: { normalizedName: parsed.data.normalizedName, rejected: result.count },
    });
    return reply.send({ rejected: result.count });
  });

  // --- Checkpoints -------------------------------------------------------
  // Create/update already live on /v1/checkpoints behind requireRole("admin").
  // This is the cross-university listing the admin table needs, with the order
  // count that decides whether a checkpoint may be deactivated rather than kept.
  fastify.get("/checkpoints", { preHandler: fastify.requirePermission("ops.read") }, async (_request, reply) => {
    const checkpoints = await fastify.prisma.checkpoint.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } } },
    });
    return reply.send({ checkpoints });
  });
}
