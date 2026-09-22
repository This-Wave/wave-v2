import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAUSE_MESSAGE,
  DEFAULT_PRELAUNCH_MESSAGE,
  isServiceVisible,
  resolveServiceStatus,
  resolveSwitch,
  serviceForOrderType,
  type ServiceSwitchRow,
} from "../switches";

const UNI = "ashesi";
const now = new Date("2026-09-21T12:00:00Z");
const row = (over: Partial<ServiceSwitchRow>): ServiceSwitchRow => ({
  key: "buy_for_me",
  universityId: null,
  paused: true,
  message: null,
  resumeAt: null,
  ...over,
});

describe("resolveSwitch", () => {
  it("is running when no row exists — the opposite of a feature flag", () => {
    expect(resolveSwitch("buy_for_me", UNI, [], now).paused).toBe(false);
  });

  it("a campus row beats the global row, both ways", () => {
    const globalPaused = [row({}), row({ universityId: UNI, paused: false })];
    expect(resolveSwitch("buy_for_me", UNI, globalPaused, now).paused).toBe(false);
    expect(resolveSwitch("buy_for_me", "other", globalPaused, now).paused).toBe(true);
  });

  it("a pause whose resume time has passed is over, tidied or not", () => {
    const rows = [row({ resumeAt: "2026-09-21T11:59:00Z" })];
    expect(resolveSwitch("buy_for_me", UNI, rows, now).paused).toBe(false);
  });

  it("falls back to a generic message when none was written", () => {
    expect(resolveSwitch("buy_for_me", UNI, [row({ message: "  " })], now).message).toBe(DEFAULT_PAUSE_MESSAGE);
  });
});

describe("resolveServiceStatus", () => {
  it("the master switch pauses both, and its message wins", () => {
    const rows = [
      row({ key: "all_orders", message: "Exams week, back Monday" }),
      row({ key: "pickup", message: "Pickup paused" }),
    ];
    const status = resolveServiceStatus(UNI, rows, now);
    expect(status.buy_for_me).toMatchObject({ paused: true, message: "Exams week, back Monday" });
    expect(status.pickup.message).toBe("Exams week, back Monday");
  });

  it("pausing one service leaves the other running", () => {
    const status = resolveServiceStatus(UNI, [row({ key: "pickup" })], now);
    expect(status.pickup.paused).toBe(true);
    expect(status.buy_for_me.paused).toBe(false);
  });
});

describe("serviceForOrderType", () => {
  it("files a suggested-shop order under pickup, as students see it", () => {
    expect(serviceForOrderType("buy_for_me")).toBe("buy_for_me");
    expect(serviceForOrderType("pickup")).toBe("pickup");
    expect(serviceForOrderType("shop_pickup")).toBe("pickup");
  });
});

describe("a service that has not launched", () => {
  const prelaunch = [row({ key: "buy_for_me", hidden: true, message: "Coming soon — we're signing up shops." })];

  it("is hidden, not merely paused", () => {
    const status = resolveServiceStatus(UNI, prelaunch, now);
    expect(status.buy_for_me).toMatchObject({ paused: true, hidden: true, message: "Coming soon — we're signing up shops." });
    expect(status.pickup.hidden).toBe(false);
  });

  it("stays hidden when the master switch is also paused", () => {
    const status = resolveServiceStatus(UNI, [...prelaunch, row({ key: "all_orders", message: "Exams week" })], now);
    expect(status.buy_for_me).toMatchObject({ hidden: true, message: "Exams week" });
    expect(status.pickup).toMatchObject({ paused: true, hidden: false });
  });

  it("a campus can open it before the rest of the platform", () => {
    const rows = [...prelaunch, row({ key: "buy_for_me", universityId: UNI, paused: false })];
    expect(resolveServiceStatus(UNI, rows, now).buy_for_me).toMatchObject({ paused: false, hidden: false });
    expect(resolveServiceStatus("other", rows, now).buy_for_me.hidden).toBe(true);
  });

  it("falls back to a coming-soon line rather than a closed-for-now one", () => {
    const state = resolveSwitch("buy_for_me", UNI, [row({ key: "buy_for_me", hidden: true, message: null })], now);
    expect(state.message).toBe(DEFAULT_PRELAUNCH_MESSAGE);
  });

  it("is visible once it launches", () => {
    expect(isServiceVisible(resolveServiceStatus(UNI, [], now).buy_for_me)).toBe(true);
    expect(isServiceVisible(resolveServiceStatus(UNI, prelaunch, now).buy_for_me)).toBe(false);
  });
});
