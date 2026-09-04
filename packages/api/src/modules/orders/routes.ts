import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { OrderStatus } from "@wave/shared";
import {
  cancelOrderSchema,
  createOrderSchema,
  deliverOrderSchema,
  recordGoodsCostSchema,
  DEFAULT_DELIVERY_FEE_GHS,
  DEFAULT_LOYALTY_DISCOUNT_PCT,
  DEFAULT_LOYALTY_THRESHOLD,
  DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT,
  DEFAULT_GOODS_COST_MAX_GHS,
  DEFAULT_RIDER_EARNING_PCT_BY_TYPE,
  RIDER_EARNING_PCT_KEY,
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
import { decryptDeliveryPin } from "./pinCrypto";
import { redactClosedOrderContacts, redactClosedOrderContactsAll } from "./redact";
import { findOrderForUser, redactStudentContactForShop } from "./access";
import { allowedPredecessors } from "./transitions";
import { clientSafeOrder, feedOrder } from "./select";
import { endOrderWithRefund } from "../payments/refund";
import { notifyGoodsCostRecorded, notifyOrderStatus } from "../notifications/dispatch";
import { PIN_RESEND_RATE_LIMIT, PIN_VERIFY_RATE_LIMIT } from "../../plugins/rateLimit";

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

      // A date in the past is not a delivery anyone can run. `scheduledDate` was
      // only ever checked for its day of the week, so "last Sunday" passed —
      // and the rider feed filters on status and campus, not on date, so the
      // order went live immediately for a Wave that had already happened.
      //
      // Compared as a UTC calendar day because `z.string().date()` is date-only
      // and Ghana is UTC+0: no timezone arithmetic to get wrong.
      const today = new Date();
      const todayUtcDay = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      );
      if (scheduledDate.getTime() < todayUtcDay) {
        return reply.code(400).send({ error: "That delivery date has already passed" });
      }

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

      // `platform_config` is the runtime source of truth; the shared constants
      // are the fallback for a row that has not been seeded. They were literals
      // here, which meant the base fee lived as an unlabelled `5` in the middle
      // of the money path and could silently disagree with every other copy.
      const deliveryFee = Number(feeConfig?.value ?? DEFAULT_DELIVERY_FEE_GHS);
      const surchargePct = input.isSpecialOrder
        ? Number(surchargeConfig?.value ?? DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT)
        : 0;
      const threshold = Number(thresholdConfig?.value ?? DEFAULT_LOYALTY_THRESHOLD);
      const configuredDiscountPct = Number(discountConfig?.value ?? DEFAULT_LOYALTY_DISCOUNT_PCT);
      // The loyalty discount applies to the DELIVERY FEE ONLY, never to the
      // items — see calculateOrderTotal, and Wave_Technical_Document.md §"20%
      // discount applies to delivery fee, not the item purchase price".
      const discountPct =
        calculateDiscount({
          totalDeliveries: stats?.totalDeliveries ?? 0,
          baseAmount: 1,
          threshold,
          discountPct: configuredDiscountPct,
        }) > 0
          ? configuredDiscountPct
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
    // A student's history is mostly closed orders, so without this it is a
    // standing list of the phone number of every rider who has ever delivered
    // to them.
    return reply.send({ orders: redactClosedOrderContactsAll(orders, request.user!.role) });
  });

  fastify.get("/available", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const rider = await fastify.prisma.profile.findUnique({
      where: { id: request.user!.id },
      select: { isVerified: true, universityId: true, riderType: true },
    });
    if (!rider?.isVerified) {
      return reply.code(403).send({ error: "Your rider account is not verified yet" });
    }
    if (!rider.universityId) {
      return reply.send({ orders: [] });
    }

    // A rider from outside the university may only deliver to checkpoints an
    // admin has opened to them. Filtering the feed rather than blocking the
    // accept is deliberate: a job they can never complete should not be visible
    // at all, both because offering it and refusing it is the behaviour this
    // whole gate exists to stop, and because the feed carries the drop-off
    // location of orders they have no business knowing about.
    const externalOnly =
      rider.riderType === "external"
        ? { checkpoint: { externalRidersAllowed: true } }
        : {};

    // feedOrder, NOT clientSafeOrder — these orders are unclaimed, so the rider
    // reading them has no relationship to the student yet and must not receive
    // their name, phone or student ID. See select.ts.
    const orders = await fastify.prisma.order.findMany({
      where: { status: "confirmed", riderId: null, universityId: rider.universityId, ...externalOnly },
      select: feedOrder,
    });
    return reply.send({
      orders,
      // The app needs to tell an external rider with an empty feed why it is
      // empty. "No jobs right now" and "you are not allowed at any checkpoint"
      // look identical otherwise, and only one of them resolves by waiting.
      riderType: rider.riderType,
    });
  });

  fastify.get("/my-deliveries", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const orders = await fastify.prisma.order.findMany({
      where: { riderId: request.user!.id },
      select: clientSafeOrder,
      orderBy: { createdAt: "desc" },
    });
    // The larger exposure of the two: a busy rider's delivery list would
    // otherwise hold the number of every student they have ever served.
    return reply.send({ orders: redactClosedOrderContactsAll(orders, request.user!.role) });
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
    // The larger of the two exposures: this returns every order the shop has
    // ever had in one response, so an unredacted version is a standing export
    // of the contact details of every student who has ordered from them.
    return reply.send({
      orders: orders.map((o) => redactStudentContactForShop(o, request.user!)),
    });
  });

  fastify.get("/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await findOrderForUser(fastify.prisma, id, request.user!);
    if (!order) return reply.code(404).send({ error: "Order not found" });
    return reply.send({ order: redactClosedOrderContacts(order, request.user!.role) });
  });

  fastify.patch("/:id/accept", { preHandler: [fastify.authenticate, fastify.requireRole("rider")] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const rider = await fastify.prisma.profile.findUnique({
      where: { id: request.user!.id },
      select: { isVerified: true, universityId: true },
    });
    if (!rider?.isVerified) {
      return reply.code(403).send({ error: "Your rider account is not verified yet" });
    }

    const candidate = await fastify.prisma.order.findUnique({
      where: { id },
      select: { universityId: true, status: true, riderId: true },
    });
    if (!candidate || candidate.status !== "confirmed" || candidate.riderId) {
      return reply.code(409).send({ error: "This order is no longer available" });
    }
    if (rider.universityId && candidate.universityId !== rider.universityId) {
      return reply.code(403).send({ error: "This order is not on your campus" });
    }

    // The `riderId: null, status: "confirmed"` predicate is the claim lock: two
    // riders tapping Accept on the same feed entry both reach here, and only one
    // update can match. The loser matches no row, and Prisma throws P2025 rather
    // than returning null — so this must be caught, or the second rider gets a
    // 500 for what is ordinary contention.
    let order;
    try {
      order = await fastify.prisma.order.update({
        where: {
          id,
          riderId: null,
          status: "confirmed",
          ...(rider.universityId ? { universityId: rider.universityId } : {}),
        },
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

      // The current status belongs in the predicate, not in a prior read: two
      // requests would both pass a read-then-check. Same reasoning as the rider
      // claim lock above.
      //
      // Without this the predicate was `{ id, riderId }` alone — and a
      // delivered order still has a `riderId`, so a finished, cancelled or
      // refunded order could be pushed back to `en_route`
      // (review 09-architecture, C2).
      const target = body.status as OrderStatus;
      let order;
      try {
        order = await fastify.prisma.order.update({
          where: {
            id,
            riderId: request.user!.id,
            status: { in: allowedPredecessors(target) },
          },
          data: { status: target as never },
          select: clientSafeOrder,
        });
      } catch {
        // Three ways to land here — not yours, not found, or the wrong state —
        // and they need different answers. Re-read to say which.
        const existing = await fastify.prisma.order.findFirst({
          where: { id, riderId: request.user!.id },
          select: { status: true },
        });
        if (!existing) {
          return reply.code(404).send({ error: "Order not found or not assigned to you" });
        }
        return reply.code(409).send({
          error: `This order is ${existing.status} — it can't be marked ${target}`,
        });
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

      // Whatever the rider types here is charged to the student automatically,
      // and the only prior guard was a GHS 10,000 *per-unit* cap in the schema —
      // which across a 20-line basket permits a charge in the millions
      // (review 11-campus, M2). One slipped decimal point is a real debit from a
      // student's MoMo wallet.
      //
      // A hard stop rather than a flag-for-review: the rider is standing at the
      // till holding the receipt, which is the cheapest possible moment to
      // re-check an amount. Flagging would mean charging first and looking later.
      const maxGoodsConfig = await fastify.prisma.platformConfig.findUnique({
        where: { key: "goods_cost_max_ghs" },
      });
      const maxGoodsGhs = Number(maxGoodsConfig?.value ?? DEFAULT_GOODS_COST_MAX_GHS);
      if (itemsTotal > maxGoodsGhs) {
        return reply.code(400).send({
          error: `That total (GH₵${itemsTotal.toFixed(2)}) looks too high for a campus run. Check the amount, or call Wave.`,
        });
      }

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

  /**
   * How many wrong PINs an order tolerates before it stops answering.
   *
   * Five is enough for a rider mistyping on a phone at dusk and nowhere near
   * enough to search a 6-digit space. Recovery is the student tapping "Resend
   * PIN", which issues a new code and zeroes the counter — and crucially the
   * rider cannot do that themselves, so the lockout means something.
   */
  const MAX_PIN_ATTEMPTS = 5;

  // Rider marks delivered — requires the correct PIN, verified against the bcrypt hash.
  fastify.patch(
    "/:id/deliver",
    {
      preHandler: [fastify.authenticate, fastify.requireRole("rider")],
      config: {
        rateLimit: {
          ...PIN_VERIFY_RATE_LIMIT,
          keyGenerator: (request) =>
            `${request.user?.id ?? request.ip}:${(request.params as { id?: string }).id ?? ""}:pin-verify`,
        },
      },
    },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = deliverOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const order = await fastify.prisma.order.findUnique({ where: { id } });
    if (!order || !order.deliveryPinHash) return reply.code(404).send({ error: "Order not found" });
    if (order.riderId !== request.user!.id) {
      return reply.code(403).send({ error: "Not your delivery" });
    }

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

    // Checked before the comparison, so a locked order costs no bcrypt at all.
    if (order.deliveryPinAttempts >= MAX_PIN_ATTEMPTS) {
      return reply.code(429).send({
        error:
          "Too many incorrect PINs on this order. Ask the student to tap \u201cResend PIN\u201d in their app, then try the new code.",
      });
    }

    const valid = await verifyDeliveryPin(parsed.data.pin, order.deliveryPinHash);
    if (!valid) {
      // Incremented in the database, not counted in this process: the count has
      // to survive a restart and be shared across instances, or it caps nothing.
      const { deliveryPinAttempts } = await fastify.prisma.order.update({
        where: { id },
        data: { deliveryPinAttempts: { increment: 1 } },
        select: { deliveryPinAttempts: true },
      });
      const remaining = Math.max(0, MAX_PIN_ATTEMPTS - deliveryPinAttempts);
      if (remaining === 0) {
        request.log.warn(
          { orderId: id, riderId: request.user!.id },
          "Delivery PIN locked after repeated incorrect entries",
        );
      }
      return reply.code(403).send({
        error: remaining
          ? `Incorrect PIN — ${remaining} ${remaining === 1 ? "try" : "tries"} left before this order locks.`
          : "Incorrect PIN. This order is now locked — ask the student to resend their PIN.",
        attemptsRemaining: remaining,
      });
    }

    // Delivering is not idempotent — it increments
    // `studentDeliveryStats.totalDeliveries`, which is what earns the 20%
    // loyalty discount. Without a status predicate this route would happily
    // deliver an already-delivered order again and move the student closer to a
    // discount they did not earn, or mark a refunded order delivered
    // (review 09-architecture, C2).
    //
    // In the predicate rather than an `if` above, so two riders holding the
    // same PIN cannot both pass the check before either writes.
    const deliverable = await fastify.prisma.order.updateMany({
      where: { id, status: { in: allowedPredecessors("delivered") } },
      // The counter is zeroed on the way through: the PIN was right, so whatever
      // fumbling preceded it was a rider on a phone, not an attack.
      data: { status: "delivered", deliveredAt: new Date(), deliveryPinAttempts: 0 },
    });
    if (deliverable.count === 0) {
      return reply.code(409).send({
        error: `This order is ${order.status} — it can't be marked delivered`,
      });
    }
    const updated = await settleDelivery({
      fastify,
      log: request.log,
      order,
      closedBy: request.user!.id,
      note: "PIN entered by the rider",
    });
    return reply.send({ order: updated });
  });

  /**
   * The student closes their own delivery.
   *
   * The delivery PIN is the only way an order can be completed, and it arrives
   * by SMS. SMS on Ghanaian networks is not 100%, which makes a text message a
   * single point of failure on every single order — a rider standing in front of
   * the right student holding the right goods simply cannot finish the job.
   *
   * A student pressing "I have my order" in their own account is at least as
   * strong a proof as reading six digits aloud: it is the same person, the same
   * phone, and one fewer step for anyone to overhear. It deliberately does NOT
   * exist for the rider — a rider-side bypass is exactly the thing that would let
   * someone close a delivery they never made.
   */
  fastify.post(
    "/:id/confirm-receipt",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await fastify.prisma.order.findUnique({ where: { id } });
      if (!order) return reply.code(404).send({ error: "Order not found" });
      if (order.studentId !== request.user!.id) {
        return reply.code(403).send({ error: "Not your order" });
      }
      if (!order.riderId) {
        // Nobody has collected it, so there is nothing to have received. Without
        // this a student could close an order that no rider ever touched, and
        // still be counted a delivery towards their loyalty discount.
        return reply.code(409).send({ error: "No rider has picked this order up yet" });
      }
      if (order.orderType === "shop_pickup" && !order.goodsPaidAt) {
        return reply.code(409).send({ error: "Pay for the items first" });
      }

      const deliverable = await fastify.prisma.order.updateMany({
        where: { id, status: { in: allowedPredecessors("delivered") } },
        data: { status: "delivered", deliveredAt: new Date(), deliveryPinAttempts: 0 },
      });
      if (deliverable.count === 0) {
        return reply.code(409).send({
          error: `This order is ${order.status} — it can't be marked delivered`,
        });
      }

      const updated = await settleDelivery({
        fastify,
        log: request.log,
        order,
        closedBy: request.user!.id,
        note: "Confirmed received by the student",
      });
      return reply.send({ order: updated });
    },
  );

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
        select: { studentId: true, status: true, orderType: true, itemPrice: true },
      });
      if (!order || order.studentId !== request.user!.id) {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (!STUDENT_CANCELLABLE_STATUSES.includes(order.status as never)) {
        return reply.code(409).send({
          error: `An order that is ${order.status} can no longer be cancelled here — contact support`,
        });
      }

      // On a suggested-shop order the rider pays cash at the till, and recording
      // that cost does NOT move the status — the rider sets `en_route` by hand,
      // separately, and may not have yet. So the cancellable window stayed open
      // over a basket someone had already bought, and the student could
      // self-serve a full refund with the rider out of pocket.
      //
      // Status is the wrong thing to test here; money spent is the right one.
      if (order.orderType === "shop_pickup" && Number(order.itemPrice ?? 0) > 0) {
        return reply.code(409).send({
          error:
            "Your runner has already bought these items, so this can't be cancelled in the app — message Wave support and we'll sort it out.",
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

  // Owning student reads their delivery code for in-app display. Ciphertext is
  // never on general order GETs. Legacy orders (hash only) get a one-time
  // re-issue so the app can show a code — that rotates the PIN.
  fastify.get(
    "/:id/delivery-pin",
    { preHandler: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const order = await fastify.prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          studentId: true,
          status: true,
          deliveryPinHash: true,
          deliveryPinCiphertext: true,
          student: { select: { phone: true } },
        },
      });
      if (!order || order.studentId !== request.user!.id) {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (!["confirmed", "rider_assigned", "en_route", "at_checkpoint"].includes(order.status)) {
        return reply.code(409).send({ error: "This order has no active delivery PIN" });
      }
      if (!order.deliveryPinHash) {
        return reply.code(409).send({ error: "This order has no active delivery PIN" });
      }

      if (order.deliveryPinCiphertext) {
        try {
          const pin = decryptDeliveryPin(order.deliveryPinCiphertext, fastify.config.JWT_SECRET);
          return reply.send({ pin });
        } catch (err) {
          request.log.error({ err }, "Failed to decrypt delivery PIN — re-issuing");
        }
      }

      // Pre-ciphertext orders (or unreadable blobs): mint a new PIN the app can show.
      const { pin, smsSent } = await issueDeliveryPin({
        fastify,
        log: request.log,
        phone: order.student.phone,
        persist: ({ hash, ciphertext }) =>
          fastify.prisma.order
            .update({
              where: { id: order.id },
              // A new PIN gets a clean slate — otherwise a locked order stays
              // locked through the very resend that is supposed to recover it.
              data: {
                deliveryPinHash: hash,
                deliveryPinCiphertext: ciphertext,
                deliveryPinAttempts: 0,
              },
            })
            .then(() => undefined),
      });
      return reply.send({ pin, smsSent });
    },
  );

  // Re-issues a delivery PIN, texts it, and returns the digits so the app can
  // refresh what it shows without a second round-trip.
  const PIN_RESEND_COOLDOWN_MS = 60_000;

  fastify.post(
    "/:id/resend-pin",
    {
      preHandler: [fastify.authenticate, fastify.requireRole("student")],
      config: {
        rateLimit: {
          ...PIN_RESEND_RATE_LIMIT,
          keyGenerator: (request) => `${request.user?.id ?? request.ip}:pin-resend`,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const order = await fastify.prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          studentId: true,
          status: true,
          lastPinResendAt: true,
          student: { select: { phone: true } },
        },
      });
      if (!order || order.studentId !== request.user!.id) {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (!["confirmed", "rider_assigned", "en_route", "at_checkpoint"].includes(order.status)) {
        return reply.code(409).send({ error: "This order has no active delivery PIN" });
      }

      // Each send costs money, so throttle. The cooldown is claimed with a
      // conditional UPDATE rather than tracked in a per-process Map: the Map
      // held only while the API ran as a single instance, and two of them would
      // each keep their own and let a student resend twice per window.
      //
      // `count === 0` means someone else claimed inside the window — including
      // the student's own double-tap racing itself.
      const cutoff = new Date(Date.now() - PIN_RESEND_COOLDOWN_MS);
      const claimed = await fastify.prisma.order.updateMany({
        where: {
          id: order.id,
          OR: [{ lastPinResendAt: null }, { lastPinResendAt: { lt: cutoff } }],
        },
        data: { lastPinResendAt: new Date() },
      });
      if (claimed.count === 0) {
        const last = order.lastPinResendAt?.getTime() ?? Date.now();
        const waitMs = Math.max(0, PIN_RESEND_COOLDOWN_MS - (Date.now() - last));
        return reply.code(429).send({
          error: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another PIN`,
        });
      }

      const { smsSent, pin } = await issueDeliveryPin({
        fastify,
        log: request.log,
        phone: order.student.phone,
        persist: ({ hash, ciphertext }) =>
          fastify.prisma.order
            .update({
              where: { id: order.id },
              // A new PIN gets a clean slate — otherwise a locked order stays
              // locked through the very resend that is supposed to recover it.
              data: {
                deliveryPinHash: hash,
                deliveryPinCiphertext: ciphertext,
                deliveryPinAttempts: 0,
              },
            })
            .then(() => undefined),
      });

      if (!smsSent) {
        // Still return the pin — the app is the primary display; SMS is backup.
        return reply.send({ sent: false, pin });
      }
      return reply.send({ sent: true, pin });
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

    // Scope by ownership *in the predicate*, matching `/:id/shop-accept` above.
    //
    // This used to resolve one shop with `findFirst({ where: { ownerId } })` and
    // compare it to `order.shopId` (review 09-architecture, H2). An owner may
    // hold several shops, and that `findFirst` carried no `orderBy` — so it
    // returned an arbitrary shop, and rejecting an order belonging to any other
    // one 404'd. Non-deterministically, too: with no ordering, Postgres is free
    // to return a different row between requests, so the same call could work
    // once and fail the next time.
    //
    // The listing route above hit the identical bug and was fixed there; this
    // path was missed. One query now, and ownership cannot drift from what
    // `/shops/my` returns.
    const order = await fastify.prisma.order.findFirst({
      where: { id, shop: { ownerId: request.user!.id } },
      select: { id: true },
    });
    if (!order) {
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


/**
 * Credits the rider for a completed delivery.
 *
 * `rider_earnings` existed in the schema, had a route reading it, and had a
 * screen rendering it — and **nothing ever wrote a row**, so every rider's
 * Earnings tab was permanently empty. For the people the pilot most needs to
 * trust it, the screen that says what they are owed showed nothing at all.
 *
 * Written as `pending`; `paidAt` is stamped when the MoMo payout actually goes
 * out. That is still a manual process, so this is the ledger it will be
 * reconciled against, not a promise the money has moved.
 *
 * Best-effort, and deliberately after the delivery itself: `order_id` is unique,
 * so a retry cannot double-credit, and a failure here must never turn a
 * completed handover into an error the rider sees at a checkpoint. A missing
 * row is recoverable from the order; a delivery the rider could not close is not.
 */
/**
 * Everything that happens once a delivery is genuinely complete.
 *
 * Three routes can close a delivery now — the rider with a PIN, the student
 * confirming receipt when the SMS never arrived, and an admin overriding — and
 * all three must have identical consequences. Duplicating this was how the
 * loyalty counter and the rider's earnings would quietly diverge depending on
 * which door the delivery went out of.
 *
 * The status row is written for every path including the ordinary one, so "how
 * was this closed?" always has an answer. That question only gets asked when
 * something has gone wrong, which is exactly when a missing record costs the most.
 */
async function settleDelivery(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  order: { id: string; studentId: string; riderId: string | null; deliveryFee: unknown };
  closedBy: string;
  note: string;
}) {
  const { fastify, log, order, closedBy, note } = args;

  const updated = await fastify.prisma.order.findUnique({
    where: { id: order.id },
    select: clientSafeOrder,
  });

  await fastify.prisma.orderStatusHistory.create({
    data: { orderId: order.id, status: "delivered", changedBy: closedBy, note },
  });

  await fastify.prisma.studentDeliveryStats.upsert({
    where: { studentId: order.studentId },
    create: { studentId: order.studentId, totalDeliveries: 1 },
    update: { totalDeliveries: { increment: 1 } },
  });

  // The rider is paid for the run whichever way it was closed. A delivery that
  // finished because the student confirmed it, or because an admin unstuck it,
  // is still a delivery the rider made.
  if (order.riderId) {
    await recordRiderEarning({
      fastify,
      log,
      orderId: order.id,
      riderId: order.riderId,
      deliveryFee: Number(order.deliveryFee),
    });
  }

  await notifyOrderStatus({ fastify, log, orderId: order.id, status: "delivered" });
  return updated;
}

async function recordRiderEarning(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  orderId: string;
  riderId: string;
  deliveryFee: number;
}): Promise<void> {
  const { fastify, log, orderId, riderId, deliveryFee } = args;
  try {
    // Student and external riders are paid at separate rates, so the rate to
    // apply depends on this rider. A rider with no type set is paid the student
    // rate rather than nothing — the two are identical by default, and refusing
    // to write the row would cost a real person a real delivery over a data gap.
    const rider = await fastify.prisma.profile.findUnique({
      where: { id: riderId },
      select: { riderType: true },
    });
    const riderType = rider?.riderType ?? "student";
    if (!rider?.riderType) {
      log.warn({ riderId }, "Rider has no riderType — paying at the student rate");
    }

    const key = RIDER_EARNING_PCT_KEY[riderType];
    const pctConfig = await fastify.prisma.platformConfig.findUnique({ where: { key } });
    const parsed = Number(pctConfig?.value);
    // A missing row is expected (the constant is the default); an unparseable
    // one is an admin typo, and silently paying 0 would be worse than saying so.
    if (pctConfig && !Number.isFinite(parsed)) {
      log.error({ key, value: pctConfig.value }, `platform_config.${key} is not a number — falling back to the default`);
    }
    const pct = Number.isFinite(parsed) ? parsed : DEFAULT_RIDER_EARNING_PCT_BY_TYPE[riderType];
    const amount = round2((deliveryFee * pct) / 100);

    // `ratePct` is written onto the row so editing a rate later never rewrites
    // the basis of a delivery that already happened, and a rider disputing an
    // old payment can be answered.
    await fastify.prisma.riderEarning.create({
      data: { orderId, riderId, amount, ratePct: pct, status: "pending" },
    });
    log.info({ orderId, riderId, amount, pct, riderType }, "Rider earning recorded");
  } catch (err) {
    log.error(
      { orderId, riderId, err: err instanceof Error ? err.message : "unknown" },
      "Could not record the rider earning for a delivered order — the delivery stands, the ledger row is missing",
    );
  }
}
