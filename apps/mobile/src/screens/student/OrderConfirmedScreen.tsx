import { ActivityIndicator, SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, ShieldCheck } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Button } from "../../components/ui/Button";
import { useOrder } from "../../lib/orders";
import { formatFullDay } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "OrderConfirmed">;

export function OrderConfirmedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });

  const isConfirmed = order?.status === "confirmed" || (order && order.status !== "payment_pending");

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-wave-500">
          {isConfirmed ? <Check size={30} color="#fff" strokeWidth={3} /> : <ActivityIndicator color="#fff" />}
        </View>
        <Text className="mb-2 font-sans-extrabold text-[22px] text-white">
          {isConfirmed ? "Order Confirmed!" : "Confirming payment..."}
        </Text>
        {order ? (
          <Text className="mb-6 font-mono-semibold text-[12px] text-faint">
            #WV-{order.id.slice(0, 8).toUpperCase()}
          </Text>
        ) : null}

        {isConfirmed ? (
          <View className="mb-5 w-full rounded-card bg-dark-card p-4">
            <View className="mb-2 flex-row items-center gap-1.5">
              <ShieldCheck size={14} color="#2EA64E" />
              <Text className="text-[11px] font-sans-semibold uppercase tracking-wide text-faint">Collection PIN</Text>
            </View>
            <Text className="text-[13px] leading-5 text-faint">
              Your PIN has been sent to your phone by SMS. Show it to the rider when collecting your order at{" "}
              {order?.checkpoint?.name ?? "your checkpoint"}.
            </Text>
          </View>
        ) : null}

        {order ? (
          <View className="w-full rounded-card bg-dark-card p-4">
            <View className="flex-row justify-between py-1">
              <Text className="text-[12px] text-faint">Shop</Text>
              <Text className="font-sans-semibold text-[12px] text-white">{order.shop?.name}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-[12px] text-faint">Run Day</Text>
              <Text className="font-sans-semibold text-[12px] text-white">{formatFullDay(new Date(order.scheduledDate))}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-[12px] text-faint">Checkpoint</Text>
              <Text className="font-sans-semibold text-[12px] text-white">{order.checkpoint?.name}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View className="px-6 pb-6">
        <Button label="Track Order" onPress={() => navigation.replace("OrderTracking", { orderId: params.orderId })} disabled={!isConfirmed} />
      </View>
    </SafeAreaView>
  );
}
