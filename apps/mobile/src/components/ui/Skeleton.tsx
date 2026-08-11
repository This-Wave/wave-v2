import { useEffect, useRef } from "react";
import { Animated, Easing, type DimensionValue } from "react-native";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
}

// v5 screen 21: #E3EBDB fill, opacity pulses 0.5 -> 1 over 1.4s ease-in-out.
export function Skeleton({ width = "100%", height = 16, radius = 24, className }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-surface-skeleton ${className ?? ""}`}
      style={{ width, height, borderRadius: radius, opacity }}
    />
  );
}
