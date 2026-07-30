import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { Button } from "../../components/ui/Button";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { BoxIcon, PinIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";
import { useAvailableOrders, useRiderEarnings, useSetAvailability } from "../../lib/rider";
import { formatGhs, formatGhsCompact } from "../../lib/pricing";

function isToday(value: string | Date): boolean {
  return new Date(value).toDateString() === new Date().toDateString();
}

export function OrderFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const [online, setOnline] = useState(profile?.isActive ?? true);
  const { data: orders, isLoading } = useAvailableOrders();
  const { data: earnings } = useRiderEarnings();
  const setAvailability = useSetAvailability();

  // The hero mirrors design R01: today's take, not the all-time total.
  const today = useMemo(() => {
    const rows = (earnings ?? []).filter((e) => isToday(e.createdAt));
    return { total: rows.reduce((sum, e) => sum + Number(e.amount), 0), count: rows.length };
  }, [earnings]);

  function handleToggle(value: boolean) {
    setOnline(value);
    setAvailability.mutate(value);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 128 }}>
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="font-sans-medium text-[12px] text-muted">Order feed</Text>
            <Text className="font-sans-semibold text-[22px] tracking-tight text-ink">
              Hi, {profile?.fullName?.split(" ")[0] ?? "Rider"}
            </Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Text className={`font-sans-semibold text-[12px] ${online ? "text-wave-500" : "text-muted"}`}>
              {online ? "Online" : "Offline"}
            </Text>
            <ToggleSwitch value={online} onValueChange={handleToggle} />
          </View>
        </View>

        <View className="mb-5 overflow-hidden rounded-card bg-wave-500 p-[22px]" style={shadowCard}>
          <View
            className="absolute h-[180px] w-[180px] rounded-full"
            style={{ backgroundColor: "rgba(176,232,146,0.1)", top: -80, right: -60 }}
          />
          <Text className="mb-1.5 font-sans-medium text-[12px] text-white opacity-60">Today so far</Text>
          <Text className="mb-1 font-sans-semibold text-[44px] leading-[44px] tracking-tight text-white">
            {formatGhsCompact(today.total)}
          </Text>
          <Text className="font-sans-medium text-[12px] text-white opacity-60">
            {today.count} {today.count === 1 ? "delivery" : "deliveries"} completed
          </Text>
        </View>

        <Text className="mb-3 font-sans-medium text-[12px] text-muted">
          {isLoading
            ? "Loading orders…"
            : `${orders?.length ?? 0} ${orders?.length === 1 ? "order" : "orders"} available near you`}
        </Text>

        {isLoading ? (
          <View className="gap-2.5">
            <Skeleton height={150} radius={24} />
            <Skeleton height={150} radius={24} />
          </View>
        ) : !orders || orders.length === 0 ? (
          <View className="pt-10">
            <EmptyState
              art={<BoxIcon size={34} color={colors.muted} strokeWidth={1.6} />}
              title="No orders right now"
              description={
                online
                  ? "New orders will show up here as students place them."
                  : "Go online to start receiving orders."
              }
            />
          </View>
        ) : (
          <View className="gap-2.5">
            {orders.map((order) => (
              <Pressable
                key={order.id}
                onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
                className="rounded-card border border-border bg-surface p-4"
                style={shadowCard}
              >
                <View className="mb-3.5 flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="mb-1.5 font-sans-semibold text-[15px] text-ink">
                      {order.shop?.name ?? "Shop"}
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <PinIcon size={13} color={colors.muted} strokeWidth={1.7} />
                      <Text className="flex-1 text-[11px] text-muted" numberOfLines={1}>
                        {order.shop?.locationText ?? "Off-campus"} · {order.checkpoint?.name ?? "Checkpoint"}
                      </Text>
                    </View>
                  </View>
                  <Text className="font-sans-semibold text-[17px] tracking-tight text-wave-500">
                    {formatGhs(Number(order.deliveryFee))}
                  </Text>
                </View>
                <Button
                  label="Accept"
                  onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
