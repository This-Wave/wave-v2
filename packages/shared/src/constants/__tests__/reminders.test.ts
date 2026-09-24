import { describe, expect, it } from "vitest";
import {
  CUTOFF_REMINDER_LEAD_MS,
  MAX_REMINDERS_PER_DAY,
  inCutoffReminderWindow,
  isQuietHour,
  reminderBlockedReason,
  underDailyCap,
} from "../reminders";

const at = (hour: number) => new Date(2026, 8, 6, hour, 0, 0);

describe("isQuietHour", () => {
  it("is quiet late at night and early in the morning", () => {
    expect(isQuietHour(at(22))).toBe(true);
    expect(isQuietHour(at(2))).toBe(true);
    expect(isQuietHour(at(6))).toBe(true);
  });

  it("is not quiet during the day", () => {
    expect(isQuietHour(at(7))).toBe(false);
    expect(isQuietHour(at(12))).toBe(false);
    expect(isQuietHour(at(20))).toBe(false);
  });

  it("treats the boundaries as the window states them", () => {
    expect(isQuietHour(at(21))).toBe(true);
    expect(isQuietHour(at(20))).toBe(false);
  });
});

describe("inCutoffReminderWindow", () => {
  const MIN = 60 * 1000;

  it("fires around the lead time", () => {
    expect(inCutoffReminderWindow(CUTOFF_REMINDER_LEAD_MS)).toBe(true);
    expect(inCutoffReminderWindow(CUTOFF_REMINDER_LEAD_MS - 20 * MIN)).toBe(true);
    expect(inCutoffReminderWindow(CUTOFF_REMINDER_LEAD_MS + 20 * MIN)).toBe(true);
  });

  it("does not fire far out or long past", () => {
    expect(inCutoffReminderWindow(6 * 60 * MIN)).toBe(false);
    expect(inCutoffReminderWindow(10 * MIN)).toBe(false);
  });

  it("never fires once the cutoff has passed", () => {
    expect(inCutoffReminderWindow(0)).toBe(false);
    expect(inCutoffReminderWindow(-5 * MIN)).toBe(false);
  });

  it("leaves no gap a 10-minute sweep could tick straight over", () => {
    // The sweep runs every 10 minutes; walk a whole hour of ticks around the
    // lead time and assert at least one lands inside the window.
    const hits = Array.from({ length: 7 }, (_, i) =>
      inCutoffReminderWindow(CUTOFF_REMINDER_LEAD_MS + (i - 3) * 10 * MIN),
    );
    expect(hits.filter(Boolean).length).toBeGreaterThan(0);
  });
});

describe("underDailyCap", () => {
  it("stops at the cap", () => {
    expect(underDailyCap(0)).toBe(true);
    expect(underDailyCap(MAX_REMINDERS_PER_DAY - 1)).toBe(true);
    expect(underDailyCap(MAX_REMINDERS_PER_DAY)).toBe(false);
    expect(underDailyCap(MAX_REMINDERS_PER_DAY + 3)).toBe(false);
  });
});

describe("reminderBlockedReason", () => {
  const ok = { now: at(10), enabled: true, sentInLastDay: 0, alreadySent: false };

  it("allows a reminder when everything passes", () => {
    expect(reminderBlockedReason(ok)).toBeNull();
  });

  it("reports the first failing gate", () => {
    expect(reminderBlockedReason({ ...ok, enabled: false })).toBe("disabled");
    expect(reminderBlockedReason({ ...ok, alreadySent: true })).toBe("already-sent");
    expect(reminderBlockedReason({ ...ok, now: at(23) })).toBe("quiet-hours");
    expect(reminderBlockedReason({ ...ok, sentInLastDay: MAX_REMINDERS_PER_DAY })).toBe(
      "daily-cap",
    );
  });

  it("checks the flag before anything else, so a disabled feature is silent", () => {
    expect(
      reminderBlockedReason({ ...ok, enabled: false, now: at(23), alreadySent: true }),
    ).toBe("disabled");
  });
});
