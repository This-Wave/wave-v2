/**
 * How long someone has been waiting to be approved, and whether that is too long.
 *
 * Riders and shop owners can now register themselves, so there is a queue of real
 * people who cannot do anything until an admin looks at them. A rider waiting is
 * a rider not earning; a shop waiting is invisible to students, and its owner
 * cannot tell that apart from Wave having no customers.
 *
 * The threshold is not a guess. The rider app says "this usually takes about a
 * day" and the shop dashboard says the same — so a day is a promise Wave has
 * already made, and past it the queue is not slow, it is broken.
 */
export const APPROVAL_TARGET_HOURS = 24;

export interface ApprovalWait {
  hours: number;
  /** Past the promise made in the app. */
  overdue: boolean;
  /** Short human phrase: "3h", "2 days". */
  label: string;
}

export function approvalWait(since: string | Date, now: Date = new Date()): ApprovalWait {
  const started = since instanceof Date ? since : new Date(since);
  const ms = now.getTime() - started.getTime();
  // A future timestamp is clock skew between the server and this browser, not a
  // negative wait. Clamp rather than render "-2 days", which reads as a bug.
  const hours = Math.max(0, ms / 3_600_000);

  return {
    hours,
    overdue: hours > APPROVAL_TARGET_HOURS,
    label: formatWait(hours),
  };
}

function formatWait(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes}m`;
  }
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}
