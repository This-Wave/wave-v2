import { useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapPin, Store } from "lucide-react-native";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuthStore } from "../../store/authStore";
import { useAvailableOrders, useSetAvailability } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";

export function OrderFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const [online, setOnline] = useState(profile?.isActive ?? true);
  const { data: orders, isLoading } = useAvailableOrders();
  const setAvailability = useSetAvailability();

  function handleToggle(value: boolean) {
    setOnline(value);
    setAvailability.mutate(value);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-row items-center justify-between px-6 pb-3 pt-1">
        <View>
          <Text className="text-[12px] font-sans-medium text-muted">Order Feed</Text>
          <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">
            Hi, {profile?.fullName?.split(" ")[0] ?? "Rider"}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={`font-sans-semibold text-[12px] ${online ? "text-wave-500" : "text-muted"}`}>
            {online ? "Online" : "Offline"}
          </Text>
          <ToggleSwitch value={online} onValueChange={handleToggle} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
        <Text className="px-1 text-[12px] text-muted">
          {isLoading ? "Loading orders…" : `${orders?.length ?? 0} orders available near you`}
        </Text>

        {isLoading ? (
          <>
            <Skeleton height={110} radius={14} />
            <Skeleton height={110} radius={14} />
          </>
        ) : !orders || orders.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No orders right now"
            description={online ? "New orders will show up here as students place them." : "Go online to start receiving orders."}
          />
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <View className="mb-2.5 flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-sans-bold text-[14px] text-ink">{order.shop?.name ?? "Shop"}</Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <MapPin size={12} color="#9E9E9E" />
                    <Text className="text-[11px] text-muted" numberOfLines={1}>
                      {order.shop?.locationText ?? "Off-campus"} · {order.checkpoint?.name ?? "Checkpoint"}
                    </Text>
                  </View>
                </View>
                <Text className="font-sans-extrabold text-[15px] text-wave-500">{formatGhs(Number(order.deliveryFee))}</Text>
              </View>
              <Button label="Accept" onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })} />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
