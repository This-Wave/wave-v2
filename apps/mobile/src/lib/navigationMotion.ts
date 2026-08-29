import { AccessibilityInfo, Platform } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

export type StackMotion = "auth" | "checkout" | "app";

/**
 * Set synchronously on `popstate` so the next stack transition can read it
 * before React Navigation applies screen options (browser back / forward / edge swipe).
 */
let skipNextTransition = false;

export function markHistoryNavigation(): void {
  if (Platform.OS === "web") {
    skipNextTransition = true;
  }
}

export function shouldSkipTransition(): boolean {
  return skipNextTransition;
}

export function clearSkipTransition(): void {
  skipNextTransition = false;
}

/**
 * Cached "reduce motion" preference (review 10-a11y, M2).
 *
 * Module-level rather than a hook because `stackScreenOptions` is a plain
 * function React Navigation calls while resolving screen options — the same
 * reason `skipNextTransition` lives here. Screen transitions are the app's
 * largest motion surface: full-screen slides are precisely what triggers
 * vestibular discomfort, far more than a 180ms fade.
 *
 * Defaults to `false`, so a device that never answers keeps today's behaviour.
 */
let reduceMotion = false;

/** Primes the cache and subscribes. Call once, at app start. */
export function initReducedMotionPreference(): () => void {
  if (Platform.OS === "web") {
    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (!mql) return () => undefined;
    reduceMotion = mql.matches;
    const onChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }

  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      reduceMotion = value;
    })
    // An accessibility probe must never break navigation setup.
    .catch(() => undefined);

  const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
    reduceMotion = value;
  });
  return () => subscription.remove();
}

/** Exposed for tests and for callers that need the same answer synchronously. */
export function prefersReducedMotion(): boolean {
  return reduceMotion;
}

function motionAnimation(motion: StackMotion): NativeStackNavigationOptions["animation"] {
  // Checked before anything else: when someone has asked for less motion, the
  // right transition is no transition, on every platform and every stack.
  if (reduceMotion) return "none";

  if (Platform.OS === "web") {
    if (shouldSkipTransition()) return "none";
    if (motion === "checkout") return "slide_from_right";
    return "fade";
  }

  switch (motion) {
    case "auth":
      return "fade_from_bottom";
    case "checkout":
      return "slide_from_right";
    default:
      return "default";
  }
}

/** Shared native-stack options — call from a function so motion is read per transition. */
export function stackScreenOptions(motion: StackMotion): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: motionAnimation(motion),
    gestureEnabled: Platform.OS !== "web",
    ...(Platform.OS === "ios" ? { animationDuration: 280 } : {}),
  };
}

export function tabsStackScreenOptions(): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: "none",
    gestureEnabled: false,
  };
}
