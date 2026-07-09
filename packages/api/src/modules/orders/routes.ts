import type { FastifyInstance } from "fastify";
import {
  cancelOrderSchema,
  createOrderSchema,
  deliverOrderSchema,
} from "@wave/shared";
import { calculateDiscount, calculateOrderTotal, isStandardDeliveryDay } from "./discount";
import { generateDeliveryPin, verifyDeliveryPin } from "./pin";

// Order fields that are safe to return to clients — delivery_pin_hash is
// NEVER selected here (see GOTCHA-003 in debug.md).
const clientSafeOrder = {
  id: true,
  studentId: true,
  riderId: true,
  shopId: true,
  checkpointId: true,
  universityId: true,
  itemDescription: true,
  productId: true,
  itemPrice: true,
  deliveryFee: true,
  discountApplied: true,
  surchargeApplied: true,
  totalAmount: true,
  deliveryDay: true,
  scheduledDate: true,
  isSpecialOrder: true,
  status: true,
  paidAt: true,
  deliveredAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
    const order = await fastify.prisma.order.update({
      where: { id, riderId: null, status: "confirmed" },
      data: { riderId: request.user!.id, status: "rider_assigned" },
      select: clientSafeOrder,
    });
    return reply.send({ order });
  });

  fastify.patch("/:id/status", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string; note?: string };
    if (!body.status) return reply.code(400).send({ error: "status is required" });

    const order = await fastify.prisma.order.update({
      where: { id },
      data: { status: body.status as never },
      select: clientSafeOrder,
    });
    await fastify.prisma.orderStatusHistory.create({
      data: { orderId: id, status: body.status, changedBy: request.user!.id, note: body.note },
    });
    return reply.send({ order });
  });

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

    return reply.send({ order: updated });
  });

  fastify.patch("/:id/cancel", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = cancelOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const order = await fastify.prisma.order.update({
      where: { id },
      data: { status: "cancelled", cancellationReason: parsed.data.reason },
      select: clientSafeOrder,
    });
    // TODO(Phase 3): trigger Paystack refund.
    return reply.send({ order });
  });

  fastify.patch("/:id/shop-accept", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await fastify.prisma.order.update({
      where: { id },
      data: { status: "confirmed" },
      select: clientSafeOrder,
    });
    return reply.send({ order });
  });

  fastify.patch("/:id/shop-cancel", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = cancelOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const order = await fastify.prisma.order.update({
      where: { id },
      data: { status: "cancelled", cancellationReason: parsed.data.reason },
      select: clientSafeOrder,
    });
    return reply.send({ order });
  });
}

export { generateDeliveryPin };
