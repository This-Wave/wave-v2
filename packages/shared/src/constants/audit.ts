/**
 * The audit log's vocabulary, shared so the API that writes events and the
 * admin panel that filters them cannot drift apart.
 *
 * `category` is the coarse bucket the panel filters on; `action` is the precise
 * dotted name ("order.refunded"). Categories are a closed list, actions are
 * open — a new route can log a new action without a shared release, but it
 * must land in one of these buckets.
 */
export const AUDIT_CATEGORIES = [
  { key: "auth", label: "Sign-in & accounts" },
  { key: "order", label: "Orders" },
  { key: "payment", label: "Payments" },
  { key: "refund", label: "Refunds" },
  { key: "user", label: "Users" },
  { key: "rider", label: "Riders" },
  { key: "shop", label: "Shops & products" },
  { key: "suggestion", label: "Shop suggestions" },
  { key: "basket", label: "Group baskets" },
  { key: "checkpoint", label: "Checkpoints" },
  { key: "config", label: "Pricing & config" },
  { key: "flag", label: "Feature flags" },
  { key: "switch", label: "Service switches" },
  { key: "beta", label: "Beta programme" },
  { key: "staff", label: "Staff" },
  { key: "pii", label: "Sensitive data viewed" },
  { key: "security", label: "Denied & suspicious" },
  { key: "system", label: "System jobs" },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["key"];

export const AUDIT_CATEGORY_KEYS = AUDIT_CATEGORIES.map((c) => c.key) as readonly AuditCategory[];

export function isAuditCategory(value: string): value is AuditCategory {
  return (AUDIT_CATEGORY_KEYS as readonly string[]).includes(value);
}

export const AUDIT_OUTCOMES = ["success", "denied", "failed"] as const;
export type AuditOutcomeKey = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_ACTOR_TYPES = ["user", "staff", "system", "webhook", "anonymous"] as const;
export type AuditActorTypeKey = (typeof AUDIT_ACTOR_TYPES)[number];

/** One row as the admin panel receives it. */
export interface AuditEventDto {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorType: AuditActorTypeKey;
  actorRole: string | null;
  actorStaffRole: string | null;
  actorName: string | null;
  action: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  universityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  outcome: AuditOutcomeKey;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
}
