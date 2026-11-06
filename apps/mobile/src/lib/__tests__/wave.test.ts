import { describe, expect, it } from "vitest";
import { countdownParts, formatCountdown } from "../wave";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("countdownParts", () => {
  it("leads with days and hours while more than a day remains", () => {
    expect(countdownParts(3 * DAY + 22 * HOUR + 14 * MIN)).toEqual([
      { value: 3, unit: "days" },
      { value: 22, unit: "hours" },
    ]);
  });

  it("drops to hours and minutes inside the last day", () => {
    expect(countdownParts(5 * HOUR + 9 * MIN)).toEqual([
      { value: 5, unit: "hours" },
      { value: 9, unit: "minutes" },
    ]);
  });

  it("shows minutes alone in the last hour", () => {
    expect(countdownParts(48 * MIN)).toEqual([{ value: 48, unit: "minutes" }]);
  });

  it("singularises, so a counter never reads '1 days'", () => {
    expect(countdownParts(DAY + HOUR)).toEqual([
      { value: 1, unit: "day" },
      { value: 1, unit: "hour" },
    ]);
    expect(countdownParts(MIN)).toEqual([{ value: 1, unit: "minute" }]);
  });

  it("keeps a zero second unit rather than dropping to one block", () => {
    // 3 days exactly still reads "3 days 0 hours": losing the block would make
    // the counter change shape at an arbitrary moment.
    expect(countdownParts(3 * DAY)).toEqual([
      { value: 3, unit: "days" },
      { value: 0, unit: "hours" },
    ]);
  });

  it("returns nothing once the window has closed", () => {
    expect(countdownParts(0)).toEqual([]);
    expect(countdownParts(-1)).toEqual([]);
  });

  it("agrees with the one-line countdown it replaces", () => {
    // Both read the same clock, so a card showing blocks and a row showing the
    // string must never disagree about the hour.
    for (const ms of [3 * DAY + 22 * HOUR, 5 * HOUR + 9 * MIN, 48 * MIN]) {
      const parts = countdownParts(ms);
      const line = formatCountdown(ms);
      expect(line).toContain(String(parts[0].value));
    }
  });
});
