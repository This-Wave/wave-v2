import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export interface QuickAction {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * The row of square-ish action tiles from the reference: a disc, a glyph, a
 * label underneath.
 *
 * The reference runs four across, and three of its four were Orders,
 * Checkpoints and Account — which are the bottom tabs, one row further down. A
 * shortcut to somewhere already one tap away is not a shortcut, so this carries
 * only what Wave can actually do from here: send a package, and ask for a shop.
 * Two tiles also stay legible at 390pt, where four labels have to be truncated
 * or shrunk below the floor the type scale sets for outdoor reading.
 *
 * Tiles are white on canvas with no border, per the system: the reference
 * outlines them, but separation here is value contrast and nothing on content
 * carries a border or a shadow.
 */
export function QuickTiles({ actions }: { actions: QuickAction[] }) {
  return (
    <View className="flex-row" style={{ gap: 12 }}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: !!action.disabled }}
          className={`flex-1 items-center rounded-card bg-surface px-3 py-3.5 active:bg-hairline ${
            action.disabled ? "opacity-50" : ""
          }`}
        >
          <View className="mb-2 h-10 w-10 items-center justify-center rounded-pill bg-lime">
            {action.icon}
          </View>
          <Text
            className="text-center font-sans-medium text-body text-ink"
            numberOfLines={2}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
