import type { Step } from "../../components/v6";
import type { Order, OrderStatus } from "../../types";

/** Shared status mapping, so Home / History / Tracking / Detail never disagree. */
export function statusPill(status: OrderStatus): {
  label: string;
  tone: "neutral" | "active" | "done" | "danger";
} {
  switch (status) {
    case "delivered":
      return { label: "Delivered", tone: "done" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "refunded":
      return { label: "Refunded", tone: "danger" };
    case "en_route":
      return { label: "On the way", tone: "active" };
    case "at_checkpoint":
      return { label: "At checkpoint", tone: "active" };
    case "rider_assigned":
      return { label: "Runner assigned", tone: "active" };
    case "confirmed":
      return { label: "Confirmed", tone: "neutral" };
    case "payment_pending":
      return { label: "Awaiting payment", tone: "neutral" };
    default:
      return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}

const FLOW: OrderStatus[] = [
  "confirmed",
  "rider_assigned",
  "en_route",
  "at_checkpoint",
  "delivered",
];

/** 0–1 position through the delivery flow, for the compact progress rail. */
export function orderProgress(status: OrderStatus): number {
  const i = FLOW.indexOf(status);
  if (i < 0) return 0;
  return (i + 1) / FLOW.length;
}

/** How far through `orderSteps` the order currently is. */
export function currentStepIndex(status: OrderStatus): number {
  const i = FLOW.indexOf(status);
  return i < 0 ? 0 : i;
}

export function orderSteps(order: Order): Step[] {
  const placed = order.createdAt ? timeOf(order.createdAt) : undefined;
  const paid = order.paidAt ? timeOf(order.paidAt) : undefined;
  const delivered = order.deliveredAt ? timeOf(order.deliveredAt) : undefined;
  const idx = currentStepIndex(order.status);

  return [
    { label: "Order confirmed", detail: paid ?? placed },
    {
      label: "Runner assigned",
      detail: order.rider?.fullName ?? (idx < 1 ? "Assigned before the run" : undefined),
    },
    {
      label:
        order.orderType === "pickup"
          ? `Collected from ${order.originCheckpoint?.name ?? "the checkpoint"}`
          : `Picked up from ${order.shop?.name ?? "the shop"}`,
      detail: idx < 2 ? "Not yet" : undefined,
    },
    {
      label: `On the way to ${order.checkpoint?.name ?? "your checkpoint"}`,
      detail: idx < 3 ? "Not yet" : undefined,
    },
    { label: "Delivered", detail: delivered ?? (idx < 4 ? "Pending" : undefined) },
  ];
}

/**
 * Short human reference for an order.
 *
 * Takes the LAST six characters of the UUID, not the first four. Every seeded
 * order id begins `00000000-0000-…`, so a leading slice rendered all nine of
 * them as the identical `#WV-0000` — useless to a student reading it out and
 * useless to support looking it up.
 */
export function shortOrderRef(orderId: string): string {
  const clean = orderId.replace(/[^a-zA-Z0-9]/g, "");
  return `#WV-${clean.slice(-6).toUpperCase()}`;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
