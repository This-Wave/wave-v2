import { Platform } from "react-native";
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

function motionAnimation(motion: StackMotion): NativeStackNavigationOptions["animation"] {
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
