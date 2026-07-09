import type { OrderTotalInput } from "@wave/shared";

// Never trust a client-sent total — this is the single source of truth,
// called only with server-loaded prices/fees/config.
export function calculateOrderTotal(input: OrderTotalInput): number {
  const { itemPrice, deliveryFee, discountPct, surchargePct } = input;
  const adjustedFee = deliveryFee * (1 + surchargePct / 100) * (1 - discountPct / 100);
  return Math.round((itemPrice + adjustedFee) * 100) / 100;
}

export function calculateDiscount({
  totalDeliveries,
  baseAmount,
  threshold = 6,
  discountPct = 20,
}: {
  totalDeliveries: number;
  baseAmount: number;
  threshold?: number;
  discountPct?: number;
}): number {
  if (totalDeliveries < threshold) return 0;
  return Math.round(baseAmount * (discountPct / 100) * 100) / 100;
}

export function isStandardDeliveryDay(date: Date): boolean {
  const day = date.getDay(); // 0 = Sunday, 3 = Wednesday
  return day === 0 || day === 3;
}
