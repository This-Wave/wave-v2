import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Calendar, MapPin, User } from "lucide-react-native";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useOrder } from "../../lib/orders";
import { useAcceptOrder } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";

type Route = RouteProp<RiderStackParamList, "OrderDetail">;

export function OrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useAcceptOrder();

  async function handleAccept() {
    await acceptOrder.mutateAsync(params.orderId);
    navigation.replace("ActiveDelivery", { orderId: params.orderId });
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-6 pb-3.5 pt-1.5">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} compact />
        <Text className="flex-1 font-sans-extrabold text-[16px] tracking-tight text-ink">Order Detail</Text>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ gap: 12 }}>
        <Card>
          <Text className="mb-1 font-sans-bold text-[14px] text-ink">{order?.shop?.name ?? "Shop"}</Text>
          <Text className="mb-3 text-[11px] text-muted">{order?.shop?.locationText ?? "Off-campus"}</Text>
          <Text className="mb-1.5 font-sans-semibold text-[11px] uppercase tracking-wider text-muted">Items to buy</Text>
          <Text className="text-[13px] leading-5 text-ink">{order?.itemDescription ?? "—"}</Text>
        </Card>

        <Card>
          <View className="mb-2.5 flex-row items-center gap-2">
            <User size={14} color="#6B7D63" />
            <Text className="text-[12px] text-ink">{order?.student?.fullName ?? "Student"}</Text>
          </View>
          <View className="mb-2.5 flex-row items-center gap-2">
            <MapPin size={14} color="#6B7D63" />
            <Text className="text-[12px] text-ink">{order?.checkpoint?.name ?? "Checkpoint"}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Calendar size={14} color="#6B7D63" />
            <Text className="text-[12px] text-ink capitalize">{order?.deliveryDay ?? "—"} run</Text>
          </View>
        </Card>

        <View className="rounded-card border border-success-border bg-success-bg p-3.5">
          <Text className="mb-0.5 text-[11px] text-success-text">Your earnings</Text>
          <Text className="font-sans-extrabold text-[20px] text-success-text">
            {order ? formatGhs(Number(order.deliveryFee)) : "—"}
          </Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-3 px-6 pb-6 pt-3">
        <View className="flex-1">
          <Button label="Pass" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
        <View className="flex-[2]">
          <Button label="Accept Order" onPress={handleAccept} loading={acceptOrder.isPending} />
        </View>
      </View>
    </SafeAreaView>
  );
}
