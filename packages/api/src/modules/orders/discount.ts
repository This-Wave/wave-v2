import type { OrderTotalInput } from "@wave/shared";

// Never trust a client-sent total — this is the single source of truth,
// called only with server-loaded prices/fees/config.
export function calculateOrderTotal(input: OrderTotalInput): number {
  const { itemPrice, deliveryFee, discountPct, surchargePct } = input;
  const adjustedFee = deliveryFee * (1 + surchargePct / 100) * (1 - discountPct / 100);
  return Math.round((itemPrice + adjustedFee) * 100) / 100;
}

/**
 * What a full stamp card takes off a given amount.
 *
 * The parameter is `stamps`, not a lifetime delivery count. It used to be the
 * latter, which is what made the discount permanent: once an account passed six
 * deliveries the condition was true forever. Since the reward became one-shot
 * the input has to be the spendable counter, and naming it after the thing it
 * actually is, is most of what stops that regressing.
 */
export function calculateDiscount({
  stamps,
  baseAmount,
  threshold = 6,
  discountPct = 20,
}: {
  stamps: number;
  baseAmount: number;
  threshold?: number;
  discountPct?: number;
}): number {
  if (stamps < threshold) return 0;
  return Math.round(baseAmount * (discountPct / 100) * 100) / 100;
}

export function isStandardDeliveryDay(date: Date): boolean {
  const day = date.getDay(); // 0 = Sunday, 3 = Wednesday
  return day === 0 || day === 3;
}
