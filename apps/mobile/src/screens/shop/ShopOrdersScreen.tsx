import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { Package, Store } from "lucide-react-native";
import { ListRow } from "../../components/ui/ListRow";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useShopOrders } from "../../lib/shopOwner";
import { formatGhs } from "../../lib/pricing";
import type { OrderStatus } from "../../types";

function statusBadge(status: OrderStatus): { label: string; variant: "success" | "error" | "warning" | "neutral"; pulse?: boolean } {
  if (status === "delivered") return { label: "Delivered", variant: "success" };
  if (status === "cancelled" || status === "refunded") return { label: status === "refunded" ? "Refunded" : "Cancelled", variant: "error" };
  if (status === "confirmed") return { label: "New", variant: "warning" };
  if (status === "en_route") return { label: "En Route", variant: "success", pulse: true };
  return { label: status.replace(/_/g, " "), variant: "neutral" };
}

export function ShopOrdersScreen() {
  const { data: orders, isLoading } = useShopOrders();

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="px-6 pb-3 pt-2">
        <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">Orders</Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 128 }}>
        {isLoading ? (
          <View className="gap-2.5">
            <Skeleton height={62} radius={14} />
            <Skeleton height={62} radius={14} />
          </View>
        ) : !orders || orders.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" description="Orders placed with your shop will show up here." />
        ) : (
          <View className="overflow-hidden rounded-well border border-border bg-surface">
            {orders.map((order, i) => (
              <ListRow
                key={order.id}
                bordered={i < orders.length - 1}
                leading={
                  <View className="h-[34px] w-[34px] items-center justify-center rounded-well bg-surface-muted">
                    <Store size={15} color="#6B7D63" />
                  </View>
                }
                title={order.student?.fullName ?? "Student"}
                subtitle={`${order.itemDescription} · ${formatGhs(Number(order.totalAmount))}`}
                trailing={<Badge {...statusBadge(order.status)} />}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
