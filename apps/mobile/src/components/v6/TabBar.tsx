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

/**
 * Bottom bar for phone + narrow web. Hidden on wide desktop (SideNav instead).
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDesktop } = useLayout();
  if (isDesktop) {
    return null;
  }

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
            className="relative flex-1 items-center gap-1 py-1"
          >
            <Icon size={22} color={focused ? colors.ink : colors.muted} strokeWidth={1.7} />
            {options.tabBarBadge != null ? (
              <View
                className="absolute -right-2 -top-1 min-h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-lime px-1"
                accessibilityLabel={`${options.tabBarBadge} updates`}
              >
                <Text className="font-sans-semibold text-caption text-ink">
                  {String(options.tabBarBadge)}
                </Text>
              </View>
            ) : null}
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
