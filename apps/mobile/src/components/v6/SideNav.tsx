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
  WaveMarkIcon,
  type IconProps,
} from "../icons";
import { useWave } from "../../lib/wave";
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
        {/* v7 canvas: the mark and wordmark, then the menu as capitalised
            keys; the active one sits on wash inside an ink edge. */}
        <View className="mb-8 flex-row items-center px-1" style={{ gap: 8 }} accessible accessibilityLabel="Wave">
          <WaveMarkIcon size={34} />
          <Text className="font-sans-bold text-ink" style={{ fontSize: 24, letterSpacing: -0.8 }}>wave</Text>
        </View>

        <View style={{ gap: 8 }}>
          {menu.items.map(({ label, tab, Icon }) => {
            const focused = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={() => goToTab(tab)}
                className={`min-h-[52px] flex-row items-center rounded-input border-2 px-4 ${
                  focused ? "border-ink bg-wash" : "border-transparent"
                }`}
                style={{ gap: 14 }}
              >
                <Icon size={20} color={focused ? colors.ink : colors.muted} strokeWidth={1.9} />
                <Text className={`font-sans-bold text-ui uppercase tracking-wider ${focused ? "text-ink" : "text-muted"}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {role === "student" || role === "rider" ? <WaveCard /> : (
        <Text className="px-2 font-sans text-caption text-muted">{menu.footer}</Text>
      )}
    </View>
  );
}

/** v7 canvas: today's Wave and its countdown, pinned to the foot of the menu. */
function WaveCard() {
  const wave = useWave();
  const closed = !wave || wave.closed;
  return (
    <Pressable
      onPress={() => {
        if (navigationRef.isReady()) navigationRef.dispatch(CommonActions.navigate({ name: "WaveCalendar" }));
      }}
      accessibilityRole="button"
      accessibilityLabel={closed ? "Today's Wave has left. Pick another day" : `${wave.name}, ${wave.countdown} left to order`}
      className="rounded-card border border-hairline bg-surface p-4"
    >
      <Text className="font-sans-bold text-ui text-ink">{closed ? "Today's Wave has left" : wave.name}</Text>
      <Text className="font-sans text-body text-muted">{closed ? "Pick another day" : "Order by 12 noon"}</Text>
      {closed ? null : <Text className="mt-2 font-display text-heading text-ink">{wave.countdown}</Text>}
    </Pressable>
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
  // The Send flow is a stack screen, but on desktop it is a menu destination.
  if (name === "PickupRequest" && tabNames.includes("Send")) return "Send";
  if (name && tabNames.includes(name)) return name;
  return null;
}
