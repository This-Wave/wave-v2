export type PillTone = "good" | "neutral" | "warn" | "bad" | "info";

/**
 * v7 canvas pill skins: soft fills with dark text. Wash green for done/paid,
 * blue for moving, amber for waiting at a point, red for a problem.
 */
const TONE: Record<PillTone, string> = {
  good: "bg-wash border-transparent text-ink",
  info: "bg-info-bg border-transparent text-info-text",
  neutral: "bg-canvas border-border text-muted",
  warn: "bg-warning-bg border-warning-border text-warning-text",
  bad: "bg-danger-bg border-danger-border text-danger-text",
};

/** Order statuses in the words staff use (v7 canvas). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  payment_pending: "Not paid",
  confirmed: "Paid",
  rider_assigned: "Rider assigned",
  en_route: "On the way",
  at_checkpoint: "At checkpoint",
  delivered: "Collected",
  cancelled: "Cancelled",
  refunded: "Refunded",
  payment_failed: "Payment failed",
};

/** Maps an order/verification/account status onto a pill tone. */
export function toneForStatus(status: string): PillTone {
  switch (status) {
    case "delivered":
    case "confirmed":
    case "approved":
    case "active":
    case "running":
      return "good";
    case "en_route":
    case "rider_assigned":
      return "info";
    case "at_checkpoint":
    case "payment_pending":
    case "pending":
    case "paused":
      return "warn";
    case "cancelled":
    case "refunded":
    case "rejected":
    case "suspended":
    case "deactivated":
    case "payment_failed":
    case "failed":
      return "bad";
    default:
      return "neutral";
  }
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  const text = ORDER_STATUS_LABEL[label] ?? label.replace(/_/g, " ");
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-control border px-2.5 py-[4px] text-[12px] font-bold first-letter:uppercase ${TONE[tone]}`}
    >
      {text}
    </span>
  );
}

/** One call for an order status: label and tone from the status key. */
export function OrderStatusPill({ status }: { status: string }) {
  return <StatusPill label={status} tone={toneForStatus(status)} />;
}
