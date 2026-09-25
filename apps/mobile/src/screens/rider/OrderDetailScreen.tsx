import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Thumb,
  TopBar,
} from "../../components/v6";
import { useOrder } from "../../lib/orders";
import { useAcceptOrder } from "../../lib/rider";
import { apiErrorMessage } from "../../lib/apiError";
import { showToast } from "../../store/toastStore";
import { formatGhs } from "../../lib/pricing";
import { jobPay } from "../../lib/jobOrigin";

type Route = RouteProp<RiderStackParamList, "OrderDetail">;

/**
 * What a rider sees before claiming an order.
 *
 * The fee is the headline because it is the entire decision. v5 put it in a
 * green panel at the bottom, below the fold on a small phone.
 *
 * Reachable before the order is claimed, so the API answers with the feed's
 * view of it (`findFeedOrderForRider`): route, goods and fee, and never the
 * student's name, phone or ID.
 */
export function OrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useAcceptOrder();
  const pay = order ? jobPay(order) : null;

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
          {/* "You'd earn" only when the server quotes the rider's share; the
              delivery fee is what the student pays, and calling it earnings
              promised riders money they would not be paid. */}
          <Text className="font-sans text-body text-muted">
            {pay?.isEarning ? "You'd earn" : "Delivery fee"}
          </Text>
          <Text
            className="mb-8 mt-1 font-sans-bold text-ink"
            style={{ fontSize: 48, lineHeight: 52 }}
          >
            {pay ? formatGhs(pay.amount) : "—"}
          </Text>

          <Text className="mb-2 font-sans-medium text-body text-ink">The job</Text>
          <RowGroup>
            <Row {...collectFrom(order)} chevron={false} />
            <Row
              title={order?.checkpoint?.name ?? "Checkpoint"}
              meta="Hand over here"
              chevron={false}
            />
            <Row
              title={order?.deliveryDay ? `${capitalise(order.deliveryDay)}'s Wave` : "—"}
              meta="Goes out on"
              chevron={false}
            />
          </RowGroup>

          <Text className="mb-2 mt-7 font-sans-medium text-body text-ink">
            {order?.orderType === "pickup" ? "What to carry" : "What to buy"}
          </Text>
          <View className="rounded-card bg-surface p-4">
            <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
          </View>

          {order?.notes ? (
            <>
              <Text className="mb-2 mt-7 font-sans-medium text-body text-ink">
                Notes from the student
              </Text>
              <View className="rounded-card bg-surface p-4">
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

/**
 * Where the job starts. A package pickup starts at a checkpoint and a
 * suggested-shop run at a shop that is not on Wave yet; only a Buy for me order
 * has a Wave shop. Showing "Shop" for all three sent riders to the wrong place.
 */
function collectFrom(order: ReturnType<typeof useOrder>["data"]) {
  if (order?.orderType === "pickup") {
    return { title: order.originCheckpoint?.name ?? "Checkpoint", meta: "Collect the package here" };
  }
  if (order?.orderType === "shop_pickup") {
    return { title: order.suggestion?.name ?? "Shop", meta: order.suggestion?.locationText ?? "Not on Wave yet — ask around" };
  }
  return {
    title: order?.shop?.name ?? "Shop",
    meta: order?.shop?.locationText ?? "Buy from here",
    leading: <Thumb uri={order?.shop?.logoUrl} />,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
