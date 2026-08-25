import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Whether the person using the app has asked their device to reduce motion
 * (review 10-a11y, M2).
 *
 * iOS: Settings → Accessibility → Motion → Reduce Motion.
 * Android: Settings → Accessibility → Remove animations.
 * Web: the `prefers-reduced-motion` media query.
 *
 * The setting exists because animation is not a neutral flourish for everyone —
 * for people with vestibular disorders, looping and sliding motion causes real
 * nausea and dizziness. Wave's worst offender is the skeleton placeholder,
 * which pulses forever while a list loads: on a slow campus connection that is
 * a long time to sit under a throbbing rectangle.
 *
 * Reads the current value once and then subscribes, because the setting can be
 * changed while the app is open — someone who turns it on mid-session is
 * usually turning it on *because of* what is currently on their screen.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (Platform.OS === "web") {
      // `matchMedia` is missing in some embedded webviews and during SSR.
      const mql =
        typeof window !== "undefined" && typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-reduced-motion: reduce)")
          : null;
      if (!mql) return;

      setReduced(mql.matches);
      const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
      // Safari below 14 only has the deprecated listener API.
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!cancelled) setReduced(value);
      })
      // Never let an accessibility probe break a render. Failing closed here
      // means animations stay on, which is the status quo, not a regression.
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}
