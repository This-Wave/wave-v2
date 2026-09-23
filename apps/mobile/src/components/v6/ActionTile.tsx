import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * The one action on Home, as a tile: a lime disc, a glyph, a label.
 *
 * Sits inside the ink header so the primary journey starts above the fold
 * without a full-width button competing with the Wave card below it.
 */
export function ActionTile({
  label,
  meta,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  meta?: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[label, meta].filter(Boolean).join(". ")}
      accessibilityState={{ disabled: !!disabled }}
      className={`flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5 active:bg-hairline ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-pill bg-lime">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
          {label}
        </Text>
        {meta ? (
          <Text className="font-sans text-body text-muted" numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
