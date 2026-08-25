// Defaults only — the source of truth at runtime is the `platform_config` table.
export const DEFAULT_DELIVERY_FEE_GHS = 20.0;
export const DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT = 30;
export const DEFAULT_LOYALTY_DISCOUNT_PCT = 20;
export const DEFAULT_LOYALTY_THRESHOLD = 6;
export const DEFAULT_SPECIAL_ORDER_LEAD_HOURS = 24;

/**
 * Ceiling on the goods total a rider may record for a suggested-shop order.
 *
 * A `shop_pickup` is charged twice: the delivery fee up front, then whatever the
 * rider says they paid at the till — and that second charge is taken from the
 * student automatically. The only guard used to be a GHS 10,000 per-unit cap in
 * the Zod schema, which across a 20-line basket permits a charge in the
 * millions. One mistyped amount is a real charge to a student's MoMo wallet.
 *
 * GHS 1,000 is 50x the base delivery fee — generous for a campus errand, and
 * far below anything that could be a typo or a fraud. Overridable at runtime via
 * the `goods_cost_max_ghs` row in `platform_config` (review 11-campus, M2).
 */
export const DEFAULT_GOODS_COST_MAX_GHS = 1000;

export const STANDARD_DELIVERY_DAYS = ["sunday", "wednesday"] as const;

export const PROFILE_ROLES = ["student", "rider", "shop_owner", "admin"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

/** Roles a user may pick at self-serve signup — never `admin`. */
export const SELF_SERVE_PROFILE_ROLES = ["student", "rider", "shop_owner"] as const;
export type SelfServeProfileRole = (typeof SELF_SERVE_PROFILE_ROLES)[number];

export const PRODUCT_STATUSES = ["active", "out_of_stock", "not_serving"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending",
  "payment_pending",
  "confirmed",
  "rider_assigned",
  "en_route",
  "at_checkpoint",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ["buy_for_me", "pickup", "shop_pickup"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const SUGGESTION_STATUSES = ["pending", "onboarded", "rejected"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** A basket can't be unbounded — this is a campus runner on a motorbike. */
export const MAX_ORDER_ITEMS = 20;
export const MAX_ITEM_QUANTITY = 20;

/**
 * Collapses a shop name to its ranking key: lowercase, punctuation stripped,
 * whitespace collapsed. "MELCOM Berekuso!" and "melcom  berekuso" are one place.
 *
 * Lives in shared because the API normalizes on write and the admin dashboard
 * groups on the result — if the two ever disagreed, the demand ranking would
 * silently split one shop across several rows.
 */
export function normalizeShopName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Punctuation becomes a SPACE, not nothing. Deleting it would make
      // "Melcom-Berekuso" normalize to "melcomberekuso", which fails to match
      // the "Melcom Berekuso" everyone else types — and a hyphen is one of the
      // commonest ways people write a shop and its town together.
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export const DELIVERY_DAYS = ["sunday", "wednesday", "special"] as const;
export type DeliveryDay = (typeof DELIVERY_DAYS)[number];
