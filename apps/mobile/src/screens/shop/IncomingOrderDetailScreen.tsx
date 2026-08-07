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

type Route = RouteProp<ShopStackParamList, "IncomingOrderDetail">;

/**
 * Accept or reject one paid order.
 *
 * The refund consequence is stated as plain body text rather than in a green
 * panel: it is the most important sentence on the screen and v5's success-green
 * treatment made it read as reassurance rather than a warning.
 */
export function IncomingOrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useShopAcceptOrder();
  const cancelOrder = useShopCancelOrder();

  async function handleAccept() {
    await acceptOrder.mutateAsync(params.orderId);
    navigation.goBack();
  }

  async function handleCancel() {
    await cancelOrder.mutateAsync({
      orderId: params.orderId,
      reason: "Unable to fulfill this order",
    });
    navigation.goBack();
  }

  return (
    <Screen>
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

          <Text className="mb-2 font-sans-medium text-body text-ink">What they want</Text>
          <View className="mb-2 rounded-card bg-surface p-4">
            <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
            {order?.notes ? (
              <Text className="mt-3 font-sans text-body text-muted">{order.notes}</Text>
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
            If you reject this, the student is refunded in full automatically. That cannot be
            undone from here.
          </Text>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button label="Accept order" onPress={handleAccept} loading={acceptOrder.isPending} />
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
