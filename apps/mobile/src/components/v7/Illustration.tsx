import { useEffect, useRef } from "react";
import { Animated, Easing, Image, type ImageStyle } from "react-native";
import { useReducedMotion } from "../../hooks/useReducedMotion";

import box from "../../../assets/illustrations/box.png";
import pillow from "../../../assets/illustrations/pillow.png";
import stroll from "../../../assets/illustrations/stroll.png";
import run from "../../../assets/illustrations/run.png";

const SOURCES = { box, pillow, stroll, run };
export type IllustrationName = keyof typeof SOURCES;


/**
 * v7 illustration: the Wave characters from the launch artwork, floating
 * gently (8px, 4.5s loop). Decorative, so hidden from screen readers.
 */
export function Illustration({ name, width, height, style }: { name: IllustrationName; width: number; height: number; style?: ImageStyle }) {
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -8, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, y]);
  return (
    <Animated.Image
      source={SOURCES[name]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      resizeMode="contain"
      style={[{ width, height, transform: [{ translateY: y }] }, style]}
    />
  );
}

/** Rises 16px and fades in, `delay` ms after mount. The v7 entrance. */
export function Rise({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [delay, reduced, v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

export { Image };
