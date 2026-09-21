/**
 * Staff roles and what each may do.
 *
 * One role per person, fixed permissions, defined here so that the API's
 * `requirePermission` and the admin dashboard's navigation read the same table.
 * The dashboard hiding a button is a courtesy; the API refusing the request is
 * the rule.
 *
 * `profiles.role = admin` still means "is staff". `profiles.staff_role` says
 * which kind. An admin row with no staff role has no permissions at all — the
 * safe reading of a half-created account.
 */
export const STAFF_ROLES = [
  {
    key: "owner",
    label: "Owner",
    description: "Everything, including adding and removing staff.",
  },
  {
    key: "accountant",
    label: "Accountant",
    description: "Payments, pricing and the money side of orders. Cannot change orders or users.",
  },
  {
    key: "claims_officer",
    label: "Claims officer",
    description: "Disputes and failed orders: issues refunds and closes stuck deliveries.",
  },
  {
    key: "logistics_head",
    label: "Logistics head",
    description: "Riders, verification, checkpoints, and pausing orders when operations need it.",
  },
  {
    key: "support",
    label: "Support / Ops",
    description: "Looks people up, bans and unbans, approves shops and beta testers. No money actions.",
  },
  {
    key: "auditor",
    label: "Auditor",
    description: "Reads everything, including the full audit log. Changes nothing.",
  },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]["key"];

export const STAFF_ROLE_KEYS = STAFF_ROLES.map((r) => r.key) as readonly StaffRole[];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLE_KEYS as readonly string[]).includes(value);
}

export function staffRoleLabel(role: string | null | undefined): string {
  return STAFF_ROLES.find((r) => r.key === role)?.label ?? "No staff role";
}

export const PERMISSIONS = [
  "ops.read",
  "pii.read",
  "orders.force_deliver",
  "refunds.issue",
  "payments.read",
  "payments.sweep",
  "config.write",
  "riders.verify",
  "checkpoints.manage",
  "switches.manage",
  "flags.manage",
  "users.ban",
  "users.role",
  "shops.manage",
  "suggestions.manage",
  "beta.review",
  "audit.read_all",
  "staff.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  owner: ALL,
  accountant: ["ops.read", "payments.read", "payments.sweep", "config.write"],
  claims_officer: ["ops.read", "pii.read", "payments.read", "refunds.issue", "orders.force_deliver"],
  logistics_head: ["ops.read", "pii.read", "riders.verify", "checkpoints.manage", "switches.manage", "orders.force_deliver"],
  support: ["ops.read", "pii.read", "users.ban", "users.role", "shops.manage", "suggestions.manage", "beta.review"],
  auditor: ["ops.read", "pii.read", "payments.read", "audit.read_all"],
};

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: string | null | undefined): Permission[] {
  return isStaffRole(role) ? [...ROLE_PERMISSIONS[role]] : [];
}
