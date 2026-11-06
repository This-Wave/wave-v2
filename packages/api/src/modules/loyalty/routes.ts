import type { FastifyInstance } from "fastify";
import { DEFAULT_LOYALTY_DISCOUNT_PCT, DEFAULT_LOYALTY_THRESHOLD } from "@wave/shared";

/**
 * The student's own stamp card.
 *
 * This exists because the reward became one-shot. While the discount was
 * permanent the app could work it out for itself — count your delivered orders,
 * compare with six — and that is exactly what the profile and the checkout
 * estimate did. A counter that is *spent* cannot be derived from order history,
 * so the number has to come from the row that holds it.
 *
 * Thresholds come from `platform_config`, the same runtime source the order
 * route prices against, so the card a student reads and the discount they are
 * charged cannot disagree.
 *
 * Own module rather than a field on `/profile/me`: the profile is cached in the
 * app's auth store for the whole session, and a stamp earned mid-session would
 * not show up until the next sign-in.
 */
export async function loyaltyRoutes(fastify: FastifyInstance) {
  fastify.get("/loyalty", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const [stats, thresholdRow, discountRow] = await Promise.all([
      fastify.prisma.studentDeliveryStats.findUnique({
        where: { studentId: request.user!.id },
        select: { rewardStamps: true, totalDeliveries: true },
      }),
      fastify.prisma.platformConfig.findUnique({ where: { key: "loyalty_threshold" } }),
      fastify.prisma.platformConfig.findUnique({ where: { key: "loyalty_discount_pct" } }),
    ]);

    const threshold = Number(thresholdRow?.value ?? DEFAULT_LOYALTY_THRESHOLD);
    const discountPct = Number(discountRow?.value ?? DEFAULT_LOYALTY_DISCOUNT_PCT);
    const stamps = stats?.rewardStamps ?? 0;

    /**
     * A reward the student is holding but has already priced into an unpaid
     * order. The order route refuses to apply a second one while that is open,
     * so saying "reward ready" here would promise a discount the next order
     * would not get.
     */
    const heldOpen = await fastify.prisma.order.findFirst({
      where: {
        studentId: request.user!.id,
        status: "payment_pending",
        discountApplied: { gt: 0 },
      },
      select: { id: true },
    });

    return reply.send({
      stamps,
      threshold,
      discountPct,
      totalDeliveries: stats?.totalDeliveries ?? 0,
      rewardReady: stamps >= threshold && !heldOpen,
      /** True when the card is full but already spoken for by an unpaid order. */
      rewardPending: stamps >= threshold && !!heldOpen,
    });
  });
}
