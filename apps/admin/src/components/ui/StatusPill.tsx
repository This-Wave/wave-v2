export type PillTone = "good" | "neutral" | "warn" | "bad";

const TONE: Record<PillTone, string> = {
  good: "bg-wave-lime border-transparent text-wave-500",
  neutral: "bg-canvas border-border text-muted",
  warn: "bg-warning-bg border-warning-border text-warning-text",
  bad: "bg-danger-bg border-danger-border text-danger-text",
};

/** Maps an order/verification/account status onto the v5 pill tones. */
export function toneForStatus(status: string): PillTone {
  switch (status) {
    case "delivered":
    case "confirmed":
    case "approved":
    case "active":
    case "en_route":
      return "good";
    case "payment_pending":
    case "pending":
      return "warn";
    case "cancelled":
    case "refunded":
    case "rejected":
    case "suspended":
    case "deactivated":
      return "bad";
    default:
      return "neutral";
  }
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill border px-[11px] py-[5px] text-[11px] font-semibold capitalize ${TONE[tone]}`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}
