import { SafeAreaView, ScrollView, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Every v6 screen sits on the canvas (#f7f7f7), never on white. White is a
 * *card* colour — the value step between the two is what separates content in
 * this system, so a white screen background would flatten every card on it.
 */
export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <SafeAreaView className={`flex-1 bg-canvas ${className}`}>{children}</SafeAreaView>;
}

/**
 * Scrolling body with the standard 24px gutter. `bottomInset` clears the tab
 * bar or a docked action bar.
 */
export function ScreenBody({
  children,
  bottomInset = 24,
  className = "",
}: {
  children: ReactNode;
  bottomInset?: number;
  className?: string;
}) {
  return (
    <ScrollView
      className={`flex-1 ${className}`}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** Horizontal gutter wrapper — 24px, the one screen-edge padding in the system. */
export function Gutter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`px-gutter ${className}`}>{children}</View>;
}

/**
 * The docked action bar at the foot of a screen. Sits on the canvas with a
 * hairline above it — no shadow, no elevation. The reference reserves shadow
 * for floating elements only.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return <View className="border-t border-hairline bg-canvas px-gutter pb-8 pt-4">{children}</View>;
}
