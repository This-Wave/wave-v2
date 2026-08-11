import { Pressable, ScrollView, Text, View, Platform } from "react-native";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { layout } from "../../theme/layout";
import { IconCircle } from "./Controls";

/**
 * Desktop right inspector. Sits beside the main stage so secondary flows
 * (track order, calendar, payment info) don't replace the whole page.
 */
export function RightPanel({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <View
      className={Platform.OS === "web" ? "wave-panel-enter" : undefined}
      style={{
        width: layout.rightPanelWidth,
        height: "100%",
        backgroundColor: colors.surface,
        borderLeftWidth: 1,
        borderLeftColor: colors.hairline,
      }}
    >
      <View className="flex-row items-center justify-between border-b border-hairline px-5 py-4">
        <Text className="flex-1 pr-3 font-sans-semibold text-ui text-ink" numberOfLines={1}>
          {title}
        </Text>
        <IconCircle onPress={onClose} accessibilityLabel="Close panel">
          <CloseIcon size={18} color={colors.ink} strokeWidth={2} />
        </IconCircle>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: footer ? 12 : 32 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View className="border-t border-hairline px-5 py-4">{footer}</View>
      ) : null}
    </View>
  );
}

/** Dim the main stage when a panel is open (click closes). */
export function PanelScrim({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Dismiss panel"
      className={Platform.OS === "web" ? "wave-scrim-enter" : undefined}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(8,52,0,0.08)",
        zIndex: 1,
      }}
    />
  );
}
