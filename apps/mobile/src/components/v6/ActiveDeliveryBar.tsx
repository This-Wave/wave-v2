import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { useMyDeliveries } from "../../lib/rider";
import { useLayout } from "../../hooks/useLayout";
import { statusPill } from "../../screens/student/orderPresenters";
import { StatusPill } from "./Controls";

const ACTIVE = ["rider_assigned", "en_route", "at_checkpoint"] as const;

/** Sticky strip when the rider has a delivery in progress. */
export function ActiveDeliveryBar() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { isDesktop } = useLayout();
  const { data: orders } = useMyDeliveries();

  const active = (orders ?? []).find((o) =>
    (ACTIVE as readonly string[]).includes(o.status),
  );
  if (!active) return null;

  const pill = statusPill(active.status);

  return (
    <Pressable
      onPress={() => navigation.navigate("ActiveDelivery", { orderId: active.id })}
      accessibilityRole="button"
      className="border-t border-hairline bg-surface px-4 py-3 active:bg-hairline"
      style={isDesktop ? { marginBottom: 0 } : undefined}
    >
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
            {active.shop?.name ?? "Active delivery"}
          </Text>
          <Text className="font-sans text-meta text-muted" numberOfLines={1}>
            To {active.checkpoint?.name ?? "checkpoint"}
          </Text>
        </View>
        <StatusPill label={pill.label} tone={pill.tone} />
        <Text className="font-sans-medium text-body text-ink">Open</Text>
      </View>
    </Pressable>
  );
}
