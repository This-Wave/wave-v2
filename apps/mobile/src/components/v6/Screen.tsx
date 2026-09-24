import { Platform, SafeAreaView, ScrollView, View, RefreshControl } from "react-native";
import { useContext, type ReactNode } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useLayout } from "../../hooks/useLayout";
import { useNavBarStore, useReportNavBarScroll } from "../../hooks/useNavBarScroll";
import { layout } from "../../theme/layout";

/**
 * Every v6 screen sits on the canvas (#f7f7f7), never on white. White is a
 * *card* colour — the value step between the two is what separates content in
 * this system, so a white screen background would flatten every card on it.
 *
 * On wide desktop, `narrow` caps checkout stacks. Phone + responsive web stay
 * full-bleed.
 */
export function Screen({
  children,
  className = "",
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Cap width on desktop for form / payment stacks. */
  narrow?: boolean;
}) {
  const { isDesktop } = useLayout();
  const frame =
    narrow && isDesktop ? (
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: layout.narrowMaxWidth,
          alignSelf: "center",
        }}
      >
        {children}
      </View>
    ) : (
      children
    );

  return <SafeAreaView className={`flex-1 bg-canvas ${className}`}>{frame}</SafeAreaView>;
}

/**
 * Scrolling body with the standard gutter. `bottomInset` clears the tab
 * bar or a docked action bar.
 */
/**
 * Height of the floating tab bar plus its bottom offset.
 *
 * Only owed by screens that actually sit under it. The checkout screens are
 * pushed onto the stack as siblings of the tab navigator, so they have no tab
 * bar at all and adding this to them would open 88px of dead space above their
 * action bar. Reading the tab-bar height *context* is the safe test: it is
 * undefined outside a tab navigator, where the `useBottomTabBarHeight` hook
 * would throw.
 */
export const FLOATING_NAV_CLEARANCE = 88;

/** Extra clearance when the live-order card is riding above the nav. */
export const LIVE_BAR_CLEARANCE = 72;

export function ScreenBody({
  children,
  bottomInset = 24,
  className = "",
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  bottomInset?: number;
  className?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** @deprecated Prefer `<Screen narrow>` so the header stays aligned. */
  narrow?: boolean;
}) {
  const onScroll = useReportNavBarScroll();
  const underFloatingNav = useContext(BottomTabBarHeightContext) !== undefined;
  // The live-order card floats above the nav, so it owes clearance of its own.
  const liveBar = useNavBarStore((s) => s.liveBar);

  return (
    <ScrollView
      onScroll={onScroll}
      // 16 is enough for the direction test in `useNavBarScroll` without
      // running the handler on every frame.
      scrollEventThrottle={16}
      className={`flex-1 ${className}`}
      // The tab bar floats over the content now rather than sitting under it,
      // so every screen owes it clearance or the last row is unreachable.
      contentContainerStyle={{
        paddingBottom:
          bottomInset +
          (underFloatingNav ? FLOATING_NAV_CLEARANCE : 0) +
          (underFloatingNav && liveBar ? LIVE_BAR_CLEARANCE : 0),
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
      // Web only, and it is not cosmetic. React Native Web renders this as a
      // scrollable div with no tab stop, so on a screen whose only control sits
      // outside it in the ActionBar — the order summary, for one — a keyboard
      // user cannot scroll the page at all and simply never sees the total.
      // On native the platform handles scrolling and a tabIndex means nothing.
      {...(Platform.OS === "web" ? ({ tabIndex: 0 } as object) : {})}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** Horizontal gutter — 24px on phone, 40px on wide web. */
export function Gutter({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: object;
}) {
  const { gutter } = useLayout();
  return (
    <View className={className} style={[{ paddingHorizontal: gutter }, style]}>
      {children}
    </View>
  );
}

/**
 * The docked action bar at the foot of a screen. Sits on the canvas with a
 * hairline above it — no shadow, no elevation. The reference reserves shadow
 * for floating elements only.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  const { gutter } = useLayout();
  return (
    <View
      className="border-t border-hairline bg-canvas pb-8 pt-4"
      style={{ paddingHorizontal: gutter }}
    >
      {children}
    </View>
  );
}
