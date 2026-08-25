import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CommonActions } from "@react-navigation/native";
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
import { layout } from "../../theme/layout";
import { navigationRef } from "../../lib/navigationRef";
import { useDesktopPanelStore } from "../../store/desktopPanelStore";

export type AppRole = "student" | "rider" | "shop";

type NavItem = {
  label: string;
  tab: string;
  Icon: (p: IconProps) => JSX.Element;
};

const MENUS: Record<AppRole, { subtitle: string; footer: string; items: NavItem[] }> = {
  student: {
    subtitle: "Campus delivery",
    footer: "Ashesi · Sunday & Wednesday Waves",
    items: [
      { label: "Home", tab: "Home", Icon: HomeIcon },
      { label: "Orders", tab: "Orders", Icon: BoxIcon },
      { label: "Checkpoints", tab: "Checkpoints", Icon: PinIcon },
      { label: "Profile", tab: "Profile", Icon: UserIcon },
    ],
  },
  rider: {
    subtitle: "Runner",
    footer: "Ashesi · Live Wave feed",
    items: [
      { label: "Feed", tab: "Feed", Icon: BoltIcon },
      { label: "Deliveries", tab: "MyOrders", Icon: BoxIcon },
      { label: "Earnings", tab: "Earnings", Icon: WalletIcon },
      { label: "Profile", tab: "Profile", Icon: UserIcon },
    ],
  },
  shop: {
    subtitle: "Shop owner",
    footer: "Ashesi · Your storefront",
    items: [
      { label: "Today", tab: "Dashboard", Icon: DashboardIcon },
      { label: "Orders", tab: "ShopOrders", Icon: CartIcon },
      { label: "Menu", tab: "Menu", Icon: BoxIcon },
      { label: "Settings", tab: "Settings", Icon: SettingsIcon },
    ],
  },
};

/**
 * Desktop-only left nav — role-aware site chrome.
 * Mobile keeps the bottom TabBar.
 */
export function SideNav({ role }: { role: AppRole }) {
  const menu = MENUS[role];
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = navigationRef.addListener("state", () => {
      setTick((n) => n + 1);
    });
    return unsub;
  }, []);

  const tabNames = menu.items.map((i) => i.tab);
  const activeTab = readActiveTab(navigationRef.getRootState(), tabNames);

  return (
    <View
      style={{
        width: layout.sidebarWidth,
        height: "100%",
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.hairline,
        paddingTop: 32,
        paddingBottom: 28,
        paddingHorizontal: 20,
        justifyContent: "space-between",
      }}
    >
      <View>
        <View className="mb-12 flex-row items-center gap-2.5 px-2">
          <View className="h-9 w-9 items-center justify-center rounded-pill bg-lime">
            <Text className="font-sans-bold text-ui text-ink">W</Text>
          </View>
          <View>
            <Text className="font-sans-bold text-subheading text-ink">wave</Text>
            <Text className="font-sans text-caption text-muted">{menu.subtitle}</Text>
          </View>
        </View>

        <Text className="mb-3 px-2 font-sans-semibold text-meta text-muted">MENU</Text>
        <View className="gap-1">
          {menu.items.map(({ label, tab, Icon }) => {
            const focused = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={() => goToTab(tab)}
                className={`flex-row items-center gap-3 rounded-input px-3 py-3 ${
                  focused ? "bg-lime-faint" : ""
                }`}
              >
                <Icon size={20} color={focused ? colors.ink : colors.muted} strokeWidth={1.7} />
                <Text
                  className={`font-sans-medium text-ui ${focused ? "text-ink" : "text-muted"}`}
                >
                  {label}
                </Text>
                {focused ? (
                  <View className="ml-auto h-1.5 w-1.5 rounded-pill bg-lime" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text className="px-2 font-sans text-caption text-subtle">{menu.footer}</Text>
    </View>
  );
}

function goToTab(tab: string) {
  if (!navigationRef.isReady()) return;
  useDesktopPanelStore.getState().closePanel();
  navigationRef.dispatch(
    CommonActions.navigate({
      name: "Tabs",
      params: { screen: tab },
    }),
  );
}

function readActiveTab(
  state: ReturnType<typeof navigationRef.getRootState>,
  tabNames: string[],
): string | null {
  if (!state) return null;
  let current: { name?: string; state?: typeof state } | undefined = state.routes[
    state.index ?? 0
  ] as { name?: string; state?: typeof state };

  while (current?.state?.routes?.length) {
    const nested = current.state;
    current = nested.routes[nested.index ?? 0] as typeof current;
  }

  const name = current?.name;
  if (name && tabNames.includes(name)) return name;
  return null;
}
