/**
 * Service switches: the kill switches for taking new orders.
 *
 * Deliberately not feature flags. A flag's missing row means OFF, which is
 * right for a feature still being built and exactly wrong here: a fresh
 * database, or a switch nobody has touched, must mean Wave is taking orders.
 * So a missing row means RUNNING, and only a row that says `paused` stops
 * anything.
 *
 * A pause stops *new* business only — creating an order, starting a group
 * basket, paying for an order that has not been paid yet. Everything already
 * paid carries on: riders accept, pick up and deliver, because a paid order
 * frozen mid-flight is worse for everyone than one that finishes.
 */
export const SERVICE_SWITCHES = [
  {
    key: "all_orders",
    label: "All new orders",
    description: "Master switch. Pauses Buy for me and Pickup together.",
  },
  {
    key: "buy_for_me",
    label: "Buy for me",
    description: "A rider buys from a shop on Wave and delivers it.",
  },
  {
    key: "pickup",
    label: "Pickup & deliveries",
    description: "Moving a package between checkpoints, and buying from a suggested shop.",
  },
] as const;

export type ServiceSwitchKey = (typeof SERVICE_SWITCHES)[number]["key"];

export const SERVICE_SWITCH_KEYS = SERVICE_SWITCHES.map((s) => s.key) as readonly ServiceSwitchKey[];

export function isServiceSwitchKey(value: unknown): value is ServiceSwitchKey {
  return typeof value === "string" && (SERVICE_SWITCH_KEYS as readonly string[]).includes(value);
}

/** What a student is told when nobody wrote a message. */
export const DEFAULT_PAUSE_MESSAGE = "Wave isn't taking new orders right now. Please check back soon.";

/** The same, for a service that has not launched yet. */
export const DEFAULT_PRELAUNCH_MESSAGE = "This isn't available yet. We'll let you know when it opens.";

export interface ServiceSwitchRow {
  key: string;
  universityId: string | null;
  paused: boolean;
  message: string | null;
  resumeAt: Date | string | null;
  /** Not launched yet. Optional so older callers and fixtures still type-check. */
  hidden?: boolean;
}

export interface ServiceState {
  paused: boolean;
  message: string | null;
  /** ISO time the pause lifts by itself, if one was set. */
  resumeAt: string | null;
  /**
   * The service has not launched. Stronger than `paused`: the app leaves it out
   * of the interface entirely — no tab, and for Buy for me no shop browsing —
   * instead of showing it as temporarily closed.
   */
  hidden: boolean;
}

function resumeTime(row: ServiceSwitchRow): number | null {
  if (!row.resumeAt) return null;
  const t = new Date(row.resumeAt).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * One switch's state. A campus row wins over the global row, as with flags —
 * so a global pause can be lifted for one campus and vice versa. A pause whose
 * `resumeAt` has passed is over, whether or not anything has tidied the row.
 */
export function resolveSwitch(
  key: ServiceSwitchKey,
  universityId: string | null | undefined,
  rows: ServiceSwitchRow[],
  now: Date = new Date(),
): ServiceState {
  const forKey = rows.filter((r) => r.key === key);
  const row =
    (universityId ? forKey.find((r) => r.universityId === universityId) : undefined) ??
    forKey.find((r) => r.universityId === null);
  if (!row || !row.paused) return { paused: false, message: null, resumeAt: null, hidden: false };
  const until = resumeTime(row);
  if (until !== null && until <= now.getTime()) {
    return { paused: false, message: null, resumeAt: null, hidden: false };
  }
  const hidden = row.hidden === true;
  return {
    paused: true,
    hidden,
    message: row.message?.trim() || (hidden ? DEFAULT_PRELAUNCH_MESSAGE : DEFAULT_PAUSE_MESSAGE),
    resumeAt: until !== null ? new Date(until).toISOString() : null,
  };
}

export type ServiceStatus = Record<"buy_for_me" | "pickup", ServiceState>;

/**
 * What the app needs: can a student start a Buy-for-me, can they start a
 * Pickup. The master switch folds into both, and its message wins, because
 * "exams week, back Monday" explains more than "Buy for me is paused".
 */
export function resolveServiceStatus(
  universityId: string | null | undefined,
  rows: ServiceSwitchRow[],
  now: Date = new Date(),
): ServiceStatus {
  const all = resolveSwitch("all_orders", universityId, rows, now);
  const pick = (key: "buy_for_me" | "pickup"): ServiceState => {
    const own = resolveSwitch(key, universityId, rows, now);
    // The master switch's message wins when both are closed, but it must never
    // *un-hide* a service: an unlaunched Buy for me stays absent, not paused.
    if (all.paused) return { ...all, hidden: all.hidden || own.hidden };
    return own;
  };
  return { buy_for_me: pick("buy_for_me"), pickup: pick("pickup") };
}

/** Whether a service is live enough to be shown at all. */
export function isServiceVisible(state: ServiceState): boolean {
  return !state.hidden;
}

/** Which switch governs an order type. A suggested-shop order is shown to students as a kind of pickup. */
export function serviceForOrderType(orderType: string): "buy_for_me" | "pickup" {
  return orderType === "buy_for_me" ? "buy_for_me" : "pickup";
}
