import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ListRow } from "../../components/ui/ListRow";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { BoxIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useMyDeliveries } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";
import type { OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = ["rider_assigned", "en_route", "at_checkpoint"];

function statusBadge(status: OrderStatus): { label: string; variant: "success" | "error" | "neutral" } {
  if (status === "delivered") return { label: "Delivered", variant: "success" };
  if (status === "refunded") return { label: "Refunded", variant: "error" };
  if (status === "cancelled") return { label: "Cancelled", variant: "error" };
  if (status === "en_route") return { label: "En route", variant: "success" };
  if (status === "rider_assigned") return { label: "Assigned", variant: "neutral" };
  if (status === "at_checkpoint") return { label: "At checkpoint", variant: "neutral" };
  return { label: status.replace(/_/g, " "), variant: "neutral" };
}

function ShopGlyph() {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-tile bg-canvas">
      <BoxIcon size={18} color={colors.muted} strokeWidth={1.7} />
    </View>
  );
}

export function MyOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { data: orders, isLoading } = useMyDeliveries();

  const active = orders?.filter((o) => ACTIVE_STATUSES.includes(o.status)) ?? [];
  const past = orders?.filter((o) => !ACTIVE_STATUSES.includes(o.status)) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 128 }}>
        <Text className="mb-5 font-sans-semibold text-[22px] tracking-tight text-ink">My orders</Text>

        {isLoading ? (
          <View className="gap-3">
            <Skeleton height={120} radius={24} />
            <Skeleton height={180} radius={24} />
          </View>
        ) : !orders || orders.length === 0 ? (
          <View className="pt-10">
            <EmptyState
              art={<BoxIcon size={34} color={colors.muted} strokeWidth={1.6} />}
              title="No deliveries yet"
              description="Accept an order from the Feed tab to get started."
            />
          </View>
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Active</Text>
                <View
                  className="mb-6 overflow-hidden rounded-card border border-border bg-surface"
                  style={shadowCard}
                >
                  {active.map((order, i) => (
                    <ListRow
                      key={order.id}
                      bordered={i < active.length - 1}
                      leading={<ShopGlyph />}
                      title={order.shop?.name ?? "Shop"}
                      subtitle={formatGhs(Number(order.deliveryFee))}
                      trailing={<Badge {...statusBadge(order.status)} />}
                      onPress={() => navigation.navigate("ActiveDelivery", { orderId: order.id })}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {past.length > 0 ? (
              <>
                <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Past</Text>
                <View className="overflow-hidden rounded-card border border-border bg-surface" style={shadowCard}>
                  {past.map((order, i) => (
                    <ListRow
                      key={order.id}
                      bordered={i < past.length - 1}
                      leading={<ShopGlyph />}
                      title={order.shop?.name ?? "Shop"}
                      subtitle={formatGhs(Number(order.deliveryFee))}
                      trailing={<Badge {...statusBadge(order.status)} />}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
