import type { FastifyInstance } from "fastify";
import {
  basketRefusalMessage,
  canAddToBasket,
  canLockBasket,
  generateBasketCode,
  isCutoffPassedToday,
  isValidBasketCode,
  normalizeBasketCode,
  resolveFeature,
  MAX_BASKET_ITEM_QUANTITY,
} from "@wave/shared";

/**
 * Group baskets — several students filling one basket that one of them pays for.
 *
 * **The flag is checked here, not only in the app.** A flag the client reads is
 * a flag a client can lie about, so every route refuses while
 * `group_orders` is off for the caller's university.
 *
 * **Scope of trust.** The code is the invitation: anyone at the same university
 * who has it may add items. That is deliberate — an approval step per friend
 * would make a group order slower than four separate ones, and the worst case
 * is somebody adding jollof to a basket they were told about. Only the starter
 * can lock, cancel, or pay.
 */
export async function groupBasketRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /** Resolve the flag and the caller's profile in one place. */
  async function context(userId: string) {
    const profile = await fastify.prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, universityId: true, fullName: true },
    });
    const rows = await fastify.prisma.featureFlag.findMany({
      where: { key: "group_orders" },
      select: { key: true, universityId: true, enabled: true },
    });
    return {
      profile,
      enabled: resolveFeature("group_orders", profile?.universityId, rows),
    };
  }

  const basketShape = {
    id: true,
    code: true,
    status: true,
    starterId: true,
    shopId: true,
    scheduledDate: true,
    isSpecialOrder: true,
    orderId: true,
    shop: { select: { id: true, name: true, logoUrl: true } },
    starter: { select: { id: true, fullName: true } },
    items: {
      select: {
        id: true,
        name: true,
        unitPrice: true,
        quantity: true,
        productId: true,
        profileId: true,
        profile: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    },
  } as const;

  fastify.post("/", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.code(403).send({ error: "Group orders are not available yet" });
    if (!profile?.universityId) {
      return reply.code(400).send({ error: "Your account has no university set" });
    }

    const body = request.body as {
      shopId?: string;
      scheduledDate?: string;
      isSpecialOrder?: boolean;
    };
    if (typeof body.shopId !== "string" || typeof body.scheduledDate !== "string") {
      return reply.code(400).send({ error: "shopId and scheduledDate are required" });
    }

    const shop = await fastify.prisma.shop.findFirst({
      where: { id: body.shopId, universityId: profile.universityId },
      select: { id: true },
    });
    if (!shop) return reply.code(404).send({ error: "Shop not found" });

    // Codes are short enough to collide eventually. Retry rather than trust the
    // odds, and give up loudly rather than loop forever.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateBasketCode();
      try {
        const basket = await fastify.prisma.groupBasket.create({
          data: {
            code,
            starterId: profile.id,
            shopId: shop.id,
            universityId: profile.universityId,
            scheduledDate: new Date(body.scheduledDate),
            isSpecialOrder: !!body.isSpecialOrder,
          },
          select: basketShape,
        });
        return reply.code(201).send({ basket });
      } catch {
        // Unique violation on `code` — try another.
      }
    }
    request.log.error("Could not allocate a unique group basket code in 5 attempts");
    return reply.code(500).send({ error: "Couldn't start a basket. Please try again." });
  });

  fastify.get("/:code", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.code(403).send({ error: "Group orders are not available yet" });

    const code = normalizeBasketCode((request.params as { code: string }).code);
    if (!isValidBasketCode(code)) return reply.code(400).send({ error: "That is not a basket code" });

    const basket = await fastify.prisma.groupBasket.findFirst({
      // Scoped to the caller's university: a code is short, and a stranger
      // guessing one should not be handed another campus's basket.
      where: { code, universityId: profile?.universityId ?? "" },
      select: basketShape,
    });
    if (!basket) return reply.code(404).send({ error: "No basket with that code" });

    return reply.send({ basket });
  });

  fastify.post("/:code/items", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.code(403).send({ error: "Group orders are not available yet" });

    const code = normalizeBasketCode((request.params as { code: string }).code);
    const body = request.body as { productId?: string; name?: string; quantity?: number };

    const basket = await fastify.prisma.groupBasket.findFirst({
      where: { code, universityId: profile?.universityId ?? "" },
      select: { id: true, status: true, shopId: true, scheduledDate: true, _count: { select: { items: true } } },
    });
    if (!basket) return reply.code(404).send({ error: "No basket with that code" });

    const quantity = Number(body.quantity ?? 1);
    const refusal = canAddToBasket({
      status: basket.status,
      itemCount: basket._count.items,
      quantity,
      // A basket for today's Wave stops accepting items at noon, same as an order.
      cutoffPassed: isSameDay(basket.scheduledDate, new Date()) && isCutoffPassedToday(),
    });
    if (refusal) {
      return reply.code(409).send({ error: basketRefusalMessage(refusal), refusal });
    }

    // Price comes from the catalogue, never the client — the same rule the
    // order routes follow, and for the same reason.
    const product = body.productId
      ? await fastify.prisma.product.findFirst({
          where: { id: body.productId, shopId: basket.shopId },
          select: { id: true, name: true, price: true, status: true },
        })
      : null;
    if (body.productId && !product) {
      return reply.code(404).send({ error: "That item is not on this shop's menu" });
    }
    if (product && product.status !== "active") {
      return reply.code(409).send({ error: `${product.name} is not available right now` });
    }

    const name = product?.name ?? (typeof body.name === "string" ? body.name.trim() : "");
    if (!name) return reply.code(400).send({ error: "An item needs a name" });

    await fastify.prisma.groupBasketItem.create({
      data: {
        basketId: basket.id,
        profileId: request.user!.id,
        productId: product?.id ?? null,
        name,
        unitPrice: product?.price ?? null,
        quantity: Math.min(Math.max(1, Math.floor(quantity)), MAX_BASKET_ITEM_QUANTITY),
      },
    });

    const updated = await fastify.prisma.groupBasket.findUnique({
      where: { id: basket.id },
      select: basketShape,
    });
    return reply.code(201).send({ basket: updated });
  });

  /** Remove a line. Your own, or anyone's if you started the basket. */
  fastify.delete("/:code/items/:itemId", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.code(403).send({ error: "Group orders are not available yet" });

    const { code, itemId } = request.params as { code: string; itemId: string };
    const basket = await fastify.prisma.groupBasket.findFirst({
      where: { code: normalizeBasketCode(code), universityId: profile?.universityId ?? "" },
      select: { id: true, status: true, starterId: true },
    });
    if (!basket) return reply.code(404).send({ error: "No basket with that code" });
    if (basket.status !== "open") {
      return reply.code(409).send({ error: basketRefusalMessage("not-open") });
    }

    const item = await fastify.prisma.groupBasketItem.findFirst({
      where: { id: itemId, basketId: basket.id },
      select: { id: true, profileId: true },
    });
    if (!item) return reply.code(404).send({ error: "That line is not in this basket" });
    if (item.profileId !== request.user!.id && basket.starterId !== request.user!.id) {
      return reply.code(403).send({ error: "You can only remove lines you added" });
    }

    await fastify.prisma.groupBasketItem.delete({ where: { id: item.id } });
    const updated = await fastify.prisma.groupBasket.findUnique({
      where: { id: basket.id },
      select: basketShape,
    });
    return reply.send({ basket: updated });
  });

  /**
   * Close the basket so the starter can pay.
   *
   * This is the concurrency answer: after this, adds are refused with a reason
   * rather than the total moving under someone about to authorise it. The
   * conditional update is what makes two simultaneous locks safe — the second
   * matches no row.
   */
  fastify.post("/:code/lock", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.code(403).send({ error: "Group orders are not available yet" });

    const code = normalizeBasketCode((request.params as { code: string }).code);
    const basket = await fastify.prisma.groupBasket.findFirst({
      where: { code, universityId: profile?.universityId ?? "" },
      select: { id: true, starterId: true, status: true, _count: { select: { items: true } } },
    });
    if (!basket) return reply.code(404).send({ error: "No basket with that code" });
    if (!canLockBasket({ starterId: basket.starterId, actorId: request.user!.id })) {
      return reply.code(403).send({ error: "Only whoever started this basket can pay for it" });
    }
    if (basket._count.items === 0) {
      return reply.code(409).send({ error: "This basket is empty" });
    }

    const claimed = await fastify.prisma.groupBasket.updateMany({
      where: { id: basket.id, status: "open" },
      data: { status: "locked" },
    });
    if (claimed.count === 0) {
      return reply.code(409).send({ error: "This basket is already being paid for" });
    }

    const updated = await fastify.prisma.groupBasket.findUnique({
      where: { id: basket.id },
      select: basketShape,
    });
    return reply.send({ basket: updated });
  });

  /** Reopen a locked basket — the starter changed their mind before paying. */
  fastify.post("/:code/unlock", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.code(403).send({ error: "Group orders are not available yet" });

    const code = normalizeBasketCode((request.params as { code: string }).code);
    const basket = await fastify.prisma.groupBasket.findFirst({
      where: { code, universityId: profile?.universityId ?? "" },
      select: { id: true, starterId: true },
    });
    if (!basket) return reply.code(404).send({ error: "No basket with that code" });
    if (basket.starterId !== request.user!.id) {
      return reply.code(403).send({ error: "Only whoever started this basket can reopen it" });
    }

    // Only from `locked`. A converted basket has an order behind it and must
    // never go back to accepting items.
    const reopened = await fastify.prisma.groupBasket.updateMany({
      where: { id: basket.id, status: "locked" },
      data: { status: "open" },
    });
    if (reopened.count === 0) {
      return reply.code(409).send({ error: "This basket can't be reopened" });
    }
    return reply.send({ ok: true });
  });

  /** The baskets this student started or has added to. */
  fastify.get("/", async (request, reply) => {
    const { profile, enabled } = await context(request.user!.id);
    if (!enabled) return reply.send({ baskets: [] });

    const baskets = await fastify.prisma.groupBasket.findMany({
      where: {
        universityId: profile?.universityId ?? "",
        status: { in: ["open", "locked"] },
        OR: [{ starterId: request.user!.id }, { items: { some: { profileId: request.user!.id } } }],
      },
      select: basketShape,
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return reply.send({ baskets });
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
