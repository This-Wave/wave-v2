/**
 * When Wave is allowed to push a reminder at someone.
 *
 * Pure and shared so the rules are testable without a database and can be
 * quoted back in the admin later. A delivery app that pushes twice a week is
 * useful; one that pushes daily gets its notifications switched off, and then
 * every reminder feature is worth nothing.
 */

export const REMINDER_KINDS = ["cutoff", "abandoned"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** No pushes before this hour, local time. */
export const QUIET_START_HOUR = 21;
/** …or after it. Students share rooms. */
export const QUIET_END_HOUR = 7;

/** The most reminder pushes one person can get in a rolling day. */
export const MAX_REMINDERS_PER_DAY = 2;

/** How close to the cutoff the reminder fires. */
export const CUTOFF_REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;

/**
 * A window either side of the lead time, because the sweep runs on a timer and
 * will never tick at exactly two hours out. Wide enough that a tick cannot skip
 * the window, narrow enough that "2 hours left" stays true.
 */
export const CUTOFF_REMINDER_WINDOW_MS = 35 * 60 * 1000;

export function isQuietHour(now: Date = new Date()): boolean {
  const h = now.getHours();
  // The window wraps midnight, so this is an OR rather than a range test.
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** Whether the cutoff is close enough — but not past — to remind about. */
export function inCutoffReminderWindow(msUntilCutoff: number): boolean {
  if (msUntilCutoff <= 0) return false;
  return Math.abs(msUntilCutoff - CUTOFF_REMINDER_LEAD_MS) <= CUTOFF_REMINDER_WINDOW_MS;
}

export function underDailyCap(sentInLastDay: number): boolean {
  return sentInLastDay < MAX_REMINDERS_PER_DAY;
}

/**
 * The single gate every reminder passes through.
 *
 * Returns a reason rather than a boolean so the sweep can log *why* nobody was
 * reminded — "0 sent" with no explanation is the kind of thing that gets
 * debugged twice.
 */
export function reminderBlockedReason(args: {
  now?: Date;
  enabled: boolean;
  sentInLastDay: number;
  alreadySent: boolean;
}): "disabled" | "already-sent" | "quiet-hours" | "daily-cap" | null {
  if (!args.enabled) return "disabled";
  if (args.alreadySent) return "already-sent";
  if (isQuietHour(args.now ?? new Date())) return "quiet-hours";
  if (!underDailyCap(args.sentInLastDay)) return "daily-cap";
  return null;
}
