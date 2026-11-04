import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  BoltIcon,
  BoxIcon,
  CartIcon,
  DashboardIcon,
  HomeIcon,
  PinIcon,
  SettingsIcon,
  UserIcon,
  WalletIcon,
  type IconProps,
} from "../icons";
import { colors } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  Home: HomeIcon,
  Orders: BoxIcon,
  Checkpoints: PinIcon,
  Profile: UserIcon,
  Feed: BoltIcon,
  MyOrders: BoxIcon,
  Earnings: WalletIcon,
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
 * Docked, full-width tab bar for phone and narrow web (canvas, 2026-10-21).
 * Hidden on wide desktop, where `SideNav` takes over.
 *
 * It replaces the floating pill. The pill needed a shadow to read as floating,
 * and v6 keeps shadow for the search capsule and sheets only; it also covered
 * the last row of every list. A docked bar with a hairline top edge is the
 * pattern every phone user already knows (Jakob's law), the labels never
 * disappear (recognition over recall), and each tab is a full-height target
 * (Fitts's law). The current tab gets the lime pill behind its icon: the one
 * accent, used once.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();

  if (isDesktop) {
    return null;
  }

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-hairline bg-surface px-2 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
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
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            className="min-h-[56px] flex-1 items-center justify-center gap-1 active:opacity-70"
          >
            <View
              className={`relative h-[30px] w-14 items-center justify-center rounded-pill ${
                focused ? "bg-lime" : ""
              }`}
            >
              <Icon size={22} color={focused ? colors.ink : colors.muted} strokeWidth={focused ? 2 : 1.8} />
              {options.tabBarBadge != null ? (
                <View
                  className="absolute -right-1 -top-1 min-h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-ink px-1"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text className="font-sans-semibold text-caption text-white">
                    {String(options.tabBarBadge)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className={`text-caption ${focused ? "font-sans-semibold text-ink" : "font-sans-medium text-muted"}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
