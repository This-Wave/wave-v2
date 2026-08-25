import { SafeAreaView, ScrollView, View, RefreshControl } from "react-native";
import type { ReactNode } from "react";
import { useLayout } from "../../hooks/useLayout";
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
  return (
    <ScrollView
      className={`flex-1 ${className}`}
      contentContainerStyle={{ paddingBottom: bottomInset, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
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
