import type { FastifyInstance } from "fastify";
import {
  cancelOrderSchema,
  createOrderSchema,
  deliverOrderSchema,
  recordGoodsCostSchema,
} from "@wave/shared";
import { calculateDiscount, calculateOrderTotal, isStandardDeliveryDay } from "./discount";
import {
  buildManualBasket,
  priceCatalogueBasket,
  round2,
  type BasketResult,
} from "./basket";
import { verifyDeliveryPin } from "./pin";
import { issueDeliveryPin } from "./issuePin";
import { clientSafeOrder, feedOrder } from "./select";
import { endOrderWithRefund } from "../payments/refund";
import { notifyGoodsCostRecorded, notifyOrderStatus } from "../notifications/dispatch";

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

      const [feeConfig, surchargeConfig, discountConfig, thresholdConfig, stats] = await Promise.all([
        fastify.prisma.platformConfig.findUnique({ where: { key: "delivery_fee_base" } }),
        fastify.prisma.platformConfig.findUnique({ where: { key: "special_order_surcharge_pct" } }),
        fastify.prisma.platformConfig.findUnique({ where: { key: "loyalty_discount_pct" } }),
        fastify.prisma.platformConfig.findUnique({ where: { key: "loyalty_threshold" } }),
        fastify.prisma.studentDeliveryStats.findUnique({ where: { studentId: request.user!.id } }),
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

      // Both checkpoints must exist on the student's own campus. Without this a
      // student could name any checkpoint UUID in the country as their origin.
      const profile = await fastify.prisma.profile.findUnique({
        where: { id: request.user!.id },
      });
      const universityId = profile?.universityId;
      if (!universityId) {
        return reply.code(400).send({ error: "Your profile has no campus set" });
      }

      const checkpointIds = [input.checkpointId, input.originCheckpointId].filter(
        (id): id is string => !!id,
      );
      const validCheckpoints = await fastify.prisma.checkpoint.count({
        where: { id: { in: checkpointIds }, universityId, isActive: true },
      });
      if (validCheckpoints !== checkpointIds.length) {
        return reply
          .code(400)
          .send({ error: "That checkpoint is not active on your campus" });
      }

      // --- The basket, and with it the price -------------------------------
      //
      // Each order type prices differently, and this is the only place that
      // decides. Note that no branch reads a price off `input` — the client
      // sends product ids and quantities, and the amounts come from the
      // database or from nowhere at all.
      let basket: BasketResult;
      let suggestionId: string | null = null;

      if (input.orderType === "buy_for_me") {
        const shop = await fastify.prisma.shop.findFirst({
          where: { id: input.shopId!, universityId, isActive: true },
          select: { id: true },
        });
        if (!shop) {
          return reply.code(400).send({ error: "That shop is not open on your campus" });
        }
        basket = await priceCatalogueBasket({
          fastify,
          shopId: input.shopId!,
          items: input.items ?? [],
        });
      } else if (input.orderType === "shop_pickup") {
        // The suggestion must be the student's own and still un-onboarded. Once
        // it resolves to a real shop, ordering has to go through the catalogue
        // instead — otherwise a student keeps buying blind from a shop whose
        // prices Wave now knows.
        const suggestion = await fastify.prisma.shopSuggestion.findFirst({
          where: { id: input.suggestionId!, studentId: request.user!.id, universityId },
          select: { id: true, status: true },
        });
        if (!suggestion) {
          return reply.code(404).send({ error: "That shop suggestion doesn't exist" });
        }
        if (suggestion.status === "rejected") {
          return reply.code(409).send({ error: "Wave can't deliver from that shop" });
        }
        if (suggestion.status === "onboarded") {
          return reply
            .code(409)
            .send({ error: "That shop is on Wave now — order from its menu instead" });
        }
        suggestionId = suggestion.id;
        basket = buildManualBasket(input.manualItems ?? []);
      } else {
        // A pickup carries no items at all; the student's own words are the
        // description, and the delivery fee is the whole price.
        basket = { ok: true, lines: [], itemsTotal: 0, description: input.itemDescription! };
      }

      if (!basket.ok) return reply.code(400).send({ error: basket.error });

      // A `shop_pickup`'s goods are charged later, once the rider reports the
      // till total — so the amount payable NOW is the delivery fee only. For the
      // other two types the total is final at this point.
      const chargeableItemsTotal = input.orderType === "shop_pickup" ? 0 : basket.itemsTotal;
      const totalAmount = calculateOrderTotal({
        itemPrice: chargeableItemsTotal,
        deliveryFee,
        discountPct,
        surchargePct,
      });

      const order = await fastify.prisma.order.create({
        data: {
          studentId: request.user!.id,
          orderType: input.orderType,
          shopId: input.orderType === "buy_for_me" ? input.shopId : null,
          originCheckpointId: input.orderType === "pickup" ? input.originCheckpointId : null,
          suggestionId,
          checkpointId: input.checkpointId,
          universityId,
          itemDescription: basket.description,
          itemPrice: chargeableItemsTotal,
          deliveryFee,
          discountApplied: discountPct,
          surchargeApplied: surchargePct,
          totalAmount,
          deliveryDay: input.isSpecialOrder ? "special" : (scheduledDate.getDay() === 0 ? "sunday" : "wednesday"),
          scheduledDate,
          isSpecialOrder: input.isSpecialOrder,
          status: "payment_pending",
          notes: input.notes,
          items: basket.lines.length
            ? {
                create: basket.lines.map((l) => ({
                  productId: l.productId,
                  name: l.name,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                })),
              }
            : undefined,
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
    // feedOrder, NOT clientSafeOrder — these orders are unclaimed, so the rider
    // reading them has no relationship to the student yet and must not receive
    // their name, phone or student ID. See select.ts.
    const orders = await fastify.prisma.order.findMany({
      where: { status: "confirmed", riderId: null },
      select: feedOrder,
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

  // Every order across every shop this owner holds.
  //
  // This previously resolved a single shop with `findFirst` and listed only that
  // shop's orders, so an owner with more than one shop could not see — and
  // therefore could not fulfil — orders placed with the others. They were not
  // hidden behind a filter; they were absent. Filtering on the relation rather
  // than a collected id list keeps it one query and cannot drift out of sync
  // with what /shops/my returns.
  //
  // `shopId` is already on clientSafeOrder, so a client with several shops can
  // group these without a second request.
  fastify.get("/shop", { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] }, async (request, reply) => {
    const orders = await fastify.prisma.order.findMany({
      where: { shop: { ownerId: request.user!.id } },
      select: clientSafeOrder,
      orderBy: { createdAt: "desc" },
    });
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

  /**
   * The rider records what they actually paid, line by line, at a shop that has
   * no catalogue on Wave.
   *
   * This is the only way a `shop_pickup` ever acquires a goods price. Until it
   * lands, the order has a delivery fee and nothing else, and `/deliver` below
   * refuses to complete it.
   *
   * Three properties worth keeping:
   *  - **Per unit, not per line.** The client sends a unit price and the server
   *    multiplies by the quantity it already recorded. A rider doing that
   *    arithmetic on a phone at a till is exactly where a wrong charge is born.
   *  - **Write-once.** Re-recording would move a total the student may already
   *    have been charged for, so a second call is refused rather than applied.
   *  - **Every line or none.** A partial submission would produce a total that
   *    looks complete and isn't.
   */
  fastify.post(
    "/:id/goods-cost",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = recordGoodsCostSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const order = await fastify.prisma.order.findFirst({
        where: { id, riderId: request.user!.id },
        select: {
          id: true,
          orderType: true,
          status: true,
          deliveryFee: true,
          discountApplied: true,
          surchargeApplied: true,
          goodsPaidAt: true,
          items: { select: { id: true, quantity: true, actualUnitPrice: true } },
        },
      });
      if (!order) {
        return reply.code(404).send({ error: "Order not found or not assigned to you" });
      }
      if (order.orderType !== "shop_pickup") {
        return reply
          .code(409)
          .send({ error: "Only a suggested-shop order has a cost to record — this one is priced" });
      }
      if (order.goodsPaidAt || order.items.some((i) => i.actualUnitPrice !== null)) {
        return reply.code(409).send({ error: "The cost for this order has already been recorded" });
      }

      const byId = new Map(order.items.map((i) => [i.id, i]));
      if (parsed.data.lines.length !== order.items.length) {
        return reply
          .code(400)
          .send({ error: "Record a price for every item on the list" });
      }
      for (const line of parsed.data.lines) {
        if (!byId.has(line.itemId)) {
          return reply.code(400).send({ error: "That item is not on this order" });
        }
      }

      const itemsTotal = round2(
        parsed.data.lines.reduce(
          (sum, l) => sum + l.actualUnitPrice * (byId.get(l.itemId)!.quantity ?? 1),
          0,
        ),
      );

      // The delivery fee was charged at order time. Recomputing the total the
      // same way as creation keeps one definition of what an order costs, and
      // the difference between the two is exactly what is still owed.
      const totalAmount = calculateOrderTotal({
        itemPrice: itemsTotal,
        deliveryFee: Number(order.deliveryFee),
        discountPct: Number(order.discountApplied),
        surchargePct: Number(order.surchargeApplied),
      });

      const updated = await fastify.prisma.$transaction(async (tx) => {
        for (const line of parsed.data.lines) {
          await tx.orderItem.update({
            where: { id: line.itemId },
            data: { actualUnitPrice: line.actualUnitPrice },
          });
        }
        return tx.order.update({
          where: { id },
          data: { itemPrice: itemsTotal, totalAmount },
          select: clientSafeOrder,
        });
      });

      await fastify.prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          status: order.status,
          changedBy: request.user!.id,
          note: `Rider recorded goods cost: GHS ${itemsTotal.toFixed(2)}`,
        },
      });

      // The student now owes the goods. Telling them immediately is what makes
      // the second charge feel like part of the order rather than a surprise.
      await notifyGoodsCostRecorded({
        fastify,
        log: request.log,
        orderId: id,
        amountGhs: itemsTotal,
      });

      return reply.send({ order: updated, goodsTotal: itemsTotal });
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

    // A suggested-shop order is charged in two parts, and the goods half is
    // only knowable once the rider has been to the till. Handing the items over
    // before that charge clears would give away goods Wave paid for and has no
    // remaining hold on — the PIN proves the right person is collecting, not
    // that they have paid.
    if (order.orderType === "shop_pickup" && !order.goodsPaidAt) {
      return reply.code(409).send({
        error:
          order.itemPrice && Number(order.itemPrice) > 0
            ? "The student hasn't paid for the goods yet — ask them to complete payment in the app"
            : "Record what you paid for the items before handing this over",
      });
    }

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

  // The shop acknowledging a paid order.
  //
  // This used to set `status: "confirmed"` on an order that was already
  // `confirmed` — a no-op — and it had **no ownership check at all**, so any
  // shop owner could call it against any order in the system.
  //
  // Acceptance is now recorded as a timestamp rather than a status change.
  // Introducing an `awaiting_shop` status would gate the rider feed and sit on
  // the money path; a timestamp records the same fact and gates nothing.
  fastify.patch(
    "/:id/shop-accept",
    { preHandler: [fastify.authenticate, fastify.requireRole("shop_owner")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Scope by ownership *in the predicate*, so an order belonging to someone
      // else's shop simply does not match rather than being read and rejected.
      const result = await fastify.prisma.order.updateMany({
        where: {
          id,
          shop: { ownerId: request.user!.id },
          status: "confirmed",
          shopAcceptedAt: null,
        },
        data: { shopAcceptedAt: new Date() },
      });

      if (result.count === 0) {
        // Already accepted is not a failure — the shop tapped twice, and the
        // outcome they wanted is true either way.
        const existing = await fastify.prisma.order.findFirst({
          where: { id, shop: { ownerId: request.user!.id } },
          select: clientSafeOrder,
        });
        if (!existing) {
          return reply.code(404).send({ error: "Order not found" });
        }
        if (existing.status !== "confirmed") {
          return reply
            .code(409)
            .send({ error: "This order can no longer be accepted" });
        }
        return reply.send({ order: existing });
      }

      const order = await fastify.prisma.order.findUnique({
        where: { id },
        select: clientSafeOrder,
      });
      return reply.send({ order });
    },
  );

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
