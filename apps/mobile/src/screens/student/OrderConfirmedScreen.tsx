import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Row, RowGroup, Screen, ScreenBody } from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { formatFullDay } from "../../lib/pricing";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderConfirmed">;

/**
 * The moment after paying.
 *
 * No confetti, no illustration — the reference has no such vocabulary. A lime
 * disc with an ink check is the entire celebration, and the screen spends its
 * space on the two things a student needs next: when the run is, and that the
 * delivery code is coming by text.
 */
export function OrderConfirmedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-12">
          <View className="mb-6 h-14 w-14 items-center justify-center rounded-pill bg-lime">
            <CheckIcon size={28} color={colors.ink} strokeWidth={2.4} />
          </View>

          <Text className="mb-2 font-sans-bold text-heading text-ink">You're on the run</Text>
          <Text className="mb-9 font-sans text-body text-muted">
            {order?.scheduledDate
              ? `We'll bring it on ${formatFullDay(new Date(order.scheduledDate))}.`
              : "We'll bring it on the next run."}
          </Text>

          <RowGroup>
            <Row title={shortOrderRef(params.orderId)} meta="Your order reference" chevron={false} />
            <Row
              title={order?.shop?.name ?? "Your shop"}
              meta={order?.itemDescription}
              chevron={false}
            />
            <Row
              title={order?.checkpoint?.name ?? "Your checkpoint"}
              meta="Meet your runner here"
              chevron={false}
            />
          </RowGroup>

          <View className="mt-6 rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">NEXT</Text>
            <Text className="font-sans text-body text-ink">
              We're texting you a six-digit code. Read it to your runner at the checkpoint to close
              the delivery — it's the only way to confirm you got your things.
            </Text>
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button
            label="Track this order"
            onPress={() => navigation.replace("OrderTracking", { orderId: params.orderId })}
          />
          <Button label="Back to home" variant="quiet" onPress={() => navigation.navigate("Tabs")} />
        </View>
      </ActionBar>
    </Screen>
  );
}
