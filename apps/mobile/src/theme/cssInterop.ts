import { Animated } from "react-native";
import { cssInterop } from "nativewind";

/**
 * NativeWind v4 styles React Native's core components out of the box; anything
 * else must be registered to accept `className`. v2 transformed every
 * component, so these relied on it: the tab bar and the root fade shell animate
 * `Animated.View`s that also carry Tailwind classes, and without this the tab
 * bar collapses. Imported once, before the app renders.
 */
cssInterop(Animated.View, { className: "style" });
