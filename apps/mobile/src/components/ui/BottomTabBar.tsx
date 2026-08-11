import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { ComponentType } from "react";
import type { IconProps } from "../icons";
import { colors, shadowCard } from "../../theme/tokens";

export interface TabConfig {
  name: string;
  label: string;
  // Accepts both the v5 icon set and the Lucide icons the rider/shop tabs still use.
  icon: ComponentType<IconProps>;
}

/**
 * v5 tab bar: a detached 64px pill floating 16px off every edge — white, 24px
 * radius, hairline border. The active tab becomes a 40px solid-green tile with a
 * lime glyph; inactive tabs are bare 18px muted glyphs with no label.
 */
export function createBottomTabBar(tabs: TabConfig[]) {
  return function TabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    return (
      <View
        className="absolute left-4 right-4 h-16 flex-row items-center justify-around rounded-card border border-border bg-surface"
        style={[{ bottom: Math.max(insets.bottom, 16) }, shadowCard]}
      >
        {state.routes.map((route, index) => {
          const tab = tabs.find((t) => t.name === route.name);
          if (!tab) return null;
          const isFocused = state.index === index;
          const Icon = tab.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              onPress={() => navigation.navigate(route.name)}
              className={`h-10 w-10 items-center justify-center ${
                isFocused ? "rounded-tile bg-wave-500" : ""
              }`}
            >
              <Icon
                size={isFocused ? 17 : 18}
                color={isFocused ? colors.lime : colors.muted}
                strokeWidth={isFocused ? 1.9 : 1.6}
              />
            </Pressable>
          );
        })}
      </View>
    );
  };
}
