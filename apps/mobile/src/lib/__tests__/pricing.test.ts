import { describe, expect, test } from "vitest";
import {
  CUTOFF_HOUR,
  classifyMonth,
  deliveryDayFor,
  estimateOrderTotal,
  formatGhs,
  formatGhsCompact,
  isCutoffPassedToday,
  isStandardRunDay,
  nextRunCutoff,
  toApiDate,
  upcomingRunDays,
} from "../pricing";
import {
  DEFAULT_DELIVERY_FEE_GHS,
  DEFAULT_LOYALTY_DISCOUNT_PCT,
  DEFAULT_LOYALTY_THRESHOLD,
  DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT,
} from "@wave/shared";

/**
 * The mobile app had no tests at all (review 02-qa-engineer, H1). This covers
 * the pure logic that decides what a student is shown and what date the order
 * is booked for — the parts that can be wrong quietly.
 *
 * All dates are constructed with `new Date(y, m, d, h)` (local), matching how
 * the calendar itself builds them.
 */
// 2026-09-06 is a Sunday; 2026-09-09 is a Wednesday.
const SUNDAY_9AM = new Date(2026, 8, 6, 9, 0, 0);
const SUNDAY_1PM = new Date(2026, 8, 6, 13, 0, 0);
const MONDAY_9AM = new Date(2026, 8, 7, 9, 0, 0);

describe("run days", () => {
  test("Sunday and Wednesday are the standing run days", () => {
    expect(isStandardRunDay(new Date(2026, 8, 6))).toBe(true); // Sun
    expect(isStandardRunDay(new Date(2026, 8, 9))).toBe(true); // Wed
    expect(isStandardRunDay(new Date(2026, 8, 7))).toBe(false); // Mon
  });

  test("the cutoff has not passed on a run-day morning", () => {
    expect(isCutoffPassedToday(SUNDAY_9AM)).toBe(false);
  });

  test("the cutoff has passed on a run-day afternoon", () => {
    expect(isCutoffPassedToday(SUNDAY_1PM)).toBe(true);
  });

  test("a non-run day is never 'past cutoff'", () => {
    // Monday has no cutoff to pass — it is not a Wave day at all.
    expect(isCutoffPassedToday(new Date(2026, 8, 7, 23, 0))).toBe(false);
  });

  test("exactly noon counts as passed", () => {
    expect(isCutoffPassedToday(new Date(2026, 8, 6, CUTOFF_HOUR, 0))).toBe(true);
  });
});

describe("nextRunCutoff", () => {
  test("returns today's noon when asked in the morning of a run day", () => {
    const cutoff = nextRunCutoff(SUNDAY_9AM);
    expect(cutoff.getDate()).toBe(6);
    expect(cutoff.getHours()).toBe(CUTOFF_HOUR);
  });

  test("skips to Wednesday once Sunday noon has passed", () => {
    const cutoff = nextRunCutoff(SUNDAY_1PM);
    expect(cutoff.getDay()).toBe(3);
    expect(cutoff.getDate()).toBe(9);
  });

  test("is always strictly in the future", () => {
    for (const now of [SUNDAY_9AM, SUNDAY_1PM, MONDAY_9AM]) {
      expect(nextRunCutoff(now).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe("upcomingRunDays", () => {
  test("returns the next two run days, in order", () => {
    const [first, second] = upcomingRunDays(MONDAY_9AM, 2);
    expect(first!.getDay()).toBe(3); // Wed 9th
    expect(second!.getDay()).toBe(0); // Sun 13th
    expect(second!.getTime()).toBeGreaterThan(first!.getTime());
  });

  test("excludes today once its cutoff has passed", () => {
    const days = upcomingRunDays(SUNDAY_1PM, 2);
    expect(days[0]!.getDate()).not.toBe(6);
  });

  test("includes today while its cutoff is still ahead", () => {
    const days = upcomingRunDays(SUNDAY_9AM, 2);
    expect(days[0]!.getDate()).toBe(6);
  });
});

describe("estimateOrderTotal", () => {
  test("a plain order is items plus the flat delivery fee", () => {
    const r = estimateOrderTotal({ itemPrice: 50, isSpecialOrder: false, completedDeliveries: 0 });
    expect(r.deliveryFee).toBe(DEFAULT_DELIVERY_FEE_GHS);
    expect(r.total).toBe(50 + DEFAULT_DELIVERY_FEE_GHS);
    expect(r.discountPct).toBe(0);
    expect(r.surchargePct).toBe(0);
  });

  test("the special-order surcharge applies to the delivery fee only", () => {
    const r = estimateOrderTotal({ itemPrice: 100, isSpecialOrder: true, completedDeliveries: 0 });
    expect(r.surchargePct).toBe(DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT);
    expect(r.surchargeAmount).toBe(
      (DEFAULT_DELIVERY_FEE_GHS * DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT) / 100,
    );
    // Never a percentage of the goods.
    expect(r.total).toBe(100 + DEFAULT_DELIVERY_FEE_GHS + r.surchargeAmount);
  });

  test("loyalty discounts the delivery fee only, never the items", () => {
    // CLAUDE.md is explicit: 20% off the DELIVERY FEE ONLY after 6 deliveries.
    const r = estimateOrderTotal({
      itemPrice: 200,
      isSpecialOrder: false,
      completedDeliveries: DEFAULT_LOYALTY_THRESHOLD,
    });
    expect(r.discountPct).toBe(DEFAULT_LOYALTY_DISCOUNT_PCT);
    expect(r.discountAmount).toBe(
      (DEFAULT_DELIVERY_FEE_GHS * DEFAULT_LOYALTY_DISCOUNT_PCT) / 100,
    );
    expect(r.total).toBe(200 + DEFAULT_DELIVERY_FEE_GHS - r.discountAmount);
  });

  test("the discount starts exactly at the threshold, not before", () => {
    const below = estimateOrderTotal({
      itemPrice: 0,
      isSpecialOrder: false,
      completedDeliveries: DEFAULT_LOYALTY_THRESHOLD - 1,
    });
    const at = estimateOrderTotal({
      itemPrice: 0,
      isSpecialOrder: false,
      completedDeliveries: DEFAULT_LOYALTY_THRESHOLD,
    });
    expect(below.discountPct).toBe(0);
    expect(at.discountPct).toBe(DEFAULT_LOYALTY_DISCOUNT_PCT);
  });

  test("surcharge and discount can both apply and partly cancel", () => {
    const r = estimateOrderTotal({
      itemPrice: 0,
      isSpecialOrder: true,
      completedDeliveries: DEFAULT_LOYALTY_THRESHOLD,
    });
    expect(r.total).toBe(DEFAULT_DELIVERY_FEE_GHS + r.surchargeAmount - r.discountAmount);
  });
});

describe("currency formatting", () => {
  test("formatGhs always keeps two decimals", () => {
    expect(formatGhs(163)).toBe("GH₵163.00");
    expect(formatGhs(163.5)).toBe("GH₵163.50");
  });

  test("formatGhsCompact drops decimals only when the amount is whole", () => {
    expect(formatGhsCompact(163)).toBe("GH₵163");
    expect(formatGhsCompact(163.5)).toBe("GH₵163.50");
  });

  test("carries no emoji and no currency ambiguity", () => {
    expect(formatGhs(20)).toMatch(/^GH₵/);
  });
});

describe("deliveryDayFor", () => {
  test("maps a Sunday and a Wednesday to their names", () => {
    expect(deliveryDayFor(new Date(2026, 8, 6), false)).toBe("sunday");
    expect(deliveryDayFor(new Date(2026, 8, 9), false)).toBe("wednesday");
  });

  test("a special order is always 'special', whatever the weekday", () => {
    expect(deliveryDayFor(new Date(2026, 8, 6), true)).toBe("special");
    expect(deliveryDayFor(new Date(2026, 8, 7), true)).toBe("special");
  });
});

describe("toApiDate", () => {
  test("formats local calendar date as YYYY-MM-DD", () => {
    expect(toApiDate(new Date(2026, 8, 6))).toBe("2026-09-06");
  });

  test("zero-pads month and day", () => {
    expect(toApiDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  test("does not shift the day for a local-midnight date", () => {
    // The regression this function exists for: `toISOString().slice(0,10)` on
    // local midnight east of Greenwich yields the PREVIOUS day, silently
    // booking the wrong Wave. Ghana is UTC+0 so the pilot would never see it.
    const localMidnight = new Date(2026, 8, 14);
    expect(toApiDate(localMidnight)).toBe("2026-09-14");
  });

  test("produces a value the API's date schema accepts", () => {
    // `scheduledDate: z.string().date()` rejects a full ISO datetime — sending
    // one 400'd every order placed from the app.
    expect(toApiDate(new Date(2026, 8, 6, 15, 30))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toApiDate(new Date(2026, 8, 6, 15, 30))).not.toContain("T");
  });
});

describe("classifyMonth", () => {
  const NOW = new Date(2026, 8, 7, 9, 0); // Mon 7 Sep 2026, 9am
  const month = classifyMonth(new Date(2026, 8, 1), NOW);
  const on = (day: number) => month.find((d) => d.date.getDate() === day)!;

  test("returns every day of the month", () => {
    expect(month).toHaveLength(30); // September
  });

  test("past days are disabled", () => {
    expect(on(1).kind).toBe("disabled");
    expect(on(6).kind).toBe("disabled"); // yesterday, a Sunday
  });

  test("an upcoming run day is standard", () => {
    expect(on(9).kind).toBe("standard"); // Wed
    expect(on(13).kind).toBe("standard"); // Sun
  });

  test("a non-run day beyond the lead time is a rush order", () => {
    expect(on(10).kind).toBe("rush"); // Thu
  });

  test("a day inside the lead time is disabled", () => {
    // Tue the 8th starts less than 24h after Mon 9am.
    expect(on(8).kind).toBe("disabled");
  });

  test("every standard day is a real run day", () => {
    for (const d of month.filter((d) => d.kind === "standard")) {
      expect(isStandardRunDay(d.date)).toBe(true);
    }
  });

  test("no rush day falls on a run day", () => {
    // A run day is either standard or disabled — never surcharged.
    for (const d of month.filter((d) => d.kind === "rush")) {
      expect(isStandardRunDay(d.date)).toBe(false);
    }
  });

  test("a run day whose noon has passed is disabled, not standard", () => {
    const sundayAfternoon = classifyMonth(new Date(2026, 8, 1), SUNDAY_1PM);
    expect(sundayAfternoon.find((d) => d.date.getDate() === 6)!.kind).toBe("disabled");
  });
});
