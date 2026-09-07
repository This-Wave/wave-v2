import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
  DEFAULT_RIDER_EARNING_PCT_BY_TYPE,
  RIDER_EARNING_PCT_KEY,
  type RiderType,
} from "@wave/shared";

/**
 * The rate a rider is paid, resolved from config with the constant as default.
 *
 * Extracted from `recordRiderEarning` so the earnings *preview* on the feed and
 * the earning actually written on delivery come from one implementation. A
 * preview that quotes a different percentage from the one that eventually pays
 * is worse than no preview — a rider who feels short-changed once stops
 * trusting the number, and the number exists to get them to accept jobs.
 */
export async function riderEarningPct(args: {
  fastify: FastifyInstance;
  log?: FastifyBaseLogger;
  riderType: RiderType | null | undefined;
}): Promise<number> {
  // A rider with no type set is paid the student rate rather than nothing: the
  // two are identical by default, and a data gap should not cost a real person
  // a real delivery.
  const riderType: RiderType = args.riderType ?? "student";
  const key = RIDER_EARNING_PCT_KEY[riderType];

  const row = await args.fastify.prisma.platformConfig.findUnique({ where: { key } });
  const parsed = Number(row?.value);

  // A missing row is expected — the constant is the default. An unparseable one
  // is an admin typo, and quietly previewing 0 would be worse than saying so.
  if (row && !Number.isFinite(parsed)) {
    args.log?.error(
      { key, value: row.value },
      `platform_config.${key} is not a number — falling back to the default`,
    );
  }

  return Number.isFinite(parsed) ? parsed : DEFAULT_RIDER_EARNING_PCT_BY_TYPE[riderType];
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** What this delivery pays, given the fee and the rate. */
export function riderEarningFor(deliveryFee: number, pct: number): number {
  return round2((deliveryFee * pct) / 100);
}
