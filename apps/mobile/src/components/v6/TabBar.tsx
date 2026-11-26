import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  BoxIcon,
  CartIcon,
  DashboardIcon,
  HomeIcon,
  PinIcon,
  SettingsIcon,
  UserIcon,
  ListIcon,
  GiftIcon,
  PlusIcon,
  type IconProps,
} from "../icons";
import { colors } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  Home: HomeIcon,
  Orders: ListIcon,
  Send: PlusIcon,
  Checkpoints: PinIcon,
  Profile: UserIcon,
  Feed: ListIcon,
  MyOrders: BoxIcon,
  Earnings: GiftIcon,
  Dashboard: DashboardIcon,
  ShopOrders: CartIcon,
  Menu: BoxIcon,
  Settings: SettingsIcon,
};

/** Height of the bar above the safe area. */
export const FULL = 64;

/** Kept for callers that position things above the bar (InstallHint). */
export const NAV_BOTTOM_GAP = 0;

/**
 * v7 floating pill nav (owner, 2026-11-26: "i love the whole floating pill nav
 * bar at the bottom"). A Sacramento pill held 16px off the edges. It sits in
 * its own row rather than over the content, so it never hides the last list
 * row (the reason v6 docked it). The current tab grows into a lime pill with
 * its label; the others are icons with accessible names. Hidden on desktop,
 * where `SideNav` takes over.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();

  if (isDesktop) {
    return null;
  }

  return (
    <View className="bg-canvas px-4 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
      <View
        accessibilityRole="tablist"
        className="h-[66px] flex-row items-center justify-around rounded-pill bg-ink px-2"
        style={{ shadowColor: "#000000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? route.name;
          const Icon = ICONS[route.name] ?? HomeIcon;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarBadge != null ? `${label}, ${String(options.tabBarBadge)} active` : label
              }
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              className={`h-12 flex-row items-center justify-center gap-1.5 rounded-pill active:opacity-80 ${
                focused ? "bg-lime px-4" : "w-12"
              }`}
            >
              <Icon size={21} color={focused ? colors.onLime : "#a9c2b8"} strokeWidth={2.1} />
              {focused ? (
                <Text numberOfLines={1} className="font-sans-bold text-meta text-on-lime">
                  {label}
                </Text>
              ) : null}
              {options.tabBarBadge != null ? (
                <View
                  className="absolute right-0.5 top-0.5 min-h-[16px] min-w-[16px] items-center justify-center rounded-pill bg-lime px-1"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text className="font-sans-bold text-caption text-on-lime">{String(options.tabBarBadge)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
