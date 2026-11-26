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

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text className="font-sans text-body text-muted">You'd earn</Text>
          <Text
            className="mb-6 mt-1 font-display text-ink"
            style={{ fontSize: 48, lineHeight: 52 }}
          >
            {order ? formatGhs(Number(order.estimatedEarning ?? order.deliveryFee)) : "—"}
          </Text>

          {/* v7: the route first (where you go), then the pickup details the
              sender gave, then what it is. Student contact stays hidden until
              the job is accepted. */}
          <View className="mb-4 rounded-card border border-hairline bg-surface p-4">
            <RouteLine
              fromLabel="Collect from"
              from={order?.orderType === "pickup" ? (order?.senderName ?? order?.originCheckpoint?.name ?? "Accra") : (order?.shop?.name ?? "Shop")}
              fromSub={order?.orderType === "pickup" ? order?.originCheckpoint?.name : order?.shop?.locationText}
              toLabel="Deliver to"
              to={order?.checkpoint?.name ?? "Campus"}
              toSub={order?.deliveryDay ? `${capitalise(order.deliveryDay)}'s Wave` : null}
            />
          </View>

          {order?.pickupNotes || order?.packageSize ? (
            <View className="mb-4 rounded-card border border-hairline bg-surface px-4 py-1">
              {order.packageSize ? (
                <View className="flex-row justify-between border-b border-hairline py-3">
                  <Text className="font-sans text-body text-muted">Package</Text>
                  <Text className="font-sans-bold text-body text-ink">{capitalise(order.packageSize)} size</Text>
                </View>
              ) : null}
              {(order.pickupNotes ?? "").split(" · ").filter(Boolean).map((line) => (
                <View key={line} className="border-b border-hairline py-3">
                  <Text className="font-sans text-body text-ink">{line}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text className="mb-2 mt-3 font-sans-bold text-body text-ink">
            {order?.orderType === "pickup" ? "What it is" : "What to buy"}
          </Text>
          <View className="rounded-card border border-hairline bg-surface p-4">
            <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
          </View>

          {order?.notes ? (
            <>
              <Text className="mb-2 mt-7 font-sans-bold text-body text-ink">
                Notes from the student
              </Text>
              <View className="rounded-card border border-hairline bg-surface p-4">
                <Text className="font-sans text-body text-ink">{order.notes}</Text>
              </View>
            </>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button label="Accept this order" onPress={handleAccept} loading={acceptOrder.isPending} />
          <Button label="Pass" variant="quiet" onPress={() => navigation.goBack()} />
        </View>
      </ActionBar>
    </Screen>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
