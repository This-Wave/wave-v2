import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Platform } from "react-native";

/**
 * Soft crossfade when RootNavigator swaps auth ↔ role navigators (e.g. after profile setup).
 */
export function RootFadeShell({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [routeKey, opacity]);

  return (
    <Animated.View style={{ flex: 1, opacity }} className="flex-1">
      {children}
    </Animated.View>
  );
}
