import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { useMyOrders } from "../../lib/orders";
import { useLayout } from "../../hooks/useLayout";
import { openOrderTracking } from "../../lib/desktopNavigate";
import { statusPill } from "../../screens/student/orderPresenters";
import { StatusPill } from "./Controls";

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

/** Persistent strip when the student has an active delivery. */
export function LiveOrderBar() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { isDesktop } = useLayout();
  const { data: orders } = useMyOrders();

  const live = (orders ?? []).find((o) => LIVE.includes(o.status));
  if (!live) return null;

  const pill = statusPill(live.status);

  return (
    <Pressable
      onPress={() => openOrderTracking(navigation, live.id)}
      accessibilityRole="button"
      className="border-t border-hairline bg-surface px-4 py-3 active:bg-hairline"
      style={isDesktop ? { marginBottom: 0 } : undefined}
    >
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
    </Pressable>
  );
}
