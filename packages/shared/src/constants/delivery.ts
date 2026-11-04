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
/** Where the company brings every order for packing. Shown on the company's list. */
export const HUB_ADDRESS_KEY = "hub_address";
export const DEFAULT_HUB_ADDRESS = "the Wave packing point";

/**
 * The stages of an order that goes through Wave's packing point, in the words
 * the student sees. Mapped onto the existing statuses so nothing downstream
 * (refunds, cancellation, force-deliver) needs a new state:
 *  - rider_assigned — the company is collecting it from the shop
 *  - en_route       — it has reached Wave and is being packed
 *  - at_checkpoint  — packed in a Wave bag and waiting at the checkpoint
 */
export const HUB_STAGE_COPY = {
  rider_assigned: { title: "Collecting your order", body: "We're picking it up from the shop." },
  en_route: { title: "Packing your order", body: "It's at Wave, going into your bag." },
  at_checkpoint: { title: "Ready for you", body: "Your Wave bag is at {checkpoint}." },
} as const;
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
