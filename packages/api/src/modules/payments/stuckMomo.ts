import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { capturePaymentIssue } from "../../lib/sentry";
import { MOOLRE_DELIVERY_PREFIX, MOOLRE_GOODS_PREFIX, mintedAtFromMoolreReference } from "./moolre";

/**
 * A MoMo charge this old with no payment is worth a human look. Past a normal
 * approval (a minute or two) and well inside the abandoned-checkout TTL, so the
 * alert lands while the student can still be helped.
 */
export const STUCK_MOMO_AFTER_MS = 5 * 60_000;
/** Older than this the abandoned-checkout sweep owns the order; stop alerting. */
export const STUCK_MOMO_GIVE_UP_MS = 45 * 60_000;

/** Orders already flagged by this process, so one stuck charge alerts once. */
const alerted = new Set<string>();

/** Test hook. */
export function resetStuckMomoAlerts() {
  alerted.clear();
}

/**
 * Flags orders whose Moolre MoMo charge was started 5+ minutes ago and is
 * still unpaid. Alert only: it never changes an order, so it cannot race the
 * webhook, the verify poll or the abandoned-checkout sweep.
 *
 * Why it exists (2026-11-27): a student paid by MoMo, never got the approval
 * prompt, and nobody knew until the student said so.
 */
export async function sweepStuckMomo(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  now?: Date;
}): Promise<{ flagged: number }> {
  const { fastify, log } = args;
  const now = args.now ?? new Date();

  const rows = await fastify.prisma.order.findMany({
    where: {
      // The delivery-fee leg is only unpaid while the order waits on payment;
      // the goods leg is paid later, so any live order can still owe it.
      OR: [
        { status: { in: ["pending", "payment_pending"] }, paidAt: null, paystackRef: { startsWith: MOOLRE_DELIVERY_PREFIX } },
        {
          status: { notIn: ["cancelled", "refunded", "delivered"] },
          goodsPaidAt: null,
          goodsPaystackRef: { startsWith: MOOLRE_GOODS_PREFIX },
        },
      ],
    },
    select: { id: true, paidAt: true, paystackRef: true, goodsPaidAt: true, goodsPaystackRef: true },
    take: 50,
  });

  let flagged = 0;
  for (const row of rows) {
    const refs = [
      !row.paidAt ? row.paystackRef : null,
      !row.goodsPaidAt ? row.goodsPaystackRef : null,
    ];
    for (const reference of refs) {
      if (!reference || alerted.has(reference)) continue;
      const minted = mintedAtFromMoolreReference(reference);
      if (!minted) continue;
      const age = now.getTime() - minted.getTime();
      if (age < STUCK_MOMO_AFTER_MS || age > STUCK_MOMO_GIVE_UP_MS) continue;
      alerted.add(reference);
      flagged += 1;
      log.warn({ orderId: row.id, reference, ageMin: Math.round(age / 60_000) }, "Stuck MoMo payment: charge started but never paid");
      capturePaymentIssue("MoMo charge started but unpaid after 5+ minutes", { phase: "stuck_momo", orderId: row.id, reference });
    }
  }
  return { flagged };
}
