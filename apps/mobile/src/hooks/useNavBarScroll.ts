import { useEffect } from "react";
import { create } from "zustand";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * Scroll direction, shared between the screen doing the scrolling and the tab
 * bar reacting to it.
 *
 * A store rather than props or context because the tab bar is rendered by the
 * navigator, not by the screen — they are siblings in the tree with no path
 * between them.
 *
 * `THRESHOLD` exists because a bar that resizes on every pixel of movement
 * flickers during the small vertical drift of a horizontal swipe, and because
 * a list bounced at its top would otherwise flip the bar twice on release.
 * 12px is roughly a deliberate flick and well above that noise.
 */
const THRESHOLD = 12;

/** Below this the list is at rest at the top, where the bar is always full. */
const TOP = 24;

export const useNavBarStore = create<{
  compact: boolean;
  /** Whether the live-order card is floating above the nav right now. */
  liveBar: boolean;
  lastY: number;
  setCompact: (compact: boolean) => void;
  setLiveBar: (liveBar: boolean) => void;
  reset: () => void;
  report: (y: number) => void;
}>((set, get) => ({
  compact: false,
  liveBar: false,
  lastY: 0,
  setCompact: (compact) => set({ compact }),
  setLiveBar: (liveBar) => set({ liveBar }),
  reset: () => set({ compact: false, lastY: 0 }),
  report: (y) => {
    const { lastY } = get();
    const delta = y - lastY;

    if (y <= TOP) {
      set({ lastY: y, compact: false });
      return;
    }
    if (Math.abs(delta) < THRESHOLD) return;

    // Down into the content shrinks it; back up brings it and its labels back.
    set({ lastY: y, compact: delta > 0 });
  },
}));

/** Read the current state. Used by the tab bar. */
export function useNavBarScroll(): { compact: boolean } {
  const compact = useNavBarStore((s) => s.compact);
  return { compact };
}

/**
 * Report scroll from a screen, and restore the bar when the screen unmounts —
 * otherwise navigating away mid-scroll leaves the next screen's bar compact
 * with nothing to explain why.
 */
export function useReportNavBarScroll(): (e: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const report = useNavBarStore((s) => s.report);
  const reset = useNavBarStore((s) => s.reset);

  useEffect(() => reset, [reset]);

  return (e) => report(e.nativeEvent.contentOffset.y);
}
