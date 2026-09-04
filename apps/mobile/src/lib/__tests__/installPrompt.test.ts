import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * AsyncStorage is a native module and cannot load under the node environment
 * these tests run in, so it is mocked outright — same reasoning as
 * `onboarding.test.ts`. The interesting behaviour is what happens when storage
 * throws, because that decides whether a student gets nagged on every launch.
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

// react-native's Platform resolves to the web shim under vitest; pin it so the
// guards under test are exercised rather than short-circuited.
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

import {
  __setDeferredPrompt,
  detectInstallPlatform,
  hasDeferredPrompt,
  hasDismissedInstallHint,
  markInstallHintDismissed,
  onInstallPromptAvailable,
  showInstallPrompt,
  type BeforeInstallPromptEvent,
} from "../installPrompt";

beforeEach(() => {
  store.clear();
  getItem.mockClear();
  setItem.mockClear();
  getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  setItem.mockImplementation(async (k: string, v: string) => {
    store.set(k, v);
  });
  __setDeferredPrompt(null);
});

const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 13; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("detectInstallPlatform", () => {
  test("iOS Safari gets the Share-sheet instruction", () => {
    expect(detectInstallPlatform(IOS_SAFARI)).toBe("ios");
  });

  test("Android Chrome gets the real install button", () => {
    expect(detectInstallPlatform(ANDROID_CHROME)).toBe("android");
  });

  test("Chrome on iOS gets nothing — it cannot install a standalone app", () => {
    // The important negative case. Telling a CriOS user to tap Share would be
    // instructing them to do something that does not produce an app.
    expect(detectInstallPlatform(IOS_CHROME)).toBe("none");
  });

  test("desktop gets nothing", () => {
    expect(detectInstallPlatform(DESKTOP)).toBe("none");
  });

  test("an empty user agent is not treated as installable", () => {
    expect(detectInstallPlatform("")).toBe("none");
  });
});

describe("dismissal", () => {
  test("defaults to not dismissed, and persists once dismissed", async () => {
    expect(await hasDismissedInstallHint()).toBe(false);
    await markInstallHintDismissed();
    expect(await hasDismissedInstallHint()).toBe(true);
  });

  test("unavailable storage reads as dismissed rather than showing every launch", async () => {
    getItem.mockImplementation(async () => {
      throw new Error("no storage");
    });
    expect(await hasDismissedInstallHint()).toBe(true);
  });

  test("a failed write does not throw into the caller", async () => {
    setItem.mockImplementation(async () => {
      throw new Error("quota");
    });
    await expect(markInstallHintDismissed()).resolves.toBeUndefined();
  });
});

describe("the deferred prompt", () => {
  function fakeEvent(outcome: "accepted" | "dismissed"): BeforeInstallPromptEvent {
    return {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome }),
    } as unknown as BeforeInstallPromptEvent;
  }

  test("reports nothing to replay before the browser has offered", () => {
    expect(hasDeferredPrompt()).toBe(false);
  });

  test("accepting is reported to the caller", async () => {
    __setDeferredPrompt(fakeEvent("accepted"));
    expect(hasDeferredPrompt()).toBe(true);
    await expect(showInstallPrompt()).resolves.toBe(true);
  });

  test("declining is reported to the caller", async () => {
    __setDeferredPrompt(fakeEvent("dismissed"));
    await expect(showInstallPrompt()).resolves.toBe(false);
  });

  test("the event is single-use — Chrome refuses a second prompt() on it", async () => {
    __setDeferredPrompt(fakeEvent("accepted"));
    await showInstallPrompt();
    expect(hasDeferredPrompt()).toBe(false);
    await expect(showInstallPrompt()).resolves.toBe(false);
  });

  test("a throwing prompt resolves false instead of escaping into the UI", async () => {
    const event = {
      prompt: vi.fn(async () => {
        throw new Error("already used");
      }),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    } as unknown as BeforeInstallPromptEvent;
    __setDeferredPrompt(event);
    await expect(showInstallPrompt()).resolves.toBe(false);
  });
});

describe("onInstallPromptAvailable", () => {
  function fakeEvent(): BeforeInstallPromptEvent {
    return {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    } as unknown as BeforeInstallPromptEvent;
  }

  test("fires immediately when a prompt was already captured", () => {
    __setDeferredPrompt(fakeEvent());
    const listener = vi.fn();
    onInstallPromptAvailable(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("fires later when the prompt arrives after subscribing", () => {
    // The regression this guards: the hint used to sample `hasDeferredPrompt()`
    // once at a fixed delay. Chrome fires `beforeinstallprompt` only after the
    // service worker registers, which is deferred to `load`, so on a slow
    // connection the single sample missed it and the hint never appeared.
    const listener = vi.fn();
    onInstallPromptAvailable(listener);
    expect(listener).not.toHaveBeenCalled();

    __setDeferredPrompt(fakeEvent());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a torn-down subscriber is not called", () => {
    const listener = vi.fn();
    const off = onInstallPromptAvailable(listener);
    off();
    __setDeferredPrompt(fakeEvent());
    expect(listener).not.toHaveBeenCalled();
  });
});
