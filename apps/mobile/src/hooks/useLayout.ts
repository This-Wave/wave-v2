import { useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import {
  gutterForWidth,
  layout,
  shopCardWidth,
  shopColumnCount,
} from "../theme/layout";
import { useDesktopPanelStore } from "../store/desktopPanelStore";

function useViewportWidth(): number {
  const { width: rnWidth } = useWindowDimensions();
  const [webWidth, setWebWidth] = useState(() =>
    Platform.OS === "web" && typeof window !== "undefined" ? window.innerWidth : rnWidth,
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const sync = () => setWebWidth(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);

    const mql = window.matchMedia(`(min-width: ${layout.desktopLayoutAt}px)`);
    const onMql = () => sync();
    mql.addEventListener("change", onMql);

    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      mql.removeEventListener("change", onMql);
    };
  }, []);

  return Platform.OS === "web" ? webWidth : rnWidth;
}

/**
 * `isDesktop` → wide web chrome. Main stage fills the window beside the nav
 * (and beside an open right panel). No artificial dead strip on the right.
 */
export function useLayout() {
  const windowWidth = useViewportWidth();
  const panelOpen = useDesktopPanelStore((s) => s.panel !== null);
  const isWeb = Platform.OS === "web";
  const minDesktopWidth = Math.max(layout.desktopLayoutAt, layout.sidebarWidth + 360);
  const isDesktop = isWeb && windowWidth >= minDesktopWidth;

  // Match StudentWebShell: sidebar + optional right panel + stage pad (28×2).
  const chrome =
    (isDesktop ? layout.sidebarWidth : 0) +
    (isDesktop && panelOpen ? layout.rightPanelWidth : 0) +
    (isDesktop ? 56 : 0);

  // Fill the main stage — do not cap below the window (that left a dead right strip).
  const contentWidth = isDesktop ? Math.max(320, windowWidth - chrome) : windowWidth;

  const shopColumns = isDesktop ? Math.max(2, shopColumnCount(contentWidth)) : 2;
  const cardWidth = isDesktop
    ? shopCardWidth(contentWidth, shopColumns, 16)
    : shopCardWidth(contentWidth, 2, 12);

  return {
    isWeb,
    isDesktop,
    windowWidth,
    contentWidth,
    gutter: isDesktop ? layout.gutterDesktop : gutterForWidth(contentWidth),
    shopColumns,
    cardWidth,
    useShopGrid: isDesktop,
    pageMaxWidth: layout.pageMaxWidth,
    narrowMaxWidth: layout.narrowMaxWidth,
    searchMaxWidth: layout.searchMaxWidth,
    sidebarWidth: layout.sidebarWidth,
    rightPanelWidth: layout.rightPanelWidth,
    panelOpen,
  };
}
