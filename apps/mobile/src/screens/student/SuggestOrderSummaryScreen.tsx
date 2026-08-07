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
  Sheet,
  TopBar,
} from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCheckpoints } from "../../lib/checkpoints";
import { useCompletedDeliveryCount, useCreateOrder } from "../../lib/orders";
import { useAuthStore } from "../../store/authStore";
import {
  deliveryDayFor,
  estimateOrderTotal,
  formatFullDay,
  formatGhs,
  formatGhsCompact,
} from "../../lib/pricing";

type Nav = NativeStackNavigationProp<StudentStackParamList>;
type Route = RouteProp<StudentStackParamList, "SuggestOrderSummary">;

/**
 * Review a suggested-shop order before paying the delivery fee.
 *
 * The hard part of this screen is honesty about money. Every other order in
 * Wave has a total before you pay; this one cannot, because the shop has no
 * catalogue and nobody knows what the items cost until a runner is standing at
 * the till. So the screen says that plainly and twice — once in the fee block
 * and once above the button — rather than showing a confident-looking total
 * that is only the delivery fee.
 */
export function SuggestOrderSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);
  const createOrder = useCreateOrder();
  const completedDeliveries = useCompletedDeliveryCount();

  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkpoint = checkpoints?.find((c) => c.id === checkpointId) ?? checkpoints?.[0];
  const scheduledDate = new Date(params.scheduledDate);

  const estimate = useMemo(
    () =>
      estimateOrderTotal({
        itemPrice: 0,
        isSpecialOrder: params.isSpecialOrder,
        completedDeliveries,
      }),
    [params.isSpecialOrder, completedDeliveries],
  );

  async function handleConfirm() {
    if (!checkpoint) return;
    setError(null);
    try {
      const order = await createOrder.mutateAsync({
        orderType: "shop_pickup",
        suggestionId: params.suggestionId,
        checkpointId: checkpoint.id,
        manualItems: params.manualItems,
        deliveryDay: deliveryDayFor(scheduledDate, params.isSpecialOrder),
        scheduledDate: params.scheduledDate,
        isSpecialOrder: params.isSpecialOrder,
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
            {params.manualItems.map((item, i) => (
              <View
                key={i}
                className={`flex-row items-center justify-between py-2 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <Text className="flex-1 font-sans text-body text-ink">{item.name}</Text>
                <Text className="font-sans text-body text-muted">×{item.quantity}</Text>
              </View>
            ))}
          </View>

          <RowGroup>
            <Row
              title={params.shopName}
              meta={params.locationText ?? "Buying from — not yet on Wave"}
              chevron={false}
            />
            <Row
              title={checkpoint?.name ?? "Choose a checkpoint"}
              meta="Delivering to"
              onPress={() => setPickerOpen(true)}
            />
            <Row title={formatFullDay(scheduledDate)} meta="On this Wave" chevron={false} />
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
            <Line label="The items" value="Not yet known" />
            <View className="mt-1 h-px bg-hairline" />
            <View className="flex-row items-center justify-between pt-4">
              <Text className="font-sans-medium text-ui text-ink">Total now</Text>
              <Text className="font-sans-bold text-heading-sm text-ink">
                {formatGhsCompact(estimate.total)}
              </Text>
            </View>
          </View>

          <View className="mt-4 rounded-card bg-warning-bg p-4">
            <Text className="font-sans-medium text-body text-warning">
              You'll pay for the items separately
            </Text>
            <Text className="mt-1 font-sans text-body text-warning">
              {params.shopName} isn't on Wave yet, so there's no menu to price. Your runner will tell
              you exactly what everything cost, and you pay that before they hand it over.
            </Text>
          </View>

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Pay delivery & send runner"
          onPress={handleConfirm}
          loading={createOrder.isPending}
          disabled={!checkpoint}
        />
      </ActionBar>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Deliver to">
        <View className="gap-1">
          {(checkpoints ?? []).map((c) => (
            <Option
              key={c.id}
              title={c.name}
              meta={c.description ?? undefined}
              selected={checkpoint?.id === c.id}
              onPress={() => {
                setCheckpointId(c.id);
                setPickerOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
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

function Option({
  title,
  meta,
  selected,
  onPress,
}: {
  title: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Row
      title={title}
      meta={meta}
      onPress={onPress}
      chevron={false}
      trailing={selected ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
    />
  );
}
