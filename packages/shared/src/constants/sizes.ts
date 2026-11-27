/**
 * Package sizes (owner 2026-11-27): four, our own names, no weights or examples.
 * Price = the size's price + the pickup zone's add-on. Prices live in
 * platform_config (`size_price_<key>`); these are only the fallback for an
 * unseeded row.
 */
export const PACKAGE_SIZES = ["ripple", "wave", "swell", "tide"] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];

export interface SizeInfo {
  key: PackageSize;
  label: string;
  defaultPrice: number;
}

export const SIZE_INFO: readonly SizeInfo[] = [
  { key: "ripple", label: "Ripple", defaultPrice: 60 },
  { key: "wave", label: "Wave", defaultPrice: 70 },
  { key: "swell", label: "Swell", defaultPrice: 80 },
  { key: "tide", label: "Tide", defaultPrice: 160 },
];

/**
 * Names used for a few hours on 2026-11-27 (Small / Medium / Large). An app
 * bundle cached on a phone can still send them, so the API maps them back
 * rather than refusing the order.
 */
export const LEGACY_SIZE_NAMES: Record<string, PackageSize> = {
  small: "ripple",
  medium: "wave",
  large: "swell",
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
