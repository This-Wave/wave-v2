/**
 * Every feature flag the platform knows about.
 *
 * The list lives here, in shared, so the API, the admin dashboard and the app
 * cannot disagree about what exists. A flag missing from this list is not a
 * flag: the admin will not offer it and the resolver will not return it, which
 * is what stops a typo in a database row quietly enabling nothing.
 *
 * **Default is always `false`.** A feature nobody has switched on is off — on a
 * fresh database, on a database that has never heard of the key, and on a
 * client that failed to fetch. That property is the whole point: it is what
 * makes it safe to merge a half-finished feature to `develop`.
 *
 * Flags are a *product* switch, never a security boundary. The client reads
 * them to decide what to draw; the API checks them again before doing anything,
 * because a flag a client can read is a flag a client can lie about.
 */
export const FEATURE_FLAGS = [
  {
    key: "group_orders",
    label: "Group orders",
    description:
      "One student starts a basket, friends add items with a code, the starter pays once.",
  },
  {
    key: "reorder",
    label: "One-tap reorder",
    description: "“Order this again” on a delivered order, which rebuilds the basket.",
  },
  {
    key: "cutoff_reminder",
    label: "Cutoff reminder",
    description:
      "Push a couple of hours before a Wave closes, to students who have ordered before.",
  },
  {
    key: "abandoned_nudge",
    label: "Abandoned order nudge",
    description: "Push a student back to an order they left at the payment step.",
  },
  {
    key: "cutoff_suggestion",
    label: "Near-cutoff suggestions",
    description: "Surface the cheapest shops on this Wave when the cutoff is close.",
  },
  {
    key: "loyalty_progress",
    label: "Loyalty progress",
    description: "Show how many deliveries remain before the delivery discount applies.",
  },
  {
    key: "rider_earnings_preview",
    label: "Rider earnings preview",
    description: "Show a rider what a run pays before they accept it.",
  },
  {
    key: "referrals",
    label: "Referral credit",
    description: "A free delivery for both sides of a referral. Needs abuse controls first.",
  },
  {
    key: "browse_signed_out",
    label: "Browse before signing in",
    description: "Let a student browse shops and build a basket before the phone check.",
  },
] as const;

export type FeatureKey = (typeof FEATURE_FLAGS)[number]["key"];

export const FEATURE_KEYS = FEATURE_FLAGS.map((f) => f.key) as readonly FeatureKey[];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

/** Every flag off — the shape the app falls back to when the fetch fails. */
export function allFeaturesOff(): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<
    FeatureKey,
    boolean
  >;
}

/**
 * Resolve one flag from the rows that exist.
 *
 * A row scoped to the university wins over the global row, and the global row
 * wins over the built-in `false`. Passing rows for other universities is safe —
 * they are ignored — so callers can hand over an unfiltered fetch.
 */
export function resolveFeature(
  key: FeatureKey,
  universityId: string | null | undefined,
  rows: { key: string; universityId: string | null; enabled: boolean }[],
): boolean {
  const forKey = rows.filter((r) => r.key === key);
  const scoped = universityId
    ? forKey.find((r) => r.universityId === universityId)
    : undefined;
  if (scoped) return scoped.enabled;

  const global = forKey.find((r) => r.universityId === null);
  return global?.enabled ?? false;
}

export function resolveFeatures(
  universityId: string | null | undefined,
  rows: { key: string; universityId: string | null; enabled: boolean }[],
): Record<FeatureKey, boolean> {
  return Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, resolveFeature(k, universityId, rows)]),
  ) as Record<FeatureKey, boolean>;
}
