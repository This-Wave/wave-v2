import { Pressable, Text, View } from "react-native";
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

// One bar serves all three roles; the route name picks the glyph.
const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  // student
  Home: HomeIcon,
  Orders: BoxIcon,
  Checkpoints: PinIcon,
  Profile: UserIcon,
  // rider
  Feed: BoltIcon,
  MyOrders: BoxIcon,
  Earnings: WalletIcon,
  // shop owner
  Dashboard: DashboardIcon,
  ShopOrders: CartIcon,
  Menu: BoxIcon, // shop route "ShopOrders" carries the cart, so Menu keeps the box
  Settings: SettingsIcon,
};

/**
 * Flat bottom navigation. v5 floated a rounded pill above the content; the
 * reference has no such object — navigation is a plain bar with a hairline, and
 * the content scrolls to meet it.
 *
 * Active state is ink text plus a small lime dot. Lime cannot carry the label
 * itself (far too low contrast at 14px), so the accent marks the position while
 * ink does the reading.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View className="flex-row border-t border-hairline bg-surface pb-7 pt-2">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = (options.tabBarLabel as string) ?? route.name;
        const Icon = ICONS[route.name] ?? HomeIcon;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
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
            className="flex-1 items-center gap-1 py-1"
          >
            <Icon size={22} color={focused ? colors.ink : colors.muted} strokeWidth={1.7} />
            <Text
              className={`text-caption ${
                focused ? "font-sans-semibold text-ink" : "font-sans text-muted"
              }`}
            >
              {label}
            </Text>
            <View
              className={`h-1 w-1 rounded-pill ${focused ? "bg-lime" : "bg-transparent"}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
