import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Package, Store } from "lucide-react-native";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ListRow } from "../../components/ui/ListRow";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMyDeliveries } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";
import type { OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = ["rider_assigned", "en_route", "at_checkpoint"];

function statusBadge(status: OrderStatus): { label: string; variant: "success" | "error" | "neutral"; pulse?: boolean } {
  if (status === "delivered") return { label: "Delivered", variant: "success" };
  if (status === "cancelled" || status === "refunded") return { label: status === "refunded" ? "Refunded" : "Cancelled", variant: "error" };
  if (status === "en_route") return { label: "En Route", variant: "success", pulse: true };
  return { label: status.replace(/_/g, " "), variant: "neutral" };
}

export function MyOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { data: orders, isLoading } = useMyDeliveries();

  const active = orders?.filter((o) => ACTIVE_STATUSES.includes(o.status)) ?? [];
  const past = orders?.filter((o) => !ACTIVE_STATUSES.includes(o.status)) ?? [];

  function handlePress(orderId: string, status: OrderStatus) {
    if (ACTIVE_STATUSES.includes(status)) {
      navigation.navigate("ActiveDelivery", { orderId });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="px-6 pb-3 pt-2">
        <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">My Orders</Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
        {isLoading ? (
          <>
            <Skeleton height={62} radius={14} />
            <Skeleton height={62} radius={14} />
          </>
        ) : !orders || orders.length === 0 ? (
          <EmptyState icon={Package} title="No deliveries yet" description="Accept an order from the Feed tab to get started." />
        ) : (
          <>
            {active.length > 0 ? (
              <View>
                <Text className="mb-2 px-1 font-sans-bold text-[13px] text-ink">Active</Text>
                <View className="overflow-hidden rounded-well border border-border bg-surface">
                  {active.map((order, i) => (
                    <ListRow
                      key={order.id}
                      bordered={i < active.length - 1}
                      leading={
                        <View className="h-[34px] w-[34px] items-center justify-center rounded-well bg-surface-muted">
                          <Store size={15} color="#9E9E9E" />
                        </View>
                      }
                      title={order.shop?.name ?? "Shop"}
                      subtitle={formatGhs(Number(order.deliveryFee))}
                      trailing={<Badge {...statusBadge(order.status)} />}
                      onPress={() => handlePress(order.id, order.status)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {past.length > 0 ? (
              <View>
                <Text className="mb-2 px-1 font-sans-bold text-[13px] text-ink">Past</Text>
                <View className="overflow-hidden rounded-well border border-border bg-surface">
                  {past.map((order, i) => (
                    <ListRow
                      key={order.id}
                      bordered={i < past.length - 1}
                      leading={
                        <View className="h-[34px] w-[34px] items-center justify-center rounded-well bg-surface-muted">
                          <Store size={15} color="#9E9E9E" />
                        </View>
                      }
                      title={order.shop?.name ?? "Shop"}
                      subtitle={formatGhs(Number(order.deliveryFee))}
                      trailing={<Badge {...statusBadge(order.status)} />}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
