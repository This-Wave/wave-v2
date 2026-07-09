import {
  DEFAULT_DELIVERY_FEE_GHS,
  DEFAULT_LOYALTY_DISCOUNT_PCT,
  DEFAULT_LOYALTY_THRESHOLD,
  DEFAULT_SPECIAL_ORDER_LEAD_HOURS,
  DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT,
} from "@wave/shared";

export const CUTOFF_HOUR = 12;
const RUN_DAYS = [0, 3]; // Sunday, Wednesday

// Display-only helpers mirroring the server's pricing rules in
// packages/api/src/modules/orders/discount.ts — the server always
// recalculates and is the only source of truth for the actual charge.

export function nextRunCutoff(now: Date = new Date()): Date {
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(CUTOFF_HOUR, 0, 0, 0);
    if (RUN_DAYS.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  return now;
}

export function isCutoffPassedToday(now: Date = new Date()): boolean {
  return RUN_DAYS.includes(now.getDay()) && now.getHours() >= CUTOFF_HOUR;
}

export function upcomingRunDays(now: Date = new Date(), count = 2): Date[] {
  const results: Date[] = [];
  for (let offset = 0; results.length < count && offset < 30; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(0, 0, 0, 0);
    const cutoff = new Date(candidate);
    cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
    if (RUN_DAYS.includes(candidate.getDay()) && cutoff.getTime() > now.getTime()) {
      results.push(candidate);
    }
  }
  return results;
}

export function earliestSpecialOrderDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + DEFAULT_SPECIAL_ORDER_LEAD_HOURS * 60 * 60 * 1000);
}

export function estimateOrderTotal(input: {
  itemPrice: number;
  isSpecialOrder: boolean;
  completedDeliveries: number;
}) {
  const deliveryFee = DEFAULT_DELIVERY_FEE_GHS;
  const surchargePct = input.isSpecialOrder ? DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT : 0;
  const discountPct = input.completedDeliveries >= DEFAULT_LOYALTY_THRESHOLD ? DEFAULT_LOYALTY_DISCOUNT_PCT : 0;

  const surchargeAmount = (deliveryFee * surchargePct) / 100;
  const discountAmount = (deliveryFee * discountPct) / 100;
  const total = input.itemPrice + deliveryFee + surchargeAmount - discountAmount;

  return { deliveryFee, surchargePct, discountPct, surchargeAmount, discountAmount, total };
}

export function formatGhs(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDayChip(date: Date): { dayLabel: string; dateLabel: string } {
  return {
    dayLabel: DAY_ABBR[date.getDay()],
    dateLabel: `${date.getDate()} ${MONTH_ABBR[date.getMonth()]}`,
  };
}

export function formatFullDay(date: Date): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${dayNames[date.getDay()]}, ${date.getDate()} ${MONTH_ABBR[date.getMonth()]}`;
}
