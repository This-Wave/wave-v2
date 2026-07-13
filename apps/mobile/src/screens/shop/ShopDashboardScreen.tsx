import { useMemo } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Package } from "lucide-react-native";
import type { ShopStackParamList } from "../../navigation/ShopNavigator";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useMyShop, useShopCancelOrder, useShopOrders } from "../../lib/shopOwner";
import { formatGhs } from "../../lib/pricing";

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export function ShopDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { data: shop, isLoading: shopLoading } = useMyShop();
  const { data: orders, isLoading: ordersLoading } = useShopOrders();
  const cancelOrder = useShopCancelOrder();

  const incoming = orders?.filter((o) => o.status === "confirmed" && !o.riderId) ?? [];
  const todaysOrders = useMemo(() => orders?.filter((o) => isToday(o.createdAt)) ?? [], [orders]);
  const revenueToday = todaysOrders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const isLoading = shopLoading || ordersLoading;

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="px-6 pb-3 pt-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">
            {shop?.name ?? "Your Shop"}
          </Text>
          <Badge label={shop?.isActive ? "Serving" : "Closed"} variant={shop?.isActive ? "success" : "neutral"} />
        </View>
        <Text className="text-[12px] text-muted">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
        {isLoading ? (
          <View className="flex-row gap-2.5">
            <Skeleton height={80} radius={14} className="flex-1" />
            <Skeleton height={80} radius={14} className="flex-1" />
          </View>
        ) : (
          <View className="flex-row gap-2.5">
            <Card className="flex-1">
              <Text className="mb-1 text-[11px] text-muted">Orders Today</Text>
              <Text className="font-sans-extrabold text-[22px] text-ink">{todaysOrders.length}</Text>
            </Card>
            <Card className="flex-1">
              <Text className="mb-1 text-[11px] text-muted">Revenue</Text>
              <Text className="font-sans-extrabold text-[22px] text-ink">{formatGhs(revenueToday)}</Text>
            </Card>
          </View>
        )}

        <View>
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="font-sans-bold text-[13px] text-ink">Incoming Orders</Text>
            {incoming.length > 0 ? <Badge label={`${incoming.length} new`} variant="warning" /> : null}
          </View>

          {isLoading ? (
            <Skeleton height={140} radius={14} />
          ) : incoming.length === 0 ? (
            <EmptyState icon={Package} title="No incoming orders" description="New paid orders will show up here." />
          ) : (
            <View className="gap-2.5">
              {incoming.map((order) => (
                <Card key={order.id}>
                  <View className="mb-2.5 flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="mb-0.5 font-sans-bold text-[13px] text-ink">
                        {order.student?.fullName ?? "Student"}
                      </Text>
                      <Text className="text-[11px] text-muted" numberOfLines={1}>
                        {order.itemDescription}
                      </Text>
                    </View>
                    <Text className="font-sans-extrabold text-[14px] text-ink">
                      {formatGhs(Number(order.totalAmount))}
                    </Text>
                  </View>
                  <View className="flex-row gap-2.5">
                    <View className="flex-1">
                      <Button
                        label="Reject"
                        variant="secondary"
                        onPress={() => cancelOrder.mutate({ orderId: order.id, reason: "Rejected by shop" })}
                        loading={cancelOrder.isPending}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Accept Order"
                        onPress={() => navigation.navigate("IncomingOrderDetail", { orderId: order.id })}
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
