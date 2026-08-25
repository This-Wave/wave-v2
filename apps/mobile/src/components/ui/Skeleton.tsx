import { useEffect, useRef } from "react";
import { Animated, Easing, type DimensionValue } from "react-native";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
}

// v5 screen 21: #E3EBDB fill, opacity pulses 0.5 -> 1 over 1.4s ease-in-out.
export function Skeleton({ width = "100%", height = 16, radius = 24, className }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // The pulse loops for as long as the list is loading, which on a slow
    // campus connection is a long time to sit under a throbbing rectangle.
    // Continuous motion is exactly what "reduce motion" is asking us to stop
    // (review 10-a11y, M2), so hold a steady mid-opacity instead: the
    // placeholder still reads as "not real content yet" without moving.
    if (reducedMotion) {
      opacity.setValue(0.75);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      className={`bg-surface-skeleton ${className ?? ""}`}
      style={{ width, height, borderRadius: radius, opacity }}
    />
  );
}
