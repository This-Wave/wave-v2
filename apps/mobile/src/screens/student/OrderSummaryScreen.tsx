import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Store } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { Card } from "../../components/ui/Card";
import { FeeBreakdownRow } from "../../components/ui/FeeBreakdownRow";
import { Button } from "../../components/ui/Button";
import { useCreateOrder } from "../../lib/orders";
import { estimateOrderTotal, formatFullDay, formatGhs } from "../../lib/pricing";
import { DEFAULT_LOYALTY_THRESHOLD } from "@wave/shared";

type Route = RouteProp<StudentStackParamList, "OrderSummary">;

export function OrderSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const createOrder = useCreateOrder();
  const [error, setError] = useState<string | null>(null);

  const scheduledDate = new Date(params.scheduledDate);
  const estimate = useMemo(
    () => estimateOrderTotal({ itemPrice: 0, isSpecialOrder: params.isSpecialOrder, completedDeliveries: 0 }),
    [params.isSpecialOrder],
  );

  async function handleConfirm() {
    setError(null);
    try {
      const order = await createOrder.mutateAsync({
        shopId: params.shopId,
        checkpointId: params.checkpointId,
        itemDescription: params.itemDescription,
        deliveryDay: params.isSpecialOrder ? "special" : scheduledDate.getDay() === 0 ? "sunday" : "wednesday",
        scheduledDate: params.scheduledDate,
        isSpecialOrder: params.isSpecialOrder,
      });
      navigation.navigate("Payment", { orderId: order.id, totalAmount: Number(order.totalAmount) });
    } catch {
      setError("Couldn't create your order. Please try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-1.5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-5 flex-row items-center gap-3">
          <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />
          <Text className="font-sans-extrabold text-[17px] tracking-tight text-ink">Order Summary</Text>
        </View>

        <Card className="mb-3">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-well bg-success-bg">
              <Store size={20} color="#2EA64E" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px] text-ink">{params.shopName}</Text>
              <Text className="mt-0.5 text-[11px] text-muted" numberOfLines={2}>
                {params.itemDescription}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row justify-between border-t border-border pt-3">
            <Text className="text-[12px] text-muted">Run Day</Text>
            <Text className="font-sans-semibold text-[12px] text-ink">{formatFullDay(scheduledDate)}</Text>
          </View>
          <View className="mt-1.5 flex-row justify-between">
            <Text className="text-[12px] text-muted">Checkpoint</Text>
            <Text className="font-sans-semibold text-[12px] text-ink">{params.checkpointName}</Text>
          </View>
        </Card>

        <Card>
          <FeeBreakdownRow label="Item cost" value="Charged at pickup" />
          <FeeBreakdownRow label="Delivery fee" value={formatGhs(estimate.deliveryFee)} />
          {estimate.surchargeAmount > 0 ? (
            <FeeBreakdownRow label="Special order surcharge" value={`+${formatGhs(estimate.surchargeAmount)}`} />
          ) : null}
          {estimate.discountAmount > 0 ? (
            <FeeBreakdownRow label="Loyalty discount" value={`-${formatGhs(estimate.discountAmount)}`} isDiscount />
          ) : null}
          <FeeBreakdownRow label="Total (est.)" value={formatGhs(estimate.total)} isTotal />
        </Card>

        <Text className="mt-3 text-center text-[11px] text-muted">
          Final total is calculated by the server · {DEFAULT_LOYALTY_THRESHOLD} deliveries unlocks a loyalty discount
        </Text>

        {error ? <Text className="mt-3 text-center text-[12px] text-danger-text">{error}</Text> : null}

        <View className="mt-6">
          <Button
            label={`Proceed to Pay · ${formatGhs(estimate.total)}`}
            onPress={handleConfirm}
            loading={createOrder.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
