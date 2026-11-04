import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Button, Gutter, Row, RowGroup, Screen, ScreenBody } from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { formatFullDay } from "../../lib/pricing";
import {
  resetAfterOrderConfirmed,
  resetStudentTabs,
} from "../../lib/navigationFlows";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderConfirmed">;

/**
 * The moment after paying (canvas board 12): a green celebration, the same
 * shape as the rider's Delivered, so the peak of the flow feels like one
 * (Peak-End rule).
 *
 * The delivery code is deliberately NOT here any more. It is needed at the
 * checkpoint, hours later, and lives on Tracking, where the student will be
 * when they need it. Showing it now taught people to screenshot it.
 */
export function OrderConfirmedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);

  return (
    <Screen narrow className="bg-ink">
      <View className="flex-1 bg-ink">
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-16">
            <View className="mb-8 h-20 w-20 items-center justify-center rounded-pill bg-lime">
              <CheckIcon size={40} color={colors.ink} strokeWidth={2.6} />
            </View>

            <Text
              accessibilityRole="header"
              className="mb-2 font-sans-bold text-white"
              style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.2 }}
            >
              Order placed
            </Text>
            <Text className="mb-10 font-sans text-white" style={{ fontSize: 18, lineHeight: 24, opacity: 0.85 }}>
              {order?.scheduledDate ? formatFullDay(new Date(order.scheduledDate)) : "On the next Wave"}
            </Text>

            <RowGroup>
              <Row
                title={order?.shop?.name ?? "Your order"}
                meta={order?.itemDescription}
                chevron={false}
              />
              <Row
                title={order?.checkpoint?.name ?? "Your checkpoint"}
                meta={shortOrderRef(params.orderId)}
                chevron={false}
              />
            </RowGroup>
          </Gutter>
        </ScreenBody>

        <View className="gap-3 px-gutter pb-8 pt-3">
          <Button
            label="Track this order"
            onPress={() => resetAfterOrderConfirmed(navigation, params.orderId, "tracking")}
          />
          <Pressable
            onPress={() => resetStudentTabs(navigation, "Home")}
            accessibilityRole="button"
            className="min-h-[52px] items-center justify-center rounded-pill active:opacity-80"
            style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)" }}
          >
            <Text className="font-sans-medium text-ui text-white">Back to home</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
