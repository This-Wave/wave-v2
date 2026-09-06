import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  CheckoutProgress,
  Gutter,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Sheet,
  TopBar,
} from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { useLastCheckpoint } from "../../hooks/useLastCheckpoint";
import { useCompletedDeliveryCount, useCreateOrder } from "../../lib/orders";
import { apiErrorMessage } from "../../lib/apiError";
import {
  deliveryDayFor,
  estimateOrderTotal,
  formatFullDay,
  formatGhs,
  formatGhsCompact,
  toApiDate,
} from "../../lib/pricing";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";

type Route = RouteProp<StudentStackParamList, "OrderSummary">;

/**
 * Review before paying — and the only step between the menu and payment.
 *
 * This absorbed `DescribeOrderScreen`, which sat before it and asked exactly one
 * question: which checkpoint. It had already answered that question itself, by
 * defaulting to the student's last one, and then this screen repeated the shop,
 * the checkpoint and the day straight back at them. Two screens stating the
 * same facts, and the progress bar labelled both "step 2 of 3" — the code
 * conceding they were one step.
 *
 * So the checkpoint is chosen here, in place, with the same sheet that screen
 * used. Both it and the day carry a Change control: the two things that are
 * genuinely the student's to set are the two things that look settable.
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);
  const checkpointIds = checkpoints?.map((c) => c.id);
  const { checkpointId, selectCheckpoint } = useLastCheckpoint(checkpointIds);

  // A caller may still pin the checkpoint (the desktop panel does); otherwise
  // fall back to the student's last one, which is what the removed screen did.
  const checkpoint =
    checkpoints?.find((c) => c.id === (params.checkpointId ?? checkpointId)) ?? checkpoints?.[0];

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
        checkpointId: checkpoint!.id,
        items: params.items,
        deliveryDay: deliveryDayFor(scheduledDate, params.isSpecialOrder),
        scheduledDate: toApiDate(scheduledDate),
        isSpecialOrder: params.isSpecialOrder,
        notes: params.notes,
      });
      navigation.replace("Payment", {
        orderId: order.id,
        totalAmount: Number(order.totalAmount),
      });
    } catch (err) {
      // The server refuses a basket whose items went out of stock between the
      // menu and here. That is worth saying in its own words rather than as
      // "something went wrong" — it tells the student what to change.
      setError(apiErrorMessage(err, "Couldn't create your order. Please try again."));
    }
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <CheckoutProgress step={2} />
          <Text className="mb-8 font-sans-bold text-heading text-ink">Check this over</Text>

          <Text className="mb-2 font-sans-medium text-body text-ink">Delivery</Text>
          <RowGroup>
            <Row
              title={checkpoint?.name ?? "Choose a checkpoint"}
              meta={checkpoint?.description ?? "Where you'll collect it"}
              onPress={() => setPickerOpen(true)}
              accessibilityLabel={`Delivering to ${checkpoint?.name ?? "no checkpoint yet"}. Change.`}
            />
            <Row
              title={formatFullDay(scheduledDate)}
              meta={
                params.isSpecialOrder
                  ? `Rush order · ${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% more on the delivery fee`
                  : "Standard Wave"
              }
              onPress={() => navigation.navigate("WaveCalendar")}
              accessibilityLabel={`On ${formatFullDay(scheduledDate)}. Change the Wave.`}
            />
            <Row title={params.shopName} meta="Buying from" chevron={false} />
          </RowGroup>

          <Text className="mb-2 mt-8 font-sans-medium text-body text-ink">Your list</Text>
          <View className="mb-6 rounded-card bg-surface p-4">
            {params.itemsPreview.map((line, i) => (
              <View
                key={i}
                // Quantity, name and price are three Texts on one line. Grouped,
                // a screen reader says "2 times Jollof Rice, GH₵24.00"; ungrouped
                // it says them as three unrelated stops and the price could
                // belong to any row.
                accessible
                accessibilityLabel={`${line.quantity} × ${line.name}, ${formatGhs(
                  line.unitPrice * line.quantity,
                )}`}
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
                label={`Loyalty discount (−${estimate.discountPct}% of delivery)`}
                value={`−${formatGhs(estimate.discountAmount)}`}
              />
            ) : null}
            <View className="mt-1 h-px bg-hairline" />
            <View
              accessible
              accessibilityLabel={`Total, ${formatGhs(estimate.total)}`}
              className="flex-row items-center justify-between pt-4"
            >
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

          {error ? (
            <Text
              accessibilityLiveRegion="assertive"
              role="alert"
              className="mt-4 font-sans text-body text-danger"
            >
              {error}
            </Text>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Place order"
          onPress={handleConfirm}
          disabled={!checkpoint}
          loading={createOrder.isPending}
        />
      </ActionBar>
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Where?">
        <View className="gap-1">
          {(checkpoints ?? []).map((c) => (
            <Row
              key={c.id}
              title={c.name}
              meta={c.description ?? undefined}
              chevron={false}
              trailing={
                checkpoint?.id === c.id ? (
                  <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
                ) : null
              }
              onPress={() => {
                selectCheckpoint(c.id);
                setPickerOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

/**
 * One money line. Grouped for assistive tech: "Delivery" and "GH₵20.00" are
 * separate Texts, and read apart they are two facts a listener has to pair up
 * themselves — across five lines that is where a wrong total goes unnoticed.
 * The minus and plus signs are spelled out because a screen reader skips a
 * leading "−" glyph entirely, turning a discount into a charge.
 */
function Line({ label, value }: { label: string; value: string }) {
  const spoken = value.startsWith("−")
    ? `minus ${value.slice(1)}`
    : value.startsWith("+")
      ? `plus ${value.slice(1)}`
      : value;
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${spoken}`}
      className="flex-row items-center justify-between py-2.5"
    >
      <Text className="font-sans text-body text-muted">{label}</Text>
      <Text className="font-sans text-body text-ink">{value}</Text>
    </View>
  );
}
