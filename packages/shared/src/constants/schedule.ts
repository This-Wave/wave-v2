/**
 * The Wave schedule — the one implementation.
 *
 * This used to live only in `apps/mobile/src/lib/pricing.ts`, which was fine
 * while nothing else needed it. The cutoff reminder is a server job, and a
 * reminder that fires at a different moment than the countdown the student is
 * looking at would be worse than no reminder at all. So the schedule moved
 * here and the app re-exports it.
 *
 * **Timezone.** Every function works in the host's local time. Ghana is UTC+0
 * with no daylight saving, and Render runs UTC, so "noon" is the same noon in
 * both places. That is a real assumption rather than an accident: if Wave ever
 * runs somewhere east or west of Accra, these need a zone passed in.
 */

/** Ordering closes at noon on the delivery day. */
export const CUTOFF_HOUR = 12;

/**
 * Every day of the week, as `Date#getDay` numbers (since 2026-11-04; it was
 * Sunday and Wednesday only). Kept as a list rather than deleted so a day can
 * be taken out again by editing one line.
 *
 * Typed `readonly number[]` rather than the literal tuple: callers test
 * membership with `RUN_DAYS.includes(date.getDay())`, and a literal tuple
 * makes that a type error because `getDay()` returns a plain number.
 */
export const RUN_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

const DAY_ENUM = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/** The `deliveryDay` enum value for a date, e.g. `"monday"`. */
export function deliveryDayOf(date: Date): (typeof DAY_ENUM)[number] {
  return DAY_ENUM[date.getDay()] ?? "sunday";
}

/**
 * Has ordering for `day` already closed at `now`? True for any day before
 * today and for today from noon on. Compared on UTC calendar days because
 * the API parses `YYYY-MM-DD` as UTC midnight and Ghana is UTC+0.
 */
export function isDayClosed(day: Date, now: Date = new Date()): boolean {
  const dayUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (dayUtc < todayUtc) return true;
  return dayUtc === todayUtc && now.getUTCHours() >= CUTOFF_HOUR;
}

/** The next moment ordering closes, strictly in the future. */
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

/** The next `count` delivery days whose cutoff has not passed, at midnight. */
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

/** Milliseconds until ordering closes for the next Wave. */
export function msUntilCutoff(now: Date = new Date()): number {
  return nextRunCutoff(now).getTime() - now.getTime();
}
