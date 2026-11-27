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
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { CodeTicket, RouteLine, Tracker } from "../../components/v7/Signature";
import { PhoneIcon } from "../../components/icons";
import { useConfirmReceipt, useDeliveryPin } from "../../lib/orders";
import { colors } from "../../theme/tokens";
import { useCancelOrder, useOrder } from "../../lib/orders";
import { resetStudentTabs } from "../../lib/navigationFlows";
import { showToast } from "../../store/toastStore";
import { apiErrorMessage, isRefundFailed } from "../../lib/apiError";
import { openSupportContact } from "../../lib/support";
import { currentStepIndex, orderSteps, shortOrderRef, trackerSteps } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderTracking">;

const STUDENT_CANCELLABLE = ["confirmed", "rider_assigned", "pending", "payment_pending"];

export function OrderTrackingScreen() {
  const confirmReceipt = useConfirmReceipt();
  const [confirming, setConfirming] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });
  const cancelOrder = useCancelOrder();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [needsSupport, setNeedsSupport] = useState(false);

  const { data: pin } = useDeliveryPin(order?.status === "at_checkpoint" && !order.companyId ? params.orderId : undefined);
  // Wave packs and delivers this one (company mode): the student shows the
  // order number to collect the bag and closes it themselves. No runner, no
  // PIN, and no hint that anyone but Wave carried it.
  const packedByWave = !!order?.companyId;
  const rider = order?.rider;
  // Only once a rider is actually carrying it. Offering this earlier would let a
  // student close an order nobody has collected, and still be counted a delivery
  // towards their loyalty discount — the server refuses, but the button should
  // not be there to press.
  // A Wave-packed order has no Wave rider; it can be received once its bag is
  // waiting at the checkpoint.
  const canConfirmReceipt = order?.companyId
    ? order.status === "at_checkpoint"
    : !!order?.riderId && ["rider_assigned", "en_route", "at_checkpoint"].includes(order.status);
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
      showToast(apiErrorMessage(err, "Couldn't cancel right now. Check your connection and try again."), "danger");
      setConfirmCancel(false);
      // A refund the server could not send: the order is still open, so give a
      // way to reach a person right here.
      if (isRefundFailed(err)) setNeedsSupport(true);
    }
  }

  const arrived = order?.status === "at_checkpoint";
  const steps = order ? trackerSteps(order) : [];

  return (
    <Screen narrow>
      <TopBar title="Tracking" onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          {arrived && !packedByWave ? (
            // v7 canvas "It's here.": the code is the whole screen's job now.
            <View className="mb-6 items-center">
              <Text accessibilityRole="header" className="mt-2 text-center font-display text-heading text-ink">
                It's here.
              </Text>
              <Text className="mb-5 mt-3 text-center font-sans text-body text-muted">
                At {order?.checkpoint?.name ?? "your"} checkpoint. Show this code.
              </Text>
              <View className="self-stretch">
                {pin ? (
                  <CodeTicket pin={pin} large caption="" note="Only works for you" />
                ) : (
                  <DeliveryPinSnippet
                    orderId={params.orderId}
                    orderStatus={order?.status}
                    onOpenFull={() => navigation.navigate("PickupPin", { orderId: params.orderId })}
                  />
                )}
              </View>
            </View>
          ) : (
            <View className="mb-5">
              <Text accessibilityRole="header" className="mt-1 font-display text-heading text-ink">
                {headline(order?.status, packedByWave)}
              </Text>
              {order ? (
                <Text className="mt-1 font-sans text-ui text-muted">{arrivalLine(order.scheduledDate, order.status)}</Text>
              ) : null}
            </View>
          )}

          {order && !(arrived && !packedByWave) ? (
            <View className="mb-5 rounded-card border border-hairline bg-surface p-4">
              <RouteLine
                fromLabel={order.orderType === "pickup" ? "From" : "Buying at"}
                from={
                  order.orderType === "pickup"
                    ? [order.senderName, order.originCheckpoint?.name?.split(" & ")[0]].filter(Boolean).join(", ") || "Accra"
                    : (order.shop?.name ?? "The shop")
                }
                toLabel="To you at"
                to={order.checkpoint?.name ?? "your pickup point"}
                progress={Math.min(1, (currentStepIndex(order.status) + 1) / Math.max(orderSteps(order).length, 1))}
              />
            </View>
          ) : null}

          {order ? <Tracker steps={steps} /> : null}

          {packedByWave ? (
            <Text className="mt-5 font-sans text-body text-muted">
              Order number <Text className="font-sans-bold text-ink">{shortOrderRef(params.orderId)}</Text>
            </Text>
          ) : !arrived && order && order.status !== "delivered" ? (
            <View className="mt-5">
              <Button
                label="Show my code"
                variant="quiet"
                onPress={() => navigation.navigate("PickupPin", { orderId: params.orderId })}
              />
            </View>
          ) : null}

          {/* The PIN arrives by SMS, and SMS does not always arrive: a second
              way to close the delivery keeps a text message from being a
              single point of failure. */}
          {canConfirmReceipt && !packedByWave ? (
            <View className="mt-2">
              <Button
                label="I have my parcel"
                variant="quiet"
                loading={confirmReceipt.isPending}
                onPress={() => setConfirming(true)}
              />
            </View>
          ) : null}

          {canCancel ? (
            <View className="mt-2">
              <Button
                label="Cancel this order"
                variant="quiet"
                onPress={() => setConfirmCancel(true)}
                loading={cancelOrder.isPending}
              />
              {needsSupport ? (
                <View className="mt-2">
                  <Button label="Message Wave support" variant="ghost" onPress={() => void openSupportContact()} />
                </View>
              ) : null}
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      {packedByWave && canConfirmReceipt ? (
        <ActionBar>
          <Button label="I have my parcel" loading={confirmReceipt.isPending} onPress={() => setConfirming(true)} />
        </ActionBar>
      ) : rider?.phone ? (
        <ActionBar>
          <Button
            label="Call the rider"
            variant="ghost"
            icon={<PhoneIcon size={18} color={colors.ink} strokeWidth={1.9} />}
            onPress={() => void Linking.openURL(`tel:${rider.phone}`)}
          />
        </ActionBar>
      ) : null}

      <Confirm
        visible={confirmCancel}
        title="Cancel this order?"
        body="We'll stop the run. If you already paid, the refund goes back to how you paid."
        confirmLabel="Yes, cancel"
        onConfirm={() => void handleCancel()}
        onCancel={() => setConfirmCancel(false)}
      />
      <Confirm
        visible={confirming}
        title="Do you have your order?"
        body={
          packedByWave
            ? "Only tap yes once your Wave bag is in your hands."
            : "This closes the delivery, the same as giving your runner the PIN. Only tap yes once your things are in your hands."
        }
        confirmLabel="Yes, I have it"
        onConfirm={() => {
          setConfirming(false);
          confirmReceipt.mutate(params.orderId);
        }}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

function headline(status: string | undefined, packed: boolean): string {
  switch (status) {
    case "confirmed":
      return "Booked";
    case "rider_assigned":
      return packed ? "Being collected" : "Rider is on the way to it";
    case "en_route":
      return packed ? "Being packed" : "On the way up";
    case "at_checkpoint":
      return "Ready for you";
    case "delivered":
      return "Collected";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return "Tracking";
  }
}

/** "Arrives today" / "Arrives Thursday 27 Nov", from the Wave day. */
function arrivalLine(iso: string | undefined, status: string): string {
  if (status === "delivered") return "Collected. Thanks for using Wave.";
  if (status === "cancelled" || status === "refunded") return "This order won't be delivered.";
  if (!iso) return "On today's Wave";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Arrives today";
  return `Arrives ${d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}`;
}
