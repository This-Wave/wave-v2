import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ShopStackParamList } from "../../navigation/ShopNavigator";
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
import { useOrder } from "../../lib/orders";
import { useShopAcceptOrder, useShopCancelOrder } from "../../lib/shopOwner";
import { formatGhs } from "../../lib/pricing";
import { showToast } from "../../store/toastStore";

type Route = RouteProp<ShopStackParamList, "IncomingOrderDetail">;

/**
 * Acknowledge or reject one paid order.
 *
 * The refund consequence is stated as plain body text rather than in a green
 * panel: it is the most important sentence on the screen and v5's success-green
 * treatment made it read as reassurance rather than a warning.
 *
 * The primary action used to read "Accept order", which described a gate that
 * does not exist (review 03-product-manager, H2). `shopAcceptedAt` is advisory:
 * the rider feed filters on paid status, campus and rider verification, never on
 * it, so a runner can be on their way before a shop has opened the app at all. A
 * shop reading "Accept" reasonably assumes nothing moves until they tap — and
 * then a rider arrives for an order they thought they were still considering.
 * The label now describes what the tap actually does.
 */
export function IncomingOrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useShopAcceptOrder();
  const cancelOrder = useShopCancelOrder();

  async function handleAccept() {
    await acceptOrder.mutateAsync(params.orderId);
    showToast("Thanks — the runner knows you're on it.", "success");
    navigation.goBack();
  }

  async function handleCancel() {
    await cancelOrder.mutateAsync({
      orderId: params.orderId,
      reason: "Unable to fulfill this order",
    });
    showToast("Order rejected. Student will be refunded.", "success");
    navigation.goBack();
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text className="font-sans text-body text-muted">Order value</Text>
          <Text
            className="mb-8 mt-1 font-sans-bold text-ink"
            style={{ fontSize: 44, lineHeight: 48 }}
          >
            {order?.totalAmount ? formatGhs(Number(order.totalAmount)) : "—"}
          </Text>

          {/* Itemised, so the kitchen can read quantities off the screen. Falls
              back to the summary line for orders placed before baskets existed. */}
          <Text className="mb-2 font-sans-medium text-body text-ink">What they want</Text>
          <View className="mb-2 rounded-card bg-surface p-4">
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
            {order?.notes ? (
              <Text className="mt-3 border-t border-hairline pt-3 font-sans text-body text-muted">
                {order.notes}
              </Text>
            ) : null}
          </View>

          <View className="mt-5">
            <RowGroup>
              <Row
                title={order?.student?.fullName ?? "Student"}
                meta="Ordered by"
                chevron={false}
              />
              <Row
                title={order?.checkpoint?.name ?? "Checkpoint"}
                meta="A runner collects and delivers here"
                chevron={false}
              />
              <Row
                title={order?.deliveryDay ? `${capitalise(order.deliveryDay)}'s Wave` : "—"}
                meta="Goes out on"
                chevron={false}
              />
            </RowGroup>
          </View>

          <Text className="mt-7 font-sans text-body text-muted">
            A runner may arrive before you tap below — this order is already paid and in the
            queue. Letting us know you&apos;ve seen it just tells the runner you&apos;re on it.
          </Text>

          <Text className="mt-3 font-sans text-body text-muted">
            If you can&apos;t fulfil this, the student is refunded in full automatically. That
            cannot be undone from here, and there is no way to supply only part of the order —
            it is all of it or none.
          </Text>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button label="We'll start prep" onPress={handleAccept} loading={acceptOrder.isPending} />
          <Button
            label="Can't fulfil this"
            variant="ghost"
            onPress={handleCancel}
            loading={cancelOrder.isPending}
          />
        </View>
      </ActionBar>
    </Screen>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
