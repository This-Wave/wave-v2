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
    await acceptOrder.mutateAsync(params.orderId);
    navigation.replace("ActiveDelivery", { orderId: params.orderId });
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text className="font-sans text-body text-muted">You'd earn</Text>
          <Text
            className="mb-8 mt-1 font-sans-bold text-ink"
            style={{ fontSize: 48, lineHeight: 52 }}
          >
            {order ? formatGhs(Number(order.deliveryFee)) : "—"}
          </Text>

          <Text className="mb-2 font-sans-medium text-body text-ink">The job</Text>
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
            <Row
              title={order?.deliveryDay ? `${capitalise(order.deliveryDay)}'s Wave` : "—"}
              meta="Goes out on"
              chevron={false}
            />
          </RowGroup>

          <Text className="mb-2 mt-7 font-sans-medium text-body text-ink">What to buy</Text>
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

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
