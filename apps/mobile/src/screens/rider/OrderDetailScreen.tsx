import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { RouteLine } from "../../components/v7/Signature";
import { InfoRow } from "../../components/v7/InfoRows";
import { parsePickupNotes } from "../../lib/pickupNotes";
import { SIZE_INFO } from "@wave/shared";
import { shortOrderRef } from "../student/orderPresenters";
import { useOrder } from "../../lib/orders";
import { useAcceptOrder } from "../../lib/rider";
import { apiErrorMessage } from "../../lib/apiError";
import { showToast } from "../../store/toastStore";
import { formatGhs } from "../../lib/pricing";

type Route = RouteProp<RiderStackParamList, "OrderDetail">;

/**
 * What a rider sees before claiming an order.
 *
 * The fee is the headline because it is the entire decision. v5 put it in a
 * green panel at the bottom, below the fold on a small phone.
 *
 * Note the student's name and number are deliberately NOT shown here — this
 * screen is reachable before the order is claimed. See `debug.md`: the API
 * currently sends them anyway, which is an open defect.
 */
export function OrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useAcceptOrder();

  async function handleAccept() {
    // Two riders tapping Accept on the same feed entry is ordinary contention,
    // not an edge case — the server says so in the claim-lock comment on
    // `PATCH /orders/:id/accept` and answers 409 to the loser. `mutateAsync`
    // rejects on that, and without this catch the rejection was unhandled: the
    // spinner stopped, no message appeared, and the rider was left tapping a
    // button that silently did nothing (review 08-mobile, H4).
    try {
      await acceptOrder.mutateAsync(params.orderId);
      navigation.replace("ActiveDelivery", { orderId: params.orderId });
    } catch (err) {
      // The API's own copy names the actual reason ("already accepted by
      // another rider"), which is what tells them to go back to the feed.
      showToast(apiErrorMessage(err, "Couldn't accept this order — another rider may have taken it. Pull down to refresh the feed."), "danger");
      navigation.goBack();
    }
  }

  const d = parsePickupNotes(order?.pickupNotes);
  const sizeInfo = SIZE_INFO.find((x) => x.key === order?.packageSize) ?? null;
  const rows: [string, string | null | undefined][] = [
    ["Building", d.building],
    ["Landmark", d.landmark],
    ["Handover", d.handover],
    ["Package", order?.packageSize ? `${capitalise(order.packageSize)}${sizeInfo ? ` · up to ${sizeInfo.maxKg} kg` : ""}` : null],
    [order?.orderType === "pickup" ? "What it is" : "What to buy", order?.itemDescription],
  ];
  const earn = order ? Number(order.estimatedEarning ?? order.deliveryFee) : null;

  return (
    <Screen narrow>
      <TopBar title={order ? `Job ${shortOrderRef(order.id)}` : "Job"} onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        {/* v7 canvas: where you go, what you'll find there, then the sender's
            words. Student contact stays hidden until the job is accepted. */}
        <Gutter className="pt-1" style={{ gap: 12 }}>
          <View className="rounded-card border border-hairline bg-surface p-4">
            <RouteLine
              fromLabel="Collect from"
              from={order?.orderType === "pickup" ? (order?.senderName ?? order?.originCheckpoint?.name ?? "Accra") : (order?.shop?.name ?? "Shop")}
              fromSub={order?.orderType === "pickup" ? order?.originCheckpoint?.name : order?.shop?.locationText}
              toLabel="Deliver to"
              to={order?.checkpoint?.name ?? "Campus"}
              toSub={order?.deliveryDay ? `${capitalise(order.deliveryDay)}'s Wave` : null}
            />
          </View>

          <View className="rounded-card border border-hairline bg-surface px-4">
            {rows
              .filter(([, v]) => !!v)
              .map(([k, v], i, all) => (
                <InfoRow key={k} label={k} value={v} last={i === all.length - 1} />
              ))}
          </View>

          {d.instructions || order?.notes ? (
            <View className="rounded-card bg-wash p-4">
              <Text className="font-sans-bold text-body text-ink">Instructions</Text>
              <Text className="mt-1 font-sans text-body text-ink-700">{d.instructions ?? order?.notes}</Text>
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="mb-3 flex-row items-end justify-between">
          <Text className="font-sans text-ui text-muted">{order?.estimatedEarning ? "You earn" : "Delivery fee"}</Text>
          <Text className="font-display text-ink" style={{ fontSize: 28, lineHeight: 32 }}>
            {earn !== null ? formatGhs(earn) : "—"}
          </Text>
        </View>
        <Button label="Accept job" onPress={handleAccept} loading={acceptOrder.isPending} />
      </ActionBar>
    </Screen>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
