import { describe, expect, test } from "vitest";
import { approvalWait, APPROVAL_TARGET_HOURS } from "../waiting";

const NOW = new Date("2026-09-03T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

describe("approvalWait", () => {
  test("the threshold is the promise the app already makes", () => {
    // Both the rider lobby and the shop dashboard say "about a day". If that
    // copy changes, this constant has to change with it.
    expect(APPROVAL_TARGET_HOURS).toBe(24);
  });

  test("inside a day is not overdue", () => {
    expect(approvalWait(ago(3), NOW).overdue).toBe(false);
    expect(approvalWait(ago(23.9), NOW).overdue).toBe(false);
  });

  test("past a day is overdue", () => {
    expect(approvalWait(ago(25), NOW).overdue).toBe(true);
    expect(approvalWait(ago(24 * 9), NOW).overdue).toBe(true);
  });

  test("reads naturally at each scale", () => {
    expect(approvalWait(ago(0.25), NOW).label).toBe("15m");
    expect(approvalWait(ago(5), NOW).label).toBe("5h");
    expect(approvalWait(ago(24), NOW).label).toBe("1 day");
    expect(approvalWait(ago(24 * 3), NOW).label).toBe("3 days");
  });

  test("never says less than a minute", () => {
    // "0m" reads as broken; someone who just submitted has waited a moment.
    expect(approvalWait(NOW, NOW).label).toBe("1m");
  });

  test("a future timestamp is clamped, not shown as negative", () => {
    // The browser's clock and the server's disagree by seconds routinely.
    // "-2 days" in the queue reads as a bug and hides a real wait of zero.
    const wait = approvalWait(new Date(NOW.getTime() + 60_000), NOW);
    expect(wait.hours).toBe(0);
    expect(wait.overdue).toBe(false);
    expect(wait.label).toBe("1m");
  });

  test("accepts an ISO string, which is what the API sends", () => {
    expect(approvalWait(ago(30).toISOString(), NOW).overdue).toBe(true);
  });
});
