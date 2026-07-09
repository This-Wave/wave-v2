// Defaults only — the source of truth at runtime is the `platform_config` table.
export const DEFAULT_DELIVERY_FEE_GHS = 5.0;
export const DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT = 30;
export const DEFAULT_LOYALTY_DISCOUNT_PCT = 20;
export const DEFAULT_LOYALTY_THRESHOLD = 6;
export const DEFAULT_SPECIAL_ORDER_LEAD_HOURS = 24;

export const STANDARD_DELIVERY_DAYS = ["sunday", "wednesday"] as const;

export const PROFILE_ROLES = ["student", "rider", "shop_owner", "admin"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

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

export const DELIVERY_DAYS = ["sunday", "wednesday", "special"] as const;
export type DeliveryDay = (typeof DELIVERY_DAYS)[number];
