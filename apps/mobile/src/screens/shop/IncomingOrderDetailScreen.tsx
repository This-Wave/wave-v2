import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Calendar, MapPin, User } from "lucide-react-native";
import type { ShopStackParamList } from "../../navigation/ShopNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useOrder } from "../../lib/orders";
import { useShopAcceptOrder, useShopCancelOrder } from "../../lib/shopOwner";
import { formatGhs } from "../../lib/pricing";

type Route = RouteProp<ShopStackParamList, "IncomingOrderDetail">;

export function IncomingOrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useShopAcceptOrder();
  const cancelOrder = useShopCancelOrder();

  async function handleAccept() {
    await acceptOrder.mutateAsync(params.orderId);
    navigation.goBack();
  }

  async function handleCancel() {
    await cancelOrder.mutateAsync({ orderId: params.orderId, reason: "Unable to fulfill this order" });
    navigation.goBack();
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center gap-3 px-6 pb-3.5 pt-1.5">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} compact />
        <Text className="flex-1 font-sans-extrabold text-[16px] tracking-tight text-ink">Incoming Order</Text>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ gap: 12 }}>
        <Card>
          <Text className="mb-2.5 font-sans-semibold text-[11px] uppercase tracking-wider text-muted">
            Items Ordered
          </Text>
          <View className="mb-1 flex-row items-start justify-between">
            <Text className="flex-1 pr-3 text-[13px] text-ink">{order?.itemDescription}</Text>
            <Text className="font-sans-bold text-[13px] text-ink">
              {order?.itemPrice ? formatGhs(Number(order.itemPrice)) : "—"}
            </Text>
          </View>
          {order?.notes ? <Text className="mt-1.5 text-[11px] italic text-muted">{order.notes}</Text> : null}
        </Card>

        <Card>
          <View className="mb-2.5 flex-row items-center gap-2">
            <User size={14} color="#555" />
            <Text className="text-[12px] text-ink">{order?.student?.fullName ?? "Student"}</Text>
          </View>
          <View className="mb-2.5 flex-row items-center gap-2">
            <MapPin size={14} color="#555" />
            <Text className="text-[12px] text-ink">{order?.checkpoint?.name ?? "Checkpoint"}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Calendar size={14} color="#555" />
            <Text className="text-[12px] text-ink capitalize">
              {order?.deliveryDay ?? "—"} run · pickup by rider once accepted
            </Text>
          </View>
        </Card>

        <View className="rounded-card border border-success-border bg-success-bg p-3.5">
          <Text className="text-[12px] leading-5 text-success-text">
            If you cancel, the student will be fully refunded automatically.
          </Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-3 px-6 pb-6 pt-3">
        <View className="flex-1">
          <Button label="Cancel Order" variant="danger" onPress={handleCancel} loading={cancelOrder.isPending} />
        </View>
        <View className="flex-[2]">
          <Button label="Accept Order" onPress={handleAccept} loading={acceptOrder.isPending} />
        </View>
      </View>
    </SafeAreaView>
  );
}
