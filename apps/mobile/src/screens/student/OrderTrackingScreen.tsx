import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Confirm,
  DeliveryPinSnippet,
  Gutter,
  IconCircle,
  Ledger,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
  Steps,
  Thumb,
  TopBar,
} from "../../components/v6";
import { PhoneIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCancelOrder, useOrder } from "../../lib/orders";
import { buildOrderLedger } from "../../lib/ledger";
import { resetStudentTabs } from "../../lib/navigationFlows";
import { showToast } from "../../store/toastStore";
import { currentStepIndex, orderSteps, shortOrderRef, statusPill } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderTracking">;

const STUDENT_CANCELLABLE = ["confirmed", "rider_assigned", "pending", "payment_pending"];

export function OrderTrackingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });
  const cancelOrder = useCancelOrder();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const pill = order ? statusPill(order.status) : null;
  const rider = order?.rider;
  const ledger = order ? buildOrderLedger(order) : null;
  const canCancel = order && STUDENT_CANCELLABLE.includes(order.status);

  async function handleCancel() {
    try {
      const result = await cancelOrder.mutateAsync({
        orderId: params.orderId,
        reason: "Cancelled by student in the app",
      });
      setConfirmCancel(false);
      showToast(
        result.refundIssued
          ? "Order cancelled. Your refund is on its way."
          : "Order cancelled.",
        "success",
      );
      resetStudentTabs(navigation, "Orders");
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      showToast(message ?? "Could not cancel right now.", "danger");
      setConfirmCancel(false);
    }
  }

  return (
    <Screen narrow>
      <TopBar title={order ? shortOrderRef(order.id) : ""} onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <View className="mb-6">
            {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
            <Text className="mt-3 font-sans-bold text-heading text-ink">
              {headline(order?.status)}
            </Text>
            <Text className="mt-1 font-sans text-body text-muted">
              {order?.orderType === "pickup" && order.originCheckpoint
                ? `${order.originCheckpoint.name} → ${order.checkpoint?.name}`
                : order?.checkpoint?.name
                  ? `Handing over at ${order.checkpoint.name}`
                  : "Delivery in progress"}
            </Text>
          </View>

          <DeliveryPinSnippet
            orderId={params.orderId}
            orderStatus={order?.status}
            onOpenFull={() => navigation.navigate("PickupPin", { orderId: params.orderId })}
          />

          <View className="mb-6 rounded-card bg-surface p-5">
            {order ? <Steps steps={orderSteps(order)} currentIndex={currentStepIndex(order.status)} /> : null}
          </View>

          {rider ? (
            <View className="mb-6 flex-row items-center gap-3 rounded-card bg-surface p-4">
              <Thumb size={44} />
              <View className="flex-1">
                <Text className="font-sans-medium text-body text-ink">{rider.fullName}</Text>
                <Text className="font-sans text-body text-muted">Your runner</Text>
              </View>
              {rider.phone ? (
                <IconCircle
                  tone="lime"
                  accessibilityLabel={`Call ${rider.fullName}`}
                  onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                >
                  <PhoneIcon size={18} color={colors.ink} strokeWidth={1.8} />
                </IconCircle>
              ) : null}
            </View>
          ) : null}

          <Text className="mb-3 font-sans-medium text-subheading text-ink">Your order</Text>
          <RowGroup>
            <Row
              title={order?.itemDescription ?? "—"}
              meta={order?.shop?.name}
              leading={<Thumb uri={order?.shop?.logoUrl} />}
              chevron={false}
            />
          </RowGroup>

          {ledger ? (
            <View className="mt-6 rounded-card bg-surface p-5">
              <Ledger ledger={ledger} />
            </View>
          ) : null}

          {canCancel ? (
            <View className="mt-8">
              <Button
                label="Cancel this order"
                variant="ghost"
                onPress={() => setConfirmCancel(true)}
                loading={cancelOrder.isPending}
              />
              <Text className="mt-2 font-sans text-body text-muted">
                Only before your runner is on the way. Paid orders are refunded automatically.
              </Text>
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Show pickup code"
          onPress={() => navigation.navigate("PickupPin", { orderId: params.orderId })}
        />
      </ActionBar>

      <Confirm
        visible={confirmCancel}
        title="Cancel this order?"
        body="We'll stop the run. If you already paid, the refund goes back to how you paid."
        confirmLabel="Yes, cancel"
        onConfirm={() => void handleCancel()}
        onCancel={() => setConfirmCancel(false)}
      />
    </Screen>
  );
}

function headline(status?: string): string {
  switch (status) {
    case "confirmed":
      return "We've got your order";
    case "rider_assigned":
      return "A runner is on it";
    case "en_route":
      return "On the way to you";
    case "at_checkpoint":
      return "Your runner has arrived";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Order cancelled";
    case "refunded":
      return "Refunded";
    default:
      return "Tracking your order";
  }
}
