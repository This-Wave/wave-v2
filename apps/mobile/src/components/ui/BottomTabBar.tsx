import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

export interface TabConfig {
  name: string;
  label: string;
  icon: LucideIcon;
}

export function createBottomTabBar(tabs: TabConfig[]) {
  return function TabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    return (
      <View className="flex-row border-t border-border bg-surface pt-2.5" style={{ paddingBottom: insets.bottom }}>
        {state.routes.map((route, index) => {
          const tab = tabs.find((t) => t.name === route.name);
          if (!tab) return null;
          const isFocused = state.index === index;
          const Icon = tab.icon;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              className="flex-1 items-center gap-0.5"
            >
              <Icon size={22} color={isFocused ? "#2EA64E" : "#9E9E9E"} strokeWidth={2} />
              <Text className={`text-[10px] ${isFocused ? "font-sans-semibold text-wave-500" : "text-muted"}`}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };
}
