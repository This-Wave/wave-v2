import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { Illustration, Rise } from "../../components/v7/Illustration";
import { CodeTicket } from "../../components/v7/Signature";
import { NotificationPrompt } from "../../components/NotificationSettings";
import { useDeliveryPin, useOrder } from "../../lib/orders";
import { formatFullDay } from "../../lib/pricing";
import {
  resetAfterOrderConfirmed,
  resetStudentTabs,
} from "../../lib/navigationFlows";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderConfirmed">;

/**
 * v7 "It's on." (canvas: Sent: the code). The peak of the flow (peak-end): the
 * running illustration, who we're collecting from, and the code ticket. The
 * code also stays on Tracking, where the student is when they need it.
 */
export function OrderConfirmedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const { data: pin } = useDeliveryPin(params.orderId, { pollUntilReady: true });
  const from = order?.senderName
    ? `${order.senderName}${order.originCheckpoint?.name ? ` in ${order.originCheckpoint.name}` : ""}`
    : (order?.originCheckpoint?.name ?? order?.shop?.name ?? null);

  return (
    <Screen narrow>
      <ScreenBody bottomInset={16}>
        <Gutter className="items-center pt-10" style={{ gap: 16 }}>
          <Rise>
            <Illustration name="run" width={240} height={180} />
          </Rise>
          <Rise delay={80}>
            <Text accessibilityRole="header" className="text-center font-display text-display text-ink">
              It's on.
            </Text>
          </Rise>
          <Rise delay={140}>
            <Text className="text-center font-sans text-ui text-muted" style={{ lineHeight: 24 }}>
              {from ? `We'll pick it up from ${from}.` : "We've got it from here."}
              {order?.scheduledDate ? ` Arrives ${formatFullDay(new Date(order.scheduledDate))}.` : ""}
            </Text>
          </Rise>
          <View className="w-full">
            <CodeTicket pin={pin ?? null} note="Show it at your pickup point" />
          </View>
          <Text className="font-sans text-meta text-muted">{shortOrderRef(params.orderId)}</Text>
          <NotificationPrompt />
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View style={{ gap: 10 }}>
          <Button label="Track it" onPress={() => resetAfterOrderConfirmed(navigation, params.orderId, "tracking")} />
          <Button label="Done" variant="ghost" onPress={() => resetStudentTabs(navigation, "Home")} />
        </View>
      </ActionBar>
    </Screen>
  );
}
