import type { AuditCategory } from "@wave/shared";

/**
 * What each mutating route means, for the audit log's safety net.
 *
 * `plugins/audit.ts` writes one event for every POST/PUT/PATCH/DELETE that a
 * handler did not already describe itself. This table turns
 * `PATCH /v1/orders/:id/accept` into `order.accepted` on entity `order <id>`,
 * so the log reads as what happened rather than as HTTP.
 *
 * A route missing from here is still logged — as `http.patch` in the category
 * its path prefix suggests — so a new route can never escape the log by being
 * forgotten; it just reads less nicely until someone adds a line.
 *
 * `body` lists the request-body fields worth keeping as metadata. Everything
 * still passes through `redactForAudit`, so listing a field here is safe even
 * if it later turns out to hold something sensitive.
 */
export interface RouteAudit {
  action: string;
  category: AuditCategory;
  entityType?: string;
  /** Route param holding the entity id. */
  entityParam?: string;
  /** Pull the entity id from the reply body instead, e.g. a newly created order. */
  entityFromReply?: string;
  body?: string[];
}

export const ROUTE_AUDIT: Record<string, RouteAudit> = {
  // Accounts
  "POST /v1/auth/register": { action: "account.registered", category: "auth", entityType: "profile", body: ["role", "universityId"] },
  "POST /v1/auth/login": { action: "auth.password_login", category: "auth" },
  "POST /v1/auth/sms-hook": { action: "auth.otp_sent", category: "auth" },
  "POST /v1/profile": { action: "profile.created", category: "auth", entityType: "profile", entityFromReply: "profile.id", body: ["role", "universityId", "riderType"] },
  "PUT /v1/profile/me": { action: "profile.updated", category: "user", entityType: "profile", body: ["fullName", "email", "studentId", "universityId", "avatarUrl"] },
  "POST /v1/notifications/token": { action: "device.push_registered", category: "auth" },
  "DELETE /v1/notifications/token": { action: "device.push_removed", category: "auth" },

  // Orders
  "POST /v1/orders": { action: "order.created", category: "order", entityType: "order", entityFromReply: "order.id", body: ["orderType", "shopId", "checkpointId", "originCheckpointId", "scheduledDate", "isSpecialOrder", "items"] },
  "PATCH /v1/orders/:id/accept": { action: "order.accepted", category: "order", entityType: "order", entityParam: "id" },
  "PATCH /v1/orders/:id/status": { action: "order.status_changed", category: "order", entityType: "order", entityParam: "id", body: ["status", "note"] },
  "POST /v1/orders/:id/goods-cost": { action: "order.goods_cost_recorded", category: "order", entityType: "order", entityParam: "id", body: ["items", "receiptTotal"] },
  "PATCH /v1/orders/:id/deliver": { action: "order.delivered", category: "order", entityType: "order", entityParam: "id" },
  "POST /v1/orders/:id/confirm-receipt": { action: "order.receipt_confirmed", category: "order", entityType: "order", entityParam: "id" },
  "PATCH /v1/orders/:id/cancel": { action: "order.cancelled_by_student", category: "order", entityType: "order", entityParam: "id", body: ["reason"] },
  "POST /v1/orders/:id/resend-pin": { action: "order.pin_resent", category: "order", entityType: "order", entityParam: "id" },
  "PATCH /v1/orders/:id/shop-accept": { action: "order.shop_accepted", category: "order", entityType: "order", entityParam: "id" },
  "PATCH /v1/orders/:id/shop-cancel": { action: "order.cancelled_by_shop", category: "order", entityType: "order", entityParam: "id", body: ["reason"] },

  // Payments
  "POST /v1/payments/initiate": { action: "payment.initiated", category: "payment", entityType: "order", body: ["orderId", "method"] },
  "POST /v1/payments/initiate-goods": { action: "payment.goods_initiated", category: "payment", entityType: "order", body: ["orderId", "method"] },
  "POST /v1/payments/webhook": { action: "payment.webhook_received", category: "payment" },

  // Riders
  "POST /v1/riders/verification": { action: "rider.verification_submitted", category: "rider", entityType: "rider_verification", entityFromReply: "verification.id", body: ["idType"] },
  "POST /v1/riders/verification/upload": { action: "rider.id_photo_uploaded", category: "rider" },
  "PATCH /v1/riders/availability": { action: "rider.availability_changed", category: "rider", body: ["isAvailable"] },
  "PATCH /v1/riders/admin/riders/:id/verify": { action: "rider.verification_reviewed", category: "rider", entityType: "rider_verification", entityParam: "id", body: ["status", "rejectionReason"] },

  // Shops and products
  "POST /v1/shops": { action: "shop.created", category: "shop", entityType: "shop", entityFromReply: "shop.id", body: ["name", "universityId", "category"] },
  "PUT /v1/shops/:id": { action: "shop.updated", category: "shop", entityType: "shop", entityParam: "id", body: ["name", "isOpen", "openingHours", "category", "location"] },
  "POST /v1/shops/:shopId/products": { action: "product.created", category: "shop", entityType: "shop", entityParam: "shopId", body: ["name", "price", "status"] },
  "PUT /v1/products/:id": { action: "product.updated", category: "shop", entityType: "product", entityParam: "id", body: ["name", "price", "status", "description"] },
  "PATCH /v1/products/:id/status": { action: "product.status_changed", category: "shop", entityType: "product", entityParam: "id", body: ["status"] },
  "DELETE /v1/products/:id": { action: "product.deleted", category: "shop", entityType: "product", entityParam: "id" },

  // Suggestions, baskets, checkpoints
  "POST /v1/shop-suggestions": { action: "suggestion.submitted", category: "suggestion", body: ["name", "locationText", "category"] },
  "POST /v1/group-baskets": { action: "basket.started", category: "basket", entityType: "group_basket", entityFromReply: "basket.code" },
  "POST /v1/group-baskets/:code/items": { action: "basket.item_added", category: "basket", entityType: "group_basket", entityParam: "code", body: ["productId", "quantity"] },
  "DELETE /v1/group-baskets/:code/items/:itemId": { action: "basket.item_removed", category: "basket", entityType: "group_basket", entityParam: "code" },
  "POST /v1/group-baskets/:code/lock": { action: "basket.locked", category: "basket", entityType: "group_basket", entityParam: "code" },
  "POST /v1/group-baskets/:code/unlock": { action: "basket.unlocked", category: "basket", entityType: "group_basket", entityParam: "code" },
  "POST /v1/checkpoints": { action: "checkpoint.created", category: "checkpoint", entityType: "checkpoint", entityFromReply: "checkpoint.id", body: ["name", "universityId", "isActive"] },
  "PUT /v1/checkpoints/:id": { action: "checkpoint.updated", category: "checkpoint", entityType: "checkpoint", entityParam: "id", body: ["name", "isActive", "description"] },

  // Staff and admin. Handlers write their own rich event on success; these
  // names are what a refused or failed attempt is logged as.
  "PUT /v1/admin/config": { action: "config.change_attempted", category: "config", body: ["key", "value"] },
  "POST /v1/admin/refund/:orderId": { action: "refund.attempted", category: "refund", entityType: "order", entityParam: "orderId", body: ["reason"] },
  "POST /v1/admin/orders/:orderId/force-deliver": { action: "order.force_deliver_attempted", category: "order", entityType: "order", entityParam: "orderId", body: ["reason"] },
  "PATCH /v1/admin/users/:id/role": { action: "user.role_change_attempted", category: "user", entityType: "profile", entityParam: "id", body: ["role"] },
  "PATCH /v1/admin/users/:id/status": { action: "user.status_change_attempted", category: "user", entityType: "profile", entityParam: "id", body: ["isActive"] },
  "PATCH /v1/admin/riders/:id/type": { action: "rider.type_change_attempted", category: "rider", entityType: "profile", entityParam: "id", body: ["riderType"] },
  "POST /v1/admin/shops": { action: "shop.create_attempted", category: "shop", body: ["name", "universityId"] },
  "PATCH /v1/admin/shops/:id": { action: "shop.update_attempted", category: "shop", entityType: "shop", entityParam: "id" },
  "POST /v1/admin/shop-suggestions/resolve": { action: "suggestion.onboard_attempted", category: "suggestion", body: ["normalizedName", "universityId", "shopId"] },
  "POST /v1/admin/shop-suggestions/reject": { action: "suggestion.reject_attempted", category: "suggestion", body: ["normalizedName", "universityId"] },
  "POST /v1/admin/payments/sweep-abandoned": { action: "payment.sweep_attempted", category: "payment" },
  "POST /v1/admin/staff": { action: "staff.add_attempted", category: "staff", body: ["staffRole"] },
  "PATCH /v1/admin/staff/:id": { action: "staff.role_change_attempted", category: "staff", entityType: "profile", entityParam: "id", body: ["staffRole"] },
  "DELETE /v1/admin/staff/:id": { action: "staff.remove_attempted", category: "staff", entityType: "profile", entityParam: "id" },
  "POST /v1/admin/campus-admins": { action: "campus_admin.add_attempted", category: "staff", body: ["universityId"] },
  "DELETE /v1/admin/campus-admins/:id": { action: "campus_admin.remove_attempted", category: "staff", entityType: "profile", entityParam: "id" },
  "POST /v1/admin/refund-requests": { action: "refund.request_attempted", category: "refund", entityType: "order", body: ["orderId", "reason"] },
  "POST /v1/admin/refund-requests/:id/decide": { action: "refund.decision_attempted", category: "refund", entityType: "refund_request", entityParam: "id", body: ["decision", "note"] },
  "PUT /v1/admin/switches": { action: "switch.change_attempted", category: "switch", body: ["key", "universityId", "paused"] },
  "DELETE /v1/admin/switches": { action: "switch.clear_attempted", category: "switch", body: ["key", "universityId"] },
  "PUT /v1/admin/features": { action: "flag.change_attempted", category: "flag", body: ["key", "universityId", "state"] },
  "DELETE /v1/admin/features": { action: "flag.clear_attempted", category: "flag", body: ["key", "universityId"] },
  "POST /v1/beta/apply": { action: "beta.apply_attempted", category: "beta" },
  "POST /v1/beta/feedback": { action: "beta.feedback_attempted", category: "beta" },
  "POST /v1/admin/beta/:id/review": { action: "beta.review_attempted", category: "beta", entityType: "beta_application", entityParam: "id", body: ["decision"] },
};

/** Fallback category for a route nobody described, from its path. */
export function categoryForPath(path: string): AuditCategory {
  const p = path.replace(/^\/v1\//, "");
  if (p.startsWith("orders")) return "order";
  if (p.startsWith("payments")) return "payment";
  if (p.startsWith("riders")) return "rider";
  if (p.startsWith("shops") || p.startsWith("products")) return "shop";
  if (p.startsWith("shop-suggestions")) return "suggestion";
  if (p.startsWith("group-baskets")) return "basket";
  if (p.startsWith("checkpoints")) return "checkpoint";
  if (p.startsWith("auth") || p.startsWith("profile") || p.startsWith("notifications")) return "auth";
  if (p.startsWith("admin/features")) return "flag";
  if (p.startsWith("admin/switches")) return "switch";
  if (p.startsWith("admin/staff")) return "staff";
  if (p.startsWith("admin/beta") || p.startsWith("beta")) return "beta";
  if (p.startsWith("admin")) return "user";
  return "system";
}

/** Read `a.b.c` out of a parsed reply body. */
export function pick(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    source,
  );
}
