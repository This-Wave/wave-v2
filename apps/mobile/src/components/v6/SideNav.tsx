import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CommonActions } from "@react-navigation/native";
import {
  BoxIcon,
  CartIcon,
  DashboardIcon,
  GiftIcon,
  HomeIcon,
  ListIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
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
    footer: "Ashesi · Delivering every day",
    items: [
      { label: "Home", tab: "Home", Icon: HomeIcon },
      { label: "Orders", tab: "Orders", Icon: ListIcon },
      { label: "Send a package", tab: "Send", Icon: PlusIcon },
      { label: "You", tab: "Profile", Icon: UserIcon },
    ],
  },
  rider: {
    subtitle: "Runner",
    footer: "Ashesi · Live Wave feed",
    items: [
      { label: "Jobs", tab: "Feed", Icon: ListIcon },
      { label: "My jobs", tab: "MyOrders", Icon: BoxIcon },
      { label: "Earnings", tab: "Earnings", Icon: GiftIcon },
      { label: "You", tab: "Profile", Icon: UserIcon },
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
          <View className="h-9 w-9 items-center justify-center rounded-input bg-ink">
            <Text className="font-display text-ui text-lime">w</Text>
          </View>
          <View>
            <Text className="font-sans-bold text-subheading text-ink">wave</Text>
            <Text className="font-sans text-caption text-muted">{menu.subtitle}</Text>
          </View>
        </View>

        <Text className="mb-3 px-2 font-sans-bold text-body text-ink">Menu</Text>
        <View className="gap-1">
          {menu.items.map(({ label, tab, Icon }) => {
            const focused = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={() => goToTab(tab)}
                className={`flex-row items-center gap-3 rounded-input border-2 px-3 py-3 ${
                  focused ? "border-ink bg-wash" : "border-transparent"
                }`}
              >
                <Icon size={20} color={focused ? colors.ink : colors.muted} strokeWidth={1.7} />
                <Text
                  className={`font-sans-bold text-ui ${focused ? "text-ink" : "text-muted"}`}
                >
                  {label}
                </Text>

              </Pressable>
            );
          })}
        </View>
      </View>

      <Text className="px-2 font-sans text-caption text-muted">{menu.footer}</Text>
    </View>
  );
}

function goToTab(tab: string) {
  if (!navigationRef.isReady()) return;
  useDesktopPanelStore.getState().closePanel();
  // "Send" is a shortcut into the Send flow, not a tab page.
  if (tab === "Send") {
    navigationRef.dispatch(CommonActions.navigate({ name: "PickupRequest" }));
    return;
  }
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
