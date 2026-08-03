import type { FastifyInstance } from "fastify";
import {
  cancelOrderSchema,
  createOrderSchema,
  deliverOrderSchema,
} from "@wave/shared";
import { calculateDiscount, calculateOrderTotal, isStandardDeliveryDay } from "./discount";
import { verifyDeliveryPin } from "./pin";
import { issueDeliveryPin } from "./issuePin";
import { clientSafeOrder } from "./select";
import { endOrderWithRefund } from "../payments/refund";
import { notifyOrderStatus } from "../notifications/dispatch";

export async function orderRoutes(fastify: FastifyInstance) {
  // POST /orders — student places a "Buy For Me" order.
  // Creates the order as payment_pending; actual PIN + confirmation happens
  // in the Paystack webhook handler (see modules/payments/routes.ts).
  fastify.post(
    "/",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const input = parsed.data;
      const scheduledDate = new Date(input.scheduledDate);

      if (!input.isSpecialOrder && !isStandardDeliveryDay(scheduledDate)) {
        return reply.code(400).send({
          error: "Non-standard delivery day requires a special order (24h advance notice)",
        });
      }
      if (input.isSpecialOrder) {
        const leadTimeMs = scheduledDate.getTime() - Date.now();
        if (leadTimeMs < 24 * 60 * 60 * 1000) {
          return reply.code(400).send({ error: "Special orders require 24 hours advance notice" });
        }
      }

      const [feeConfig, surchargeConfig, discountConfig, thresholdConfig, stats, product] = await Promise.all([
        fastify.prisma.platformConfig.findUnique({ where: { key: "delivery_fee_base" } }),
        fastify.prisma.platformConfig.findUnique({ where: { key: "special_order_surcharge_pct" } }),
        fastify.prisma.platformConfig.findUnique({ where: { key: "loyalty_discount_pct" } }),
        fastify.prisma.platformConfig.findUnique({ where: { key: "loyalty_threshold" } }),
        fastify.prisma.studentDeliveryStats.findUnique({ where: { studentId: request.user!.id } }),
        input.productId
          ? fastify.prisma.product.findUnique({ where: { id: input.productId } })
          : Promise.resolve(null),
      ]);

      const deliveryFee = Number(feeConfig?.value ?? 5);
      const surchargePct = input.isSpecialOrder ? Number(surchargeConfig?.value ?? 30) : 0;
      const threshold = Number(thresholdConfig?.value ?? 6);
      const discountPct = calculateDiscount({
        totalDeliveries: stats?.totalDeliveries ?? 0,
        baseAmount: 1,
        threshold,
        discountPct: Number(discountConfig?.value ?? 20),
      }) > 0
        ? Number(discountConfig?.value ?? 20)
        : 0;

      const itemPrice = product ? Number(product.price) : 0;
      const totalAmount = calculateOrderTotal({ itemPrice, deliveryFee, discountPct, surchargePct });

      const order = await fastify.prisma.order.create({
        data: {
          studentId: request.user!.id,
          shopId: input.shopId,
          checkpointId: input.checkpointId,
          universityId: (await fastify.prisma.profile.findUnique({ where: { id: request.user!.id } }))!.universityId!,
          itemDescription: input.itemDescription,
          productId: input.productId,
          itemPrice,
          deliveryFee,
          discountApplied: discountPct,
          surchargeApplied: surchargePct,
          totalAmount,
          deliveryDay: input.isSpecialOrder ? "special" : (scheduledDate.getDay() === 0 ? "sunday" : "wednesday"),
          scheduledDate,
          isSpecialOrder: input.isSpecialOrder,
          status: "payment_pending",
          notes: input.notes,
        },
        select: clientSafeOrder,
      });

      // TODO(Phase 3): call payments/initiate to get a Paystack authorization_url.
      return reply.code(201).send({ order });
    },
  );

  fastify.get("/my", { preHandler: [fastify.authenticate, fastify.requireRole("student")] }, async (request, reply) => {
    const orders = await fastify.prisma.order.findMany({
      where: { studentId: request.user!.id },
      select: clientSafeOrder,
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ orders });
  });

  fastify.get("/available", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const orders = await fastify.prisma.order.findMany({
      where: { status: "confirmed", riderId: null },
      select: clientSafeOrder,
    });
    return reply.send({ orders });
  });

  fastify.get("/my-deliveries", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const orders = await fastify.prisma.order.findMany({
      where: { riderId: request.user!.id },
      select: clientSafeOrder,
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ orders });
  });

  fastify.get("/shop", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const shop = await fastify.prisma.shop.findFirst({ where: { ownerId: request.user!.id } });
    const orders = shop
      ? await fastify.prisma.order.findMany({ where: { shopId: shop.id }, select: clientSafeOrder })
      : [];
    return reply.send({ orders });
  });

  fastify.get("/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await fastify.prisma.order.findUnique({ where: { id }, select: clientSafeOrder });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    return reply.send({ order });
  });

  fastify.patch("/:id/accept", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // The `riderId: null, status: "confirmed"` predicate is the claim lock: two
    // riders tapping Accept on the same feed entry both reach here, and only one
    // update can match. The loser matches no row, and Prisma throws P2025 rather
    // than returning null — so this must be caught, or the second rider gets a
    // 500 for what is ordinary contention.
    let order;
    try {
      order = await fastify.prisma.order.update({
        where: { id, riderId: null, status: "confirmed" },
        data: { riderId: request.user!.id, status: "rider_assigned" },
        select: clientSafeOrder,
      });
    } catch {
      return reply.code(409).send({ error: "This order has already been accepted by another rider" });
    }
    await notifyOrderStatus({ fastify, log: request.log, orderId: id, status: "rider_assigned" });
    return reply.send({ order });
  });

  // Rider-only, self-service mid-delivery transitions. Scoped to the two
  // states a rider legitimately drives themselves outside of accept/deliver
  // (which have their own checks) — anything else (delivered, cancelled,
  // refunded, etc.) must go through a dedicated route.
  const RIDER_SETTABLE_STATUSES = ["en_route", "at_checkpoint"] as const;

  fastify.patch(
    "/:id/status",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status?: string; note?: string };
      if (!body.status || !RIDER_SETTABLE_STATUSES.includes(body.status as never)) {
        return reply.code(400).send({ error: `status must be one of: ${RIDER_SETTABLE_STATUSES.join(", ")}` });
      }

      let order;
      try {
        order = await fastify.prisma.order.update({
          where: { id, riderId: request.user!.id },
          data: { status: body.status as never },
          select: clientSafeOrder,
        });
      } catch {
        return reply.code(404).send({ error: "Order not found or not assigned to you" });
      }

      await fastify.prisma.orderStatusHistory.create({
        data: { orderId: id, status: body.status, changedBy: request.user!.id, note: body.note },
      });
      await notifyOrderStatus({ fastify, log: request.log, orderId: id, status: body.status });
      return reply.send({ order });
    },
  );

  // Rider marks delivered — requires the correct PIN, verified against the bcrypt hash.
  fastify.patch("/:id/deliver", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = deliverOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const order = await fastify.prisma.order.findUnique({ where: { id } });
    if (!order || !order.deliveryPinHash) return reply.code(404).send({ error: "Order not found" });

    const valid = await verifyDeliveryPin(parsed.data.pin, order.deliveryPinHash);
    if (!valid) return reply.code(403).send({ error: "Incorrect PIN" });

    const updated = await fastify.prisma.order.update({
      where: { id },
      data: { status: "delivered", deliveredAt: new Date() },
      select: clientSafeOrder,
    });

    await fastify.prisma.studentDeliveryStats.upsert({
      where: { studentId: order.studentId },
      create: { studentId: order.studentId, totalDeliveries: 1 },
      update: { totalDeliveries: { increment: 1 } },
    });

    await notifyOrderStatus({ fastify, log: request.log, orderId: id, status: "delivered" });
    return reply.send({ order: updated });
  });

  // The window in which a student may cancel their own order. Once a rider is
  // en route the order is physically in motion, so cancellation (and with it a
  // self-served refund) has to go through an admin instead.
  const STUDENT_CANCELLABLE_STATUSES = [
    "pending",
    "payment_pending",
    "confirmed",
    "rider_assigned",
  ] as const;

  fastify.patch(
    "/:id/cancel",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = cancelOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const order = await fastify.prisma.order.findUnique({
        where: { id },
        select: { studentId: true, status: true },
      });
      if (!order || order.studentId !== request.user!.id) {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (!STUDENT_CANCELLABLE_STATUSES.includes(order.status as never)) {
        return reply.code(409).send({
          error: `An order that is ${order.status} can no longer be cancelled here — contact support`,
        });
      }

      const result = await endOrderWithRefund({
        fastify,
        log: request.log,
        orderId: id,
        reason: parsed.data.reason,
        actorId: request.user!.id,
        intent: "cancel",
      });
      if (!result.ok) return reply.code(result.code).send({ error: result.error });

      return reply.send({ order: result.order, refundIssued: result.refundIssued });
    },
  );

  // Re-issues a delivery PIN and texts it again. Needed because the plaintext
  // PIN is never stored — if the confirmation SMS failed or was lost, there is
  // nothing to re-read, only something to re-issue.
  const PIN_RESEND_COOLDOWN_MS = 60_000;
  const lastPinResend = new Map<string, number>();

  fastify.post(
    "/:id/resend-pin",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const order = await fastify.prisma.order.findUnique({
        where: { id },
        select: { id: true, studentId: true, status: true, student: { select: { phone: true } } },
      });
      if (!order || order.studentId !== request.user!.id) {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (!["confirmed", "rider_assigned", "en_route", "at_checkpoint"].includes(order.status)) {
        return reply.code(409).send({ error: "This order has no active delivery PIN" });
      }

      // Each send costs money, so throttle. Per-process, which is enough at
      // pilot scale on a single Railway instance.
      const since = Date.now() - (lastPinResend.get(order.id) ?? 0);
      if (since < PIN_RESEND_COOLDOWN_MS) {
        return reply.code(429).send({
          error: `Please wait ${Math.ceil((PIN_RESEND_COOLDOWN_MS - since) / 1000)}s before requesting another PIN`,
        });
      }
      lastPinResend.set(order.id, Date.now());

      const { smsSent } = await issueDeliveryPin({
        fastify,
        log: request.log,
        phone: order.student.phone,
        persistHash: (hash) =>
          fastify.prisma.order
            .update({ where: { id: order.id }, data: { deliveryPinHash: hash } })
            .then(() => undefined),
      });

      if (!smsSent) {
        return reply.code(502).send({ error: "Could not send the PIN by SMS. Please try again." });
      }
      return reply.send({ sent: true });
    },
  );

  fastify.patch("/:id/shop-accept", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await fastify.prisma.order.update({
      where: { id },
      data: { status: "confirmed" },
      select: clientSafeOrder,
    });
    return reply.send({ order });
  });

  // The shop rejecting a paid order refunds it. IncomingOrderDetailScreen
  // already promises the student "you will be fully refunded automatically",
  // which until now was not true.
  fastify.patch("/:id/shop-cancel", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = cancelOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const shop = await fastify.prisma.shop.findFirst({ where: { ownerId: request.user!.id } });
    const order = shop
      ? await fastify.prisma.order.findUnique({ where: { id }, select: { shopId: true } })
      : null;
    if (!order || order.shopId !== shop!.id) {
      return reply.code(404).send({ error: "Order not found" });
    }

    const result = await endOrderWithRefund({
      fastify,
      log: request.log,
      orderId: id,
      reason: parsed.data.reason,
      actorId: request.user!.id,
      intent: "cancel",
    });
    if (!result.ok) return reply.code(result.code).send({ error: result.error });

    return reply.send({ order: result.order, refundIssued: result.refundIssued });
  });
}
