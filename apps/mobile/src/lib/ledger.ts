import type { Order } from "../types";
import { formatGhs } from "./pricing";

/**
 * Turns a persisted order into the lines of a cost breakdown.
 *
 * ⚠️ The reason this module exists.
 *
 * `Order.discountApplied` and `Order.surchargeApplied` are **percentages**, not
 * amounts, despite names that read like amounts. The server's own arithmetic
 * settles it (packages/api/src/modules/orders/discount.ts):
 *
 *     adjustedFee = deliveryFee * (1 + surchargePct/100) * (1 - discountPct/100)
 *
 * Before this module, the order-detail screen rendered those columns straight
 * through a currency formatter, so a 20% loyalty discount on a GH₵5 delivery fee
 * — worth GH₵1.00 — was shown to the student as **−GH₵20.00**, and the
 * breakdown could not be reconciled with the total they actually paid.
 *
 * Every consumer must go through here. Never format `discountApplied` directly.
 */

export interface LedgerLine {
  label: string;
  /** Pre-formatted, sign included. */
  value: string;
  kind: "item" | "fee" | "surcharge" | "discount";
}

export interface OrderLedger {
  lines: LedgerLine[];
  totalLabel: string;
  total: number;
  /**
   * True when the lines sum to the persisted total (within a cent). False means
   * the row itself is inconsistent — seeded rows predating the current pricing
   * rules do this — and the caller should show the total alone rather than a
   * breakdown that visibly does not add up.
   */
  reconciles: boolean;
}

export function buildOrderLedger(order: Order): OrderLedger {
  const itemPrice = Number(order.itemPrice ?? 0);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const surchargePct = Number(order.surchargeApplied ?? 0);
  const discountPct = Number(order.discountApplied ?? 0);
  const total = Number(order.totalAmount ?? 0);

  // Derive cash from the percentage against the delivery fee — the only base
  // the server ever applies them to.
  const surchargeAmount = round2((deliveryFee * surchargePct) / 100);
  const discountAmount = round2((deliveryFee * discountPct) / 100);

  const lines: LedgerLine[] = [
    {
      label: "Items",
      value: itemPrice > 0 ? formatGhs(itemPrice) : "Paid at pickup",
      kind: "item",
    },
    { label: "Delivery", value: formatGhs(deliveryFee), kind: "fee" },
  ];

  if (surchargeAmount > 0) {
    lines.push({
      label: `Special order (+${trimPct(surchargePct)}%)`,
      value: `+${formatGhs(surchargeAmount)}`,
      kind: "surcharge",
    });
  }

  if (discountAmount > 0) {
    lines.push({
      label: `Loyalty discount (−${trimPct(discountPct)}% of delivery)`,
      value: `−${formatGhs(discountAmount)}`,
      kind: "discount",
    });
  }

  const computed = round2(itemPrice + deliveryFee + surchargeAmount - discountAmount);

  return {
    lines,
    total,
    totalLabel: order.paidAt ? "Total paid" : "Total",
    reconciles: Math.abs(computed - total) < 0.01,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function trimPct(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}
