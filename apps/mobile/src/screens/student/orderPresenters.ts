import type { OrderStatus } from "../../types";

export type BadgeProps = { label: string; variant: "success" | "error" | "neutral"; pulse?: boolean };

/** Shared status-pill mapping, so Home / History / Detail never disagree. */
export function statusBadge(status: OrderStatus): BadgeProps {
  if (status === "delivered") return { label: "Delivered", variant: "success" };
  if (status === "cancelled") return { label: "Cancelled", variant: "neutral" };
  if (status === "refunded") return { label: "Refunded", variant: "error" };
  if (status === "en_route") return { label: "In transit", variant: "success", pulse: true };
  if (status === "at_checkpoint") return { label: "At checkpoint", variant: "success" };
  if (status === "rider_assigned") return { label: "Runner assigned", variant: "success" };
  return { label: status.replace(/_/g, " "), variant: "neutral" };
}

/** The design shows short refs like `#WV-2481`; derive one from the real UUID. */
export function shortOrderRef(orderId: string): string {
  return `#WV-${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
