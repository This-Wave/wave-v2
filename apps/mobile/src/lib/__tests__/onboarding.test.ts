import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * AsyncStorage is a native module and cannot load under the node environment
 * these tests run in, so it is mocked outright. The point of the mock is not to
 * simulate storage faithfully — it is to be able to make it *throw*, because
 * the interesting behaviour in `onboarding.ts` is entirely in what happens when
 * storage is unavailable.
 */
const store = new Map<string, string>();
const getItem = vi.fn(async (k: string) => store.get(k) ?? null);
const setItem = vi.fn(async (k: string, v: string) => {
  store.set(k, v);
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (k: string) => getItem(k),
    setItem: (k: string, v: string) => setItem(k, v),
  },
}));

// A static import is safe despite the mock above: `vi.mock` is hoisted above
// every import in the file. A dynamic `await import` would need top-level await,
// which this workspace's CommonJS target rejects.
import { hasSeenTour, markTourSeen } from "../onboarding";

describe("first-run tour state", () => {
  beforeEach(() => {
    store.clear();
    getItem.mockClear();
    setItem.mockClear();
    getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
    setItem.mockImplementation(async (k: string, v: string) => {
      store.set(k, v);
    });
  });

  test("a brand-new account has not seen the tour", async () => {
    expect(await hasSeenTour("profile-1")).toBe(false);
  });

  test("marking it seen persists for that account", async () => {
    await markTourSeen("profile-1");
    expect(await hasSeenTour("profile-1")).toBe(true);
  });

  test("state is per account, not per device", async () => {
    // A shared phone is the normal case on this campus. A rider borrowing a
    // student's handset must still get the rider tour.
    await markTourSeen("student-1");

    expect(await hasSeenTour("student-1")).toBe(true);
    expect(await hasSeenTour("rider-1")).toBe(false);
  });

  test("unreadable storage reports the tour as already seen", async () => {
    // Failing open would show the tour on every single launch, which is worse
    // than never showing it.
    getItem.mockRejectedValueOnce(new Error("storage unavailable"));

    expect(await hasSeenTour("profile-1")).toBe(true);
  });

  test("a failed write never throws at the caller", async () => {
    // This runs while dismissing a modal over a live app. Throwing here would
    // surface as a crash on a purely cosmetic action.
    setItem.mockRejectedValueOnce(new Error("disk full"));

    await expect(markTourSeen("profile-1")).resolves.toBeUndefined();
  });
});
