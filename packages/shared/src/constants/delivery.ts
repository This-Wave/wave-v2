/**
 * Who runs deliveries.
 *
 *  - `independent` — riders sign up themselves, Wave checks their ID, and they
 *    claim jobs from an open feed. Paid a share of each fee (`rider_earning_pct`).
 *  - `company` — one contracted delivery company. Its dispatcher assigns each
 *    order to one of its riders from a run sheet; riders see only "Assigned to
 *    you". The company is paid on a statement, not per rider.
 *
 * Stored as `platform_config.delivery_mode`, with the active company in
 * `delivery_company_id`. Switching back is one setting; nothing is deleted.
 */
export const DELIVERY_MODES = ["independent", "company"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_MODE_KEY = "delivery_mode";
export const DELIVERY_COMPANY_KEY = "delivery_company_id";
export const DEFAULT_DELIVERY_MODE: DeliveryMode = "independent";

export function isDeliveryMode(value: unknown): value is DeliveryMode {
  return typeof value === "string" && (DELIVERY_MODES as readonly string[]).includes(value);
}

export const COMPANY_RATE_TYPES = ["flat", "percent"] as const;
export type CompanyRateType = (typeof COMPANY_RATE_TYPES)[number];

/** Order statuses a run sheet shows: everything paid and not yet finished, plus delivered. */
export const RUN_SHEET_STATUSES = [
  "confirmed",
  "rider_assigned",
  "en_route",
  "at_checkpoint",
  "delivered",
] as const;

/**
 * What one delivered order owes the company under its rate, or null when no
 * rate is set yet (the contract is unsigned; the statement shows counts only).
 */
export function companyPayFor(
  deliveryFee: number,
  rate: { rateType: CompanyRateType | null; rateValue: number | null },
): number | null {
  if (!rate.rateType || rate.rateValue === null || !Number.isFinite(rate.rateValue)) return null;
  const raw = rate.rateType === "flat" ? rate.rateValue : (deliveryFee * rate.rateValue) / 100;
  return Math.round(raw * 100) / 100;
}
