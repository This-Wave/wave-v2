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
import { useCompletedDeliveryCount, useCreateOrder } from "../../lib/orders";
import {
  deliveryDayFor,
  estimateOrderTotal,
  formatFullDay,
  formatGhs,
  formatGhsCompact,
  toApiDate,
} from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "OrderSummary">;

/**
 * Review before paying.
 *
 * The fee lines here are an *estimate* — `estimateOrderTotal` mirrors the
 * server's rules but the server recalculates from its own config when the order
 * is created, and its number is the one charged. That is said plainly on the
 * screen rather than in a footnote, because a total that changes between two
 * screens with no explanation is how you lose someone at checkout.
 *
 * ⚠️ This screen used to pass `itemPrice: 0` into the estimate while the server
 * charged for the item, so every quote shown here was short by the entire cost
 * of the shopping. Now that a basket is priced from the catalogue, the estimate
 * takes the real basket total — and the two numbers agree.
 */
export function OrderSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const createOrder = useCreateOrder();
  const completedDeliveries = useCompletedDeliveryCount();
  const [error, setError] = useState<string | null>(null);

  const scheduledDate = new Date(params.scheduledDate);

  const basketTotal = useMemo(
    () => params.itemsPreview.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [params.itemsPreview],
  );

  const estimate = useMemo(
    () =>
      estimateOrderTotal({
        itemPrice: basketTotal,
        isSpecialOrder: params.isSpecialOrder,
        completedDeliveries,
      }),
    [basketTotal, params.isSpecialOrder, completedDeliveries],
  );

  async function handleConfirm() {
    setError(null);
    try {
      const order = await createOrder.mutateAsync({
        orderType: "buy_for_me",
        shopId: params.shopId,
        checkpointId: params.checkpointId,
        items: params.items,
        deliveryDay: deliveryDayFor(scheduledDate, params.isSpecialOrder),
        scheduledDate: toApiDate(scheduledDate),
        isSpecialOrder: params.isSpecialOrder,
        notes: params.notes,
      });
      navigation.navigate("Payment", {
        orderId: order.id,
        totalAmount: Number(order.totalAmount),
      });
    } catch (err) {
      // The server refuses a basket whose items went out of stock between the
      // menu and here. That is worth saying in its own words rather than as
      // "something went wrong" — it tells the student what to change.
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(message ?? "Couldn't create your order. Please try again.");
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
            {params.itemsPreview.map((line, i) => (
              <View
                key={i}
                className={`flex-row items-center justify-between py-2.5 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <Text className="flex-1 font-sans text-body text-ink">
                  {line.quantity}× {line.name}
                </Text>
                <Text className="font-sans text-body text-ink">
                  {formatGhs(line.unitPrice * line.quantity)}
                </Text>
              </View>
            ))}
          </View>

          <RowGroup>
            <Row title={params.shopName} meta="Buying from" chevron={false} />
            <Row title={params.checkpointName} meta="Delivering to" chevron={false} />
            <Row title={formatFullDay(scheduledDate)} meta="On this Wave" chevron={false} />
          </RowGroup>

          {params.notes ? (
            <View className="mt-6">
              <Text className="mb-2 font-sans-medium text-body text-ink">Your note</Text>
              <View className="rounded-card bg-surface p-4">
                <Text className="font-sans text-body text-ink">{params.notes}</Text>
              </View>
            </View>
          ) : null}

          <Text className="mb-3 mt-8 font-sans-medium text-subheading text-ink">What you pay</Text>
          <View className="rounded-card bg-surface p-5">
            <Line label="Items" value={formatGhs(basketTotal)} />
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
              <Text className="font-sans-medium text-ui text-ink">Total</Text>
              <Text className="font-sans-bold text-heading-sm text-ink">
                {formatGhsCompact(estimate.total)}
              </Text>
            </View>
          </View>

          <Text className="mt-4 font-sans text-body text-muted">
            You pay for everything now. If the shop is out of something, we'll cancel and refund you
            in full.
          </Text>

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button label="Place order" onPress={handleConfirm} loading={createOrder.isPending} />
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
