import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
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
import { colors, shadowFloating } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useNavBarScroll } from "../../hooks/useNavBarScroll";

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

export const FULL = 64;
export const COMPACT = 52;

/** Distance from the bottom edge the pill floats at, above the safe area. */
export const NAV_BOTTOM_GAP = 12;

/**
 * Floating pill navigation for phone and narrow web. Hidden on wide desktop,
 * where `SideNav` takes over.
 *
 * Two departures from the old docked bar, both deliberate:
 *
 * **It floats.** v6 reserves elevation for the search capsule and sheets, and
 * content cards get none. A bar that hovers over scrolling content has to cast
 * a shadow or it reads as a card that has come loose from the list. So this is
 * the second — and last — element in the system allowed one. `tokens.ts` says
 * so, rather than leaving the next person to infer it from this file.
 *
 * **It shrinks as you read down.** Scrolling down drops the labels and tightens
 * the pill to 52px; scrolling back up restores it. It never disappears: a
 * control that vanishes has to be hunted back with a scroll gesture before the
 * next action can even start, which trades one problem for a worse one. The
 * touch target is padded back to 44 in the compact state — 2.5.8 measures the
 * target, not the paint.
 *
 * Labels returning on scroll-up is also what keeps this honest for screen
 * readers: the accessible name never changes between states, only the visible
 * text does.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { compact } = useNavBarScroll();

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const to = compact ? 1 : 0;
    if (reduceMotion) {
      progress.setValue(to);
      return;
    }
    Animated.spring(progress, {
      toValue: to,
      useNativeDriver: false,
      friction: 9,
      tension: 90,
    }).start();
  }, [compact, reduceMotion, progress]);

  if (isDesktop) {
    return null;
  }

  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [FULL, COMPACT] });
  const labelOpacity = progress.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0] });
  const labelHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [15, 0] });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, NAV_BOTTOM_GAP),
      }}
    >
      <Animated.View
        style={[shadowFloating, { height }]}
        className="flex-row items-center rounded-pill bg-surface p-1.5"
      >
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
              accessibilityLabel={`${label} tab`}
              // The compact pill is 42px inside a 52px bar; the slop takes the
              // target past 44 without moving anything on screen.
              hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
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
              className={`relative h-full flex-1 items-center justify-center rounded-pill ${
                focused ? "bg-ink" : ""
              }`}
            >
              <Icon
                size={20}
                color={focused ? colors.white : colors.muted}
                strokeWidth={1.8}
              />
              {/* Height animates to zero rather than unmounting, so the pill
                  keeps a stable centre while it resizes. */}
              <Animated.View style={{ opacity: labelOpacity, height: labelHeight }}>
                <Text
                  numberOfLines={1}
                  className={`text-caption ${
                    focused ? "font-sans-semibold text-white" : "font-sans text-muted"
                  }`}
                >
                  {label}
                </Text>
              </Animated.View>

              {options.tabBarBadge != null ? (
                <View
                  className="absolute right-2 top-1 min-h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-lime px-1"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text className="font-sans-semibold text-caption text-ink">
                    {String(options.tabBarBadge)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}
