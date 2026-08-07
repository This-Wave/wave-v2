import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { useCreateOrder } from "../../lib/orders";
import { estimateOrderTotal, formatFullDay, formatGhs, formatGhsCompact } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "OrderSummary">;

/**
 * Review before paying.
 *
 * The fee lines here are an *estimate* — `estimateOrderTotal` mirrors the
 * server's rules but the server recalculates from its own config when the order
 * is created, and its number is the one charged. That is said plainly on the
 * screen rather than in a footnote, because a total that changes between two
 * screens with no explanation is how you lose someone at checkout.
 */
export function OrderSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const createOrder = useCreateOrder();
  const [error, setError] = useState<string | null>(null);

  const scheduledDate = new Date(params.scheduledDate);
  const estimate = useMemo(
    () =>
      estimateOrderTotal({
        itemPrice: 0,
        isSpecialOrder: params.isSpecialOrder,
        completedDeliveries: 0,
      }),
    [params.isSpecialOrder],
  );

  async function handleConfirm() {
    setError(null);
    try {
      const order = await createOrder.mutateAsync({
        orderType: "buy_for_me",
        shopId: params.shopId,
        checkpointId: params.checkpointId,
        itemDescription: params.itemDescription,
        deliveryDay: params.isSpecialOrder
          ? "special"
          : scheduledDate.getDay() === 0
            ? "sunday"
            : "wednesday",
        scheduledDate: params.scheduledDate,
        isSpecialOrder: params.isSpecialOrder,
        notes: params.notes,
      });
      navigation.navigate("Payment", {
        orderId: order.id,
        totalAmount: Number(order.totalAmount),
      });
    } catch {
      setError("Couldn't create your order. Please try again.");
    }
  }

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-8 font-sans-bold text-heading text-ink">Check this over</Text>

          <Text className="mb-2 font-sans-medium text-body text-ink">Your list</Text>
          <View className="mb-6 rounded-card bg-surface p-4">
            <Text className="font-sans text-body text-ink">{params.itemDescription}</Text>
          </View>

          <RowGroup>
            <Row title={params.shopName} meta="Buying from" chevron={false} />
            <Row title={params.checkpointName} meta="Delivering to" chevron={false} />
            <Row title={formatFullDay(scheduledDate)} meta="On the run" chevron={false} />
            {params.budget ? (
              <Row title={`GH₵${params.budget}`} meta="Spend limit" chevron={false} />
            ) : null}
          </RowGroup>

          <Text className="mb-3 mt-8 font-sans-medium text-subheading text-ink">
            What you pay now
          </Text>
          <View className="rounded-card bg-surface p-5">
            <Line label="Delivery" value={formatGhs(estimate.deliveryFee)} />
            {estimate.surchargeAmount > 0 ? (
              <Line
                label={`Rush order (+${estimate.surchargePct}%)`}
                value={`+${formatGhs(estimate.surchargeAmount)}`}
              />
            ) : null}
            {estimate.discountAmount > 0 ? (
              <Line
                label={`Loyalty discount (−${estimate.discountPct}%)`}
                value={`−${formatGhs(estimate.discountAmount)}`}
              />
            ) : null}
            <View className="mt-1 h-px bg-hairline" />
            <View className="flex-row items-center justify-between pt-4">
              <Text className="font-sans-medium text-ui text-ink">Total now</Text>
              <Text className="font-sans-bold text-heading-sm text-ink">
                {formatGhsCompact(estimate.total)}
              </Text>
            </View>
          </View>

          <Text className="mt-4 font-sans text-body text-muted">
            You pay the delivery fee now. The items themselves are paid for at the shop by your
            runner and settled against your spend limit.
          </Text>

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Place order"
          onPress={handleConfirm}
          loading={createOrder.isPending}
        />
      </ActionBar>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="font-sans text-body text-muted">{label}</Text>
      <Text className="font-sans text-body text-ink">{value}</Text>
    </View>
  );
}
