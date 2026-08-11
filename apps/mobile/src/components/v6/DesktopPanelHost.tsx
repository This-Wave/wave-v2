import { Linking, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { useDesktopPanelStore } from "../../store/desktopPanelStore";
import { useCancelOrder, useOrder } from "../../lib/orders";
import { showToast } from "../../store/toastStore";
import { useAcceptOrder } from "../../lib/rider";
import { useShopAcceptOrder, useShopCancelOrder } from "../../lib/shopOwner";
import { buildOrderLedger } from "../../lib/ledger";
import { useAuthStore } from "../../store/authStore";
import { useWave } from "../../lib/wave";
import { classifyMonth, formatFullDay, formatGhs, isStandardRunDay } from "../../lib/pricing";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";
import {
  currentStepIndex,
  orderSteps,
  shortOrderRef,
  statusPill,
} from "../../screens/student/orderPresenters";
import { useMemo, useState } from "react";
import { Button } from "./Button";
import { Calendar } from "./Calendar";
import { Confirm } from "./Sheet";
import { DeliveryPinSnippet } from "./DeliveryPinSnippet";
import { IconCircle, StatusPill } from "./Controls";
import { Ledger } from "./Ledger";
import { Row, RowGroup, Thumb } from "./List";
import { RightPanel } from "./RightPanel";
import { Steps } from "./Progress";
import { PhoneIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { openShopMenu } from "../../lib/desktopNavigate";
import { ShopMenuPanel } from "../../screens/student/web/ShopMenuPanel";

type StudentNav = NativeStackNavigationProp<StudentStackParamList>;
type RiderNav = NativeStackNavigationProp<RiderStackParamList>;

/** Renders the open desktop right panel, if any. */
export function DesktopPanelHost() {
  const panel = useDesktopPanelStore((s) => s.panel);
  const closePanel = useDesktopPanelStore((s) => s.closePanel);
  if (!panel) return null;

  switch (panel.type) {
    case "orderTracking":
      return <OrderTrackingPanel orderId={panel.orderId} onClose={closePanel} />;
    case "orderDetail":
      return <OrderDetailPanel orderId={panel.orderId} onClose={closePanel} />;
    case "waveCalendar":
      return <WaveCalendarPanel onClose={closePanel} />;
    case "paymentMethods":
      return <PaymentMethodsPanel onClose={closePanel} />;
    case "shopMenu":
      return <ShopMenuPanel {...panel} onClose={closePanel} />;
    case "riderClaim":
      return <RiderClaimPanel orderId={panel.orderId} onClose={closePanel} />;
    case "shopIncoming":
      return <ShopIncomingPanel orderId={panel.orderId} onClose={closePanel} />;
    default:
      return null;
  }
}

function OrderTrackingPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const navigation = useNavigation<StudentNav>();
  const { data: order } = useOrder(orderId, { poll: true });
  const cancelOrder = useCancelOrder();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pill = order ? statusPill(order.status) : null;
  const rider = order?.rider;
  const ledger = order ? buildOrderLedger(order) : null;
  const canCancel =
    order && ["confirmed", "rider_assigned", "pending", "payment_pending"].includes(order.status);

  return (
    <RightPanel
      title={order ? shortOrderRef(order.id) : "Tracking"}
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="Show pickup code"
            onPress={() => {
              onClose();
              navigation.navigate("PickupPin", { orderId });
            }}
          />
          {canCancel ? (
            <Button label="Cancel order" variant="ghost" onPress={() => setConfirmCancel(true)} />
          ) : null}
        </View>
      }
    >
      {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
      <Text className="mt-3 font-sans-bold text-heading-sm text-ink">
        {trackingHeadline(order?.status)}
      </Text>
      <Text className="mb-4 mt-1 font-sans text-body text-muted">
        {order?.checkpoint?.name
          ? `Handing over at ${order.checkpoint.name}`
          : "Delivery in progress"}
      </Text>

      <DeliveryPinSnippet orderId={orderId} orderStatus={order?.status} />

      <View className="mb-5 rounded-card bg-canvas p-4">
        {order ? (
          <Steps steps={orderSteps(order)} currentIndex={currentStepIndex(order.status)} />
        ) : null}
      </View>

      {rider ? (
        <View className="mb-5 flex-row items-center gap-3 rounded-card bg-canvas p-4">
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

      <Text className="mb-2 font-sans-medium text-body text-ink">Your order</Text>
      <RowGroup>
        <Row
          title={order?.itemDescription ?? "—"}
          meta={order?.shop?.name}
          leading={<Thumb uri={order?.shop?.logoUrl} />}
          chevron={false}
        />
      </RowGroup>
      {ledger ? (
        <View className="mt-5 rounded-card bg-canvas p-4">
          <Ledger ledger={ledger} />
        </View>
      ) : null}
      <Confirm
        visible={confirmCancel}
        title="Cancel this order?"
        body="If you already paid, the refund goes back to how you paid."
        confirmLabel="Yes, cancel"
        onConfirm={async () => {
          try {
            const result = await cancelOrder.mutateAsync({
              orderId,
              reason: "Cancelled by student in the app",
            });
            setConfirmCancel(false);
            showToast(
              result.refundIssued
                ? "Order cancelled. Your refund is on its way."
                : "Order cancelled.",
              "success",
            );
            onClose();
          } catch {
            showToast("Could not cancel right now.", "danger");
            setConfirmCancel(false);
          }
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </RightPanel>
  );
}

function OrderDetailPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const navigation = useNavigation<StudentNav>();
  const { data: order } = useOrder(orderId);
  if (!order) {
    return (
      <RightPanel title="Order" onClose={onClose}>
        <Text className="font-sans text-body text-muted">Loading…</Text>
      </RightPanel>
    );
  }
  const pill = statusPill(order.status);
  const ledger = buildOrderLedger(order);

  return (
    <RightPanel
      title={shortOrderRef(order.id)}
      onClose={onClose}
      footer={
        order.shop ? (
          <Button
            label="Order again"
            onPress={() => {
              const next = new Date();
              onClose();
              openShopMenu(navigation, {
                shopId: order.shop!.id,
                shopName: order.shop!.name,
                scheduledDate: next.toISOString(),
                isSpecialOrder: !isStandardRunDay(next),
              });
            }}
          />
        ) : undefined
      }
    >
      <StatusPill label={pill.label} tone={pill.tone} />
      <Text className="mt-3 font-sans-bold text-heading-sm text-ink">
        {order.shop?.name ?? "Package pickup"}
      </Text>
      <Text className="mb-5 mt-1 font-sans text-body text-muted">{order.itemDescription}</Text>

      <View className="mb-5 rounded-card bg-canvas p-4">
        <Ledger ledger={ledger} />
      </View>
      <View className="rounded-card bg-canvas p-4">
        <Steps steps={orderSteps(order)} currentIndex={currentStepIndex(order.status)} />
      </View>
    </RightPanel>
  );
}

function WaveCalendarPanel({ onClose }: { onClose: () => void }) {
  const navigation = useNavigation<StudentNav>();
  const wave = useWave();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(() => wave?.date ?? null);
  const days = useMemo(() => classifyMonth(month, today), [month, today]);
  const isRush = !!selected && !isStandardRunDay(selected);
  const canGoBack =
    month.getFullYear() > today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() && month.getMonth() > today.getMonth());

  return (
    <RightPanel
      title="Pick a Wave"
      onClose={onClose}
      footer={
        <Button
          label="Continue"
          disabled={!selected}
          onPress={() => {
            if (!selected) return;
            onClose();
            navigation.navigate("ChooseService", {
              scheduledDate: selected.toISOString(),
              isSpecialOrder: isRush,
            });
          }}
        />
      }
    >
      <Text className="mb-4 font-sans text-body text-muted">
        Sunday and Wednesday are standard. Any other day is rush.
      </Text>
      <Calendar
        month={month}
        days={days}
        selected={selected}
        onSelect={setSelected}
        onPrevMonth={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onNextMonth={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        canGoBack={canGoBack}
      />
      {selected ? (
        <View className="mt-4 rounded-card bg-canvas p-4">
          <Text className="font-sans-medium text-body text-ink">{formatFullDay(selected)}</Text>
          <Text className="mt-1 font-sans text-body text-muted">
            {isRush
              ? `Rush — ${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% more on the fee.`
              : "Standard Wave. No surcharge."}
          </Text>
        </View>
      ) : null}
    </RightPanel>
  );
}

function PaymentMethodsPanel({ onClose }: { onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  return (
    <RightPanel title="Payment" onClose={onClose}>
      <Text className="mb-5 font-sans text-body text-muted">
        You choose how to pay each time you check out.
      </Text>
      <RowGroup>
        <Row
          title="Mobile Money"
          meta={profile?.phone ?? "MTN · Telecel · AirtelTigo"}
          chevron={false}
        />
        <Row title="Card" meta="Visa or Mastercard" chevron={false} />
      </RowGroup>
      <View className="mt-5 rounded-card bg-canvas p-4">
        <Text className="mb-1 font-sans-semibold text-meta text-muted">WHY NOTHING TO SET UP</Text>
        <Text className="font-sans text-body text-ink">
          Paystack handles the payment. Wave never stores your card or wallet details.
        </Text>
      </View>
    </RightPanel>
  );
}

function RiderClaimPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const navigation = useNavigation<RiderNav>();
  const { data: order } = useOrder(orderId);
  const acceptOrder = useAcceptOrder();

  return (
    <RightPanel
      title="Claim order"
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="Accept this order"
            loading={acceptOrder.isPending}
            onPress={async () => {
              await acceptOrder.mutateAsync(orderId);
              onClose();
              navigation.navigate("ActiveDelivery", { orderId });
            }}
          />
          <Button label="Pass" variant="quiet" onPress={onClose} />
        </View>
      }
    >
      <Text className="font-sans text-body text-muted">You'd earn</Text>
      <Text className="mb-5 mt-1 font-sans-bold text-heading text-ink">
        {order ? formatGhs(Number(order.deliveryFee)) : "—"}
      </Text>
      <RowGroup>
        <Row
          title={order?.shop?.name ?? "Shop"}
          meta={order?.shop?.locationText ?? "Buy from here"}
          leading={<Thumb uri={order?.shop?.logoUrl} />}
          chevron={false}
        />
        <Row
          title={order?.checkpoint?.name ?? "Checkpoint"}
          meta="Hand over here"
          chevron={false}
        />
      </RowGroup>
      <Text className="mb-2 mt-5 font-sans-medium text-body text-ink">What to buy</Text>
      <View className="rounded-card bg-canvas p-4">
        {order?.items?.length ? (
          order.items.map((item, i) => (
            <Text
              key={item.id}
              className={`font-sans text-body text-ink ${i > 0 ? "mt-2 border-t border-hairline pt-2" : ""}`}
            >
              {item.quantity}× {item.name}
            </Text>
          ))
        ) : (
          <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
        )}
      </View>
      {order?.notes ? (
        <>
          <Text className="mb-2 mt-5 font-sans-medium text-body text-ink">Notes</Text>
          <View className="rounded-card bg-canvas p-4">
            <Text className="font-sans text-body text-ink">{order.notes}</Text>
          </View>
        </>
      ) : null}
    </RightPanel>
  );
}

function ShopIncomingPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order } = useOrder(orderId);
  const acceptOrder = useShopAcceptOrder();
  const cancelOrder = useShopCancelOrder();

  return (
    <RightPanel
      title="Incoming order"
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="Accept order"
            loading={acceptOrder.isPending}
            onPress={async () => {
              await acceptOrder.mutateAsync(orderId);
              onClose();
            }}
          />
          <Button
            label="Can't fulfil this"
            variant="ghost"
            loading={cancelOrder.isPending}
            onPress={async () => {
              await cancelOrder.mutateAsync({
                orderId,
                reason: "Unable to fulfill this order",
              });
              onClose();
            }}
          />
        </View>
      }
    >
      <Text className="font-sans text-body text-muted">Order value</Text>
      <Text className="mb-5 mt-1 font-sans-bold text-heading text-ink">
        {order?.totalAmount ? formatGhs(Number(order.totalAmount)) : "—"}
      </Text>
      <Text className="mb-2 font-sans-medium text-body text-ink">What they want</Text>
      <View className="mb-4 rounded-card bg-canvas p-4">
        {order?.items?.length ? (
          order.items.map((item, i) => (
            <View
              key={item.id}
              className={`flex-row items-center justify-between py-2 ${
                i > 0 ? "border-t border-hairline" : ""
              }`}
            >
              <Text className="flex-1 font-sans text-body text-ink">
                {item.quantity}× {item.name}
              </Text>
              {item.unitPrice ? (
                <Text className="font-sans text-body text-muted">
                  {formatGhs(Number(item.unitPrice) * item.quantity)}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
        )}
      </View>
      <RowGroup>
        <Row title={order?.student?.fullName ?? "Student"} meta="Ordered by" chevron={false} />
        <Row
          title={order?.checkpoint?.name ?? "Checkpoint"}
          meta="Runner collects here"
          chevron={false}
        />
      </RowGroup>
      <Text className="mt-5 font-sans text-body text-muted">
        Rejecting refunds the student in full. That cannot be undone from here.
      </Text>
    </RightPanel>
  );
}

function trackingHeadline(status?: string): string {
  switch (status) {
    case "confirmed":
      return "We've got your order";
    case "rider_assigned":
      return "A runner is on it";
    case "en_route":
      return "On the way to you";
    case "at_checkpoint":
      return "Your runner has arrived";
    default:
      return "Tracking your order";
  }
}
