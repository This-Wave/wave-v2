import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Card } from "../../components/ui/Card";
import { FeeBreakdownRow } from "../../components/ui/FeeBreakdownRow";
import { Button } from "../../components/ui/Button";
import { PinIcon } from "../../components/icons";
import { useCreateOrder } from "../../lib/orders";
import { estimateOrderTotal, formatFullDay, formatGhs, formatGhsCompact } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "OrderSummary">;

/**
 * v5 screen 06 "Review order": an elevated summary card, the delivery row, then
 * the fee ledger with the 26px green total.
 */
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
        notes: params.notes,
      });
      navigation.navigate("Payment", { orderId: order.id, totalAmount: Number(order.totalAmount) });
    } catch {
      setError("Couldn't create your order. Please try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Review order" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <Card elevated className="mb-5 p-[18px]">
          <Text className="mb-1.5 font-sans-semibold text-[12px] uppercase tracking-[0.6px] text-muted">
            Buying from
          </Text>
          <Text className="mb-3.5 font-sans-semibold text-[18px] text-ink">{params.shopName}</Text>
          <Text className="text-[14px] leading-[22px] text-ink">{params.itemDescription}</Text>
        </Card>

        <View className="mb-6 flex-row items-center gap-3 rounded-card border border-border bg-surface p-3.5">
          <PinIcon size={20} />
          <View className="flex-1">
            <Text className="font-sans-semibold text-[14px] text-ink">Deliver to {params.checkpointName}</Text>
            <Text className="text-[12px] text-muted">Included in {formatFullDay(scheduledDate)}&apos;s run</Text>
          </View>
        </View>

        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Order summary</Text>
        {params.budget ? <FeeBreakdownRow label="Budget cap" value={`GH₵${params.budget}`} /> : null}
        <FeeBreakdownRow label="Item cost" value="Charged at pickup" />
        <FeeBreakdownRow label="Delivery" value={formatGhs(estimate.deliveryFee)} />
        {estimate.surchargeAmount > 0 ? (
          <FeeBreakdownRow label="Special order surcharge" value={`+${formatGhs(estimate.surchargeAmount)}`} />
        ) : null}
        {estimate.discountAmount > 0 ? (
          <FeeBreakdownRow label="Loyalty discount" value={`-${formatGhs(estimate.discountAmount)}`} isDiscount />
        ) : null}
        <FeeBreakdownRow label="Total" value={formatGhsCompact(estimate.total)} isTotal />

        <Text className="mt-4 text-center text-[12px] text-muted">
          The server recalculates the final total when your order is created.
        </Text>
        {error ? <Text className="mt-3 text-center text-[12px] text-danger-text">{error}</Text> : null}
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button label="Confirm & place order" onPress={handleConfirm} loading={createOrder.isPending} />
      </View>
    </SafeAreaView>
  );
}
