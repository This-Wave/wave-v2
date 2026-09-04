import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Everything the "add Wave to your home screen" hint needs to know, kept out of
 * the component so it can be tested without a DOM.
 *
 * Wave's pilot ships as a web app that students are asked to install, so this is
 * not a nicety — it is how the product gets onto a phone. The two platforms need
 * completely different handling, which is the reason this file exists at all:
 *
 *  - **Android/Chrome** fires `beforeinstallprompt`, which can be captured and
 *    replayed later against a real button. The browser also shows its own UI
 *    eventually, but only on its own schedule.
 *  - **iOS Safari** has no equivalent API and never will. The only way in is the
 *    Share sheet, so all we can do is tell the student the gesture.
 */

const DISMISSED_KEY = "wave_install_hint_dismissed";

/**
 * The `beforeinstallprompt` event, which is not in TypeScript's DOM lib because
 * it is not a standard.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let subscribers: Array<() => void> = [];

/**
 * Starts listening for `beforeinstallprompt`.
 *
 * Must run as early as possible: the browser fires this once, shortly after
 * load, and an event nobody was listening for is simply gone — there is no way
 * to ask for it again. Returns a teardown so `useEffect` can own it.
 */
export function captureInstallPrompt(): () => void {
  if (Platform.OS !== "web" || typeof window === "undefined") return () => {};

  const onBeforeInstall = (event: Event) => {
    // Deliberately NOT `preventDefault()`. Suppressing the browser's own install
    // affordance would be safe only if Wave always showed its own, and it does
    // not: the hint needs a signed-in profile, and it treats unreadable storage
    // as "already dismissed". Calling preventDefault here left a signed-out
    // Android visitor with no install path at all — neither Chrome's nor ours.
    // Stashing the event without cancelling it keeps both.
    deferredPrompt = event as BeforeInstallPromptEvent;
    for (const notify of subscribers) notify();
  };
  const onInstalled = () => {
    deferredPrompt = null;
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    window.removeEventListener("appinstalled", onInstalled);
    subscribers = [];
  };
}

/**
 * Calls `listener` when a prompt becomes available — immediately if one already
 * has been captured. Returns a teardown.
 *
 * Polling for this does not work reliably. Chrome fires `beforeinstallprompt`
 * only after the service worker registers, and registration is deferred to the
 * `load` event, so on a slow connection the event can land well after any fixed
 * delay. A single sample would miss it and the hint would never appear.
 */
export function onInstallPromptAvailable(listener: () => void): () => void {
  if (deferredPrompt) {
    listener();
    return () => {};
  }
  subscribers.push(listener);
  return () => {
    subscribers = subscribers.filter((s) => s !== listener);
  };
}

/** Whether a captured prompt is available to replay right now. */
export function hasDeferredPrompt(): boolean {
  return deferredPrompt !== null;
}

/**
 * Replays the captured prompt. Resolves to whether the student accepted.
 *
 * The event is single-use — Chrome refuses a second `prompt()` on the same
 * event — so it is cleared either way.
 */
export async function showInstallPrompt(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

/** Test seam. Not for production code. */
export function __setDeferredPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  if (event) for (const notify of subscribers) notify();
}

/**
 * Already running from the home screen.
 *
 * Two checks because the two platforms disagree: Android reports the standalone
 * display mode, while iOS Safari sets a non-standard `navigator.standalone` and
 * reports no display mode at all.
 */
export function isStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const displayMode = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

export type InstallPlatform = "android" | "ios" | "none";

/**
 * Which install story applies, from the user agent.
 *
 * `none` covers desktop, an already-installed app, and — importantly — Chrome
 * and Firefox **on iOS**. Those are Safari underneath but cannot add a
 * standalone app to the home screen, so showing them the Share-sheet
 * instruction would be telling a student to do something that does not work.
 */
export function detectInstallPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent || "";
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports a desktop Safari UA; the touch-point count gives it away.
  const isIpadOs =
    /Macintosh/.test(ua) &&
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1;

  if (isIosDevice || isIpadOs) {
    const isThirdPartyIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isThirdPartyIosBrowser ? "none" : "ios";
  }
  if (/Android/.test(ua)) return "android";
  return "none";
}

export async function hasDismissedInstallHint(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === "1";
  } catch {
    // Storage unavailable — treat as dismissed. Wave cannot tell whether it has
    // already asked, and nagging on every launch is worse than not asking. This
    // is only acceptable because `captureInstallPrompt` no longer cancels the
    // browser's own install affordance, so these users still have a way in.
    return true;
  }
}

export async function markInstallHintDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Non-critical.
  }
}
