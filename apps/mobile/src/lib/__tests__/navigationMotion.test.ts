import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AccessibilityInfo, Platform } from "react-native";
import {
  clearSkipTransition,
  initReducedMotionPreference,
  markHistoryNavigation,
  prefersReducedMotion,
  stackScreenOptions,
  tabsStackScreenOptions,
} from "../navigationMotion";

/**
 * Screen transitions are the app's largest motion surface (review 10-a11y, M2).
 * A full-screen slide is what actually triggers vestibular discomfort — far
 * more than the 180ms fade elsewhere — so "reduce motion" has to reach here,
 * not just the skeleton pulse.
 */
const setPlatform = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

beforeEach(async () => {
  clearSkipTransition();
  setPlatform("ios");
  vi.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: vi.fn() } as never);
  // The preference is cached in module scope, which persists across tests in
  // this file — so it has to be actively reset, not just left alone.
  await primeReducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  setPlatform("ios");
});

async function primeReducedMotion(enabled: boolean) {
  vi.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(enabled);
  initReducedMotionPreference();
  // Let the promise the initialiser kicked off settle.
  await Promise.resolve();
  await Promise.resolve();
}

describe("stackScreenOptions — motion off (default)", () => {
  test("checkout slides on native", async () => {
    await primeReducedMotion(false);
    expect(stackScreenOptions("checkout").animation).toBe("slide_from_right");
  });

  test("auth fades from the bottom on native", async () => {
    await primeReducedMotion(false);
    expect(stackScreenOptions("auth").animation).toBe("fade_from_bottom");
  });

  test("web uses a fade for ordinary stacks", async () => {
    await primeReducedMotion(false);
    setPlatform("web");
    expect(stackScreenOptions("app").animation).toBe("fade");
  });

  test("browser back skips the transition", async () => {
    await primeReducedMotion(false);
    setPlatform("web");
    markHistoryNavigation();
    expect(stackScreenOptions("app").animation).toBe("none");
  });
});

describe("stackScreenOptions — reduce motion on", () => {
  test.each(["auth", "checkout", "app"] as const)(
    "%s has no animation on native",
    async (motion) => {
      await primeReducedMotion(true);
      expect(prefersReducedMotion()).toBe(true);
      expect(stackScreenOptions(motion).animation).toBe("none");
    },
  );

  test.each(["auth", "checkout", "app"] as const)("%s has no animation on web", async (motion) => {
    await primeReducedMotion(true);
    setPlatform("web");
    expect(stackScreenOptions(motion).animation).toBe("none");
  });

  test("checkout is not exempt — it is the biggest slide in the app", async () => {
    await primeReducedMotion(true);
    expect(stackScreenOptions("checkout").animation).not.toBe("slide_from_right");
  });

  test("everything else about the options is unchanged", async () => {
    // Reducing motion must not quietly disable gestures or reveal headers.
    await primeReducedMotion(true);
    const options = stackScreenOptions("app");
    expect(options.headerShown).toBe(false);
    expect(options.gestureEnabled).toBe(true);
  });
});

describe("failure and default behaviour", () => {
  test("defaults to motion on, so a device that never answers is unchanged", () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(stackScreenOptions("checkout").animation).toBe("slide_from_right");
  });

  test("a rejected probe does not throw and leaves motion on", async () => {
    // An accessibility probe must never break navigation setup.
    vi.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("nope"));

    expect(() => initReducedMotionPreference()).not.toThrow();
    await Promise.resolve();
    expect(prefersReducedMotion()).toBe(false);
  });

  test("returns an unsubscribe function", async () => {
    const remove = vi.fn();
    vi.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove } as never);

    const cleanup = initReducedMotionPreference();
    cleanup();

    expect(remove).toHaveBeenCalled();
  });
});

describe("tabsStackScreenOptions", () => {
  test("never animates, reduce-motion or not", async () => {
    await primeReducedMotion(false);
    expect(tabsStackScreenOptions().animation).toBe("none");
    await primeReducedMotion(true);
    expect(tabsStackScreenOptions().animation).toBe("none");
  });
});
