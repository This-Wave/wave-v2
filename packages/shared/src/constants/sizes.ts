/**
 * Package sizes (owner 2026-11-27): three, plain names, no weights or examples.
 * Price = the size's price + the pickup zone's add-on. Prices live in
 * platform_config (`size_price_<key>`); these are only the fallback for an
 * unseeded row.
 */
export const PACKAGE_SIZES = ["small", "medium", "large"] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];

export interface SizeInfo {
  key: PackageSize;
  label: string;
  defaultPrice: number;
}

export const SIZE_INFO: readonly SizeInfo[] = [
  { key: "small", label: "Small", defaultPrice: 50 },
  { key: "medium", label: "Medium", defaultPrice: 60 },
  { key: "large", label: "Large", defaultPrice: 70 },
];

/**
 * The four names used before 2026-11-27. An app bundle cached on a phone can
 * still send these, so the API maps them onto the new three rather than
 * refusing the order. Tide (the old 150 tier) has no equivalent and maps to
 * the largest size.
 */
export const LEGACY_SIZE_NAMES: Record<string, PackageSize> = {
  ripple: "small",
  wave: "medium",
  swell: "large",
  tide: "large",
};

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
