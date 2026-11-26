import type { PrismaClient } from "@prisma/client";
import { DEFAULT_FIRST_ORDER_PROMO_PCT, FIRST_ORDER_PROMO_CODE, normalizePromoCode } from "@wave/shared";

export type PromoResult =
  | { ok: true; code: string; pct: number }
  | { ok: false; error: string };

type Db = Pick<PrismaClient, "platformConfig" | "order">;

/**
 * The first-order code. Valid when it is the launch code, switched on
 * (`promo_first_order_pct` > 0), the student has never paid for an order, and
 * no other unpaid order of theirs already carries it (two unpaid orders each
 * priced with the code would both come out discounted once paid).
 */
export async function evaluateFirstOrderPromo(db: Db, studentId: string, raw: string): Promise<PromoResult> {
  const code = normalizePromoCode(raw);
  if (code !== FIRST_ORDER_PROMO_CODE) return { ok: false, error: "That code doesn't exist." };

  const row = await db.platformConfig.findUnique({ where: { key: "promo_first_order_pct" } });
  const pct = Number(row?.value ?? DEFAULT_FIRST_ORDER_PROMO_PCT);
  if (!Number.isFinite(pct) || pct <= 0) return { ok: false, error: "That code has ended." };

  const paidBefore = await db.order.findFirst({
    where: { studentId, paidAt: { not: null } },
    select: { id: true },
  });
  if (paidBefore) return { ok: false, error: `${FIRST_ORDER_PROMO_CODE} is for your first order.` };

  const heldOpen = await db.order.findFirst({
    where: { studentId, status: "payment_pending", promoCode: { not: null } },
    select: { id: true },
  });
  if (heldOpen) {
    return { ok: false, error: "That code is already on an order waiting for payment. Pay or cancel that one first." };
  }

  return { ok: true, code, pct: Math.min(pct, 100) };
}
