import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { useMyOrders } from "../../lib/orders";
import { useLayout } from "../../hooks/useLayout";
import { openOrderTracking } from "../../lib/desktopNavigate";
import { statusPill } from "../../screens/student/orderPresenters";
import { StatusPill } from "./Controls";
import { shadowFloating } from "../../theme/tokens";
import { FULL, NAV_BOTTOM_GAP } from "./TabBar";
import { useNavBarStore } from "../../hooks/useNavBarScroll";

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

/**
 * Persistent strip when the student has an active delivery.
 *
 * It used to dock to the bottom edge, above a docked tab bar. The tab bar
 * floats now, so a docked strip ends up *underneath* it — the first run after
 * that change had this sitting behind the nav pill with its "Track" control
 * unreachable. On phone and narrow web it floats too, riding just above the
 * nav and borrowing the same card language. Desktop keeps the docked form,
 * where `SideNav` takes the nav role and there is no pill to clear.
 */
export function LiveOrderBar() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();
  const { data: orders } = useMyOrders();

  const live = (orders ?? []).find((o) => LIVE.includes(o.status));

  // Screens need to know this is here so their last row is not left under it.
  const setLiveBar = useNavBarStore((s) => s.setLiveBar);
  const showing = !!live && !isDesktop;
  useEffect(() => {
    setLiveBar(showing);
    return () => setLiveBar(false);
  }, [showing, setLiveBar]);

  if (!live) return null;

  const pill = statusPill(live.status);

  if (isDesktop) {
    return (
      <Pressable
        onPress={() => openOrderTracking(navigation, live.id)}
        accessibilityRole="button"
        accessible
        accessibilityLabel={`${live.shop?.name ?? "Your order"}, ${pill.label}. Track it.`}
        className="border-t border-hairline bg-surface px-4 py-3 active:bg-hairline"
      >
        <Body live={live} pill={pill} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => openOrderTracking(navigation, live.id)}
      accessibilityRole="button"
      accessible
      accessibilityLabel={`${live.shop?.name ?? "Your order"}, ${pill.label}. Track it.`}
      style={[
        shadowFloating,
        {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, NAV_BOTTOM_GAP) + FULL + 8,
        },
      ]}
      className="rounded-card bg-surface px-4 py-3 active:bg-hairline"
    >
      <Body live={live} pill={pill} />
    </Pressable>
  );
}

function Body({
  live,
  pill,
}: {
  live: { shop?: { name?: string } | null; checkpoint?: { name?: string } | null };
  pill: { label: string; tone: "neutral" | "active" | "done" | "danger" };
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
          {live.shop?.name ?? "Your order"}
        </Text>
        <Text className="font-sans text-meta text-muted" numberOfLines={1}>
          {live.checkpoint?.name ?? "In progress"}
        </Text>
      </View>
      <StatusPill label={pill.label} tone={pill.tone} />
      <Text className="font-sans-medium text-body text-ink">Track</Text>
    </View>
  );
}
