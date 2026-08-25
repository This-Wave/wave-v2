import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Platform } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * Soft crossfade when RootNavigator swaps auth ↔ role navigators (e.g. after profile setup).
 */
export function RootFadeShell({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // A crossfade is gentler than a slide, but "reduce motion" also covers
    // fades on iOS, and the swap this softens is a whole-navigator change —
    // appearing instantly is a perfectly good outcome.
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }

    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [routeKey, opacity, reducedMotion]);

  return (
    <Animated.View style={{ flex: 1, opacity }} className="flex-1">
      {children}
    </Animated.View>
  );
}
