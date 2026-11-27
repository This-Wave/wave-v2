/**
 * Package sizes (v7, owner 2026-11-26). Price = the size's price + the pickup
 * zone's add-on. Names are Wave's own; prices live in platform_config
 * (`size_price_<key>`) and these are only the fallback for an unseeded row.
 */
export const PACKAGE_SIZES = ["ripple", "wave", "swell", "tide"] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];

export interface SizeInfo {
  key: PackageSize;
  label: string;
  examples: string;
  maxKg: number;
  defaultPrice: number;
}

export const SIZE_INFO: readonly SizeInfo[] = [
  { key: "ripple", label: "Ripple", examples: "Documents, a charger, small items", maxKg: 3, defaultPrice: 50 },
  { key: "wave", label: "Wave", examples: "Clothes, shoes, a laptop", maxKg: 8, defaultPrice: 60 },
  { key: "swell", label: "Swell", examples: "Food trays, gift boxes, small appliances", maxKg: 15, defaultPrice: 70 },
  { key: "tide", label: "Tide", examples: "Wholesale cartons, home appliances", maxKg: 25, defaultPrice: 150 },
];

export function sizeConfigKey(size: PackageSize): `size_price_${PackageSize}` {
  return `size_price_${size}`;
}

/**
 * The one delivery-fee rule. `sizePrice` is null when the order has no size
 * (an older app, or a suggested-shop order): the base fee stands in, which is
 * what every order cost before sizes existed. The zone add-on is 0 on campus.
 */
export function deliveryFeeFor(args: { sizePrice: number | null; baseFee: number; zoneAddOn: number }): number {
  return Math.round(((args.sizePrice ?? args.baseFee) + args.zoneAddOn) * 100) / 100;
}
